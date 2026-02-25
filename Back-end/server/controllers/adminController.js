'use strict';

const { sql, getPool } = require('../config/database');
const logger = require('../services/logger');
const { validatePdfDomain } = require('../middlewares/pdfValidator');
const { validationResult } = require('express-validator');

function _getIp(req) {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function _validateRequest(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    return null;
}

function _logAdminAction(actionType, req, opts = {}) {
    logger.logEvent(actionType, {
        username:       req.user?.username,
        ip:             _getIp(req),
        userAgent:      req.get('user-agent'),
        entity:         opts.entity,
        entityId:       opts.entityId,
        executionTimeMs: opts.executionTimeMs,
        message:        opts.message,
    });
}

// ============================================================
// LEVEL 1
// ============================================================
async function createLevel1(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const { name, sortOrder } = req.body;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Name',       sql.NVarChar(200), name.trim())
            .input('SortOrder',  sql.Int, sortOrder ?? 0)
            .input('CreatedBy',  sql.NVarChar(100), req.user.username)
            .query(`
                INSERT INTO dbo.Categories_Level1 (Name, SortOrder, CreatedBy)
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.SortOrder, INSERTED.CreatedAt
                VALUES (@Name, @SortOrder, @CreatedBy)
            `);

        const row = result.recordset[0];
        _logAdminAction('ADMIN_CREATE', req, {
            entity: 'Categories_Level1', entityId: row.Id,
            executionTimeMs: Date.now() - start,
            message: `Created Level1: ${row.Name} (Id=${row.Id})`,
        });
        return res.status(201).json({ data: row });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ error: 'Category name already exists', code: 'DUPLICATE' });
        }
        next(err);
    }
}

async function updateLevel1(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const id = parseInt(req.params.id, 10);
    const { name, sortOrder } = req.body;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',         sql.Int, id)
            .input('Name',       sql.NVarChar(200), name.trim())
            .input('SortOrder',  sql.Int, sortOrder ?? 0)
            .input('UpdatedBy',  sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.Categories_Level1
                SET Name = @Name, SortOrder = @SortOrder, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.SortOrder, INSERTED.UpdatedAt
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.recordset.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_UPDATE', req, {
            entity: 'Categories_Level1', entityId: id,
            executionTimeMs: Date.now() - start,
            message: `Updated Level1 Id=${id}`,
        });
        return res.json({ data: result.recordset[0] });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ error: 'Category name already exists', code: 'DUPLICATE' });
        }
        next(err);
    }
}

async function deleteLevel1(req, res, next) {
    const start = Date.now();
    const id = parseInt(req.params.id, 10);

    try {
        const pool = await getPool();
        // Soft delete: cascades conceptually — children remain but Level1 is gone from menu
        const result = await pool.request()
            .input('Id',        sql.Int, id)
            .input('UpdatedBy', sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.Categories_Level1
                SET DeletedAt = SYSDATETIME(), IsActive = 0, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_DELETE', req, {
            entity: 'Categories_Level1', entityId: id,
            executionTimeMs: Date.now() - start,
            message: `Soft-deleted Level1 Id=${id}`,
        });
        return res.json({ message: 'Deleted successfully' });
    } catch (err) { next(err); }
}

// ============================================================
// LEVEL 2
// ============================================================
async function createLevel2(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const { level1Id, name, sortOrder, isEnabled } = req.body;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Level1Id',   sql.Int, level1Id)
            .input('Name',       sql.NVarChar(200), name.trim())
            .input('IsEnabled',  sql.Bit, isEnabled !== false ? 1 : 0)
            .input('SortOrder',  sql.Int, sortOrder ?? 0)
            .input('CreatedBy',  sql.NVarChar(100), req.user.username)
            .query(`
                INSERT INTO dbo.Categories_Level2 (Level1Id, Name, IsEnabled, SortOrder, CreatedBy)
                OUTPUT INSERTED.Id, INSERTED.Level1Id, INSERTED.Name, INSERTED.IsEnabled, INSERTED.SortOrder, INSERTED.CreatedAt
                VALUES (@Level1Id, @Name, @IsEnabled, @SortOrder, @CreatedBy)
            `);

        const row = result.recordset[0];
        _logAdminAction('ADMIN_CREATE', req, {
            entity: 'Categories_Level2', entityId: row.Id,
            executionTimeMs: Date.now() - start,
            message: `Created Level2: ${row.Name} (Id=${row.Id})`,
        });
        return res.status(201).json({ data: row });
    } catch (err) {
        if (err.number === 547) return res.status(400).json({ error: 'Invalid Level1Id', code: 'INVALID_FK' });
        next(err);
    }
}

