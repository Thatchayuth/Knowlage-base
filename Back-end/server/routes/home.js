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

const idParam = () => param('id').isInt({ min: 1 }).withMessage('รหัสไม่ถูกต้อง').toInt();

// ──────────── PUBLIC ROUTER ─────────────
const publicRouter = Router();

// GET /api/home/data — returns groups with permission-filtered items for current user
publicRouter.get('/data', authenticateAD, ctrl.getHomeData);

// GET /api/home/items/:id/resolve — (program) current path for the mapped file
publicRouter.get('/items/:id/resolve',
    authenticateAD,
    param('id').isInt({ min: 1 }).toInt(),
    ctrl.resolveItemPath
);

// GET /api/home/items/:id/files — list files in a program_group item's folder(s)
publicRouter.get('/items/:id/files',
    authenticateAD,
    param('id').isInt({ min: 1 }).toInt(),
    ctrl.getItemFiles
);

// GET /api/home/weather — current weather for the home hero (cached 15 min server-side)
publicRouter.get('/weather', authenticateAD, ctrl.getWeather);

// ──────────── ADMIN ROUTER ──────────────
const adminRouter = Router();
adminRouter.use(authenticateAD);
adminRouter.use(authorizeGroup('admin-dt'));

// GET full tree (incl disabled)
adminRouter.get('/all', ctrl.adminGetAll);

const groupValidation = [
    body('title')
        .isString().withMessage('ชื่อหัวข้อต้องเป็นข้อความ').bail()
        .trim()
        .isLength({ min: 1, max: 200 }).withMessage('กรุณากรอกชื่อหัวข้อ (ไม่เกิน 200 ตัวอักษร)'),
    body('subtitle').optional({ nullable: true })
        .isString().withMessage('คำอธิบายย่อยต้องเป็นข้อความ').bail()
        .isLength({ max: 300 }).withMessage('คำอธิบายย่อยต้องไม่เกิน 300 ตัวอักษร'),
    body('icon').optional({ nullable: true })
        .isString().withMessage('ไอคอนต้องเป็นข้อความ').bail()
        .isLength({ max: 2000 }).withMessage('ไอคอนต้องไม่เกิน 2000 ตัวอักษร'),
    body('color').optional({ nullable: true })
        .isString().withMessage('สีต้องเป็นข้อความ').bail()
        .isLength({ max: 20 }).withMessage('สีต้องไม่เกิน 20 ตัวอักษร'),
    body('isEnabled').optional()
        .isBoolean().withMessage('สถานะต้องเป็น true/false').toBoolean(),
];

// POST /groups — add a column at the end (GroupKey + SortOrder generated)
adminRouter.post('/groups', groupValidation, ctrl.adminCreateGroup);

// PUT /groups/order — { order: [{ id, sortOrder }] } in one transaction.
// Registered before /groups/:id so "order" is not parsed as an id.
adminRouter.put('/groups/order',
    [
        body('order')
            .isArray({ min: 1 }).withMessage('กรุณาส่งลำดับคอลัมน์อย่างน้อย 1 รายการ'),
        body('order.*.id')
            .isInt({ min: 1 }).withMessage('รหัสคอลัมน์ไม่ถูกต้อง').toInt(),
        body('order.*.sortOrder')
            .isInt({ min: 0 }).withMessage('ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป').toInt(),
    ],
    ctrl.adminReorderGroups
);

// PUT /groups/:id  — update group config (title/icon/color/...); sortOrder omitted = unchanged
adminRouter.put('/groups/:id',
    [
        idParam(),
        ...groupValidation,
        body('sortOrder').optional({ nullable: true })
            .isInt({ min: 0 }).withMessage('ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป').toInt(),
    ],
    ctrl.adminUpdateGroup
);

// DELETE /groups/:id — delete a column with all of its items + mappings
adminRouter.delete('/groups/:id', idParam(), ctrl.adminDeleteGroup);

// ── Item validation ──
// Each linkType needs its own target: folder → folderId, knowledge → knowledgeId,
// external_link → externalUrl (http/https only), program/program_group → ≥1 mapping.
const PROGRAM_LINK_TYPES = ['program', 'program_group'];
const isBlank = v => v === undefined || v === null || v === '';
// Validate a target field when its linkType needs it, or whenever a value was sent.
const whenNeeded = linkType => (v, { req }) => req.body.linkType === linkType || !isBlank(v);

