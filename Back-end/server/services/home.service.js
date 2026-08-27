'use strict';
/**
 * home.service.js
 * ───────────────
 * Business logic for Home Columns dashboard.
 *
 * For public (user-facing) reads:
 *   - Hide disabled groups/items.
 *   - Filter `folder`-typed items by canAccessFolder() so users only see
 *     folders they can read (re-uses Folders permission system).
 *   - For `program` items: pick the FilePath whose AdGroup matches the user's
 *     AD groups (case-insensitive). If no match → return filePath=null
 *     (item still shown but disabled / "no access" indicator).
 *   - For `knowledge` items: include linkable info (title + id).
 *   - For `external_link` items: include URL.
 */

const fsp  = require('fs').promises;
const path = require('path');

const homeRepo     = require('../repositories/home.repository');
const folderRepo   = require('../repositories/folder.repository');
const folderService = require('./folder.service');
const cache        = require('./cache.service');

const { sql, getPool } = require('../config/database');

// Same rule as the kmportal launcher: only UNC or absolute drive paths.
const SAFE_DIR_RE = /^(\\\\|[A-Za-z]:\\)/;

const HOME_TTL_MS = 60 * 1000; // 1 min cache (admin edits invalidate)

function _normalizeGroups(userGroups = []) {
    return (userGroups || []).map(g => String(g).toLowerCase().trim()).filter(Boolean);
}

/** Pick best filePath for current user from mapping list (first match wins). */
function _resolveFilePathForUser(mappings, userGroupsLower) {
    if (!mappings || !mappings.length) return null;
    for (const m of mappings) {
        if (userGroupsLower.includes(String(m.AdGroup).toLowerCase().trim())) {
            return m.FilePath;
        }
    }
    return null;
}