async function updateLevel2(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const id = parseInt(req.params.id, 10);
    const { name, sortOrder } = req.body;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',         sql.Int, id)
            .input('Name',       sql.NVarChar(200), name.trim())
            .input('SortOrder',  sql.Int, sortOrder ?? 0)
            .input('UpdatedBy',  sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.Categories_Level2
                SET Name = @Name, SortOrder = @SortOrder, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.SortOrder, INSERTED.IsEnabled, INSERTED.UpdatedAt
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.recordset.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_UPDATE', req, {
            entity: 'Categories_Level2', entityId: id,
            executionTimeMs: Date.now() - start, message: `Updated Level2 Id=${id}`,
        });
        return res.json({ data: result.recordset[0] });
    } catch (err) { next(err); }
}

async function deleteLevel2(req, res, next) {
    const start = Date.now();
    const id = parseInt(req.params.id, 10);

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',        sql.Int, id)
            .input('UpdatedBy', sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.Categories_Level2
                SET DeletedAt = SYSDATETIME(), IsActive = 0, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_DELETE', req, {
            entity: 'Categories_Level2', entityId: id,
            executionTimeMs: Date.now() - start, message: `Soft-deleted Level2 Id=${id}`,
        });
        return res.json({ message: 'Deleted successfully' });
    } catch (err) { next(err); }
}

async function toggleLevel2(req, res, next) {
    const start = Date.now();
    const id = parseInt(req.params.id, 10);

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',        sql.Int, id)
            .input('UpdatedBy', sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.Categories_Level2
                SET IsEnabled = CASE WHEN IsEnabled = 1 THEN 0 ELSE 1 END,
                    UpdatedBy = @UpdatedBy,
                    UpdatedAt = SYSDATETIME()
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.IsEnabled, INSERTED.UpdatedAt
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.recordset.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        const row = result.recordset[0];
        _logAdminAction('ADMIN_UPDATE', req, {
            entity: 'Categories_Level2', entityId: id,
            executionTimeMs: Date.now() - start,
            message: `Toggled Level2 Id=${id} IsEnabled=${row.IsEnabled}`,
        });
        return res.json({ data: row });
    } catch (err) { next(err); }
}

