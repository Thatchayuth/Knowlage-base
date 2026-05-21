'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticateAD, authorizeGroup } = require('../middlewares/auth');
const uploadFile = require('../middlewares/upload');
const admin = require('../controllers/adminController');
const { updateSettings, updateTermsSettings, uploadTermsImage, deleteTermsImage } = require('../controllers/settingsController');

// All admin routes require AD auth + admin-dt group
router.use(authenticateAD);
router.use(authorizeGroup('admin-dt'));

// ============================================================
// LEVEL 1
// ============================================================
const level1Validation = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    body('icon').trim().notEmpty().withMessage('Icon class is required').isLength({ max: 100 }),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
];

router.post('/level1', level1Validation, admin.createLevel1);
router.put('/level1/:id', [
    param('id').isInt({ min: 1 }).toInt(),
    ...level1Validation,
], admin.updateLevel1);
router.delete('/level1/:id', param('id').isInt({ min: 1 }).toInt(), admin.deleteLevel1);

// ============================================================
// LEVEL 2
// ============================================================
const level2Validation = [
    body('level1Id').if((v, { req }) => req.method === 'POST').isInt({ min: 1 }).toInt(),
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    body('icon').trim().notEmpty().withMessage('Icon class is required').isLength({ max: 100 }),
    body('isEnabled').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
];

router.post('/level2', level2Validation, admin.createLevel2);
router.put('/level2/:id', [param('id').isInt({ min: 1 }).toInt(), ...level2Validation], admin.updateLevel2);
router.delete('/level2/:id', param('id').isInt({ min: 1 }).toInt(), admin.deleteLevel2);
router.patch('/level2/:id/toggle', param('id').isInt({ min: 1 }).toInt(), admin.toggleLevel2);

// ============================================================
// KNOWLEDGE ITEMS
// ============================================================
const knowledgeValidation = [
    body('level1Id').isInt({ min: 1 }).toInt(),
    body('level2Id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 500 }),
    body('displayMode').isIn(['PDF', 'PAGE', 'LINK']).withMessage('displayMode must be PDF, PAGE or LINK'),
    body('contentHtml').optional({ nullable: true }).isString(),
    body('pdfUrl').optional({ nullable: true }).isURL({ require_tld: false }).isLength({ max: 1000 }),
    body('videoUrl').optional({ nullable: true }).isURL({ require_tld: false }).isLength({ max: 1000 }),
    body('externalUrl').optional({ nullable: true }).isURL({ require_tld: false }).isLength({ max: 2000 }),
    body('highlight').optional().isBoolean().toBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
];

router.post('/knowledge', uploadFile.single('uploadFile'), knowledgeValidation, admin.createKnowledge);
router.put('/knowledge/:id', uploadFile.single('uploadFile'), [param('id').isInt({ min: 1 }).toInt(), ...knowledgeValidation], admin.updateKnowledge);
router.delete('/knowledge/:id', param('id').isInt({ min: 1 }).toInt(), admin.deleteKnowledge);

// ============================================================
// SITE SETTINGS
// ============================================================
router.put('/settings', [
    body('portal_title').trim().notEmpty().withMessage('portal_title is required').isLength({ max: 200 }),
    body('portal_icon').optional({ nullable: true }).trim().matches(/^[a-z0-9 -]+$/).withMessage('portal_icon invalid').isLength({ max: 100 }),
    body('portal_drive_root').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('portal_drive_root too long'),
], updateSettings);

// ============================================================
// TERMS IMAGE
// ============================================================
// POST /api/admin/terms-image  (multipart, field: termsImage)
router.post('/terms-image', uploadTermsImage);
// DELETE /api/admin/terms-image
router.delete('/terms-image', deleteTermsImage);
// PUT /api/admin/terms-settings  — inactivity timeout + enabled toggle
router.put('/terms-settings', [
    body('terms_inactivity_minutes').optional({ nullable: true }).isInt({ min: 0, max: 480 }).toInt(),
    body('terms_image_enabled').optional({ nullable: true }).isBoolean().toBoolean(),
], updateTermsSettings);

module.exports = router;