/** Helper: fetch knowledge titles for a list of ids — minimal for display. */
async function _getKnowledgeTitles(ids = []) {
    if (!ids.length) return new Map();
    const safeIds = ids.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
    if (!safeIds.length) return new Map();
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT Id, Title, DisplayMode
        FROM   dbo.KnowledgeItems
        WHERE  IsActive = 1
          AND  Id IN (${safeIds.join(',')})
    `);
    const map = new Map();
    for (const row of r.recordset) map.set(row.Id, row);
    return map;
}

/** Helper: fetch folder summary for a list of ids. */
async function _getFolderSummaries(ids = []) {
    if (!ids.length) return new Map();
    const safeIds = ids.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
    if (!safeIds.length) return new Map();
    const pool = await getPool();
    const r = await pool.request().query(`
        SELECT Id, FolderName, FullPath, ParentId, Icon, Description
        FROM   dbo.Folders
        WHERE  IsActive = 1
          AND  Id IN (${safeIds.join(',')})
    `);
    console.log(`SELECT Id, FolderName, FullPath, ParentId, Icon, Description
        FROM   dbo.Folders
        WHERE  IsActive = 1
          AND  Id IN (${safeIds.join(',')})`);
    const map = new Map();
    for (const row of r.recordset) map.set(row.Id, row);
    return map;
}

// ──────────────────────────────────────────────────────────────
// PUBLIC — user-facing
// ──────────────────────────────────────────────────────────────

/**
 * Build the 3-column home view tailored for the current user.
 * @param {string[]} userGroups raw AD group names (any case)
 * @returns {Promise<{ groups: Array }>}
 */
async function getHomeForUser(userGroups = []) {
    const userGroupsLower = _normalizeGroups(userGroups);
    const isAdminAll = userGroups.includes('*');

    const groups = await homeRepo.getAllGroups(false);
    if (!groups.length) return { groups: [] };

    // Bulk fetch all items for all groups
    const allItemsByGroup = new Map();
    const allItems = [];
    for (const g of groups) {
        const items = await homeRepo.getItemsByGroup(g.Id, false);
        allItemsByGroup.set(g.Id, items);
        allItems.push(...items);
    }

    // Bulk fetch mappings (program: AD group → file, program_group: AD group → folder)
    const programItemIds = allItems
        .filter(it => it.LinkType === 'program' || it.LinkType === 'program_group')
        .map(it => it.Id);
    const mappingsMap = await homeRepo.getMappingsForItems(programItemIds);

    // Folder summaries
    const folderIds = allItems.filter(it => it.LinkType === 'folder' && it.FolderId).map(it => it.FolderId);
    console.log(`Folder IDs to fetch summaries for:`, folderIds);
    const folderMap = await _getFolderSummaries([...new Set(folderIds)]);


    // Knowledge titles
    const knIds = allItems.filter(it => it.LinkType === 'knowledge' && it.KnowledgeId).map(it => it.KnowledgeId);
    const knMap = await _getKnowledgeTitles([...new Set(knIds)]);

    // Build response
    const result = [];
    for (const g of groups) {
        const items = allItemsByGroup.get(g.Id) || [];
        const out = [];
        for (const it of items) {
            const base = {
                id:        it.Id,
                title:     it.Title,
                subtitle:  it.Subtitle,
                icon:      it.Icon,
                linkType:  it.LinkType,
                sortOrder: it.SortOrder,
            };

            if (it.LinkType === 'program') {
                const mappings = mappingsMap.get(it.Id) || [];
                const matchedMappings = isAdminAll
                    ? mappings
                    : mappings.filter(m => userGroupsLower.includes(String(m.AdGroup).toLowerCase().trim()));
                const filePath = matchedMappings[0]?.FilePath || null;
                out.push({
                    ...base,
                    programType: it.ProgramType || 'file',
                    filePath,                    // null = no access
                    filePaths: matchedMappings.map(m => ({
                        adGroup: m.AdGroup,
                        filePath: m.FilePath
                    })),
                    hasAccess:   matchedMappings.length > 0,
                });
            } else if (it.LinkType === 'program_group') {
                const mappings = mappingsMap.get(it.Id) || [];
                const matchedMappings = isAdminAll
                    ? mappings
                    : mappings.filter(m => userGroupsLower.includes(String(m.AdGroup).toLowerCase().trim()));
                out.push({
                    ...base,
                    programType: it.ProgramType || 'file',
                    folderPaths: matchedMappings.map(m => ({
                        adGroup:    m.AdGroup,
                        folderPath: m.FilePath,
                    })),
                    hasAccess: matchedMappings.length > 0,
                });
            } else if (it.LinkType === 'folder') {
                console.log(`Processing folder item ${it.Title} with FolderId ${it.FolderId}`);
                const folder = it.FolderId ? folderMap.get(it.FolderId) : null;
                
                    console.log(`Folder summary for id 1546:`, folder);
                
                if (!folder) continue; // folder removed/inactive — skip
                let allowed = isAdminAll;
                if (!allowed) {
                    try {
                        allowed = await folderService.canAccessFolder(folder.Id, userGroups);
                    } catch { allowed = false; }
                }
                if (!allowed) continue; // user has no permission — hide entirely
                out.push({
                    ...base,
                    folderId:   folder.Id,
                    folderName: folder.FolderName,
                    fullPath:   folder.FullPath,
                });
            } else if (it.LinkType === 'knowledge') {
                const kn = it.KnowledgeId ? knMap.get(it.KnowledgeId) : null;
                if (!kn) continue;
                out.push({
                    ...base,
                    knowledgeId:    kn.Id,
                    knowledgeTitle: kn.Title,
                });
            } else if (it.LinkType === 'external_link') {
                if (!it.ExternalUrl) continue;
                out.push({
                    ...base,
                    externalUrl: it.ExternalUrl,
                });
            }
        }

        result.push({
            id:        g.Id,
            groupKey:  g.GroupKey,
            title:     g.Title,
            subtitle:  g.Subtitle,
            icon:      g.Icon,
            color:     g.Color,
            sortOrder: g.SortOrder,
            items:     out,
        });
    }

    return { groups: result };
}

/**
 * List files inside the folder(s) mapped to a `program_group` item,
 * restricted to folders whose AdGroup matches the current user.
 *
 * @param {number}   itemId
 * @param {string[]} userGroups raw AD group names ('*' = admin sees all)
 * @returns {Promise<{ files: Array, folders: Array }>}
 * @throws  Error with .code = 'NOT_FOUND' | 'FORBIDDEN'
 */
async function getProgramGroupFiles(itemId, userGroups = []) {
    const item = await homeRepo.getItemById(itemId);
    if (!item || item.LinkType !== 'program_group' || !item.IsEnabled) {
        const err = new Error('Item not found');
        err.code = 'NOT_FOUND';
        throw err;
    }

    const userGroupsLower = _normalizeGroups(userGroups);
    const isAdminAll = userGroups.includes('*');
    const mappings = await homeRepo.getMappingsByItem(itemId);
    const matched = isAdminAll
        ? mappings
        : mappings.filter(m => userGroupsLower.includes(String(m.AdGroup).toLowerCase().trim()));

    if (!matched.length) {
        const err = new Error('No access to this item');
        err.code = 'FORBIDDEN';
        throw err;
    }

    const files = [];
    const folders = [];
    const seenPaths = new Set(); // dedupe when several AD groups map to the same folder

    for (const m of matched) {
        const folderPath = String(m.FilePath || '').trim();
        const key = folderPath.toLowerCase();
        if (seenPaths.has(key)) continue;
        seenPaths.add(key);

        if (!SAFE_DIR_RE.test(folderPath)) {
            folders.push({ adGroup: m.AdGroup, folderPath, error: 'invalid path' });
            continue;
        }

        try {
            const entries = await fsp.readdir(folderPath, { withFileTypes: true });
            let count = 0;
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                if (entry.name.startsWith('.'))  continue; // hidden
                if (entry.name.startsWith('~$')) continue; // Office temp files
                files.push({
                    fileName:   entry.name,
                    filePath:   path.win32.join(folderPath, entry.name),
                    adGroup:    m.AdGroup,
                    folderPath,
                });
                count++;
            }
            folders.push({ adGroup: m.AdGroup, folderPath, fileCount: count });
        } catch (e) {
            folders.push({ adGroup: m.AdGroup, folderPath, error: 'cannot read folder' });
        }
    }

    files.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
    return {
        itemId:      item.Id,
        title:       item.Title,
        programType: item.ProgramType || 'file',
        files,
        folders,
    };
}

// ──────────────────────────────────────────────────────────────
// ADMIN — full management
// ──────────────────────────────────────────────────────────────

async function getAllForAdmin() {
    const groups = await homeRepo.getAllGroups(true);
    const result = [];
    for (const g of groups) {
        const items = await homeRepo.getItemsByGroup(g.Id, true);
        const enriched = [];
        for (const it of items) {
            const mappings = (it.LinkType === 'program' || it.LinkType === 'program_group')
                ? await homeRepo.getMappingsByItem(it.Id)
                : [];
            enriched.push({
                ...it,
                Mappings: mappings,
            });
        }
        result.push({ ...g, Items: enriched });
    }
    return result;
}

async function updateGroup(id, data) {
    await homeRepo.updateGroup(id, data);
}

async function createItem(data) {
    return homeRepo.createItem(data);
}

async function updateItem(id, data) {
    await homeRepo.updateItem(id, data);
}

async function deleteItem(id) {
    await homeRepo.deleteItem(id);
}

async function replaceMappings(itemId, mappings) {
    await homeRepo.replaceMappings(itemId, mappings);
}

module.exports = {
    getHomeForUser,
    getProgramGroupFiles,
    getAllForAdmin,
    updateGroup,
    createItem,
    updateItem,
    deleteItem,
    replaceMappings,
};
