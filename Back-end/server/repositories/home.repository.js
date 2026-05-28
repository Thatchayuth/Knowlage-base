'use strict';
/**
 * home.repository.js
 * ──────────────────
 * Data-access layer for the Home Columns feature
 * (HomeGroups / HomeItems / HomeItemFileMappings).
 */

const { sql, getPool } = require('../config/database');

// ──────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────

/** Return all groups (admin: includeDisabled=true; public: only enabled). */
async function getAllGroups(includeDisabled = false) {
    const pool = await getPool();
    const where = includeDisabled ? '' : 'WHERE IsEnabled = 1';
    const result = await pool.request().query(`
        SELECT Id, GroupKey, Title, Subtitle, Icon, Color, SortOrder, IsEnabled,
               CreatedAt, UpdatedAt, UpdatedBy
        FROM   dbo.HomeGroups
        ${where}
        ORDER  BY SortOrder, Id
    `);
    return result.recordset;
}

async function getGroupById(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM dbo.HomeGroups WHERE Id = @id`);
    return r.recordset[0] || null;
}

/** Items for a single group, ordered. */
async function getItemsByGroup(groupId, includeDisabled = false) {
    const pool = await getPool();
    const where = includeDisabled ? '' : 'AND IsEnabled = 1';
    const r = await pool.request()
        .input('gid', sql.Int, groupId)
        .query(`
            SELECT Id, GroupId, Title, Subtitle, Icon, LinkType, ProgramType,
                   FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled,
                   CreatedAt, UpdatedAt, UpdatedBy
            FROM   dbo.HomeItems
            WHERE  GroupId = @gid ${where}
            ORDER  BY SortOrder, Id
        `);
    return r.recordset;
}

async function getItemById(id) {
    const pool = await getPool();
    const r = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM dbo.HomeItems WHERE Id = @id`);
    return r.recordset[0] || null;
}

/** All AD-group → filePath mappings for a single item. */
async function getMappingsByItem(itemId) {
    const pool = await getPool();
    const r = await pool.request()
        .input('iid', sql.Int, itemId)
        .query(`
            SELECT Id, ItemId, AdGroup, FilePath, SortOrder, CreatedAt
            FROM   dbo.HomeItemFileMappings
            WHERE  ItemId = @iid
            ORDER  BY SortOrder, Id
        `);
    return r.recordset;
}

/** Bulk fetch mappings for many items. Returns Map<itemId, mappings[]> */
async function getMappingsForItems(itemIds = []) {
    if (!itemIds.length) return new Map();
    const pool = await getPool();
    // Sanitize to integers (safe to inline) — STRING_SPLIT is unavailable on older compat levels.
    const safeIds = itemIds.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
    if (!safeIds.length) return new Map();
    const inList = safeIds.join(',');
    const r = await pool.request()
        .query(`
            SELECT Id, ItemId, AdGroup, FilePath, SortOrder
            FROM   dbo.HomeItemFileMappings
            WHERE  ItemId IN (${inList})
            ORDER  BY ItemId, SortOrder, Id
        `);
    const map = new Map();
    for (const row of r.recordset) {
        if (!map.has(row.ItemId)) map.set(row.ItemId, []);
        map.get(row.ItemId).push(row);
    }
    return map;
}

// ──────────────────────────────────────────────────────────────
// WRITE — Groups
// ──────────────────────────────────────────────────────────────

async function updateGroup(id, data) {
    const pool = await getPool();
    await pool.request()
        .input('id',       sql.Int,           id)
        .input('Title',    sql.NVarChar(200),  data.title)
        .input('Subtitle', sql.NVarChar(300),  data.subtitle ?? null)
        .input('Icon',     sql.NVarChar(2000), data.icon ?? null)
        .input('Color',    sql.NVarChar(20),   data.color || 'blue')
        .input('SortOrder',sql.Int,            data.sortOrder ?? 0)
        .input('IsEnabled',sql.Bit,            data.isEnabled !== false)
        .input('UpdatedBy',sql.NVarChar(100),  data.updatedBy || 'admin')
        .query(`
            UPDATE dbo.HomeGroups
               SET Title = @Title,
                   Subtitle  = @Subtitle,
                   Icon      = @Icon,
                   Color     = @Color,
                   SortOrder = @SortOrder,
                   IsEnabled = @IsEnabled,
                   UpdatedAt = SYSDATETIME(),
                   UpdatedBy = @UpdatedBy
             WHERE Id = @id
        `);
}

// ──────────────────────────────────────────────────────────────
// WRITE — Items
// ──────────────────────────────────────────────────────────────

