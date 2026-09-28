/**
 * portal.service.js
 * ─────────────────
 * Axios-based HTTP client for the File/Folder Portal API.
 * All calls use withCredentials:true for Windows Auth / session cookies.
 *
 * Used by: useFolderTree.js, useFolderFiles.js, FolderPortalPage.jsx,
 *          FolderViewPage.jsx, admin portal pages
 *
 * Base URL: /api/portal  (same origin — no cross-origin issues)
 *
 * Functions:
 *   getFolderTree()             → nested tree filtered by user's AD groups
 *   getFolderChildren(id)       → direct children (lazy-load)
 *   getFolderFiles(id)          → files in a folder
 *   adminGetFolders()           → all folders for admin UI
 *   adminCreateFolder(data)
 *   adminUpdateFolder(id, data)
 *   adminDeleteFolder(id)
 *   adminGetPermissions(folderId)
 *   adminSetPermission(data)
 *   adminRemovePermission(folderId, adGroup)
 *   adminReplacePermissions(folderId, permissions[])
 *   adminTriggerSync(rootPath?)
 *   adminGetSyncLogs(limit?)
 */

import api from './axios';

const BASE = '/api/portal';

// ──────────────────────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────────────────────

/** @returns {Promise<Array>} nested folder tree (permission-filtered) */
export const getFolderTree = () =>
  api.get(`${BASE}/folders/tree`).then(r => r.data.data);

/** @returns {Promise<Array>} direct children of parentId */
export const getFolderChildren = (id) =>
  api.get(`${BASE}/folders/${id}/children`).then(r => r.data.data);

/** @returns {Promise<Array>} files inside folderId */
export const getFolderFiles = (id) =>
  api.get(`${BASE}/folders/${id}/files`).then(r => r.data.data);

/** @returns {Promise<Array>} files matching query within user's permitted folders */
export const searchPortalFiles = (q) =>
  api.get(`${BASE}/search`, { params: { q } }).then(r => r.data.data);

// ──────────────────────────────────────────────────────────────
// ADMIN — FOLDER CRUD
// ──────────────────────────────────────────────────────────────

/** Admin: get all folders (unfiltered) */
export const adminGetFolders = () =>
  api.get(`${BASE}/admin/folders`).then(r => r.data.data);

/** Admin: create folder */
export const adminCreateFolder = (data) =>
  api.post(`${BASE}/admin/folders`, data).then(r => r.data);

/** Admin: update folder */
export const adminUpdateFolder = (id, data) =>
  api.put(`${BASE}/admin/folders/${id}`, data).then(r => r.data);

/** Admin: soft-delete folder */
export const adminDeleteFolder = (id) =>
  api.delete(`${BASE}/admin/folders/${id}`).then(r => r.data);

// ──────────────────────────────────────────────────────────────
// ADMIN — PERMISSIONS
// ──────────────────────────────────────────────────────────────

/** @returns {Promise<Array>} permission rows for a folder */
export const adminGetPermissions = (folderId) =>
  api.get(`${BASE}/admin/permissions/${folderId}`).then(r => r.data.data);

/** Upsert a single permission */
export const adminSetPermission = (data) =>
  api.post(`${BASE}/admin/permissions`, data).then(r => r.data);

/** Remove a group from a folder */
export const adminRemovePermission = (folderId, adGroup) =>
  api.delete(`${BASE}/admin/permissions/${folderId}/${encodeURIComponent(adGroup)}`).then(r => r.data);

/** Replace ALL permissions for a folder */
export const adminReplacePermissions = (folderId, permissions) =>
  api.put(`${BASE}/admin/permissions/${folderId}`, { permissions }).then(r => r.data);

// ──────────────────────────────────────────────────────────────
// ADMIN — SYNC
// ──────────────────────────────────────────────────────────────

/** Trigger a full drive sync. rootPath defaults to PORTAL_DRIVE_ROOT env on server.
 *  Uses a 400s timeout — longer than the server timeout (360s) so the UI never gives up first. */
export const adminTriggerSync = (rootPath) =>
  api.post(`${BASE}/admin/sync`, { rootPath }, { timeout: 400000 }).then(r => r.data);

/** Get recent sync audit logs */
export const adminGetSyncLogs = (limit = 50) =>
  api.get(`${BASE}/admin/sync/logs?limit=${limit}`).then(r => r.data.data);

// ──────────────────────────────────────────────────────────────
// ADMIN — SYNC USERS
// ──────────────────────────────────────────────────────────────

/** Admin: รายชื่อ sync users ทั้งหมด */
export const adminGetSyncUsers = () =>
  api.get(`${BASE}/admin/sync-users`).then(r => r.data.data);

/** Admin: เพิ่ม sync user */
export const adminAddSyncUser = (username) =>
  api.post(`${BASE}/admin/sync-users`, { username }).then(r => r.data);

/** Admin: ลบ sync user */
export const adminRemoveSyncUser = (id) =>
  api.delete(`${BASE}/admin/sync-users/${id}`).then(r => r.data);

// ──────────────────────────────────────────────────────────────
// SYNC USER — TRIGGER (สำหรับ syncuser role)
// ──────────────────────────────────────────────────────────────

/** Sync user: trigger sync ด้วย PORTAL_DRIVE_ROOT (ไม่ต้องส่ง rootPath) */
export const triggerSyncAsUser = () =>
  api.post(`${BASE}/sync`, {}, { timeout: 400000 }).then(r => r.data);
