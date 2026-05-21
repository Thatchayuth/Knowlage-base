'use strict';
/**
 * routes/folders.js
 * ─────────────────
 * Express router for all folder-related portal endpoints.
 *
 * Mount point (registered in app.js):
 *   app.use('/api/portal', require('./routes/folders'))
 *
 * Public routes  (Windows Auth / AD user):
 *   GET  /api/portal/folders/tree          → folder.controller.getTree
 *   GET  /api/portal/folders/:id/children  → folder.controller.getChildren
 *   GET  /api/portal/folders/:id/files     → folder.controller.getFiles
 *
 * Admin routes  (existing Admin login required):
 *   GET    /api/portal/admin/folders        → folder.controller.adminList
 *   POST   /api/portal/admin/folders        → folder.controller.adminCreate
 *   PUT    /api/portal/admin/folders/:id    → folder.controller.adminUpdate
 *   DELETE /api/portal/admin/folders/:id    → folder.controller.adminDelete
 *   POST   /api/portal/admin/sync           → sync.controller.triggerSync
 *   GET    /api/portal/admin/sync/logs      → sync.controller.getSyncLogs
 */

const express    = require('express');
const router     = express.Router();
const { body, param, validationResult } = require('express-validator');

// Middlewares
const { authenticateAD, authorizeGroup } = require('../middlewares/auth');
const { checkFolderAccess } = require('../middlewares/permission.middleware');

// ── Map req.user → req.portalUser for controller compatibility ──
function mapPortalUser(req, _res, next) {
  req.portalUser = {
    username: req.user.username,
    domain:   req.user.domain || null,
    groups:   req.user.groups || [],
    role:     req.user.role   || 'readonly',
  };
  next();
}

// Controllers
const folderCtrl = require('../controllers/folder.controller');
const syncCtrl   = require('../controllers/sync.controller');

// ── Validation helpers ──
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return next();
};

// ──────────────────────────────────────────────────────────────
// PUBLIC FOLDER ROUTES (Windows Auth)
// ──────────────────────────────────────────────────────────────

// GET /api/portal/files/:fileId  — stream file from Shared Drive
router.get(
  '/files/:fileId',
  authenticateAD,
  mapPortalUser,
  [param('fileId').isInt({ min: 1 })],
  validate,
  folderCtrl.serveFile
);

// GET /api/portal/folders/tree
router.get(
  '/folders/tree',
  authenticateAD,
  mapPortalUser,
  folderCtrl.getTree
);

// GET /api/portal/search?q=keyword  — file search within permitted folders
router.get(
  '/search',
  authenticateAD,
  mapPortalUser,
  [require('express-validator').query('q').notEmpty().isString().isLength({ max: 200 })],
  validate,
  folderCtrl.searchPortalFiles
);

// GET /api/portal/folders/:id/children
router.get(
  '/folders/:id/children',
  authenticateAD,
  mapPortalUser,
  [param('id').isInt({ min: 1 })],
  validate,
  folderCtrl.getChildren
);

// GET /api/portal/folders/:id/files
router.get(
  '/folders/:id/files',
  authenticateAD,
  mapPortalUser,
  [param('id').isInt({ min: 1 })],
  validate,
  checkFolderAccess(),
  folderCtrl.getFiles
);

// ──────────────────────────────────────────────────────────────
// ADMIN FOLDER ROUTES (existing admin login)
// ──────────────────────────────────────────────────────────────

// Attach admin flag for permission.middleware bypass
const adminGuard = [
  authenticateAD,
  authorizeGroup('admin-dt'),
  (req, _res, next) => { req.isAdmin = true; next(); },
];

// GET  /api/portal/admin/folders
router.get('/admin/folders', adminGuard, folderCtrl.adminList);

// POST /api/portal/admin/folders
router.post(
  '/admin/folders',
  adminGuard,
  [
    body('FolderName').notEmpty().isString(),
    body('FullPath').notEmpty().isString(),
    body('ParentId').optional({ nullable: true }).isInt(),
    body('SortOrder').optional().isInt(),
    body('Icon').optional().isString(),
    body('Description').optional().isString(),
  ],
  validate,
  folderCtrl.adminCreate
);

// PUT /api/portal/admin/folders/:id
router.put(
  '/admin/folders/:id',
  adminGuard,
  [
    param('id').isInt({ min: 1 }),
    body('FolderName').optional({ nullable: true }).isString(),
    body('IsActive').optional({ nullable: true }).isBoolean(),
    body('SortOrder').optional({ nullable: true }).isInt(),
    body('Icon').optional({ nullable: true }).isString(),
    body('Description').optional({ nullable: true }).isString(),
  ],
  validate,
  folderCtrl.adminUpdate
);

// DELETE /api/portal/admin/folders/:id
router.delete(
  '/admin/folders/:id',
  adminGuard,
  [param('id').isInt({ min: 1 })],
  validate,
  folderCtrl.adminDelete
);

// POST /api/portal/admin/sync
router.post(
  '/admin/sync',
  adminGuard,
  [body('rootPath').optional().isString()],
  validate,
  syncCtrl.triggerSync
);

// GET /api/portal/admin/sync/logs
router.get('/admin/sync/logs', adminGuard, syncCtrl.getSyncLogs);

// ──────────────────────────────────────────────────────────────
// SYNC USERS MANAGEMENT (admin-only)
// ──────────────────────────────────────────────────────────────

// GET  /api/portal/admin/sync-users  — รายชื่อ sync users ทั้งหมด
router.get('/admin/sync-users', adminGuard, syncCtrl.listSyncUsers);

// POST /api/portal/admin/sync-users  — เพิ่ม sync user
router.post(
  '/admin/sync-users',
  adminGuard,
  [body('username').trim().notEmpty().isLength({ max: 100 })],
  validate,
  syncCtrl.addSyncUser
);

// DELETE /api/portal/admin/sync-users/:id  — ลบ sync user
router.delete(
  '/admin/sync-users/:id',
  adminGuard,
  [param('id').isInt({ min: 1 })],
  validate,
  syncCtrl.removeSyncUser
);

// ──────────────────────────────────────────────────────────────
// SYNC TRIGGER (admin หรือ syncuser เข้าได้)
// ──────────────────────────────────────────────────────────────

/** Middleware: อนุญาต admin และ syncuser เท่านั้น */
function requireSyncAccess(req, res, next) {
  const role = req.user?.role;
  if (role === 'admin' || role === 'syncuser') return next();
  return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ trigger sync' });
}

// POST /api/portal/sync  — trigger sync ด้วย PORTAL_DRIVE_ROOT (ไม่ต้องส่ง rootPath)
router.post(
  '/sync',
  authenticateAD,
  requireSyncAccess,
  syncCtrl.triggerSyncAsUser
);

module.exports = router;
