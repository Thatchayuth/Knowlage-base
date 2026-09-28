'use strict';
/**
 * routes/permissions.js
 * ─────────────────────
 * Express router for all permission management endpoints (admin-only).
 *
 * Mount point (registered in app.js):
 *   app.use('/api/portal', require('./routes/permissions'))
 *
 * All routes protected by: authenticateAD + authorizeGroup('admin-dt')
 *
 * Endpoints:
 *   GET    /api/portal/admin/permissions/:folderId           → getByFolder
 *   POST   /api/portal/admin/permissions                     → setPermission
 *   DELETE /api/portal/admin/permissions/:folderId/:adGroup  → removePermission
 *   PUT    /api/portal/admin/permissions/:folderId           → replaceAll
 */

const express = require('express');
const router  = express.Router();
const { body, param, validationResult } = require('express-validator');

const { authenticateAD, authorizeGroup } = require('../middlewares/auth');
const permCtrl = require('../controllers/permission.controller');

const adminGuard = [authenticateAD, authorizeGroup('admin-dt')];

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

// GET /api/portal/admin/permissions/:folderId
router.get(
  '/admin/permissions/:folderId',
  adminGuard,
  [param('folderId').isInt({ min: 1 }).withMessage('folderId ไม่ถูกต้อง')],
  validate,
  permCtrl.getByFolder
);

// POST /api/portal/admin/permissions
router.post(
  '/admin/permissions',
  adminGuard,
  [
    body('folderId').isInt({ min: 1 }).withMessage('folderId ไม่ถูกต้อง'),
    body('adGroup').isString().withMessage('ชื่อ AD Group ไม่ถูกต้อง').bail()
      .trim().notEmpty().withMessage('กรุณาระบุชื่อ AD Group'),
    body('canView').isBoolean().withMessage('canView ต้องเป็น true/false'),
    body('canUpload').isBoolean().withMessage('canUpload ต้องเป็น true/false'),
    body('canDelete').isBoolean().withMessage('canDelete ต้องเป็น true/false'),
  ],
  validate,
  permCtrl.setPermission
);

// DELETE /api/portal/admin/permissions/:folderId/:adGroup
router.delete(
  '/admin/permissions/:folderId/:adGroup',
  adminGuard,
  [
    param('folderId').isInt({ min: 1 }).withMessage('folderId ไม่ถูกต้อง'),
    param('adGroup').trim().notEmpty().withMessage('กรุณาระบุชื่อ AD Group'),
  ],
  validate,
  permCtrl.removePermission
);

// PUT /api/portal/admin/permissions/:folderId
router.put(
  '/admin/permissions/:folderId',
  adminGuard,
  [
    param('folderId').isInt({ min: 1 }).withMessage('folderId ไม่ถูกต้อง'),
    body('permissions').isArray({ min: 0 }).withMessage('permissions ต้องเป็น array'),
    body('permissions.*.adGroup').isString().withMessage('ชื่อ AD Group ไม่ถูกต้อง').bail()
      .trim().notEmpty().withMessage('กรุณาระบุชื่อ AD Group'),
    body('permissions.*.canView').isBoolean().withMessage('canView ต้องเป็น true/false'),
    body('permissions.*.canUpload').isBoolean().withMessage('canUpload ต้องเป็น true/false'),
    body('permissions.*.canDelete').isBoolean().withMessage('canDelete ต้องเป็น true/false'),
  ],
  validate,
  permCtrl.replaceAll
);

module.exports = router;
