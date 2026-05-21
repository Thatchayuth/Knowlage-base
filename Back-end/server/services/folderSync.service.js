'use strict';
/**
 * folderSync.service.js
 * ─────────────────────
 * Orchestrates the full sync cycle between the real Shared Drive and the DB.
 * Called by sync.controller.js (POST /api/portal/folders/sync).
 *
 * Called by : sync.controller.js
 * Depends on: services/ntfsScanner.service.js
 *             repositories/folder.repository.js
 *             repositories/fileMetadata.repository.js
 *             repositories/auditLog.repository.js
 *             services/cache.service.js
 *             utils/pathHelper.js
 *
 * Sync Algorithm (for folders):
 *   1. ntfsScanner.scanFolders(rootPath)  → scanned = flat list from disk
 *   2. folderRepo.getAllPaths()            → dbPaths  = [{Id, FullPath}] from DB
 *   3. Compare:
 *        NEW:     in scanned but not in dbPaths → upsertByPath(INSERT)
 *        UPDATED: in both                       → upsertByPath(UPDATE)
 *        DELETED: in dbPaths but not in scanned → deleteFolder (soft)
 *   4. For each folder: scanFiles + upsertFile + markInactiveNotIn
 *   5. Flush all caches
 *   6. Return summary { inserted, updated, deleted, filesScanned, errors[] }
 *
 * Exported:
 *   syncDrive(rootPath, adminUser, ip)  → SyncResult
 */

const scanner    = require('./ntfsScanner.service');
const folderRepo = require('../repositories/folder.repository');
const fileRepo   = require('../repositories/fileMetadata.repository');
// NOTE: sync uses softDeleteFolder (IsActive=0) — never hard-deletes during sync
//       so that FolderPermissions are preserved when a folder temporarily disappears.
const auditRepo  = require('../repositories/auditLog.repository');
const cache      = require('./cache.service');
const path       = require('path');
const { stripTrailing, normalize } = require('../utils/pathHelper');
const logger = require('./logger');

/**
 * Run full sync for the given root drive path.
 *
 * @param {string} rootPath   - e.g. 'D:\\Shared' or '\\\\fileserver\\dept'
 * @param {string} adminUser  - for audit log
 * @param {string} ip         - for audit log
 * @returns {Promise<{inserted:number,updated:number,deleted:number,filesScanned:number,durationMs:number,errors:string[]}>}
 */
