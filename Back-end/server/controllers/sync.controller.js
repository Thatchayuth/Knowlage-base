'use strict';
/**
 * sync.controller.js
 * ──────────────────
 * HTTP handler for drive sync trigger and sync status.
 *
 * Admin-only endpoints:
 *   POST /api/portal/admin/sync              → triggerSync (admin, custom rootPath)
 *   GET  /api/portal/admin/sync/logs         → getSyncLogs
 *   GET  /api/portal/admin/sync-users        → listSyncUsers
 *   POST /api/portal/admin/sync-users        → addSyncUser
 *   DELETE /api/portal/admin/sync-users/:id  → removeSyncUser
 *
 * Admin + SyncUser endpoint:
 *   POST /api/portal/sync                    → triggerSyncAsUser (uses PORTAL_DRIVE_ROOT)
 */

const folderSyncService = require('../services/folderSync.service');

/** dryRun=1 / true / yes on the query string or body → report only, write nothing. */
function wantsDryRun(req) {
  const raw = req.query?.dryRun ?? req.body?.dryRun;
  return raw === true || raw === 1 || ['1', 'true', 'yes'].includes(String(raw).toLowerCase());
}
const auditRepo         = require('../repositories/auditLog.repository');
const syncUserRepo      = require('../repositories/syncUser.repository');
const { invalidateAuthCache } = require('../middlewares/auth');
const { getPool }       = require('../config/database');
const { normalize, stripTrailing, isSameOrUnder, hasTraversal } = require('../utils/pathHelper');

/** Sync already running (in-process lock in folderSync.service) → 409 instead of 500. */
function sendSyncError(res, err) {
  if (err && err.code === folderSyncService.SYNC_IN_PROGRESS) {
    return res.status(409).json({
      success: false,
      code:    err.code,
      message: err.message,
      error:   err.message,
      runningSince: err.runningSince || null,
    });
  }
  return res.status(500).json({ success: false, message: err.message });
}

/**
 * Read portal_drive_root from dbo.SiteSettings (DB-managed, not from .env)
 */
async function getPortalDriveRoot() {
  const pool = await getPool();
  const r = await pool.request().query(
    "SELECT SettingValue FROM dbo.SiteSettings WHERE SettingKey = 'portal_drive_root'"
  );
  return r.recordset[0]?.SettingValue || null;
}

/**
 * POST /api/portal/admin/sync  (admin-only, supports custom rootPath)
 */
async function triggerSync(req, res) {
  try {
    const driveRoot = await getPortalDriveRoot();
    const override  = typeof req.body?.rootPath === 'string' ? req.body.rootPath.trim() : '';

    // An override rootPath may only be the configured drive root or a folder
    // under it — never an arbitrary path on the server.
    if (override) {
      if (!driveRoot) {
        return badRequest(res, 'ยังไม่ได้ตั้งค่า portal_drive_root ใน Site Settings — ไม่อนุญาตให้ระบุ rootPath เอง');
      }
      if (hasTraversal(override) || !isSameOrUnder(override, driveRoot)) {
        return badRequest(res, `rootPath ต้องเป็น portal_drive_root (${driveRoot}) หรือโฟลเดอร์ย่อยภายในเท่านั้น`);
      }
    }

    const rootPath = override ? stripTrailing(normalize(override)) : driveRoot;

    if (!rootPath) {
      return res.status(400).json({
        success: false,
        message: 'rootPath is required (หรือตั้งค่า portal_drive_root ใน Site Settings)',
      });
    }

    const result = await folderSyncService.syncDrive(
      rootPath,
      req.user?.username || 'admin',
      req.ip,
      { dryRun: wantsDryRun(req) }
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    return sendSyncError(res, err);
  }
}

/** 400 with both `message` and `error` so either frontend convention shows the text. */
function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg, error: msg });
}

/**
 * POST /api/portal/sync  (admin OR syncuser — ใช้ portal_drive_root จาก DB)
 */
async function triggerSyncAsUser(req, res) {
  try {
    const rootPath = await getPortalDriveRoot();

    if (!rootPath) {
      return res.status(400).json({
        success: false,
        message: 'portal_drive_root ยังไม่ได้ตั้งค่า — ไปตั้งค่าที่ Site Settings',
      });
    }

    const triggeredBy = req.user?.username || 'syncuser';
    const result = await folderSyncService.syncDrive(rootPath, triggeredBy, req.ip, { dryRun: wantsDryRun(req) });

    return res.json({ success: true, data: result });
  } catch (err) {
    return sendSyncError(res, err);
  }
}

/**
 * GET /api/portal/admin/sync/logs
 */
async function getSyncLogs(req, res) {
  try {
    // Integer 1..500; missing / non-numeric → 100
    const parsed = parseInt(req.query.limit, 10);
    const limit  = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;
    // Sync writes Action = 'SYNC' or 'SYNC_DRYRUN' → prefix match on 'SYNC'
    const logs  = await auditRepo.getRecent(limit, 'SYNC');
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/portal/admin/sync-users
 */
async function listSyncUsers(req, res) {
  try {
    const users = await syncUserRepo.getAll();
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/portal/admin/sync-users
 * Body: { username: string }
 */
async function addSyncUser(req, res) {
  try {
    const username = (req.body?.username || '').toLowerCase().trim();
    if (!username) {
      return res.status(400).json({ success: false, message: 'username is required' });
    }

    const created = await syncUserRepo.create(username, req.user?.username || 'admin');
    // Drop any cached auth result so the new 'syncuser' role applies on the next request
    invalidateAuthCache(username);
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    // Duplicate username (UQ constraint)
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: 'Username นี้มีอยู่แล้ว' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/portal/admin/sync-users/:id
 */
async function removeSyncUser(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    // Look up the username first so its auth cache entry can be invalidated
    const target = await syncUserRepo.getById(id);
    const ok = await syncUserRepo.remove(id);
    if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบ Sync User' });

    // Invalidate auth cache ของ user นั้น → role 'syncuser' หมดผลทันที (ไม่ต้องรอ 5 นาที)
    if (target?.Username) invalidateAuthCache(target.Username);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { triggerSync, triggerSyncAsUser, getSyncLogs, listSyncUsers, addSyncUser, removeSyncUser };