async function createItem(data) {
    const pool = await getPool();
    const r = await pool.request()
        .input('GroupId',     sql.Int,           data.groupId)
        .input('Title',       sql.NVarChar(200),  data.title)
        .input('Subtitle',    sql.NVarChar(300),  data.subtitle ?? null)
        .input('Icon',        sql.NVarChar(2000), data.icon ?? null)
        .input('LinkType',    sql.NVarChar(30),   data.linkType)
        .input('ProgramType', sql.NVarChar(50),   data.programType ?? null)
        .input('FolderId',    sql.Int,            data.folderId ?? null)
        .input('KnowledgeId', sql.Int,            data.knowledgeId ?? null)
        .input('ExternalUrl', sql.NVarChar(2000), data.externalUrl ?? null)
        .input('SortOrder',   sql.Int,            data.sortOrder ?? 0)
        .input('IsEnabled',   sql.Bit,            data.isEnabled !== false)
        .input('UpdatedBy',   sql.NVarChar(100),  data.updatedBy || 'admin')
        .query(`
            INSERT INTO dbo.HomeItems
                (GroupId, Title, Subtitle, Icon, LinkType, ProgramType,
                 FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled, UpdatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@GroupId, @Title, @Subtitle, @Icon, @LinkType, @ProgramType,
                 @FolderId, @KnowledgeId, @ExternalUrl, @SortOrder, @IsEnabled, @UpdatedBy)
        `);
    return r.recordset[0]?.Id;
}

async function updateItem(id, data) {
    const pool = await getPool();
    await pool.request()
        .input('id',          sql.Int,           id)
        .input('Title',       sql.NVarChar(200),  data.title)
        .input('Subtitle',    sql.NVarChar(300),  data.subtitle ?? null)
        .input('Icon',        sql.NVarChar(2000), data.icon ?? null)
        .input('LinkType',    sql.NVarChar(30),   data.linkType)
        .input('ProgramType', sql.NVarChar(50),   data.programType ?? null)
        .input('FolderId',    sql.Int,            data.folderId ?? null)
        .input('KnowledgeId', sql.Int,            data.knowledgeId ?? null)
        .input('ExternalUrl', sql.NVarChar(2000), data.externalUrl ?? null)
        .input('SortOrder',   sql.Int,            data.sortOrder ?? 0)
        .input('IsEnabled',   sql.Bit,            data.isEnabled !== false)
        .input('UpdatedBy',   sql.NVarChar(100),  data.updatedBy || 'admin')
        .query(`
            UPDATE dbo.HomeItems
               SET Title       = @Title,
                   Subtitle    = @Subtitle,
                   Icon        = @Icon,
                   LinkType    = @LinkType,
                   ProgramType = @ProgramType,
                   FolderId    = @FolderId,
                   KnowledgeId = @KnowledgeId,
                   ExternalUrl = @ExternalUrl,
                   SortOrder   = @SortOrder,
                   IsEnabled   = @IsEnabled,
                   UpdatedAt   = SYSDATETIME(),
                   UpdatedBy   = @UpdatedBy
             WHERE Id = @id
        `);
}

async function deleteItem(id) {
    const pool = await getPool();
    await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM dbo.HomeItems WHERE Id = @id`);
}

// ──────────────────────────────────────────────────────────────
// WRITE — Mappings
// ──────────────────────────────────────────────────────────────

async function replaceMappings(itemId, mappings = []) {
    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    try {
        await tx.request()
            .input('iid', sql.Int, itemId)
            .query(`DELETE FROM dbo.HomeItemFileMappings WHERE ItemId = @iid`);
        let order = 0;
        for (const m of mappings) {
            if (!m.adGroup || !m.filePath) continue;
            await tx.request()
                .input('iid',      sql.Int,            itemId)
                .input('AdGroup',  sql.NVarChar(200),  String(m.adGroup).trim())
                .input('FilePath', sql.NVarChar(1000), String(m.filePath).trim())
                .input('SortOrder',sql.Int,            order++)
                .query(`
                    INSERT INTO dbo.HomeItemFileMappings (ItemId, AdGroup, FilePath, SortOrder)
                    VALUES (@iid, @AdGroup, @FilePath, @SortOrder)
                `);
        }
        await tx.commit();
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}

module.exports = {
    getAllGroups,
    getGroupById,
    getItemsByGroup,
    getItemById,
    getMappingsByItem,
    getMappingsForItems,
    updateGroup,
    createItem,
    updateItem,
    deleteItem,
    replaceMappings,
};