async function syncDrive(rootPath, adminUser, ip) {
  const startTime = Date.now();
  const errors    = [];
  let inserted = 0, updated = 0, deleted = 0, filesScanned = 0;

  logger.logEvent('ERROR_SYSTEM', {
    message: `[SYNC] Starting sync for: ${rootPath}`,
    username: adminUser,
  });

  const rootNorm = stripTrailing(normalize(rootPath));
  const rootName = path.basename(rootNorm) || rootNorm;

  // ── Step 1: Scan filesystem (subfolders)
  const { folders: scanned, permissionErrors: scanPermErrors } = scanner.scanFolders(rootPath);
  const scannedPaths = new Set(scanned.map(f => normalize(f.fullPath)));

  // Paths that were inaccessible due to OS-level permission denial.
  // We must NOT soft-delete DB records whose paths are under these directories —
  // they were skipped by the scanner, not actually deleted from disk.
  const permissionDeniedPaths = new Set(
    scanPermErrors.filter(e => e.isPermission).map(e => normalize(e.path))
  );

  if (permissionDeniedPaths.size > 0) {
    logger.logEvent('ERROR_SYSTEM', {
      level:   'warn',
      message: `[SYNC] ${permissionDeniedPaths.size} folder(s) skipped — process has no read permission. Grant the Node.js service account read access to these paths: ${[...permissionDeniedPaths].join(', ')}`,
      username: adminUser,
    });
  }

  // Include the root path itself so root-level files are also tracked
  scannedPaths.add(rootNorm);

  // ── Step 2: Get all DB paths
  const dbPaths    = await folderRepo.getAllPaths();
  // Store full record (Id + IsManual) so Step 5 can skip manual folders
  const dbPathMap  = new Map(dbPaths.map(r => [normalize(r.FullPath), r]));

  // Build a lookup: fullPath → db Id (populated as we upsert)
  const pathToId = new Map(dbPaths.map(r => [normalize(r.FullPath), r.Id]));

  // ── Step 2b: Always upsert rootPath itself as a top-level folder entry
  try {
    const { id: rootId, isNew: rootIsNew } = await folderRepo.upsertByPath({
      folderName: rootName,
      fullPath:   rootNorm,
      parentId:   null,
      sortOrder:  0,
    });
    pathToId.set(rootNorm, rootId);
    if (rootIsNew) inserted++; else updated++;

    // Scan files directly inside rootPath
    const rootFiles  = scanner.scanFiles(rootPath);
    const rootFilePaths = [];
    for (const file of rootFiles) {
      try {
        await fileRepo.upsertFile({ folderId: rootId, ...file });
        rootFilePaths.push(file.fullPath);
        filesScanned++;
      } catch (fErr) {
        errors.push(`File ${file.fullPath}: ${fErr.message}`);
      }
    }
    await fileRepo.markInactiveNotIn(rootId, rootFilePaths);
  } catch (err) {
    errors.push(`Root folder ${rootNorm}: ${err.message}`);
  }

  // ── Step 3: Upsert folders from disk into DB (BFS order — parents first)
  for (const folder of scanned) {
    try {
      // Resolve parent ID from already-processed paths
      const parentId = folder.parentPath
        ? (pathToId.get(normalize(folder.parentPath)) || null)
        : null;

      const { id, isNew } = await folderRepo.upsertByPath({
        folderName: folder.folderName,
        fullPath:   folder.fullPath,
        parentId,
        sortOrder:  folder.depth * 10,
      });

      pathToId.set(normalize(folder.fullPath), id);
      if (isNew) inserted++; else updated++;

      // ── Step 4: Sync files within this folder
      const fileList = scanner.scanFiles(folder.fullPath);
      const filePaths = [];
      for (const file of fileList) {
        try {
          await fileRepo.upsertFile({ folderId: id, ...file });
          filePaths.push(file.fullPath);
          filesScanned++;
        } catch (fErr) {
          errors.push(`File ${file.fullPath}: ${fErr.message}`);
        }
      }
      await fileRepo.markInactiveNotIn(id, filePaths);

    } catch (err) {
      errors.push(`Folder ${folder.fullPath}: ${err.message}`);
    }
  }

  // ── Step 5: Soft-delete DB folders no longer on disk
  // IMPORTANT: skip folders whose path is under a permission-denied directory —
  // they still exist on disk, we just couldn't read them. Deleting them from DB
  // would cause data loss that cannot be recovered by re-syncing alone.
  for (const [dbPath, dbRecord] of dbPathMap.entries()) {
    if (!scannedPaths.has(dbPath)) {
      // Skip manually-created folders — they are not expected to exist on disk.
      // IsManual=1 means added via Admin UI, not discovered by sync.
      if (dbRecord.IsManual) continue;

      // Check if this db path is under any permission-denied directory
      const underDenied = [...permissionDeniedPaths].some(
        denied => dbPath === denied || dbPath.startsWith(denied + path.sep) || dbPath.startsWith(denied + '/')
      );
      if (underDenied) {
        errors.push(`SKIPPED delete "${dbPath}" — parent directory is not readable by this process (permission denied). Grant read access to fix.`);
        continue;
      }
      try {
        // Soft-delete only — preserves FolderPermissions so they don't need to be
        // re-configured if the folder returns on disk (upsertByPath will re-activate it).
        await folderRepo.softDeleteFolder(dbRecord.Id);
        deleted++;
      } catch (err) {
        errors.push(`Delete ${dbPath}: ${err.message}`);
      }
    }
  }

  // ── Step 6: Flush all caches so next request gets fresh data
  cache.flush();

  const durationMs = Date.now() - startTime;

  // ── Audit
  await auditRepo.log({
    username:     adminUser,
    action:       'SYNC',
    resourceType: 'FOLDER',
    resourcePath: rootPath,
    details:      { inserted, updated, deleted, filesScanned, durationMs, errors: errors.length },
    ipAddress:    ip,
  });

  logger.logEvent('ERROR_SYSTEM', {
    message: `[SYNC] Completed: inserted=${inserted}, updated=${updated}, deleted=${deleted}, files=${filesScanned}, errors=${errors.length}, duration=${durationMs}ms`,
    username: adminUser,
  });

  return { inserted, updated, deleted, filesScanned, durationMs, errors, permissionErrors: [...permissionDeniedPaths] };
}

module.exports = { syncDrive };
