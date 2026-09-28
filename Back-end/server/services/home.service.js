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

const { sql, getPool } = require('../config/database');

// Same rule as the kmportal launcher: only UNC or absolute drive paths.
const SAFE_DIR_RE = /^(\\\\|[A-Za-z]:\\)/;

// External links must be plain web URLs (blocks javascript:, data:, … in href).
const SAFE_URL_RE = /^https?:\/\//i;

// Extensions considered "the same kind of document" per program type.
// Used when a mapped file was renamed and we look for its replacement.
const PROGRAM_EXTS = {
    excel:   ['.xls', '.xlsx', '.xlsm', '.xlsb'],
    word:    ['.doc', '.docx', '.docm'],
    powerbi: ['.pbix'],
};

function _isUsableFile(name) {
    if (name.startsWith('.'))  return false; // hidden
    if (name.startsWith('~$')) return false; // Office lock/temp file
    return true;
}

/** Windows-style glob (`*`, `?`) → anchored case-insensitive RegExp. */
function _globToRegExp(glob) {
    const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
}

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
                isPinned:  !!it.IsPinned,
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
                const folder = it.FolderId ? folderMap.get(it.FolderId) : null;
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
                // Only http(s) — rows saved before URL validation may hold e.g. javascript:
                if (!it.ExternalUrl || !SAFE_URL_RE.test(it.ExternalUrl)) continue;
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
 * Resolve one mapped path to a file that exists right now.
 *
 * Accepts three shapes of mapping, so renamed files keep working:
 *   \\srv\share\report.xlsm        exact file (verified; if it disappeared,
 *                                  the newest look-alike in its folder wins)
 *   \\srv\share\daily\             whole folder — newest file of that program type
 *   \\srv\share\daily\L1-2*.xlsm   glob — newest name that matches
 *
 * @returns {Promise<{filePath:string, matchMode:string}|null>} null = unreadable
 */
async function _resolveMappedPath(rawPath, programType) {
    const p = String(rawPath || '').trim();
    if (!p || !SAFE_DIR_RE.test(p)) return null;

    const base        = path.win32.basename(p);
    const hasWildcard = /[*?]/.test(base);
    const endsWithSep = /[\\/]$/.test(p);

    // Exact path that still exists — nothing to search for.
    if (!hasWildcard && !endsWithSep) {
        try {
            const st = await fsp.stat(p);
            if (st.isFile()) return { filePath: p, matchMode: 'exact' };
            if (!st.isDirectory()) return null;
            return _pickNewest(p, null, programType, null, 'folder');
        } catch {
            // Renamed or deleted: search its folder for the closest match.
            const dir  = path.win32.dirname(p);
            const stem = base.replace(/\.[^.]*$/, '');
            const ext  = path.win32.extname(base).toLowerCase();
            return _pickNewest(dir, null, programType, { stem, ext }, 'renamed');
        }
    }

    const dir  = endsWithSep ? p : path.win32.dirname(p);
    const glob = hasWildcard ? base : null;
    return _pickNewest(dir, glob, programType, null, glob ? 'glob' : 'folder');
}

/**
 * Newest usable file in `dir`. Filtered by glob when given, else by the
 * extensions of `programType`. `near` ({stem, ext}) ranks look-alikes of a
 * renamed file first: same extension beats a different one, and a name that
 * shares the old stem beats an unrelated name.
 */
