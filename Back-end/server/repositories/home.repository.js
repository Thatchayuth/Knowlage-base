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
                   FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled, IsPinned,
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
// Transactions
// ──────────────────────────────────────────────────────────────

/** Request bound to `tx` when given, else a plain pool request. */
async function _request(tx) {
    if (tx) return tx.request();
    const pool = await getPool();
    return pool.request();
}

/**
 * Run `fn(tx)` inside one transaction — commit on success, rollback on throw.
 * The item/mapping write helpers below accept that `tx` as their last argument.
 */
async function withTransaction(fn) {
    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    try {
        const result = await fn(tx);
        await tx.commit();
        return result;
    } catch (err) {
        try { await tx.rollback(); } catch { /* already aborted by SQL Server */ }
        throw err;
    }
}

// ──────────────────────────────────────────────────────────────
// WRITE — Groups
// ──────────────────────────────────────────────────────────────

/** GroupKey from a title: ASCII UPPER_SNAKE, max 40 chars ('' for e.g. Thai-only titles). */
function _slugKey(title) {
    return String(title || '')
        .normalize('NFKD')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40)
        .replace(/_+$/, '');
}

/**
 * Create a group at the end of the list (SortOrder = max + 1).
 * GroupKey (NOT NULL, UNIQUE, NVARCHAR(50)) is generated from the title —
 * 'GROUP' when the title has no ASCII letters — suffixed _2, _3, … on
 * collision. The table is range-locked between the read and the insert.
 * @returns {Promise<{id:number, groupKey:string, sortOrder:number}>}
 */
async function createGroup(data) {
    return withTransaction(async (tx) => {
        const existing = await tx.request().query(`
            SELECT GroupKey, SortOrder FROM dbo.HomeGroups WITH (UPDLOCK, HOLDLOCK)
        `);
        const keys = new Set(existing.recordset.map(r => String(r.GroupKey).toUpperCase()));
        const maxOrder = existing.recordset.reduce((m, r) => Math.max(m, r.SortOrder ?? 0), 0);

        const base = _slugKey(data.title) || 'GROUP';
        let groupKey = base;
        for (let n = 2; keys.has(groupKey); n++) groupKey = `${base}_${n}`;

        const sortOrder = maxOrder + 1;
        const r = await tx.request()
            .input('GroupKey', sql.NVarChar(50),   groupKey)
            .input('Title',    sql.NVarChar(200),  data.title)
            .input('Subtitle', sql.NVarChar(300),  data.subtitle ?? null)
            .input('Icon',     sql.NVarChar(2000), data.icon ?? null)
            .input('Color',    sql.NVarChar(20),   data.color || 'blue')
            .input('SortOrder',sql.Int,            sortOrder)
            .input('IsEnabled',sql.Bit,            data.isEnabled !== false)
            .input('UpdatedBy',sql.NVarChar(100),  data.updatedBy || 'admin')
            .query(`
                INSERT INTO dbo.HomeGroups
                    (GroupKey, Title, Subtitle, Icon, Color, SortOrder, IsEnabled, UpdatedBy)
                OUTPUT INSERTED.Id
                VALUES
                    (@GroupKey, @Title, @Subtitle, @Icon, @Color, @SortOrder, @IsEnabled, @UpdatedBy)
            `);
        return { id: r.recordset[0]?.Id, groupKey, sortOrder };
    });
}

/** @returns {Promise<number>} rows affected (0 = not found) */
async function updateGroup(id, data) {
    const pool = await getPool();
    const r = await pool.request()
        .input('id',       sql.Int,           id)
        .input('Title',    sql.NVarChar(200),  data.title)
        .input('Subtitle', sql.NVarChar(300),  data.subtitle ?? null)
        .input('Icon',     sql.NVarChar(2000), data.icon ?? null)
        .input('Color',    sql.NVarChar(20),   data.color || 'blue')
        .input('SortOrder',sql.Int,            data.sortOrder ?? null) // null = keep current order
        .input('IsEnabled',sql.Bit,            data.isEnabled !== false)
        .input('UpdatedBy',sql.NVarChar(100),  data.updatedBy || 'admin')
        .query(`
            UPDATE dbo.HomeGroups
               SET Title = @Title,
                   Subtitle  = @Subtitle,
                   Icon      = @Icon,
                   Color     = @Color,
                   SortOrder = COALESCE(@SortOrder, SortOrder),
                   IsEnabled = @IsEnabled,
                   UpdatedAt = SYSDATETIME(),
                   UpdatedBy = @UpdatedBy
             WHERE Id = @id
        `);
    return r.rowsAffected[0] || 0;
}

