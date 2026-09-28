'use strict';
/**
 * home.controller.js
 * ──────────────────
 * HTTP handlers for Home Columns endpoints (public + admin).
 */

const homeService = require('../services/home.service');
const weatherService = require('../services/weather.service');
const { validationResult } = require('express-validator');
const logger = require('../services/logger');

function _err(res, code, msg, status = 400) {
    return res.status(status).json({ error: msg, code });
}

// ──────── PUBLIC ──────────────────────────────────────────────

async function getHomeData(req, res) {
    try {
        const userGroups = req.user?.groups || [];
        const data = await homeService.getHomeForUser(userGroups);
        res.json(data);
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `getHomeData: ${err.message}` });
        res.status(500).json({ error: 'Failed to load home data', code: 'HOME_FAIL' });
    }
}

// GET /api/home/items/:id/resolve — resolve a program item to the file that exists now
async function resolveItemPath(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);
        const userGroups = req.user?.groups || [];
        const data = await homeService.resolveProgramPath(itemId, userGroups);
        res.json(data);
    } catch (err) {
        if (err.code === 'NOT_FOUND') return _err(res, 'NOT_FOUND', 'ไม่พบรายการนี้', 404);
        if (err.code === 'FORBIDDEN') return _err(res, 'FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงรายการนี้', 403);
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `resolveItemPath: ${err.message}` });
        res.status(500).json({ error: 'Failed to resolve path', code: 'HOME_RESOLVE_FAIL' });
    }
}

// GET /api/home/items/:id/files — list files inside a program_group item's mapped folder(s)
async function getItemFiles(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);
        const userGroups = req.user?.groups || [];
        const data = await homeService.getProgramGroupFiles(itemId, userGroups);
        res.json(data);
    } catch (err) {
        if (err.code === 'NOT_FOUND')  return _err(res, 'NOT_FOUND', 'ไม่พบรายการนี้', 404);
        if (err.code === 'FORBIDDEN')  return _err(res, 'FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงรายการนี้', 403);
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `getItemFiles: ${err.message}` });
        res.status(500).json({ error: 'Failed to list files', code: 'HOME_FILES_FAIL' });
    }
}

// GET /api/home/weather — current weather for the home hero (frontend falls back to time-of-day on error)
async function getWeather(req, res) {
    try {
        res.json(await weatherService.getCurrentWeather());
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'warn', message: `getWeather: ${err.message}` });
        res.status(503).json({ error: 'Weather unavailable', code: 'WEATHER_UNAVAILABLE' });
    }
}

// ──────── ADMIN ───────────────────────────────────────────────

/**
 * Send 400 with every express-validator error when the request is invalid.
 * Body: { error: <first message>, code: 'VALIDATION', errors: [{ path, msg, … }] }
 * @returns {boolean} true when a response was sent
 */
function _rejectInvalid(req, res) {
    const errs = validationResult(req);
    if (errs.isEmpty()) return false;
    const errors = errs.array();
    res.status(400).json({ error: errors[0].msg, code: 'VALIDATION', errors });
    return true;
}

// SQL Server 547 = FK/CHECK violation (e.g. groupId / folderId / knowledgeId that doesn't exist)
function _isFkError(err) {
    return err?.number === 547 || err?.originalError?.info?.number === 547;
}

const PROGRAM_LINK_TYPES = ['program', 'program_group'];

/** Item fields from the (validated) body — targets not used by linkType are nulled. */
function _itemData(req) {
    const b = req.body;
    const t = b.linkType;
    return {
        groupId:     b.groupId,
        title:       b.title,
        subtitle:    b.subtitle,
        icon:        b.icon,
        linkType:    t,
        programType: PROGRAM_LINK_TYPES.includes(t) ? b.programType : null,
        folderId:    t === 'folder'        ? b.folderId    : null,
        knowledgeId: t === 'knowledge'     ? b.knowledgeId : null,
        externalUrl: t === 'external_link' ? b.externalUrl : null,
        sortOrder:   b.sortOrder ?? 0,
        isEnabled:   b.isEnabled !== false,
        isPinned:    b.isPinned === true,
        updatedBy:   req.user?.username || 'admin',
    };
}

/** Mappings to store: program types keep theirs, other types are cleared. */
function _itemMappings(req) {
    return PROGRAM_LINK_TYPES.includes(req.body.linkType) ? req.body.mappings : [];
}

async function adminGetAll(req, res) {
    try {
        const data = await homeService.getAllForAdmin();
        res.json({ groups: data });
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `adminGetAll: ${err.message}` });
        res.status(500).json({ error: err.message, code: 'HOME_ADMIN_FAIL' });
    }
}

