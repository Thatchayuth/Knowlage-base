'use strict';
/**
 * permission.middleware.js
 * ────────────────────────
 * Per-request folder access guard for portal routes.
 * Reads folderId from req.params.id, checks if req.portalUser.groups
 * has CanView permission via folder.service.canAccessFolder which
 * supports inherited permissions from parent folders.
 *
 * Must be used AFTER windowsAuth.middleware.js (needs req.portalUser).
 *
 * Called by : folders.js route (GET /folders/:id/files)
 * Depends on: services/folder.service.js (canAccessFolder — supports inheritance)
 *
 * Flow:
 *   Request → windowsAuth.middleware → permission.middleware → controller
 *   canAccessFolder(folderId, userGroups)
 *   → walks parent chain until a folder with explicit permissions is found
 *   → true  → next()
 *   → false → 403 Forbidden
 */

const { canAccessFolder } = require('../services/folder.service');

/**
 * Factory: returns middleware that checks CanView for folder in req.params.id
 * Supports inherited permissions from ancestor folders.
 * @example router.get('/:id/files', windowsAuth, checkFolderAccess(), folderController.getFiles)
 */
function checkFolderAccess() {
  return async function (req, res, next) {
    const folderId   = parseInt(req.params.id, 10);
    const userGroups = req.portalUser?.groups || req.user?.groups || [];

    if (!folderId || isNaN(folderId)) {
      return res.status(400).json({ success: false, message: 'Invalid folder ID' });
    }

    // Admin bypass — req.isAdmin is set by admin route's authorizeGroup middleware
    if (req.isAdmin || userGroups.includes('*')) return next();

    const hasAccess = await canAccessFolder(folderId, userGroups);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this folder' });
    }

    return next();
  };
}

module.exports = { checkFolderAccess };
