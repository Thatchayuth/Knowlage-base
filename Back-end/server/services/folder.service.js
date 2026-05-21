'use strict';
/**
 * folder.service.js
 * ─────────────────
 * Business logic layer for the Folder Portal.
 * Sits between controllers and repositories.
 * Never writes SQL directly — delegates all DB access to repositories.
 *
 * Called by : folder.controller.js
 * Depends on: repositories/folder.repository.js
 *             repositories/permission.repository.js
 *             repositories/fileMetadata.repository.js
 *             repositories/auditLog.repository.js
 *             utils/treeBuilder.js
 *             services/cache.service.js
 *
 * Core Responsibilities:
 *   1. Build full recursive folder tree from flat DB records.
 *   2. Filter tree by user's AD groups (calls permission.repository.getPermissionMap).
 *   3. Return file list for a specific folder (with permission check).
 *   4. CRUD delegation to repository for admin operations.
 *
 * Flow: GET /api/portal/folders/tree
 *   Controller → service.getFilteredTree(userGroups)
 *   → cache.get('foldertree')          ← flat list cached
 *   → permRepo.getPermissionMap()      ← Map<folderId, groups[]>
 *   → treeBuilder.buildTree(flat)      ← nest the flat list
 *   → treeBuilder.filterTreeByPermission(tree, userGroups, permMap)
 *   → return filtered nested tree
 *
 * Exported:
 *   getFilteredTree(userGroups)
 *   getChildren(parentId, userGroups)
 *   getFiles(folderId, userGroups)
 *   getFolderById(id)
 *   createFolder(data)
 *   updateFolder(id, data)
 *   deleteFolder(id)
 *   getAllForAdmin()
 */

const folderRepo     = require('../repositories/folder.repository');
const permRepo       = require('../repositories/permission.repository');
const fileRepo       = require('../repositories/fileMetadata.repository');
const auditRepo      = require('../repositories/auditLog.repository');
const { buildTree, filterTreeByPermission } = require('../utils/treeBuilder');
const cache = require('./cache.service');

const TREE_TTL_MS = 2 * 60 * 1000;   // 2 min folder tree cache
const PERM_TTL_MS = 2 * 60 * 1000;   // 2 min permission map cache

// ──────────────────────────────────────────────────────────────
// PUBLIC — Folder Tree
// ──────────────────────────────────────────────────────────────

/**
 * Return the full folder tree filtered by what the user can see.
 * If userGroups is empty → return empty tree (deny-all default).
 * Admin callers should pass a wildcard sentinel ['*'] to skip filter.
 *
 * @param {string[]} userGroups  - lowercase AD group names for current user
 * @param {string}   username    - for audit log
 * @param {string}   ip
 * @returns {Promise<Object[]>}  nested folder tree (permission-filtered)
 *
 * JSON shape per node:
 *   { Id, FolderName, FullPath, ParentId, SortOrder, Icon, Description,
 *     _hasDirectAccess: bool, children: [...] }
 */
async function getFilteredTree(userGroups = [], username = null, ip = null) {
  // ── 1. Load flat folder list (cached)
  let flatFolders = cache.get('foldertree');
  if (!flatFolders) {
    flatFolders = await folderRepo.getAllFolders();
    cache.set('foldertree', flatFolders, TREE_TTL_MS);
  }

  // ── 2. Load permission map (cached)
  let permMap = cache.get('permmap');
  if (!permMap) {
    permMap = await permRepo.getPermissionMap();
    cache.set('permmap', permMap, PERM_TTL_MS);
  }

  // ── 3. Build nested tree
  const tree = buildTree(flatFolders, null);

  // ── 4. Admin bypass — return full tree
  if (userGroups.includes('*')) return tree;

  // ── 5. Filter by permission
  const filtered = filterTreeByPermission(tree, userGroups, permMap);

  // ── 6. Fire-and-forget audit log
  auditRepo.log({
    username,
    action:       'VIEW_FOLDER',
    resourceType: 'FOLDER',
    resourcePath: '/',
    ipAddress:    ip,
  });

  return filtered;
}

/**
 * Get direct children of a parent folder (lazy-load sidebar).
 * Still permission-filtered, with permission inheritance from parent chain.
 *
 * @param {number|null} parentId
 * @param {string[]}    userGroups
 * @returns {Promise<Object[]>} flat list of immediate children (no recursive nesting)
 */
async function getChildren(parentId, userGroups = []) {
  const children = await folderRepo.getChildren(parentId);
  if (userGroups.includes('*')) return children;

  let permMap = cache.get('permmap');
  if (!permMap) {
    permMap = await permRepo.getPermissionMap();
    cache.set('permmap', permMap, PERM_TTL_MS);
  }

  let flatFolders = cache.get('foldertree');
  if (!flatFolders) {
    flatFolders = await folderRepo.getAllFolders();
    cache.set('foldertree', flatFolders, TREE_TTL_MS);
  }

  // Resolve the effective groups that children of parentId inherit
  const parentInherited = _resolveEffectiveGroups(parentId, permMap, flatFolders);

  const lowerGroups = userGroups.map(g => g.toLowerCase());
  return children.filter(f => {
    const directPerms = permMap.has(f.Id) ? permMap.get(f.Id) : undefined;
    const effectiveGroups = directPerms !== undefined ? directPerms : parentInherited;
    if (effectiveGroups.length === 0) return false; // deny by default
    return effectiveGroups.some(g => lowerGroups.includes(g));
  });
}

