'use strict';
/**
 * folder.repository.js
 * ────────────────────
 * Data-access layer — ALL SQL for the Folders table lives here.
 * No SQL string is written in service/controller/route layers.
 *
 * Called by : folder.service.js, folderSync.service.js
 * Depends on: config/database.js (shared MSSQL connection pool), mssql
 *
 * Flow:
 *   Service → repository.method(params) → MSSQL query → recordset → Service
 *
 * Exported functions:
 *   getAllFolders()
 *   getFolderById(id)
 *   getChildren(parentId)
 *   getSubtree(folderId)        ← recursive CTE
 *   createFolder(data)
 *   updateFolder(id, data)
 *   deleteFolder(id)            ← soft delete (IsActive=0)
 *   upsertByPath(data)          ← MERGE by FullPath — used by sync
 *   getAllPaths()                ← returns [{Id, FullPath}] for sync diff
 */

const { sql, getPool } = require('../config/database');

// ──────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────

async function getAllFolders() {
  const pool   = await getPool();
  const result = await pool.request().query(`
    SELECT Id, FolderName, FullPath, ParentId, SortOrder, Icon, IsActive, IsHidden, Description
    FROM   dbo.Folders
    WHERE  IsActive = 1 AND IsHidden = 0
    ORDER  BY SortOrder, FolderName
  `);
  return result.recordset;
}

async function getFolderById(id) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM dbo.Folders WHERE Id = @id');
  return result.recordset[0] || null;
}

/** Fetch direct children of a parent — used for lazy loading in sidebar. */
async function getChildren(parentId) {
  const pool = await getPool();
  const req  = pool.request();
  let query;
  if (parentId == null) {
    query = `SELECT Id, FolderName, FullPath, ParentId, SortOrder, Icon, IsActive, IsHidden, Description FROM dbo.Folders WHERE ParentId IS NULL AND IsActive = 1 AND IsHidden = 0 ORDER BY SortOrder, FolderName`;
  } else {
    req.input('pid', sql.Int, parentId);
    query = `SELECT Id, FolderName, FullPath, ParentId, SortOrder, Icon, IsActive, IsHidden, Description FROM dbo.Folders WHERE ParentId = @pid AND IsActive = 1 AND IsHidden = 0 ORDER BY SortOrder, FolderName`;
  }
  return (await req.query(query)).recordset;
}

/**
 * Recursive CTE — fetch entire subtree rooted at folderId.
 * Returns flat list with Depth column; service calls buildTree() on it.
 *
 * Pattern:
 *   WITH FolderTree AS (
 *     anchor: WHERE ParentId IS NULL (or specific id)
 *     UNION ALL
 *     recursive: INNER JOIN FolderTree
 *   )
 */
async function getSubtree(folderId = null) {
  const pool = await getPool();
  const req  = pool.request();
  const anchor = folderId == null
    ? 'WHERE f.ParentId IS NULL'
    : (req.input('rootId', sql.Int, folderId), 'WHERE f.Id = @rootId');

  const result = await req.query(`
    WITH FolderTree AS (
      SELECT f.Id, f.FolderName, f.FullPath, f.ParentId,
             f.SortOrder, f.Icon, f.IsActive, f.IsHidden, f.Description, 0 AS Depth
      FROM   dbo.Folders f ${anchor}
      UNION ALL
      SELECT f.Id, f.FolderName, f.FullPath, f.ParentId,
             f.SortOrder, f.Icon, f.IsActive, f.IsHidden, f.Description, ft.Depth + 1
      FROM   dbo.Folders f
      INNER JOIN FolderTree ft ON f.ParentId = ft.Id
    )
    SELECT * FROM FolderTree ORDER BY Depth, SortOrder, FolderName
  `);
  return result.recordset;
}

// ──────────────────────────────────────────────────────────────
// WRITE
// ──────────────────────────────────────────────────────────────

async function createFolder({ folderName, fullPath, parentId = null, sortOrder = 0, icon = 'folder', description = null }) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('name',   sql.NVarChar(255),  folderName)
    .input('path',   sql.NVarChar(1000), fullPath)
    .input('parent', sql.Int,            parentId)
    .input('sort',   sql.Int,            sortOrder)
    .input('icon',   sql.NVarChar(50),   icon)
    .input('desc',   sql.NVarChar(500),  description)
    .query(`
      INSERT INTO dbo.Folders (FolderName, FullPath, ParentId, SortOrder, Icon, Description, IsManual)
      OUTPUT INSERTED.Id
      VALUES (@name, @path, @parent, @sort, @icon, @desc, 1)
    `);
  return result.recordset[0].Id;
}

