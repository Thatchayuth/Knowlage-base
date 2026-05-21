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

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return next();
};

// GET /api/portal/admin/permissions/:folderId
router.get(
  '/admin/permissions/:folderId',
  adminGuard,
  [param('folderId').isInt({ min: 1 })],
  validate,
  permCtrl.getByFolder
);

// POST /api/portal/admin/permissions
router.post(
  '/admin/permissions',
  adminGuard,
  [
    body('folderId').isInt({ min: 1 }),
    body('adGroup').notEmpty().isString(),
    body('canView').isBoolean(),
    body('canUpload').isBoolean(),
    body('canDelete').isBoolean(),
  ],
  validate,
  permCtrl.setPermission
);

// DELETE /api/portal/admin/permissions/:folderId/:adGroup
router.delete(
  '/admin/permissions/:folderId/:adGroup',
  adminGuard,
  [param('folderId').isInt({ min: 1 }), param('adGroup').notEmpty()],
  validate,
  permCtrl.removePermission
);

// PUT /api/portal/admin/permissions/:folderId
router.put(
  '/admin/permissions/:folderId',
  adminGuard,
  [
    param('folderId').isInt({ min: 1 }),
    body('permissions').isArray({ min: 0 }),
    body('permissions.*.adGroup').notEmpty().isString(),
    body('permissions.*.canView').isBoolean(),
    body('permissions.*.canUpload').isBoolean(),
    body('permissions.*.canDelete').isBoolean(),
  ],
  validate,
  permCtrl.replaceAll
);

module.exports = router;
