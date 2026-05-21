'use strict';

const fs   = require('fs');
const path = require('path');
const multer = require('multer');
const { getPool, sql } = require('../config/database');
const { validationResult } = require('express-validator');

// ── Terms image storage ──────────────────────────────────────
const TERMS_DIR = path.join(__dirname, '../../mnt/user-data/outputs/terms');
if (!fs.existsSync(TERMS_DIR)) fs.mkdirSync(TERMS_DIR, { recursive: true });

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const _termsStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TERMS_DIR),
    filename:    (_req,  file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `terms-image${ext}`);
    },
});

const termsUploadMiddleware = multer({
    storage:    _termsStorage,
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTS.includes(ext)) return cb(null, true);
        cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('termsImage');

/**
 * GET /api/settings — public, returns all settings as a flat object
 */
async function getSettings(req, res, next) {
    try {
        const pool = await getPool();
        const result = await pool.request().query(
            'SELECT SettingKey, SettingValue FROM dbo.SiteSettings'
        );
        const settings = {};
        result.recordset.forEach(row => { settings[row.SettingKey] = row.SettingValue; });
        return res.json({ data: settings });
    } catch (err) { next(err); }
}

/**
 * PUT /api/admin/settings — admin only, upsert settings
 */
async function updateSettings(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { portal_title, portal_icon, portal_drive_root } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const settingsToUpdate = [
        { key: 'portal_title',      value: portal_title?.trim() },
        { key: 'portal_icon',       value: (portal_icon || 'folder').trim() },
        { key: 'portal_drive_root', value: portal_drive_root?.trim() },
    ].filter(s => s.value != null && s.value !== '');

    try {
        const pool = await getPool();
        for (const s of settingsToUpdate) {
            await pool.request()
                .input('Key',       sql.NVarChar(100), s.key)
                .input('Value',     sql.NVarChar(500),  s.value)
                .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                .query(`
                    MERGE dbo.SiteSettings AS target
                    USING (SELECT @Key AS SettingKey, @Value AS SettingValue) AS source
                      ON target.SettingKey = source.SettingKey
                    WHEN MATCHED THEN
                        UPDATE SET SettingValue = source.SettingValue,
                                   UpdatedAt   = SYSDATETIME(),
                                   UpdatedBy   = @UpdatedBy
                    WHEN NOT MATCHED THEN
                        INSERT (SettingKey, SettingValue, UpdatedBy)
                        VALUES (source.SettingKey, source.SettingValue, @UpdatedBy);
                `);
        }
        return res.json({ data: { portal_title: portal_title?.trim(), portal_icon: (portal_icon || 'folder').trim(), portal_drive_root: portal_drive_root?.trim() } });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────
// TERMS IMAGE — GET /api/settings/terms-image
// Public endpoint: streams the current terms image file
// ─────────────────────────────────────────────────────────────
async function serveTermsImage(req, res, next) {
    try {
        const pool = await getPool();
        const result = await pool.request().query(
            "SELECT SettingValue FROM dbo.SiteSettings WHERE SettingKey = 'terms_image_filename'"
        );
        const filename = result.recordset[0]?.SettingValue;
        if (!filename) return res.status(404).json({ error: 'No terms image configured' });

        const filePath = path.join(TERMS_DIR, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Terms image file not found' });

        // Security: ensure file is inside TERMS_DIR (path traversal guard)
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(TERMS_DIR))) {
            return res.status(400).json({ error: 'Invalid file path' });
        }

        const ext = path.extname(filename).toLowerCase().slice(1);
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(filePath).pipe(res);
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────
// TERMS IMAGE — POST /api/admin/terms-image
// Admin: upload new image + save filename to DB
// ─────────────────────────────────────────────────────────────
async function uploadTermsImage(req, res, next) {
    termsUploadMiddleware(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });

        const filename  = req.file.filename;
        const updatedBy = req.user?.username || 'admin';

        try {
            // Remove old terms images that differ from new filename
            const files = fs.readdirSync(TERMS_DIR);
            for (const f of files) {
                if (f !== filename) {
                    try { fs.unlinkSync(path.join(TERMS_DIR, f)); } catch { /* ignore */ }
                }
            }

            const pool = await getPool();
            for (const [key, value] of [
                ['terms_image_filename', filename],
                ['terms_image_enabled',  'true'],
            ]) {
                await pool.request()
                    .input('Key',       sql.NVarChar(100), key)
                    .input('Value',     sql.NVarChar(500),  value)
                    .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                    .query(`
                        MERGE dbo.SiteSettings AS target
                        USING (SELECT @Key AS SettingKey, @Value AS SettingValue) AS source
                          ON target.SettingKey = source.SettingKey
                        WHEN MATCHED THEN
                            UPDATE SET SettingValue = source.SettingValue,
                                       UpdatedAt    = SYSDATETIME(),
                                       UpdatedBy    = @UpdatedBy
                        WHEN NOT MATCHED THEN
                            INSERT (SettingKey, SettingValue, UpdatedBy)
                            VALUES (source.SettingKey, source.SettingValue, @UpdatedBy);
                    `);
            }
            return res.json({ data: { filename, enabled: true } });
        } catch (dbErr) {
            // Cleanup uploaded file on DB failure
            try { fs.unlinkSync(path.join(TERMS_DIR, filename)); } catch { /* ignore */ }
            next(dbErr);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// TERMS IMAGE — DELETE /api/admin/terms-image
// Admin: remove image and clear DB settings
// ─────────────────────────────────────────────────────────────
async function deleteTermsImage(req, res, next) {
    try {
        const pool = await getPool();
        const result = await pool.request().query(
            "SELECT SettingValue FROM dbo.SiteSettings WHERE SettingKey = 'terms_image_filename'"
        );
        const filename = result.recordset[0]?.SettingValue;
        if (filename) {
            const filePath = path.join(TERMS_DIR, filename);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch { /* ignore */ }
            }
        }

        const updatedBy = req.user?.username || 'admin';
        for (const key of ['terms_image_filename', 'terms_image_enabled']) {
            await pool.request()
                .input('Key',       sql.NVarChar(100), key)
                .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                .query(`
                    UPDATE dbo.SiteSettings
                    SET SettingValue = NULL, UpdatedAt = SYSDATETIME(), UpdatedBy = @UpdatedBy
                    WHERE SettingKey = @Key
                `);
        }
        return res.json({ data: { deleted: true } });
    } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────
// TERMS SETTINGS — PUT /api/admin/terms-settings
// Admin: save terms_inactivity_minutes and/or terms_image_enabled
// ─────────────────────────────────────────────────────────────
async function updateTermsSettings(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { terms_inactivity_minutes, terms_image_enabled } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const settingsToUpdate = [];
    if (terms_inactivity_minutes !== undefined && terms_inactivity_minutes !== null) {
        settingsToUpdate.push({ key: 'terms_inactivity_minutes', value: String(Math.max(0, parseInt(terms_inactivity_minutes, 10) || 0)) });
    }
    if (terms_image_enabled !== undefined && terms_image_enabled !== null) {
        settingsToUpdate.push({ key: 'terms_image_enabled', value: terms_image_enabled ? 'true' : 'false' });
    }

    try {
        const pool = await getPool();
        for (const s of settingsToUpdate) {
            await pool.request()
                .input('Key',       sql.NVarChar(100), s.key)
                .input('Value',     sql.NVarChar(500),  s.value)
                .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                .query(`
                    MERGE dbo.SiteSettings AS target
                    USING (SELECT @Key AS SettingKey, @Value AS SettingValue) AS source
                      ON target.SettingKey = source.SettingKey
                    WHEN MATCHED THEN
                        UPDATE SET SettingValue = source.SettingValue,
                                   UpdatedAt   = SYSDATETIME(),
                                   UpdatedBy   = @UpdatedBy
                    WHEN NOT MATCHED THEN
                        INSERT (SettingKey, SettingValue, UpdatedBy)
                        VALUES (source.SettingKey, source.SettingValue, @UpdatedBy);
                `);
        }
        return res.json({ data: { terms_inactivity_minutes, terms_image_enabled } });
    } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings, updateTermsSettings, serveTermsImage, uploadTermsImage, deleteTermsImage, termsUploadMiddleware };

