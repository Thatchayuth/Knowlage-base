'use strict';
/**
 * home.controller.js
 * ──────────────────
 * HTTP handlers for Home Columns endpoints (public + admin).
 */

const homeService = require('../services/home.service');
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

// ──────── ADMIN ───────────────────────────────────────────────

async function adminGetAll(req, res) {
    try {
        const data = await homeService.getAllForAdmin();
        res.json({ groups: data });
    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `adminGetAll: ${err.message}` });
        res.status(500).json({ error: err.message, code: 'HOME_ADMIN_FAIL' });
    }
}

async function adminUpdateGroup(req, res) {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return _err(res, 'VALIDATION', errs.array()[0].msg);
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.updateGroup(id, {
            title:     req.body.title,
            subtitle:  req.body.subtitle,
            icon:      req.body.icon,
            color:     req.body.color,
            sortOrder: req.body.sortOrder ?? 0,
            isEnabled: req.body.isEnabled !== false,
            updatedBy: req.user?.username || 'admin',
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_GROUP_UPDATE_FAIL' });
    }
}

async function adminCreateItem(req, res) {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return _err(res, 'VALIDATION', errs.array()[0].msg);
    try {
        const id = await homeService.createItem({
            groupId:     req.body.groupId,
            title:       req.body.title,
            subtitle:    req.body.subtitle,
            icon:        req.body.icon,
            linkType:    req.body.linkType,
            programType: req.body.programType,
            folderId:    req.body.folderId,
            knowledgeId: req.body.knowledgeId,
            externalUrl: req.body.externalUrl,
            sortOrder:   req.body.sortOrder ?? 0,
            isEnabled:   req.body.isEnabled !== false,
            updatedBy:   req.user?.username || 'admin',
        });
        // optional mappings provided in same request (for program items)
        if (Array.isArray(req.body.mappings)) {
            await homeService.replaceMappings(id, req.body.mappings);
        }
        res.status(201).json({ ok: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_CREATE_FAIL' });
    }
}

async function adminUpdateItem(req, res) {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return _err(res, 'VALIDATION', errs.array()[0].msg);
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.updateItem(id, {
            title:       req.body.title,
            subtitle:    req.body.subtitle,
            icon:        req.body.icon,
            linkType:    req.body.linkType,
            programType: req.body.programType,
            folderId:    req.body.folderId,
            knowledgeId: req.body.knowledgeId,
            externalUrl: req.body.externalUrl,
            sortOrder:   req.body.sortOrder ?? 0,
            isEnabled:   req.body.isEnabled !== false,
            updatedBy:   req.user?.username || 'admin',
        });
        if (Array.isArray(req.body.mappings)) {
            await homeService.replaceMappings(id, req.body.mappings);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_UPDATE_FAIL' });
    }
}

async function adminDeleteItem(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        await homeService.deleteItem(id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_ITEM_DELETE_FAIL' });
    }
}

async function adminReplaceMappings(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const mappings = Array.isArray(req.body.mappings) ? req.body.mappings : [];
        await homeService.replaceMappings(id, mappings);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'HOME_MAPPING_FAIL' });
    }
}

module.exports = {
    getHomeData,
    getItemFiles,
    adminGetAll,
    adminUpdateGroup,
    adminCreateItem,
    adminUpdateItem,
    adminDeleteItem,
    adminReplaceMappings,
};