const mappingEntryValidation = [
    body('mappings.*.adGroup')
        .isString().withMessage('AD Group ต้องเป็นข้อความ').bail()
        .trim()
        .isLength({ min: 1, max: 200 }).withMessage('AD Group ต้องไม่ว่างและไม่เกิน 200 ตัวอักษร'),
    body('mappings.*.filePath')
        .isString().withMessage('Path ต้องเป็นข้อความ').bail()
        .trim()
        .isLength({ min: 1, max: 1000 }).withMessage('Path ต้องไม่ว่างและไม่เกิน 1000 ตัวอักษร'),
];

const itemValidation = [
    body('title')
        .isString().withMessage('ชื่อรายการต้องเป็นข้อความ').bail()
        .trim()
        .isLength({ min: 1, max: 200 }).withMessage('กรุณากรอกชื่อรายการ (ไม่เกิน 200 ตัวอักษร)'),
    body('subtitle').optional({ nullable: true })
        .isString().withMessage('คำอธิบายย่อยต้องเป็นข้อความ').bail()
        .isLength({ max: 300 }).withMessage('คำอธิบายย่อยต้องไม่เกิน 300 ตัวอักษร'),
    body('icon').optional({ nullable: true })
        .isString().withMessage('ไอคอนต้องเป็นข้อความ').bail()
        .isLength({ max: 2000 }).withMessage('ไอคอนต้องไม่เกิน 2000 ตัวอักษร'),
    body('linkType')
        .isIn(['program', 'program_group', 'folder', 'knowledge', 'external_link'])
        .withMessage('ประเภทลิงก์ไม่ถูกต้อง'),
    body('programType').optional({ nullable: true })
        .isString().withMessage('ชนิดโปรแกรมต้องเป็นข้อความ').bail()
        .isLength({ max: 50 }).withMessage('ชนิดโปรแกรมต้องไม่เกิน 50 ตัวอักษร'),
    body('folderId')
        .if(whenNeeded('folder'))
        .not().isEmpty().withMessage('กรุณาเลือกโฟลเดอร์').bail()
        .isInt({ min: 1 }).withMessage('Folder ID ไม่ถูกต้อง').toInt(),
    body('knowledgeId')
        .if(whenNeeded('knowledge'))
        .not().isEmpty().withMessage('กรุณาเลือก Knowledge Item').bail()
        .isInt({ min: 1 }).withMessage('Knowledge ID ไม่ถูกต้อง').toInt(),
    body('externalUrl')
        .if(whenNeeded('external_link'))
        .not().isEmpty({ ignore_whitespace: true }).withMessage('กรุณากรอก URL').bail()
        .isString().withMessage('URL ต้องเป็นข้อความ').bail()
        .trim()
        .isLength({ max: 2000 }).withMessage('URL ต้องไม่เกิน 2000 ตัวอักษร').bail()
        .isURL({
            protocols: ['http', 'https'],
            require_protocol: true,
            require_tld: false,          // allow intranet hosts, e.g. http://intranet/…
            allow_underscores: true,
        })
        .withMessage('URL ต้องขึ้นต้นด้วย http:// หรือ https:// และเป็นรูปแบบ URL ที่ถูกต้อง'),
    body('sortOrder').optional()
        .isInt({ min: 0 }).withMessage('ลำดับต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป').toInt(),
    body('isEnabled').optional()
        .isBoolean().withMessage('สถานะต้องเป็น true/false').toBoolean(),
    body('isPinned').optional()
        .isBoolean().withMessage('ค่า "แสดงตั้งแต่แรก" ต้องเป็น true/false').toBoolean(),
    body('mappings')
        .if((v, { req }) => PROGRAM_LINK_TYPES.includes(req.body.linkType) || !isBlank(v))
        .isArray().withMessage('mappings ต้องเป็นรายการ (array)').bail()
        .custom((v, { req }) => !PROGRAM_LINK_TYPES.includes(req.body.linkType) || v.length > 0)
        .withMessage('กรุณาเพิ่มการจับคู่ AD Group → Path อย่างน้อย 1 รายการ'),
    ...mappingEntryValidation,
];

adminRouter.post('/items',
    [body('groupId').isInt({ min: 1 }).withMessage('รหัสคอลัมน์ไม่ถูกต้อง').toInt(), ...itemValidation],
    ctrl.adminCreateItem
);

adminRouter.put('/items/:id',
    [idParam(), ...itemValidation],
    ctrl.adminUpdateItem
);

adminRouter.delete('/items/:id',
    idParam(),
    ctrl.adminDeleteItem
);

// PUT /items/:id/mappings — replace whole mapping list { mappings: [{adGroup, filePath}] }
adminRouter.put('/items/:id/mappings',
    [
        idParam(),
        body('mappings').isArray().withMessage('mappings ต้องเป็นรายการ (array)'),
        ...mappingEntryValidation,
    ],
    ctrl.adminReplaceMappings
);

module.exports = { publicRouter, adminRouter };