/**
 * Delete a group with its items and their mappings in one transaction.
 * Children are deleted explicitly, so this works even on a database where
 * the FK cascades were not created.
 * @returns {Promise<number>} number of items deleted with the group
 * @throws Error with .code = 'NOT_FOUND' (nothing is deleted)
 */
async function deleteGroup(id) {
    return withTransaction(async (tx) => {
        await tx.request()
            .input('gid', sql.Int, id)
            .query(`
                DELETE m
                  FROM dbo.HomeItemFileMappings m
                  JOIN dbo.HomeItems i ON i.Id = m.ItemId
                 WHERE i.GroupId = @gid
            `);
        const items = await tx.request()
            .input('gid', sql.Int, id)
            .query(`DELETE FROM dbo.HomeItems WHERE GroupId = @gid`);
        const grp = await tx.request()
            .input('id', sql.Int, id)
            .query(`DELETE FROM dbo.HomeGroups WHERE Id = @id`);
        if (!grp.rowsAffected[0]) {
            const err = new Error('Group not found');
            err.code = 'NOT_FOUND';
            throw err; // rolls back
        }
        return items.rowsAffected[0] || 0;
    });
}

/**
 * Set SortOrder for many groups in one transaction.
 * @param {Array<{id:number, sortOrder:number}>} order
 * @returns {Promise<number>} number of groups updated (unknown ids are ignored)
 */
async function reorderGroups(order = [], updatedBy = 'admin') {
    return withTransaction(async (tx) => {
        let updated = 0;
        for (const o of order) {
            const r = await tx.request()
                .input('id',        sql.Int,           o.id)
                .input('SortOrder', sql.Int,           o.sortOrder)
                .input('UpdatedBy', sql.NVarChar(100), updatedBy)
                .query(`
                    UPDATE dbo.HomeGroups
                       SET SortOrder = @SortOrder,
                           UpdatedAt = SYSDATETIME(),
                           UpdatedBy = @UpdatedBy
                     WHERE Id = @id
                `);
            updated += r.rowsAffected[0] || 0;
        }
        return updated;
    });
}

// ──────────────────────────────────────────────────────────────
// WRITE — Items
// ──────────────────────────────────────────────────────────────

async function createItem(data, tx) {
    const req = await _request(tx);
    const r = await req
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
        .input('IsPinned',    sql.Bit,            data.isPinned === true)
        .input('UpdatedBy',   sql.NVarChar(100),  data.updatedBy || 'admin')
        .query(`
            INSERT INTO dbo.HomeItems
                (GroupId, Title, Subtitle, Icon, LinkType, ProgramType,
                 FolderId, KnowledgeId, ExternalUrl, SortOrder, IsEnabled, IsPinned, UpdatedBy)
            OUTPUT INSERTED.Id
            VALUES
                (@GroupId, @Title, @Subtitle, @Icon, @LinkType, @ProgramType,
                 @FolderId, @KnowledgeId, @ExternalUrl, @SortOrder, @IsEnabled, @IsPinned, @UpdatedBy)
        `);
    return r.recordset[0]?.Id;
}

/** @returns {Promise<number>} rows affected (0 = not found) */
async function updateItem(id, data, tx) {
    const req = await _request(tx);
    const r = await req
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
        .input('IsPinned',    sql.Bit,            data.isPinned === true)
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
                   IsPinned    = @IsPinned,
                   UpdatedAt   = SYSDATETIME(),
                   UpdatedBy   = @UpdatedBy
             WHERE Id = @id
        `);
    return r.rowsAffected[0] || 0;
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

async function _replaceMappingsTx(tx, itemId, mappings) {
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
}

/** Replace all mappings of an item. Joins `tx` when given, else runs its own transaction. */
async function replaceMappings(itemId, mappings = [], tx) {
    if (tx) return _replaceMappingsTx(tx, itemId, mappings);
    return withTransaction(t => _replaceMappingsTx(t, itemId, mappings));
}

module.exports = {
    getAllGroups,
    getGroupById,
    getItemsByGroup,
    getItemById,
    getMappingsByItem,
    getMappingsForItems,
    withTransaction,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    createItem,
    updateItem,
    deleteItem,
    replaceMappings,
};