// ============================================================
// KNOWLEDGE ITEMS
// ============================================================
async function createKnowledge(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const { level1Id, level2Id, title, displayMode, contentHtml, pdfUrl, sortOrder } = req.body;

    // Validate PDF domain
    if (pdfUrl) {
        const v = validatePdfDomain(pdfUrl);
        if (!v.valid) return res.status(400).json({ error: `Invalid PDF URL: ${v.reason}`, code: 'INVALID_PDF_URL' });
    }

    if (displayMode === 'PAGE' && !contentHtml) {
        return res.status(400).json({ error: 'contentHtml is required for PAGE mode', code: 'MISSING_CONTENT' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Level1Id',    sql.Int, level1Id)
            .input('Level2Id',    sql.Int, level2Id || null)
            .input('Title',       sql.NVarChar(500), title.trim())
            .input('DisplayMode', sql.NVarChar(10), displayMode)
            .input('ContentHtml', sql.NVarChar(sql.MAX), contentHtml || null)
            .input('PdfUrl',      sql.NVarChar(1000), pdfUrl || null)
            .input('SortOrder',   sql.Int, sortOrder ?? 0)
            .input('CreatedBy',   sql.NVarChar(100), req.user.username)
            .query(`
                INSERT INTO dbo.KnowledgeItems
                    (Level1Id, Level2Id, Title, DisplayMode, ContentHtml, PdfUrl, SortOrder, CreatedBy)
                OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.DisplayMode, INSERTED.CreatedAt
                VALUES (@Level1Id, @Level2Id, @Title, @DisplayMode, @ContentHtml, @PdfUrl, @SortOrder, @CreatedBy)
            `);

        const row = result.recordset[0];
        _logAdminAction('ADMIN_CREATE', req, {
            entity: 'KnowledgeItems', entityId: row.Id,
            executionTimeMs: Date.now() - start,
            message: `Created knowledge item: ${row.Title} (Id=${row.Id})`,
        });
        return res.status(201).json({ data: row });
    } catch (err) {
        if (err.number === 547) return res.status(400).json({ error: 'Invalid Level1Id or Level2Id', code: 'INVALID_FK' });
        next(err);
    }
}

async function updateKnowledge(req, res, next) {
    if (_validateRequest(req, res)) return;
    const start = Date.now();
    const id = parseInt(req.params.id, 10);
    const { level1Id, level2Id, title, displayMode, contentHtml, pdfUrl, sortOrder } = req.body;

    if (pdfUrl) {
        const v = validatePdfDomain(pdfUrl);
        if (!v.valid) return res.status(400).json({ error: `Invalid PDF URL: ${v.reason}`, code: 'INVALID_PDF_URL' });
    }

    if (displayMode === 'PAGE' && !contentHtml) {
        return res.status(400).json({ error: 'contentHtml is required for PAGE mode', code: 'MISSING_CONTENT' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',          sql.Int, id)
            .input('Level1Id',    sql.Int, level1Id)
            .input('Level2Id',    sql.Int, level2Id || null)
            .input('Title',       sql.NVarChar(500), title.trim())
            .input('DisplayMode', sql.NVarChar(10), displayMode)
            .input('ContentHtml', sql.NVarChar(sql.MAX), contentHtml || null)
            .input('PdfUrl',      sql.NVarChar(1000), pdfUrl || null)
            .input('SortOrder',   sql.Int, sortOrder ?? 0)
            .input('UpdatedBy',   sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.KnowledgeItems
                SET Level1Id = @Level1Id, Level2Id = @Level2Id, Title = @Title,
                    DisplayMode = @DisplayMode, ContentHtml = @ContentHtml, PdfUrl = @PdfUrl,
                    SortOrder = @SortOrder, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.DisplayMode, INSERTED.UpdatedAt
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.recordset.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_UPDATE', req, {
            entity: 'KnowledgeItems', entityId: id,
            executionTimeMs: Date.now() - start, message: `Updated knowledge item Id=${id}`,
        });
        return res.json({ data: result.recordset[0] });
    } catch (err) { next(err); }
}

async function deleteKnowledge(req, res, next) {
    const start = Date.now();
    const id = parseInt(req.params.id, 10);

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id',        sql.Int, id)
            .input('UpdatedBy', sql.NVarChar(100), req.user.username)
            .query(`
                UPDATE dbo.KnowledgeItems
                SET DeletedAt = SYSDATETIME(), IsActive = 0, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
                WHERE Id = @Id AND DeletedAt IS NULL
            `);

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

        _logAdminAction('ADMIN_DELETE', req, {
            entity: 'KnowledgeItems', entityId: id,
            executionTimeMs: Date.now() - start, message: `Soft-deleted knowledge item Id=${id}`,
        });
        return res.json({ message: 'Deleted successfully' });
    } catch (err) { next(err); }
}

module.exports = {
    createLevel1, updateLevel1, deleteLevel1,
    createLevel2, updateLevel2, deleteLevel2, toggleLevel2,
    createKnowledge, updateKnowledge, deleteKnowledge,
};
