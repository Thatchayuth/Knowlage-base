'use strict';
/**
 * fileMetadata.repository.js
 * ──────────────────────────
 * Data-access layer for FileMetadata table.
 * Stores file names/sizes/types from drive scans.
 * Actual file bytes are served directly from the Shared Drive — not from DB.
 *
 * Called by : folderSync.service.js (write during sync)
 *             folder.service.js     (read for file listing)
 * Depends on: config/database.js
 */

const { sql, getPool } = require('../config/database');

/** Get all active files in a folder (for GET /api/portal/folders/:id/files). */
async function getByFolder(folderId) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('fid', sql.Int, folderId)
    .query(`
      SELECT Id, FolderId, FileName, FullPath, FileSize, FileExtension, MimeType, LastModified
      FROM   dbo.FileMetadata
      WHERE  FolderId = @fid AND IsActive = 1
      ORDER  BY FileName
    `);
  return result.recordset;
}

/** Upsert file by FullPath (MERGE). Returns file Id. */
async function upsertFile({ folderId, fileName, fullPath, fileSize = 0, fileExtension, mimeType, lastModified }) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('fid',  sql.Int,            folderId)
    .input('name', sql.NVarChar(255),  fileName)
    .input('path', sql.NVarChar(1000), fullPath)
    .input('size', sql.BigInt,         fileSize)
    .input('ext',  sql.NVarChar(20),   fileExtension || null)
    .input('mime', sql.NVarChar(100),  mimeType      || null)
    .input('mod',  sql.DateTime2,      lastModified  || null)
    .query(`
      MERGE dbo.FileMetadata AS target
      USING (SELECT @path AS FullPath) AS src ON target.FullPath = src.FullPath
      WHEN MATCHED THEN
        UPDATE SET FileName=@name, FolderId=@fid, FileSize=@size,
                   FileExtension=@ext, MimeType=@mime, LastModified=@mod,
                   IsActive=1, UpdatedAt=GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (FolderId, FileName, FullPath, FileSize, FileExtension, MimeType, LastModified)
        VALUES (@fid, @name, @path, @size, @ext, @mime, @mod)
      OUTPUT INSERTED.Id;
    `);
  return result.recordset[0]?.Id;
}

/** Mark files not in activePaths list as inactive (for deleted-file sync). */
async function markInactiveNotIn(folderId, activePaths) {
  const pool = await getPool();
  if (!activePaths.length) {
    await pool.request().input('fid', sql.Int, folderId)
      .query('UPDATE dbo.FileMetadata SET IsActive=0 WHERE FolderId=@fid');
    return;
  }
  const req = pool.request().input('fid', sql.Int, folderId);
  activePaths.forEach((p, i) => req.input(`p${i}`, sql.NVarChar(1000), p));
  const inList = activePaths.map((_, i) => `@p${i}`).join(',');
  await req.query(`
    UPDATE dbo.FileMetadata
    SET    IsActive = 0
    WHERE  FolderId = @fid AND FullPath NOT IN (${inList})
  `);
}

async function deleteByFolder(folderId) {
  const pool = await getPool();
  await pool.request().input('fid', sql.Int, folderId)
    .query('DELETE FROM dbo.FileMetadata WHERE FolderId = @fid');
}

/** Get a single file record by Id (used by file-serve endpoint). */
async function getFileById(id) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, FolderId, FileName, FullPath, FileSize, FileExtension, MimeType, LastModified
      FROM   dbo.FileMetadata
      WHERE  Id = @id AND IsActive = 1
    `);
  return result.recordset[0] || null;
}

/**
 * Search files by filename (LIKE) within a specific set of folder IDs.
 * @param {string}   q         - search keyword
 * @param {number[]} folderIds - IDs of folders the user can access
 * @param {number}   limit     - max results to return
 */
async function searchFiles(q, folderIds, limit = 50) {
  if (!folderIds.length) return [];
  const pool = await getPool();
  const req  = pool.request();
  req.input('q',   sql.NVarChar(260), `%${q}%`);
  req.input('lim', sql.Int,           limit);
  folderIds.forEach((id, i) => req.input(`fid${i}`, sql.Int, id));
  const inClause = folderIds.map((_, i) => `@fid${i}`).join(',');
  const result = await req.query(`
    SELECT TOP (@lim)
           f.Id, f.FolderId, f.FileName, f.FullPath,
           f.FileSize, f.FileExtension, f.MimeType, f.LastModified,
           fo.FolderName, fo.FullPath AS FolderPath
    FROM   dbo.FileMetadata f
    INNER  JOIN dbo.Folders fo ON f.FolderId = fo.Id
    WHERE  f.IsActive = 1 AND fo.IsActive = 1
      AND  f.FolderId IN (${inClause})
      AND  f.FileName LIKE @q
    ORDER  BY f.FileName
  `);
  return result.recordset;
}

/**
 * Search files by filename (LIKE) across ALL active folders (admin use only).
 * @param {string} q     - search keyword
 * @param {number} limit - max results
 */
async function searchFilesAll(q, limit = 50) {
  const pool = await getPool();
  const result = await pool.request()
    .input('q',   sql.NVarChar(260), `%${q}%`)
    .input('lim', sql.Int,           limit)
    .query(`
      SELECT TOP (@lim)
             f.Id, f.FolderId, f.FileName, f.FullPath,
             f.FileSize, f.FileExtension, f.MimeType, f.LastModified,
             fo.FolderName, fo.FullPath AS FolderPath
      FROM   dbo.FileMetadata f
      INNER  JOIN dbo.Folders fo ON f.FolderId = fo.Id
      WHERE  f.IsActive = 1 AND fo.IsActive = 1
        AND  f.FileName LIKE @q
      ORDER  BY f.FileName
    `);
  return result.recordset;
}

module.exports = { getByFolder, getFileById, upsertFile, markInactiveNotIn, deleteByFolder, searchFiles, searchFilesAll };