// POST /groups — body { title, subtitle?, icon?, color?, isEnabled? } → 201 { ok, id, groupKey, sortOrder }
async function adminCreateGroup(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const created = await homeService.createGroup({
            title:     req.body.title,
            subtitle:  req.body.subtitle,
            icon:      req.body.icon,
            color:     req.body.color,
            isEnabled: req.body.isEnabled !== false,
            updatedBy: req.user?.username || 'admin',
        });
        res.status(201).json({ ok: true, ...created });
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `adminCreateGroup: ${err.message}` });
        res.status(500).json({ error: err.message, code: 'HOME_GROUP_CREATE_FAIL' });
    }
}

async function adminUpdateGroup(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.updateGroup(id, {
            title:     req.body.title,
            subtitle:  req.body.subtitle,
            icon:      req.body.icon,
            color:     req.body.color,
            sortOrder: req.body.sortOrder ?? null, // omitted = keep current position
            isEnabled: req.body.isEnabled !== false,
            updatedBy: req.user?.username || 'admin',
        });
        res.json({ ok: true });
    } catch (err) {
        if (err.code === 'NOT_FOUND') return _err(res, 'NOT_FOUND', 'ไม่พบคอลัมน์นี้', 404);
        res.status(500).json({ error: err.message, code: 'HOME_GROUP_UPDATE_FAIL' });
    }
}

// DELETE /groups/:id → { ok, deletedItems }
async function adminDeleteGroup(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const id = parseInt(req.params.id, 10);
        const deletedItems = await homeService.deleteGroup(id);
        res.json({ ok: true, deletedItems });
    } catch (err) {
        if (err.code === 'NOT_FOUND') return _err(res, 'NOT_FOUND', 'ไม่พบคอลัมน์นี้', 404);
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `adminDeleteGroup: ${err.message}` });
        res.status(500).json({ error: err.message, code: 'HOME_GROUP_DELETE_FAIL' });
    }
}

// PUT /groups/order — body { order: [{ id, sortOrder }] } → { ok, updated }
async function adminReorderGroups(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const order = req.body.order.map(o => ({ id: o.id, sortOrder: o.sortOrder }));
        const updated = await homeService.reorderGroups(order, req.user?.username || 'admin');
        res.json({ ok: true, updated });
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `adminReorderGroups: ${err.message}` });
        res.status(500).json({ error: err.message, code: 'HOME_GROUP_ORDER_FAIL' });
    }
}

async function adminCreateItem(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        // item + mappings in one transaction — no orphan item if mappings fail
        const id = await homeService.createItem(_itemData(req), _itemMappings(req));
        res.status(201).json({ ok: true, id });
    } catch (err) {
        if (_isFkError(err)) {
            return _err(res, 'INVALID_REFERENCE', 'ไม่พบคอลัมน์ โฟลเดอร์ หรือ Knowledge ที่อ้างอิง');
        }
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_CREATE_FAIL' });
    }
}

async function adminUpdateItem(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.updateItem(id, _itemData(req), _itemMappings(req));
        res.json({ ok: true });
    } catch (err) {
        if (err.code === 'NOT_FOUND') return _err(res, 'NOT_FOUND', 'ไม่พบรายการนี้', 404);
        if (_isFkError(err)) {
            return _err(res, 'INVALID_REFERENCE', 'ไม่พบโฟลเดอร์ หรือ Knowledge ที่อ้างอิง');
        }
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_UPDATE_FAIL' });
    }
}

async function adminDeleteItem(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.deleteItem(id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_DELETE_FAIL' });
    }
}

async function adminReplaceMappings(req, res) {
    if (_rejectInvalid(req, res)) return;
    try {
        const id = parseInt(req.params.id, 10);
        const mappings = Array.isArray(req.body.mappings) ? req.body.mappings : [];
        await homeService.replaceMappings(id, mappings);
        res.json({ ok: true });
    } catch (err) {
        if (_isFkError(err)) return _err(res, 'NOT_FOUND', 'ไม่พบรายการนี้', 404);
        res.status(500).json({ error: err.message, code: 'HOME_MAPPING_FAIL' });
    }
}

module.exports = {
    getHomeData,
    resolveItemPath,
    getItemFiles,
    getWeather,
    adminGetAll,
    adminCreateGroup,
    adminUpdateGroup,
    adminDeleteGroup,
    adminReorderGroups,
    adminCreateItem,
    adminUpdateItem,
    adminDeleteItem,
    adminReplaceMappings,
};
