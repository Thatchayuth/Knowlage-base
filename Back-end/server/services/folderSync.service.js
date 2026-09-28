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
 *      (paths compared case-insensitively via pathHelper.pathKey)
 *   2. folderRepo.getAllPaths()            → dbPaths  = [{Id, FullPath}] from DB
 *   3. Compare:
 *        NEW:     in scanned but not in dbPaths → upsertByPath(INSERT)
 *        UPDATED: in both                       → upsertByPath(UPDATE)
 *        DELETED: in dbPaths but not in scanned → deleteFolder (soft)
 *   4. For each folder: scanFiles + upsertFile + markInactiveNotIn
 *   5. Flush all caches
 *   6. Return summary { inserted, updated, deleted, filesScanned, errors[] }
 *
 * NOTE: sync only ever READS the filesystem (readdir/stat). It never creates,
 * renames or deletes anything on disk. "deleted" refers to DB rows only.
 *
 * Step 5 acts on DB rows under the root being synced and on nothing else.
 * The DB holds rows from more than one root (e.g. a second share mounted
 * separately), and those rows are absent from this scan by definition — without
 * the scope check a sync of one root would soft-delete every other root.
 *
 * Exported:
 *   syncDrive(rootPath, adminUser, ip, opts)  → SyncResult
 *   opts.dryRun = true  → report what WOULD change and write nothing at all
 *   isSyncRunning()     → true while a sync holds the in-process lock
 *   SYNC_IN_PROGRESS    → err.code thrown (status 409) when a sync is already running
 */

const scanner    = require('./ntfsScanner.service');
const folderRepo = require('../repositories/folder.repository');
const fileRepo   = require('../repositories/fileMetadata.repository');
// NOTE: sync uses softDeleteFolder (IsActive=0) — never hard-deletes during sync
//       so that FolderPermissions are preserved when a folder temporarily disappears.
const auditRepo  = require('../repositories/auditLog.repository');
const cache      = require('./cache.service');
const path       = require('path');
const { stripTrailing, normalize, pathKey, isSameOrUnder } = require('../utils/pathHelper');
const logger = require('./logger');

/**
 * True when dbPath is the synced root itself or sits inside it.
 * Case-insensitive and segment-aware (see pathHelper.isSameOrUnder).
 */
function isUnderRoot(dbPath, rootNorm) {
  return isSameOrUnder(dbPath, rootNorm);
}

// ── In-process sync lock ──────────────────────────────────────
// Admin sync, /api/portal/sync (syncuser) and the auto-sync timer all call
// syncDrive(). Two overlapping runs would race on upsert/soft-delete, so only
// one may run at a time; a second caller fails fast with SYNC_IN_PROGRESS.
const SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS';
let _running = null;   // { rootPath, by, startedAt } while a sync is running

/** True while a sync is running in this process. */
function isSyncRunning() {
  return _running !== null;
}

/**
 * Run full sync for the given root drive path — guarded by the in-process lock.
 * Throws an Error with code 'SYNC_IN_PROGRESS' (status 409) if a sync is already running.
 * Same signature/return value as _syncDriveUnlocked below.
 */
async function syncDrive(rootPath, adminUser, ip, opts = {}) {
  // Check-and-set happens synchronously (before any await), so it is race-free
  // within this single Node.js process.
  if (_running) {
    const err = new Error('กำลัง Sync อยู่ กรุณารอให้เสร็จก่อน');
    err.code   = SYNC_IN_PROGRESS;
    err.status = 409;
    err.runningSince = _running.startedAt;
    err.runningBy    = _running.by;
    throw err;
  }
  _running = { rootPath, by: adminUser, startedAt: new Date() };
  try {
    return await _syncDriveUnlocked(rootPath, adminUser, ip, opts);
  } finally {
    _running = null;
  }
}

/**
 * Run full sync for the given root drive path.
 *
 * @param {string} rootPath   - e.g. 'D:\\Shared' or '\\\\fileserver\\dept'
 * @param {string} adminUser  - for audit log
 * @param {string} ip         - for audit log
 * @param {{dryRun?:boolean}} [opts] - dryRun reports changes without writing
 * @returns {Promise<{inserted:number,updated:number,deleted:number,filesScanned:number,durationMs:number,errors:string[]}>}
 */
