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
const auditRepo         = require('../repositories/auditLog.repository');
const syncUserRepo      = require('../repositories/syncUser.repository');
const { invalidateAuthCache } = require('../middlewares/auth');
const { getPool }       = require('../config/database');

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
    const rootPath = req.body?.rootPath || await getPortalDriveRoot();

    if (!rootPath) {
      return res.status(400).json({
        success: false,
        message: 'rootPath is required (หรือตั้งค่า portal_drive_root ใน Site Settings)',
      });
    }

    const result = await folderSyncService.syncDrive(
      rootPath,
      req.adminUser?.username || req.user?.username || 'admin',
      req.ip
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
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
    const result = await folderSyncService.syncDrive(rootPath, triggeredBy, req.ip);

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/portal/admin/sync/logs
 */
async function getSyncLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
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
    const ok = await syncUserRepo.remove(id);
    if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบ Sync User' });

    // Invalidate auth cache ของ user นั้น (ถ้าทราบ username)
    // อาจต้อง get username ก่อน แต่ soft-delete ไปแล้ว → cache หมดอายุเองใน 5 นาที

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { triggerSync, triggerSyncAsUser, getSyncLogs, listSyncUsers, addSyncUser, removeSyncUser };

