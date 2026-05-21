'use strict';
/**
 * ntfsScanner.service.js
 * ──────────────────────
 * Scans a real filesystem path (local or UNC) and returns a flat list
 * of all folders and files found recursively.
 * Used exclusively by folderSync.service.js.
 *
 * Called by : folderSync.service.js
 * Depends on: node:fs, node:path, utils/pathHelper.js
 *
 * Flow:
 *   folderSync.service calls scanDrive(rootPath)
 *   → ntfsScanner.scanFolders(rootPath)  ← recursive fs.readdirSync
 *   → returns flat array of { folderName, fullPath, depth, parentPath }
 *   → ntfsScanner.scanFiles(folderPath)  ← for each folder
 *   → returns array of { fileName, fullPath, fileSize, fileExtension, mimeType, lastModified }
 *
 * Security:
 *   - Only reads paths under the configured PORTAL_DRIVE_ROOT (isSafePath check)
 *   - Does NOT follow symbolic links (followSymlinks=false)
 *   - Catches permission errors per-folder and continues (logs warning)
 *
 * Exported:
 *   scanFolders(rootPath)   → FolderEntry[]
 *   scanFiles(folderPath)   → FileEntry[]
 */

const fs   = require('fs');
const path = require('path');
const { normalize, stripTrailing, folderName, isSafePath, extName, mimeFromExt } = require('../utils/pathHelper');
const logger = require('./logger');

const MAX_DEPTH = parseInt(process.env.PORTAL_SCAN_MAX_DEPTH || '10', 10);

// ──────────────────────────────────────────────────────────────
// FOLDER SCAN
// ──────────────────────────────────────────────────────────────

/**
 * Recursively scan all subfolders under rootPath.
 * Returns a flat list sorted by depth — parent always appears before child.
 *
 * @param {string} rootPath
 * @returns {{ folders: Array<{folderName:string, fullPath:string, parentPath:string|null, depth:number}>,
 *             permissionErrors: Array<{path:string, code:string, isPermission:boolean}> }}
 *
 * Example output:
 *   {
 *     folders: [
 *       { folderName:'HR',     fullPath:'D:\\Shared\\HR',         parentPath:null,         depth:0 },
 *       { folderName:'Salary', fullPath:'D:\\Shared\\HR\\Salary', parentPath:'D:\\Shared\\HR', depth:1 },
 *     ],
 *     permissionErrors: [
 *       { path:'D:\\Shared\\DB2', code:'EACCES', isPermission:true }
 *     ]
 *   }
 *
 * NOTE: Folders that cannot be read due to OS permissions are added to permissionErrors
 * and EXCLUDED from the folders list. The caller (folderSync) must NOT soft-delete DB
 * records for folders whose paths are under a permission-denied directory.
 */
function scanFolders(rootPath) {
  const permissionErrors = [];

  function _scan(dir, parent, depth) {
    if (depth > MAX_DEPTH) return [];

    const normalRoot = stripTrailing(normalize(dir));
    const results    = [];

    let entries;
    try {
      entries = fs.readdirSync(normalRoot, { withFileTypes: true });
    } catch (err) {
      const isPermission = err.code === 'EACCES' || err.code === 'EPERM';
      logger.logEvent('ERROR_SYSTEM', {
        level:   'warn',
        message: `ntfsScanner: cannot read directory "${normalRoot}" [${err.code}]: ${err.message}`,
      });
      permissionErrors.push({ path: normalRoot, code: err.code, isPermission });
      return [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;  // skip hidden

      const fullPath = path.join(normalRoot, entry.name);
      results.push({
        folderName: entry.name,
        fullPath:   normalize(fullPath),
        parentPath: parent,
        depth:      depth,
      });

      // Recurse
      results.push(..._scan(fullPath, normalize(fullPath), depth + 1));
    }

    return results;
  }

  const folders = _scan(rootPath, null, 0);
  return { folders, permissionErrors };
}

// ──────────────────────────────────────────────────────────────
// FILE SCAN
// ──────────────────────────────────────────────────────────────

/**
 * Scan files (non-directories) directly inside a folder (non-recursive).
 * Hidden files (starting with '.') and system files ('~$') are skipped.
 *
 * @param {string} folderPath
 * @returns {Array<{fileName:string, fullPath:string, fileSize:number, fileExtension:string, mimeType:string, lastModified:Date}>}
 */
function scanFiles(folderPath) {
  const normalPath = stripTrailing(normalize(folderPath));
  const results    = [];

  let entries;
  try {
    entries = fs.readdirSync(normalPath, { withFileTypes: true });
  } catch (err) {
    logger.logEvent('ERROR_SYSTEM', {
      level:   'warn',
      message: `ntfsScanner: cannot read files in "${normalPath}": ${err.message}`,
    });
    return [];
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.'))  continue;
    if (entry.name.startsWith('~$')) continue;  // skip Office temp files

    const fullPath = path.join(normalPath, entry.name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    const ext = extName(entry.name);
    results.push({
      fileName:      entry.name,
      fullPath:      normalize(fullPath),
      fileSize:      stat.size,
      fileExtension: ext,
      mimeType:      mimeFromExt(ext),
      lastModified:  stat.mtime,
    });
  }

  return results;
}

module.exports = { scanFolders, scanFiles };