async function _pickNewest(dir, glob, programType, near, matchMode) {
    let entries;
    try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        return null;
    }

    const globRe  = glob ? _globToRegExp(glob) : null;
    const typeExt = PROGRAM_EXTS[String(programType || '').toLowerCase()] || null;

    let candidates = entries
        .filter(e => e.isFile() && _isUsableFile(e.name))
        .map(e => ({ name: e.name, ext: path.win32.extname(e.name).toLowerCase() }));

    if (globRe)        candidates = candidates.filter(c => globRe.test(c.name));
    else if (near?.ext) candidates = candidates.filter(c => c.ext === near.ext);
    else if (typeExt)   candidates = candidates.filter(c => typeExt.includes(c.ext));

    if (!candidates.length) return null;

    // Rank a renamed file's look-alikes: shared stem first.
    if (near?.stem) {
        const stemLower = near.stem.toLowerCase();
        for (const c of candidates) {
            const nameStem = c.name.replace(/\.[^.]*$/, '').toLowerCase();
            c.related = nameStem.startsWith(stemLower) || stemLower.startsWith(nameStem);
        }
        if (candidates.some(c => c.related)) candidates = candidates.filter(c => c.related);
    }

    const stated = await Promise.all(candidates.map(async c => {
        try {
            const full = path.win32.join(dir, c.name);
            const st   = await fsp.stat(full);
            return { filePath: full, mtime: st.mtimeMs };
        } catch {
            return null;
        }
    }));

    const usable = stated.filter(Boolean);
    if (!usable.length) return null;
    usable.sort((a, b) => b.mtime - a.mtime); // newest wins — never ask the user
    return { filePath: usable[0].filePath, matchMode };
}

/**
 * Resolve a `program` item to the single file the current user should open,
 * so the client can fire `kmportal://` straight away without a picker.
 *
 * Falls back to the raw mapped path (matchMode 'raw') whenever the share
 * cannot be read, so behaviour is never worse than before.
 *
 * @throws Error with .code = 'NOT_FOUND' | 'FORBIDDEN'
 */
async function resolveProgramPath(itemId, userGroups = []) {
    const item = await homeRepo.getItemById(itemId);
    if (!item || item.LinkType !== 'program' || !item.IsEnabled) {
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

    const programType = item.ProgramType || 'file';
    for (const m of matched) {
        const hit = await _resolveMappedPath(m.FilePath, programType);
        if (hit) {
            return { ...hit, adGroup: m.AdGroup, programType };
        }
    }

    return {
        filePath:  matched[0].FilePath,
        matchMode: 'raw',
        adGroup:   matched[0].AdGroup,
        programType,
    };
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

function _notFound(msg) {
    const err = new Error(msg);
    err.code = 'NOT_FOUND';
    return err;
}

/** @returns {Promise<{id:number, groupKey:string, sortOrder:number}>} */
async function createGroup(data) {
    return homeRepo.createGroup(data);
}

async function updateGroup(id, data) {
    const affected = await homeRepo.updateGroup(id, data);
    if (!affected) throw _notFound('Group not found');
}

/** @returns {Promise<number>} items deleted along with the group */
async function deleteGroup(id) {
    return homeRepo.deleteGroup(id);
}

/** @param {Array<{id:number, sortOrder:number}>} order */
async function reorderGroups(order, updatedBy) {
    return homeRepo.reorderGroups(order, updatedBy);
}

/**
 * Create an item and (optionally) its mappings in one transaction —
 * a mapping failure leaves no orphan item behind.
 * @param {Array|undefined} mappings undefined = none
 */
async function createItem(data, mappings) {
    return homeRepo.withTransaction(async (tx) => {
        const id = await homeRepo.createItem(data, tx);
        if (Array.isArray(mappings)) await homeRepo.replaceMappings(id, mappings, tx);
        return id;
    });
}

/**
 * Update an item and (optionally) replace its mappings in one transaction.
 * @param {Array|undefined} mappings undefined = leave mappings untouched
 * @throws Error with .code = 'NOT_FOUND'
 */
async function updateItem(id, data, mappings) {
    await homeRepo.withTransaction(async (tx) => {
        const affected = await homeRepo.updateItem(id, data, tx);
        if (!affected) throw _notFound('Item not found');
        if (Array.isArray(mappings)) await homeRepo.replaceMappings(id, mappings, tx);
    });
}

async function deleteItem(id) {
    await homeRepo.deleteItem(id);
}

async function replaceMappings(itemId, mappings) {
    await homeRepo.replaceMappings(itemId, mappings);
}

module.exports = {
    getHomeForUser,
    resolveProgramPath,
    getProgramGroupFiles,
    getAllForAdmin,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    createItem,
    updateItem,
    deleteItem,
    replaceMappings,
};
