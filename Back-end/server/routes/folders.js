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
// Response: { success:false, error:'<first message>', message:'<same>', errors:[...] }
// `error`/`message` carry a readable text for frontends that only read one field.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const list  = errors.array();
    const first = list[0] || {};
    const field = first.path || first.param;
    const msg   = first.msg && first.msg !== 'Invalid value'
      ? first.msg
      : `ข้อมูลไม่ถูกต้อง${field ? `: ${field}` : ''}`;
    return res.status(400).json({ success: false, error: msg, message: msg, errors: list });
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
  [param('fileId').isInt({ min: 1 }).withMessage('fileId ไม่ถูกต้อง')],
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
  [require('express-validator').query('q')
    .notEmpty().withMessage('กรุณาระบุคำค้นหา')
    .isString().withMessage('คำค้นหาไม่ถูกต้อง')
    .isLength({ max: 200 }).withMessage('คำค้นหายาวเกิน 200 ตัวอักษร')],
  validate,
  folderCtrl.searchPortalFiles
);

// GET /api/portal/folders/:id/children
router.get(
  '/folders/:id/children',
  authenticateAD,
  mapPortalUser,
  [param('id').isInt({ min: 1 }).withMessage('id ไม่ถูกต้อง')],
  validate,
  folderCtrl.getChildren
);

// GET /api/portal/folders/:id/files
router.get(
  '/folders/:id/files',
  authenticateAD,
  mapPortalUser,
  [param('id').isInt({ min: 1 }).withMessage('id ไม่ถูกต้อง')],
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
    body('FolderName').notEmpty().withMessage('กรุณาระบุชื่อโฟลเดอร์').isString().withMessage('ชื่อโฟลเดอร์ไม่ถูกต้อง'),
    body('FullPath').notEmpty().withMessage('กรุณาระบุ Full Path').isString().withMessage('Full Path ไม่ถูกต้อง'),
    body('ParentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('ParentId ไม่ถูกต้อง'),
    body('SortOrder').optional().isInt().withMessage('SortOrder ต้องเป็นตัวเลขจำนวนเต็ม'),
    body('Icon').optional().isString().withMessage('Icon ไม่ถูกต้อง'),
    body('Description').optional().isString().withMessage('คำอธิบายไม่ถูกต้อง'),
    body('IsHidden').optional({ nullable: true }).isBoolean().withMessage('IsHidden ต้องเป็น true/false'),
  ],
  validate,
  folderCtrl.adminCreate
);

// PUT /api/portal/admin/folders/:id
router.put(
  '/admin/folders/:id',
  adminGuard,
  [
    param('id').isInt({ min: 1 }).withMessage('id ไม่ถูกต้อง'),
    body('FolderName').optional({ nullable: true }).isString().withMessage('ชื่อโฟลเดอร์ไม่ถูกต้อง'),
    body('IsActive').optional({ nullable: true }).isBoolean().withMessage('IsActive ต้องเป็น true/false'),
    body('IsHidden').optional({ nullable: true }).isBoolean().withMessage('IsHidden ต้องเป็น true/false'),
    body('ParentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('ParentId ไม่ถูกต้อง'),
    body('SortOrder').optional({ nullable: true }).isInt().withMessage('SortOrder ต้องเป็นตัวเลขจำนวนเต็ม'),
    body('Icon').optional({ nullable: true }).isString().withMessage('Icon ไม่ถูกต้อง'),
    body('Description').optional({ nullable: true }).isString().withMessage('คำอธิบายไม่ถูกต้อง'),
    // FullPath is owned by sync and deliberately NOT editable here (ignored by the controller)
  ],
  validate,
  folderCtrl.adminUpdate
);

// DELETE /api/portal/admin/folders/:id
router.delete(
  '/admin/folders/:id',
  adminGuard,
  [param('id').isInt({ min: 1 }).withMessage('id ไม่ถูกต้อง')],
  validate,
  folderCtrl.adminDelete
);

// POST /api/portal/admin/sync
router.post(
  '/admin/sync',
  adminGuard,
  [
    // Must be portal_drive_root or a folder under it — enforced in sync.controller.triggerSync
    body('rootPath').optional({ nullable: true }).isString().withMessage('rootPath ต้องเป็นข้อความ')
      .isLength({ max: 1000 }).withMessage('rootPath ยาวเกิน 1000 ตัวอักษร'),
  ],
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
  [body('username').isString().withMessage('username ไม่ถูกต้อง').bail()
    .trim().notEmpty().withMessage('กรุณาระบุ username')
    .isLength({ max: 100 }).withMessage('username ยาวเกิน 100 ตัวอักษร')],
  validate,
  syncCtrl.addSyncUser
);

// DELETE /api/portal/admin/sync-users/:id  — ลบ sync user
router.delete(
  '/admin/sync-users/:id',
  adminGuard,
  [param('id').isInt({ min: 1 }).withMessage('id ไม่ถูกต้อง')],
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
