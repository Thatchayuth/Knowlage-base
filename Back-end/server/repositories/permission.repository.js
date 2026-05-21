'use strict';
/**
 * permission.repository.js
 * ────────────────────────
 * Data-access layer for FolderPermissions table.
 *
 * Called by : permission.service.js, folder.service.js (getPermissionMap)
 * Depends on: config/database.js
 *
 * Exported:
 *   getByFolder(folderId)
 *   getPermissionMap()                     → Map<folderId, string[]>
 *   upsertPermission(data)
 *   deletePermission(folderId, adGroup)
 *   deleteAllForFolder(folderId)
 *   getUserFolderPermission(folderId, groups)
 */

const { sql, getPool } = require('../config/database');

async function getByFolder(folderId) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('fid', sql.Int, folderId)
    .query('SELECT * FROM dbo.FolderPermissions WHERE FolderId = @fid ORDER BY AdGroup');
  return result.recordset;
}

/**
 * Build a full permission Map in ONE DB call.
 * Returns Map<folderId:number → adGroups:string[]> where groups are lowercase.
 * Used by folder.service.js to filter tree without per-node DB hits.
 */
async function getPermissionMap() {
  const pool   = await getPool();
  const result = await pool.request()
    .query('SELECT FolderId, AdGroup FROM dbo.FolderPermissions WHERE CanView = 1');

  const map = new Map();
  for (const row of result.recordset) {
    if (!map.has(row.FolderId)) map.set(row.FolderId, []);
    map.get(row.FolderId).push(row.AdGroup.toLowerCase());
  }
  return map;
}

/** Upsert by (FolderId, AdGroup) — MERGE statement. */
async function upsertPermission({ folderId, adGroup, canView = true, canUpload = false, canDelete = false }) {
  const pool = await getPool();
  await pool.request()
    .input('fid',    sql.Int,           folderId)
    .input('grp',    sql.NVarChar(255), adGroup)
    .input('view',   sql.Bit,           canView   ? 1 : 0)
    .input('upload', sql.Bit,           canUpload ? 1 : 0)
    .input('del',    sql.Bit,           canDelete ? 1 : 0)
    .query(`
      MERGE dbo.FolderPermissions AS target
      USING (SELECT @fid AS FolderId, @grp AS AdGroup) AS src
        ON target.FolderId = src.FolderId AND target.AdGroup = src.AdGroup
      WHEN MATCHED THEN
        UPDATE SET CanView=@view, CanUpload=@upload, CanDelete=@del, UpdatedAt=GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (FolderId, AdGroup, CanView, CanUpload, CanDelete)
        VALUES (@fid, @grp, @view, @upload, @del);
    `);
}

async function deletePermission(folderId, adGroup) {
  const pool = await getPool();
  await pool.request()
    .input('fid', sql.Int,           folderId)
    .input('grp', sql.NVarChar(255), adGroup)
    .query('DELETE FROM dbo.FolderPermissions WHERE FolderId = @fid AND AdGroup = @grp');
}

async function deleteAllForFolder(folderId) {
  const pool = await getPool();
  await pool.request()
    .input('fid', sql.Int, folderId)
    .query('DELETE FROM dbo.FolderPermissions WHERE FolderId = @fid');
}

/**
 * Point-check: does any of the user's groups have CanView on this folder?
 * Used by permission.middleware.js for per-request validation.
 *
 * @param {number}   folderId
 * @param {string[]} groups   user's AD groups (case-insensitive)
 * @returns {Promise<boolean>}
 */
async function getUserFolderPermission(folderId, groups) {
  if (!groups?.length) return false;
  const pool = await getPool();
  const req  = pool.request().input('fid', sql.Int, folderId);
  groups.forEach((g, i) => req.input(`g${i}`, sql.NVarChar(255), g.toLowerCase()));
  const inList = groups.map((_, i) => `@g${i}`).join(',');
  const result = await req.query(`
    SELECT TOP 1 1 AS HasAccess
    FROM dbo.FolderPermissions
    WHERE FolderId = @fid AND CanView = 1 AND LOWER(AdGroup) IN (${inList})
  `);
  return result.recordset.length > 0;
}

module.exports = {
  getByFolder,
  getPermissionMap,
  upsertPermission,
  deletePermission,
  deleteAllForFolder,
  getUserFolderPermission,
};