// ──────────────────────────────────────────────────────────────
// PUBLIC — Files
// ──────────────────────────────────────────────────────────────

/**
 * Get files inside a folder, with permission check (supports inherited permissions).
 * Returns 403-like null if user has no access.
 *
 * @param {number}   folderId
 * @param {string[]} userGroups
 * @param {string}   username
 * @param {string}   ip
 * @returns {Promise<Object[]|null>}  null = access denied
 */
async function getFiles(folderId, userGroups = [], username = null, ip = null) {
  // Check permission first (with inheritance)
  if (!userGroups.includes('*')) {
    const hasAccess = await canAccessFolder(folderId, userGroups);
    if (!hasAccess) return null;
  }

  const cacheKey = `files:${folderId}`;
  let files = cache.get(cacheKey);
  if (!files) {
    files = await fileRepo.getByFolder(folderId);
    cache.set(cacheKey, files, TREE_TTL_MS);
  }

  auditRepo.log({
    username,
    action:       'VIEW_FILE',
    resourceType: 'FOLDER',
    resourceId:   folderId,
    ipAddress:    ip,
  });

  return files;
}

// ──────────────────────────────────────────────────────────────
// ADMIN — CRUD (called via admin-protected routes)
// ──────────────────────────────────────────────────────────────

async function getFolderById(id) {
  return folderRepo.getFolderById(id);
}

/** Create a new folder (admin only). Invalidates tree cache. */
async function createFolder(data) {
  const id = await folderRepo.createFolder(data);
  _invalidateTreeCache();
  return id;
}

/** Update folder metadata (admin only). Invalidates tree cache. */
async function updateFolder(id, data) {
  await folderRepo.updateFolder(id, data);
  _invalidateTreeCache();
}

/** Soft-delete a folder (admin only). Invalidates tree cache. */
async function deleteFolder(id) {
  await folderRepo.deleteFolder(id);
  _invalidateTreeCache();
}

/** Get ALL folders unfiltered (for admin UI). */
async function getAllForAdmin() {
  return folderRepo.getSubtree(null);  // includes inactive
}

// ──────────────────────────────────────────────────────────────
// PRIVATE
// ──────────────────────────────────────────────────────────────

function _invalidateTreeCache() {
  cache.del('foldertree');
  cache.del('permmap');
  cache.clearPrefix('files:');
}

/**
 * Resolve the effective permission groups for a folder.
 * Checks the folder itself first; if no direct permissions, walks up
 * the parent chain until it finds an ancestor with explicit permissions.
 *
 * Returns [] if no permissions anywhere in the ancestor chain (= deny).
 *
 * @param {number}               folderId    - the folder to check
 * @param {Map<number,string[]>} permMap     - full permission map
 * @param {Array<Object>}        flatFolders - cached flat folder list
 * @returns {string[]} effective AD groups (lowercase)
 */
function _resolveEffectiveGroups(folderId, permMap, flatFolders) {
  const map = new Map(flatFolders.map(f => [f.Id, f]));
  let current = map.get(folderId);
  // Walk from this folder up to root
  while (current) {
    const id = current.Id;
    if (permMap.has(id)) return permMap.get(id);
    const pid = current.ParentId;
    if (pid == null) break;
    current = map.get(pid);
  }
  return []; // no permissions set in ancestor chain = deny
}

/**
 * Check whether a user's groups give CanView access to a folder.
 * Supports inherited permissions from parent chain.
 * Used by serveFile to gate file downloads.
 * @param {number}   folderId
 * @param {string[]} userGroups
 * @returns {Promise<boolean>}
 */
async function canAccessFolder(folderId, userGroups = []) {
  if (!userGroups.length) return false;

  let permMap = cache.get('permmap');
  if (!permMap) {
    permMap = await permRepo.getPermissionMap();
    cache.set('permmap', permMap, PERM_TTL_MS);
  }

  let flatFolders = cache.get('foldertree');
  if (!flatFolders) {
    flatFolders = await folderRepo.getAllFolders();
    cache.set('foldertree', flatFolders, TREE_TTL_MS);
  }

  const lowerGroups = userGroups.map(g => g.toLowerCase());
  const effectiveGroups = _resolveEffectiveGroups(folderId, permMap, flatFolders);
  if (effectiveGroups.length === 0) return false;
  return effectiveGroups.some(g => lowerGroups.includes(g));
}

module.exports = {
  getFilteredTree,
  getChildren,
  getFiles,
  canAccessFolder,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  getAllForAdmin,
};
