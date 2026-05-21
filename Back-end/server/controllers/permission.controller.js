'use strict';
/**
 * permission.controller.js
 * ────────────────────────
 * HTTP handlers for folder permission management (admin-only).
 *
 * Called by : routes/permissions.js
 * Depends on: services/permission.service.js
 *
 * All routes require: authenticateAD + authorizeGroup('admin-dt')
 *
 * Endpoints:
 *   GET    /api/portal/admin/permissions/:folderId  → getByFolder
 *   POST   /api/portal/admin/permissions            → setPermission
 *   DELETE /api/portal/admin/permissions/:folderId/:adGroup → removePermission
 *   PUT    /api/portal/admin/permissions/:folderId  → replaceAll
 */

const permissionService = require('../services/permission.service');

/**
 * GET /api/portal/admin/permissions/:folderId
 * Returns all AD group permission rows for a folder.
 *
 * Response 200:
 * { success:true, data:[ { FolderId, AdGroup, CanView, CanUpload, CanDelete } ] }
 */
async function getByFolder(req, res) {
  try {
    const folderId = parseInt(req.params.folderId, 10);
    const perms    = await permissionService.getPermissionsForFolder(folderId);
    return res.json({ success: true, data: perms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/portal/admin/permissions
 * Body: { folderId, adGroup, canView, canUpload, canDelete }
 * Upserts a single permission row.
 */
async function setPermission(req, res) {
  try {
    const { folderId, adGroup, canView, canUpload, canDelete } = req.body;
    await permissionService.setPermission(
      { folderId: parseInt(folderId, 10), adGroup, canView: !!canView, canUpload: !!canUpload, canDelete: !!canDelete },
      req.adminUser?.username || 'admin'
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/portal/admin/permissions/:folderId/:adGroup
 * Removes a specific group from a folder's permission list.
 */
async function removePermission(req, res) {
  try {
    const folderId = parseInt(req.params.folderId, 10);
    const adGroup  = decodeURIComponent(req.params.adGroup);
    await permissionService.removePermission(
      folderId, adGroup, req.adminUser?.username || 'admin'
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * PUT /api/portal/admin/permissions/:folderId
 * Body: { permissions: [ { adGroup, canView, canUpload, canDelete } ] }
 * Replaces ALL permissions for a folder (delete all, re-insert).
 */
async function replaceAll(req, res) {
  try {
    const folderId = parseInt(req.params.folderId, 10);
    const { permissions } = req.body;
    await permissionService.replaceAllPermissions(
      folderId, permissions, req.adminUser?.username || 'admin'
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getByFolder, setPermission, removePermission, replaceAll };