async function updateFolder(id, { folderName, sortOrder, icon, isHidden, description }) {
  const pool = await getPool();
  await pool.request()
    .input('id',     sql.Int,           id)
    .input('name',   sql.NVarChar(255), folderName  != null ? String(folderName).trim() : null)
    .input('sort',   sql.Int,           sortOrder   != null ? sortOrder   : null)
    .input('icon',   sql.NVarChar(50),  icon        != null ? icon        : null)
    .input('hidden', sql.Bit,           isHidden    != null ? (isHidden ? 1 : 0) : null)
    .input('desc',   sql.NVarChar(500), description != null ? description : null)
    .query(`
      UPDATE dbo.Folders
      SET    FolderName  = COALESCE(@name,   FolderName),
             SortOrder   = COALESCE(@sort,   SortOrder),
             Icon        = COALESCE(@icon,   Icon),
             IsHidden    = COALESCE(@hidden, IsHidden),
             Description = COALESCE(@desc,   Description),
             UpdatedAt   = GETDATE()
      WHERE  Id = @id
    `);
}

/** Hard-delete a folder and ALL its descendants, including their permissions and file metadata.
 *  Uses a recursive CTE to collect every descendant ID, then deletes in the correct order
 *  to satisfy the self-referential FK (FK_Folders_Parent: Folders.ParentId → Folders.Id).
 */
async function deleteFolder(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // ── 1. Collect the target folder + all descendants via recursive CTE
    const { recordset } = await new sql.Request(transaction)
      .input('id', sql.Int, id)
      .query(`
        WITH descendants AS (
          SELECT Id FROM dbo.Folders WHERE Id = @id
          UNION ALL
          SELECT f.Id FROM dbo.Folders f
          INNER JOIN descendants d ON f.ParentId = d.Id
        )
        SELECT Id FROM descendants
      `);

    if (recordset.length === 0) {
      await transaction.commit();
      return;
    }

    // Build a safe integer list (all values come from our own DB query, not user input)
    const idList = recordset.map(r => r.Id).join(',');

    // ── 2. Delete dependent records first
    await new sql.Request(transaction)
      .query(`DELETE FROM dbo.FolderPermissions WHERE FolderId IN (${idList})`);

    await new sql.Request(transaction)
      .query(`DELETE FROM dbo.FileMetadata WHERE FolderId IN (${idList})`);

    // ── 3. Break the self-referential FK by nulling ParentId for ALL affected folders.
    //       This allows a single DELETE to remove them without ordering constraints.
    await new sql.Request(transaction)
      .query(`UPDATE dbo.Folders SET ParentId = NULL WHERE Id IN (${idList})`);

    // ── 4. Now delete all folders safely
    await new sql.Request(transaction)
      .query(`DELETE FROM dbo.Folders WHERE Id IN (${idList})`);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// SYNC
// ──────────────────────────────────────────────────────────────

/**
 * Atomic upsert by FullPath — used during drive sync.
 * SQL MERGE: if path exists → UPDATE, else → INSERT.
 *
 * @returns {Promise<{id:number, isNew:boolean}>}
 */
async function upsertByPath({ folderName, fullPath, parentId = null, sortOrder = 0, icon = 'folder' }) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('name',   sql.NVarChar(255),  folderName)
    .input('path',   sql.NVarChar(1000), fullPath)
    .input('parent', sql.Int,            parentId)
    .input('sort',   sql.Int,            sortOrder)
    .input('icon',   sql.NVarChar(50),   icon)
    .query(`
      MERGE dbo.Folders AS target
      USING (SELECT @path AS FullPath) AS src ON target.FullPath = src.FullPath
      WHEN MATCHED THEN
        -- FolderName updated to real filesystem name; DisplayName intentionally preserved
        -- IsManual reset to 0: folder confirmed to exist on disk, no longer manual-only
        UPDATE SET FolderName=@name, ParentId=@parent, SortOrder=@sort, IsActive=1, IsManual=0, UpdatedAt=GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (FolderName, FullPath, ParentId, SortOrder, Icon, IsManual)
        VALUES (@name, @path, @parent, @sort, @icon, 0)
      OUTPUT INSERTED.Id, CASE WHEN $action='INSERT' THEN 1 ELSE 0 END AS IsNew;
    `);
  const row = result.recordset[0];
  return { id: row.Id, isNew: Boolean(row.IsNew) };
}

/** All FullPaths in DB — for sync diff against filesystem.
 *  Returns IsManual so sync can skip soft-delete on manually-created folders. */
async function getAllPaths() {
  const pool   = await getPool();
  const result = await pool.request().query('SELECT Id, FullPath, IsManual FROM dbo.Folders');
  return result.recordset;
}

/**
 * Soft-delete a folder (IsActive = 0) WITHOUT touching FolderPermissions or FileMetadata.
 * Used by the sync process so that permissions are preserved if the folder returns later.
 * When the folder is detected on disk again, upsertByPath will SET IsActive=1 and restore it.
 */
async function softDeleteFolder(id) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.Folders
      SET    IsActive  = 0,
             UpdatedAt = GETDATE()
      WHERE  Id = @id
    `);
}

module.exports = {
  getAllFolders,
  getFolderById,
  getChildren,
  getSubtree,
  createFolder,
  updateFolder,
  deleteFolder,
  softDeleteFolder,
  upsertByPath,
  getAllPaths,
};
