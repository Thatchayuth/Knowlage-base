'use strict';
/**
 * permission.service.js
 * ─────────────────────
 * Business logic for folder permission management.
 * Handles: read permissions, write/delete permissions, admin overrides.
 *
 * Called by : permission.controller.js
 * Depends on: repositories/permission.repository.js
 *             repositories/auditLog.repository.js
 *             services/cache.service.js
 *
 * Flow for admin PATCH permission:
 *   permController → permService.setPermission(data)
 *   → permRepo.upsertPermission(data)
 *   → cache.del('permmap')          ← force re-load on next request
 *   → auditRepo.log(...)
 *
 * Exported:
 *   getPermissionsForFolder(folderId)
 *   setPermission(data)
 *   removePermission(folderId, adGroup)
 *   replaceAllPermissions(folderId, permArray)
 *   checkUserAccess(folderId, userGroups)
 */

const permRepo  = require('../repositories/permission.repository');
const auditRepo = require('../repositories/auditLog.repository');
const cache     = require('./cache.service');

// ──────────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────────

/**
 * Get all AD group permission rows for one folder.
 * Used by Admin permission editor UI.
 *
 * @param {number} folderId
 * @returns {Promise<Object[]>}
 */
async function getPermissionsForFolder(folderId) {
  return permRepo.getByFolder(folderId);
}

/**
 * Fast check: does the user have CanView on a folder?
 * Used by permission.middleware.js.
 *
 * @param {number}   folderId
 * @param {string[]} userGroups  lowercase group names
 * @returns {Promise<boolean>}
 */
async function checkUserAccess(folderId, userGroups) {
  if (!userGroups?.length) return false;
  if (userGroups.includes('*')) return true;  // admin bypass
  return permRepo.getUserFolderPermission(folderId, userGroups);
}

// ──────────────────────────────────────────────────────────────
// WRITE (admin-only callers)
// ──────────────────────────────────────────────────────────────

/**
 * Upsert a single permission entry.
 * Invalidates permission map cache after write.
 *
 * @param {{ folderId, adGroup, canView, canUpload, canDelete }} data
 * @param {string} adminUser  - for audit log
 */
async function setPermission(data, adminUser) {
  await permRepo.upsertPermission(data);
  _invalidatePerm();
  await auditRepo.log({
    username:     adminUser,
    action:       'PERM_CHANGE',
    resourceType: 'FOLDER',
    resourceId:   data.folderId,
    details:      { adGroup: data.adGroup, canView: data.canView, canUpload: data.canUpload, canDelete: data.canDelete },
  });
}

/**
 * Remove a specific group from a folder's permission list.
 *
 * @param {number} folderId
 * @param {string} adGroup
 * @param {string} adminUser
 */
async function removePermission(folderId, adGroup, adminUser) {
  await permRepo.deletePermission(folderId, adGroup);
  _invalidatePerm();
  await auditRepo.log({
    username:     adminUser,
    action:       'PERM_CHANGE',
    resourceType: 'FOLDER',
    resourceId:   folderId,
    details:      { removed: adGroup },
  });
}

/**
 * Replace all permissions for a folder with a new array.
 * Used by Admin permission editor "Save all" action.
 *
 * @param {number}   folderId
 * @param {Array<{adGroup, canView, canUpload, canDelete}>} permArray
 * @param {string}   adminUser
 */
async function replaceAllPermissions(folderId, permArray, adminUser) {
  await permRepo.deleteAllForFolder(folderId);
  for (const perm of permArray) {
    await permRepo.upsertPermission({ folderId, ...perm });
  }
  _invalidatePerm();
  await auditRepo.log({
    username:     adminUser,
    action:       'PERM_CHANGE',
    resourceType: 'FOLDER',
    resourceId:   folderId,
    details:      { replaced: permArray.length },
  });
}

function _invalidatePerm() {
  cache.del('permmap');
}

module.exports = {
  getPermissionsForFolder,
  checkUserAccess,
  setPermission,
  removePermission,
  replaceAllPermissions,
};
