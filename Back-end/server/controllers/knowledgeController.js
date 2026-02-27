'use strict';

const { sql, getPool } = require('../config/database');
const logger = require('../services/logger');
const { validatePdfDomain } = require('../middlewares/pdfValidator');

function _getIp(req) {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

// ============================================================
// GET /api/menu
// Returns hierarchical menu respecting Level2.IsEnabled rule
// ============================================================
async function getMenu(req, res, next) {
    try {
        const pool = await getPool();

        // Fetch all active Level1 categories
        const l1Result = await pool.request().query(`
            SELECT Id, Name, SortOrder, Icon
            FROM dbo.Categories_Level1
            WHERE IsActive = 1 AND DeletedAt IS NULL
            ORDER BY SortOrder, Name
        `);

        // Fetch all active Level2 categories with IsEnabled flag
        const l2Result = await pool.request().query(`
            SELECT Id, Level1Id, Name, Icon, IsEnabled, SortOrder
            FROM dbo.Categories_Level2
            WHERE IsActive = 1 AND DeletedAt IS NULL
            ORDER BY Level1Id, SortOrder, Name
        `);

        // Fetch knowledge items - if Level2 is disabled, item shows directly under Level1
        const kiResult = await pool.request().query(`
            SELECT ki.Id, ki.Level1Id, ki.Level2Id, ki.Title, ki.DisplayMode, ki.SortOrder,
                   ki.Highlight,
                   COALESCE(l2.IsEnabled, 1) AS Level2IsEnabled
            FROM dbo.KnowledgeItems ki
            LEFT JOIN dbo.Categories_Level2 l2 ON ki.Level2Id = l2.Id AND l2.DeletedAt IS NULL
            WHERE ki.IsActive = 1 AND ki.DeletedAt IS NULL
            ORDER BY ki.Level1Id, ki.Level2Id, ki.SortOrder, ki.Title
        `);

        // Build menu structure
        const l2Map = {};
        for (const row of l2Result.recordset) {
            if (!l2Map[row.Level1Id]) l2Map[row.Level1Id] = [];
            l2Map[row.Level1Id].push({ ...row, items: [] });
        }

        // Map knowledge items
        // Rule: if Level2.IsEnabled = false → attach item directly to Level1 (Level2Id = null in response)
        const l1KiMap = {};
        const l2KiMap = {};
        for (const ki of kiResult.recordset) {
            const level2Active = ki.Level2Id && Boolean(ki.Level2IsEnabled)
            const mappedItem = { id: ki.Id, title: ki.Title, displayMode: ki.DisplayMode, highlight: Boolean(ki.Highlight) }
            if (level2Active) {
                if (!l2KiMap[ki.Level2Id]) l2KiMap[ki.Level2Id] = [];
                l2KiMap[ki.Level2Id].push(mappedItem);
            } else {
                if (!l1KiMap[ki.Level1Id]) l1KiMap[ki.Level1Id] = [];
                l1KiMap[ki.Level1Id].push(mappedItem);
            }
        }

        const menu = l1Result.recordset.map(l1 => {
            const level2 = (l2Map[l1.Id] || [])
                .filter(l2 => l2.IsEnabled)   // only show enabled L2 in menu
                .map(l2 => ({
                    id:        l2.Id,
                    name:      l2.Name,
                    icon:      l2.Icon,
                    sortOrder: l2.SortOrder,
                    items:     l2KiMap[l2.Id] || [],
                }));

            return {
                id:        l1.Id,
                name:      l1.Name,
                icon:      l1.Icon,
                sortOrder: l1.SortOrder,
                level2,
                directItems: l1KiMap[l1.Id] || [],
            };
        });

        return res.json({ data: menu });
    } catch (err) {
        next(err);
    }
}

// ============================================================
// GET /api/knowledge/:id
// ============================================================
async function getKnowledgeById(req, res, next) {
    const startTime = Date.now();
    const id = parseInt(req.params.id, 10);
    if (!id || id < 1) {
        return res.status(400).json({ error: 'Invalid knowledge ID', code: 'INVALID_ID' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', sql.Int, id)
            .query(`
                SELECT ki.Id, ki.Title, ki.DisplayMode, ki.ContentHtml, ki.PdfUrl, ki.VideoUrl, ki.Highlight,
                       ki.Level1Id, l1.Name AS Level1Name,
                       ki.Level2Id, l2.Name AS Level2Name,
                       ki.ViewCount, ki.CreatedAt, ki.UpdatedAt
                FROM dbo.KnowledgeItems ki
                INNER JOIN dbo.Categories_Level1 l1 ON ki.Level1Id = l1.Id
                LEFT JOIN dbo.Categories_Level2 l2 ON ki.Level2Id = l2.Id
                WHERE ki.Id = @Id AND ki.IsActive = 1 AND ki.DeletedAt IS NULL
            `);

        if (!result.recordset.length) {
            return res.status(404).json({ error: 'Knowledge item not found', code: 'NOT_FOUND' });
        }

        const item = result.recordset[0];

        // Increment view count (fire and forget)
        pool.request()
            .input('KnowledgeId', sql.Int, id)
            .execute('dbo.usp_IncrementViewCount')
            .catch(() => {});

        // Validate PDF URL before returning
        if (item.PdfUrl) {
            const validation = validatePdfDomain(item.PdfUrl);
            if (!validation.valid) {
                logger.logEvent('ERROR_SYSTEM', {
                    level:    'warn',
                    username: req.user?.username,
                    entityId: id,
                    entity:   'KnowledgeItems',
                    message:  `Invalid PDF domain for item ${id}: ${validation.reason}`,
                });
                item.PdfUrl = null;
            }
        }

        logger.logEvent('VIEW_KNOWLEDGE', {
            username:        req.user?.username || 'anonymous',
            ip:              _getIp(req),
            userAgent:       req.get('user-agent'),
            entity:          'KnowledgeItems',
            entityId:        id,
            executionTimeMs: Date.now() - startTime,
            message:         `Viewed knowledge item ${id}: ${item.Title}`,
        });

        item.Highlight = Boolean(item.Highlight);
        return res.json({ data: item });
    } catch (err) {
        next(err);
    }
}

async function getFeaturedKnowledge(req, res, next) {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TOP 24 ki.Id, ki.Title, ki.Highlight, ki.ViewCount, ki.UpdatedAt,
                   ki.Level1Id, l1.Name AS Level1Name,
                   ki.Level2Id, l2.Name AS Level2Name
            FROM dbo.KnowledgeItems ki
            INNER JOIN dbo.Categories_Level1 l1 ON ki.Level1Id = l1.Id
            LEFT JOIN dbo.Categories_Level2 l2 ON ki.Level2Id = l2.Id
            WHERE ki.IsActive = 1 AND ki.DeletedAt IS NULL
            ORDER BY ki.Highlight DESC, ki.ViewCount DESC, ki.UpdatedAt DESC
        `);

        const items = [];
        const seen = new Set();
        for (const row of result.recordset) {
            if (seen.has(row.Id)) continue;
            seen.add(row.Id);
            items.push({
                id: row.Id,
                title: row.Title,
                highlight: Boolean(row.Highlight),
                viewCount: row.ViewCount,
                updatedAt: row.UpdatedAt,
                level1Id: row.Level1Id,
                level1Name: row.Level1Name,
                level2Id: row.Level2Id,
                level2Name: row.Level2Name,
            });
            if (items.length >= 10) break;
        }

        return res.json({ data: items });
    } catch (err) {
        next(err);
    }
}

module.exports = { getMenu, getKnowledgeById, getFeaturedKnowledge };