async function _syncDriveUnlocked(rootPath, adminUser, ip, opts = {}) {
  const dryRun    = opts.dryRun === true;
  const startTime = Date.now();
  const errors    = [];
  let inserted = 0, updated = 0, deleted = 0, filesScanned = 0;

  // Paths a real run would have soft-deleted — the point of a dry run.
  const wouldDelete = [];
  // Rows skipped because they belong to a different root than the one synced.
  const outOfScope  = [];

  logger.logEvent('ERROR_SYSTEM', {
    message: `[SYNC]${dryRun ? ' [DRY-RUN]' : ''} Starting sync for: ${rootPath}`,
    username: adminUser,
  });

  // ── Step 2 (done first): Get all DB paths
  const dbPaths    = await folderRepo.getAllPaths();
  // Store full record (Id + IsManual + ParentId) so Step 5 can skip manual folders
  const dbPathMap  = new Map(dbPaths.map(r => [pathKey(r.FullPath), r]));

  // If the root already exists in DB under different casing (e.g. typed 'd:\shared\hr'
  // for 'D:\Shared\HR'), scan using the DB spelling so FolderName / new FullPaths
  // keep the canonical casing instead of whatever was typed.
  const typedKey    = pathKey(rootPath);
  const knownRoot   = dbPathMap.get(typedKey);
  const scanRoot    = knownRoot ? knownRoot.FullPath : rootPath;
  const rootNorm    = stripTrailing(normalize(scanRoot));
  const rootName    = path.basename(rootNorm) || rootNorm;

  // ── Step 1: Scan filesystem (subfolders)
  const { folders: scanned, permissionErrors: scanPermErrors } = scanner.scanFolders(scanRoot);
  // All "same folder?" lookups below use pathKey() (normalized + lowercased):
  // NTFS and the DB collation are case-insensitive, so a root typed as
  // 'd:\shared' must still match rows stored as 'D:\Shared' — otherwise Step 5
  // would treat every live folder as missing and soft-delete it.
  const scannedPaths = new Set(scanned.map(f => pathKey(f.fullPath)));

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
  const rootKey = pathKey(rootNorm);
  scannedPaths.add(rootKey);

  // Build a lookup: pathKey → db Id (populated as we upsert)
  const pathToId = new Map(dbPaths.map(r => [pathKey(r.FullPath), r.Id]));

  // The root may be a subfolder of an already-synced tree (override root).
  // In that case the root row must keep its existing ParentId/SortOrder, and
  // its direct subfolders (scanner depth 0, parentPath=null) belong under the
  // root row — not at top level — or this sync would detach them.
  const existingRoot = dbPathMap.get(rootKey) || null;
  const isNestedRoot = dbPaths.some(r => {
    const k = pathKey(r.FullPath);
    return k !== rootKey && isSameOrUnder(rootKey, k);
  });

  // ── Step 2b: Always upsert rootPath itself as a folder entry
  //    (top-level when new; an existing row keeps its current parent)
  let rootId = existingRoot ? existingRoot.Id : null;
  try {
    if (dryRun) {
      if (rootId) updated++; else inserted++;
    } else {
      const { id, isNew } = await folderRepo.upsertByPath({
        folderName: rootName,
        fullPath:   rootNorm,
        parentId:   existingRoot ? (existingRoot.ParentId ?? null) : null,
        sortOrder:  existingRoot ? (existingRoot.SortOrder ?? 0) : 0,
      });
      rootId = id;
      pathToId.set(rootKey, rootId);
      if (isNew) inserted++; else updated++;
    }

    // Scan files directly inside rootPath
    const rootFiles  = scanner.scanFiles(scanRoot);
    const rootFilePaths = [];
    for (const file of rootFiles) {
      try {
        if (!dryRun) await fileRepo.upsertFile({ folderId: rootId, ...file });
        rootFilePaths.push(file.fullPath);
        filesScanned++;
      } catch (fErr) {
        errors.push(`File ${file.fullPath}: ${fErr.message}`);
      }
    }
    if (!dryRun) await fileRepo.markInactiveNotIn(rootId, rootFilePaths);
  } catch (err) {
    errors.push(`Root folder ${rootNorm}: ${err.message}`);
  }

  // ── Step 3: Upsert folders from disk into DB (BFS order — parents first)
  for (const folder of scanned) {
    try {
      // Resolve parent ID from already-processed paths.
      // Depth-0 folders (parentPath=null) stay top-level for a normal root sync,
      // but hang under the root row when the root is a nested (override) folder.
      const parentId = folder.parentPath
        ? (pathToId.get(pathKey(folder.parentPath)) || null)
        : (isNestedRoot ? rootId : null);

      let id;
      if (dryRun) {
        id = pathToId.get(pathKey(folder.fullPath)) || null;
        if (id) updated++; else inserted++;
      } else {
        const res = await folderRepo.upsertByPath({
          folderName: folder.folderName,
          fullPath:   folder.fullPath,
          parentId,
          sortOrder:  folder.depth * 10,
        });
        id = res.id;
        pathToId.set(pathKey(folder.fullPath), id);
        if (res.isNew) inserted++; else updated++;
      }

      // ── Step 4: Sync files within this folder
      const fileList = scanner.scanFiles(folder.fullPath);
      const filePaths = [];
      for (const file of fileList) {
        try {
          if (!dryRun) await fileRepo.upsertFile({ folderId: id, ...file });
          filePaths.push(file.fullPath);
          filesScanned++;
        } catch (fErr) {
          errors.push(`File ${file.fullPath}: ${fErr.message}`);
        }
      }
      if (!dryRun) await fileRepo.markInactiveNotIn(id, filePaths);

    } catch (err) {
      errors.push(`Folder ${folder.fullPath}: ${err.message}`);
    }
  }

  // ── Step 5: Soft-delete DB folders no longer on disk
  // IMPORTANT: skip folders whose path is under a permission-denied directory —
  // they still exist on disk, we just couldn't read them. Deleting them from DB
  // would cause data loss that cannot be recovered by re-syncing alone.
  // dbPathMap keys are pathKey()s (lowercased) — use dbRecord.FullPath for display.
  for (const [dbKey, dbRecord] of dbPathMap.entries()) {
    if (!scannedPaths.has(dbKey)) {
      const dbPath = normalize(dbRecord.FullPath);

      // Skip rows belonging to another root. This scan says nothing about
      // them, so their absence here is not evidence that they are gone.
      if (!isUnderRoot(dbPath, rootNorm)) {
        outOfScope.push(dbPath);
        continue;
      }

      // Skip manually-created folders — they are not expected to exist on disk.
      // IsManual=1 means added via Admin UI, not discovered by sync.
      if (dbRecord.IsManual) continue;

      // Already soft-deleted by an earlier sync — nothing to do, don't recount it.
      if (dbRecord.IsActive === false || dbRecord.IsActive === 0) continue;

      // Check if this db path is under any permission-denied directory (case-insensitive)
      const underDenied = [...permissionDeniedPaths].some(denied => isSameOrUnder(dbPath, denied));
      if (underDenied) {
        errors.push(`SKIPPED delete "${dbPath}" — parent directory is not readable by this process (permission denied). Grant read access to fix.`);
        continue;
      }
      try {
        wouldDelete.push({ id: dbRecord.Id, path: dbPath });
        // Soft-delete only — preserves FolderPermissions so they don't need to be
        // re-configured if the folder returns on disk (upsertByPath will re-activate it).
        if (!dryRun) await folderRepo.softDeleteFolder(dbRecord.Id);
        deleted++;
      } catch (err) {
        errors.push(`Delete ${dbPath}: ${err.message}`);
      }
    }
  }

  // ── Step 6: Flush all caches so next request gets fresh data
  if (!dryRun) cache.flush();

  const durationMs = Date.now() - startTime;

  // ── Audit
  await auditRepo.log({
    username:     adminUser,
    action:       dryRun ? 'SYNC_DRYRUN' : 'SYNC',
    resourceType: 'FOLDER',
    resourcePath: rootPath,
    details:      { dryRun, inserted, updated, deleted, filesScanned, durationMs, errors: errors.length },
    ipAddress:    ip,
  });

  logger.logEvent('ERROR_SYSTEM', {
    message: `[SYNC]${dryRun ? ' [DRY-RUN]' : ''} Completed: inserted=${inserted}, updated=${updated}, deleted=${deleted}, files=${filesScanned}, outOfScope=${outOfScope.length}, errors=${errors.length}, duration=${durationMs}ms`,
    username: adminUser,
  });

  return {
    dryRun,
    rootPath: rootNorm,
    inserted, updated, deleted, filesScanned, durationMs, errors,
    permissionErrors: [...permissionDeniedPaths],
    wouldDelete,   // rows a real run soft-deletes (same list either way)
    outOfScope,    // rows left alone because they belong to another root
  };
}

module.exports = { syncDrive, isSyncRunning, SYNC_IN_PROGRESS };
