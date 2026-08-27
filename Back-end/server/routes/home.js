'use strict';
/**
 * routes/home.js
 * ──────────────
 * Public + admin endpoints for Home Columns feature.
 *
 * Mounted twice in app.js:
 *   - publicRouter  on /api/home          (auth required: AD)
 *   - adminRouter   on /api/admin/home    (auth required: AD + admin-dt group)
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const { authenticateAD, authorizeGroup } = require('../middlewares/auth');
const ctrl = require('../controllers/home.controller');

// ──────────── PUBLIC ROUTER ─────────────
const publicRouter = Router();

// GET /api/home/data — returns groups with permission-filtered items for current user
publicRouter.get('/data', authenticateAD, ctrl.getHomeData);

// GET /api/home/items/:id/files — list files in a program_group item's folder(s)
publicRouter.get('/items/:id/files',
    authenticateAD,
    param('id').isInt({ min: 1 }).toInt(),
    ctrl.getItemFiles
);

// ──────────── ADMIN ROUTER ──────────────
const adminRouter = Router();
adminRouter.use(authenticateAD);
adminRouter.use(authorizeGroup('admin-dt'));

// GET full tree (incl disabled)
adminRouter.get('/all', ctrl.adminGetAll);

// PUT /groups/:id  — update group config (title/icon/color/...)
adminRouter.put('/groups/:id',
    [
        param('id').isInt({ min: 1 }).toInt(),
        body('title').isString().trim().isLength({ min: 1, max: 200 }),
        body('subtitle').optional({ nullable: true }).isString().isLength({ max: 300 }),
        body('icon').optional({ nullable: true }).isString().isLength({ max: 2000 }),
        body('color').optional({ nullable: true }).isString().isLength({ max: 20 }),
        body('sortOrder').optional().isInt({ min: 0 }).toInt(),
        body('isEnabled').optional().isBoolean().toBoolean(),
    ],
    ctrl.adminUpdateGroup
);

const itemValidation = [
    body('title').isString().trim().isLength({ min: 1, max: 200 }),
    body('subtitle').optional({ nullable: true }).isString().isLength({ max: 300 }),
    body('icon').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('linkType').isIn(['program', 'program_group', 'folder', 'knowledge', 'external_link']),
    body('programType').optional({ nullable: true }).isString().isLength({ max: 50 }),
    body('folderId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('knowledgeId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('externalUrl').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
    body('isEnabled').optional().isBoolean().toBoolean(),
    body('mappings').optional({ nullable: true }).isArray(),
];

adminRouter.post('/items',
    [body('groupId').isInt({ min: 1 }).toInt(), ...itemValidation],
    ctrl.adminCreateItem
);

adminRouter.put('/items/:id',
    [param('id').isInt({ min: 1 }).toInt(), ...itemValidation],
    ctrl.adminUpdateItem
);

adminRouter.delete('/items/:id',
    param('id').isInt({ min: 1 }).toInt(),
    ctrl.adminDeleteItem
);

// PUT /items/:id/mappings — replace whole mapping list { mappings: [{adGroup, filePath}] }
adminRouter.put('/items/:id/mappings',
    [
        param('id').isInt({ min: 1 }).toInt(),
        body('mappings').isArray(),
    ],
    ctrl.adminReplaceMappings
);

module.exports = { publicRouter, adminRouter };
