'use strict';

const { sql, getPool } = require('../config/database');
const logger = require('../services/logger');

function _getIp(req) {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

// ============================================================
// GET /api/search?q=keyword
// Uses MSSQL Full-Text Search with CONTAINSTABLE
// Falls back to LIKE if FTS unavailable
// ============================================================
async function search(req, res, next) {
    const startTime = Date.now();
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    if (!q) {
        return res.status(400).json({ error: 'Search query (q) is required', code: 'MISSING_QUERY' });
    }

    if (q.length > 200) {
        return res.status(400).json({ error: 'Query too long (max 200 chars)', code: 'QUERY_TOO_LONG' });
    }

    try {
        const pool = await getPool();

        let results = [];
        let usedFTS = true;

        try {
            // Try Full-Text Search first
            const ftResult = await pool.request()
                .input('SearchTerm', sql.NVarChar(500), q)
                .input('MaxResults', sql.Int, limit * page)
                .execute('dbo.usp_SearchKnowledge');

            results = ftResult.recordset || [];
        } catch (ftsErr) {
            // FTS not ready or error — fallback to LIKE
            usedFTS = false;
            logger.logEvent('ERROR_SYSTEM', {
                level:   'warn',
                message: `FTS search failed, falling back to LIKE: ${ftsErr.message}`,
            });

            const likeResult = await pool.request()
                .input('SearchTerm', sql.NVarChar(500), q)
                .input('MaxResults', sql.Int, limit * page)
                .execute('dbo.usp_SearchKnowledgeLike');

            results = likeResult.recordset || [];
        }

        // Paginate in memory
        const offset = (page - 1) * limit;
        const paged  = results.slice(offset, offset + limit);
        const total  = results.length;

        const executionTimeMs = Date.now() - startTime;

        logger.logEvent('SEARCH_QUERY', {
            username:        req.user?.username || 'anonymous',
            ip:              _getIp(req),
            userAgent:       req.get('user-agent'),
            executionTimeMs,
            message:         `Search: "${q}" → ${total} results`,
            meta:            { query: q, total, usedFTS },
        });

        return res.json({
            data: {
                query:          q,
                usedFullText:   usedFTS,
                totalResults:   total,
                page,
                limit,
                results:        paged.map(r => ({
                    id:          r.Id,
                    title:       r.Title,
                    displayMode: r.DisplayMode,
                    level1Id:    r.Level1Id,
                    level2Id:    r.Level2Id,
                    snippet:     _cleanSnippet(r.Snippet),
                    rank:        r.SearchRank || 0,
                    updatedAt:   r.UpdatedAt,
                })),
            },
        });
    } catch (err) {
        next(err);
    }
}

function _cleanSnippet(raw) {
    if (!raw) return '';
    // Strip HTML tags for clean preview
    return raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 300);
}

module.exports = { search };
