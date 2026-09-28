'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { getPool, sql } = require('../config/database');
const { validationResult } = require('express-validator');

// ── Terms image storage ──────────────────────────────────────
const TERMS_DIR = path.join(__dirname, '../../mnt/user-data/outputs/terms');
if (!fs.existsSync(TERMS_DIR)) fs.mkdirSync(TERMS_DIR, { recursive: true });

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_TERMS_IMAGE_MB = 10;
// ชื่อไฟล์จริงของรูป terms (ไม่รวมไฟล์ temp ระหว่าง upload)
const FINAL_TERMS_NAME_RE = /^terms-image\.(jpg|jpeg|png|gif|webp)$/;

// multer เขียนลงชื่อ temp ที่ไม่ซ้ำก่อน — จะ rename เป็นชื่อจริงหลังบันทึก DB สำเร็จเท่านั้น
const _termsStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TERMS_DIR),
    filename:    (_req, _file, cb) => {
        cb(null, `terms-image.upload-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.tmp`);
    },
});

const termsUploadMiddleware = multer({
    storage:    _termsStorage,
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTS.includes(ext)) return cb(null, true);
        cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp) เท่านั้น'));
    },
    limits: { fileSize: MAX_TERMS_IMAGE_MB * 1024 * 1024 }, // 10 MB
}).single('termsImage');

/**
 * ตรวจ magic bytes ของไฟล์ให้ตรงกับนามสกุล (กันไฟล์อื่นที่แค่เปลี่ยนนามสกุล)
 */
function hasValidImageSignature(filePath, ext) {
    const buf = Buffer.alloc(12);
    let bytesRead = 0;
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    } catch {
        return false;
    } finally {
        if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
    }
    const ascii = (start, end) => buf.toString('ascii', start, end);
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return bytesRead >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        case '.png':
            return bytesRead >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        case '.gif':
            return bytesRead >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a');
        case '.webp':
            return bytesRead >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
        default:
            return false;
    }
}

const UPSERT_SETTING_SQL = `
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
`;

/**
 * Upsert หลาย key ภายใน transaction เดียว (all-or-nothing)
 */
async function upsertSettingsTx(pool, pairs, updatedBy) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        for (const [key, value] of pairs) {
            await new sql.Request(transaction)
                .input('Key',       sql.NVarChar(100), key)
                .input('Value',     sql.NVarChar(500),  value)
                .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                .query(UPSERT_SETTING_SQL);
        }
        await transaction.commit();
    } catch (err) {
        try { await transaction.rollback(); } catch { /* ignore */ }
        throw err;
    }
}

/**
 * 422 response — มี `error` (ข้อความแรกที่อ่านได้) + `errors` (รายการทั้งหมด)
 */
function sendValidationErrors(res, errors) {
    const list = errors.array();
    return res.status(422).json({ error: list[0]?.msg || 'ข้อมูลไม่ถูกต้อง', errors: list });
}

// Keys ที่ public (ไม่ต้อง login) อ่านได้ — ห้ามใส่ค่าภายใน เช่น portal_drive_root
const PUBLIC_SETTING_KEYS = [
    'portal_title',
    'portal_icon',
    'terms_image_enabled',
    'terms_image_filename',
    'terms_inactivity_minutes',
];

async function readSettings(keys) {
    const pool = await getPool();
    const result = await pool.request().query(
        'SELECT SettingKey, SettingValue FROM dbo.SiteSettings'
    );
    const settings = {};
    result.recordset.forEach(row => {
        if (!keys || keys.includes(row.SettingKey)) settings[row.SettingKey] = row.SettingValue;
    });
    return settings;
}

/**
 * GET /api/settings — public, returns only whitelisted settings as a flat object
 */
async function getSettings(req, res, next) {
    try {
        return res.json({ data: await readSettings(PUBLIC_SETTING_KEYS) });
    } catch (err) { next(err); }
}

/**
 * GET /api/admin/settings — admin only, returns all settings as a flat object
 */
async function getAdminSettings(req, res, next) {
    try {
        return res.json({ data: await readSettings(null) });
    } catch (err) { next(err); }
}

/**
 * PUT /api/admin/settings — admin only, upsert settings
 */
async function updateSettings(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

    const { portal_title, portal_icon, portal_drive_root } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const settingsToUpdate = [
        { key: 'portal_title',      value: portal_title?.trim() },
        { key: 'portal_icon',       value: (portal_icon || 'folder').trim() },
    ].filter(s => s.value != null && s.value !== '');

    // portal_drive_root เคลียร์ได้: ส่งค่าว่าง/null = ยกเลิกการตั้งค่า (เก็บเป็น '' → auto-sync/manual sync ถือว่าไม่ได้ตั้งค่า)
    // ไม่ส่ง key มาเลย (undefined) = ไม่แตะค่าเดิม
    const driveRoot = portal_drive_root === undefined ? undefined : String(portal_drive_root ?? '').trim();
    if (driveRoot !== undefined) settingsToUpdate.push({ key: 'portal_drive_root', value: driveRoot });

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
        return res.json({ data: { portal_title: portal_title?.trim(), portal_icon: (portal_icon || 'folder').trim(), portal_drive_root: driveRoot } });
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
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? `ไฟล์ใหญ่เกิน ${MAX_TERMS_IMAGE_MB} MB`
                : err.message;
            return res.status(400).json({ error: message });
        }
        if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });

        const tempPath  = req.file.path;
        const ext       = path.extname(req.file.originalname).toLowerCase();
        const filename  = `terms-image${ext}`;
        const finalPath = path.join(TERMS_DIR, filename);
        const updatedBy = req.user?.username || 'admin';
        const removeTemp = () => { try { fs.unlinkSync(tempPath); } catch { /* ignore */ } };

        // ตรวจเนื้อหาไฟล์ (magic bytes) ไม่ใช่แค่นามสกุล
        if (!hasValidImageSignature(tempPath, ext)) {
            removeTemp();
            return res.status(400).json({ error: 'ไฟล์ไม่ใช่รูปภาพที่ถูกต้อง หรือเนื้อหาไม่ตรงกับนามสกุลไฟล์' });
        }

        // 1) บันทึก DB ก่อน (transaction) — ถ้าล้มเหลว ลบเฉพาะไฟล์ temp รูปเดิมยังอยู่ครบ
        let pool;
        const prev = {};
        try {
            pool = await getPool();
            const prevResult = await pool.request().query(
                "SELECT SettingKey, SettingValue FROM dbo.SiteSettings WHERE SettingKey IN ('terms_image_filename', 'terms_image_enabled')"
            );
            prevResult.recordset.forEach(row => { prev[row.SettingKey] = row.SettingValue; });

            await upsertSettingsTx(pool, [
                ['terms_image_filename', filename],
                ['terms_image_enabled',  'true'],
            ], updatedBy);
        } catch (dbErr) {
            removeTemp();
            return next(dbErr);
        }

        // 2) rename temp → ชื่อจริง (แทนที่ไฟล์เดิมแบบ atomic)
        try {
            fs.renameSync(tempPath, finalPath);
        } catch (fsErr) {
            removeTemp();
            // คืนค่า DB เดิม เพื่อไม่ให้ชี้ไปยังไฟล์ที่ไม่มีอยู่
            try {
                await upsertSettingsTx(pool, [
                    ['terms_image_filename', prev.terms_image_filename ?? null],
                    ['terms_image_enabled',  prev.terms_image_enabled ?? null],
                ], updatedBy);
            } catch { /* ignore */ }
            return next(fsErr);
        }

        // 3) ลบรูปเก่า (terms-image.* นามสกุลอื่น) หลังทุกอย่างสำเร็จแล้วเท่านั้น
        try {
            for (const f of fs.readdirSync(TERMS_DIR)) {
                if (f !== filename && FINAL_TERMS_NAME_RE.test(f)) {
                    try { fs.unlinkSync(path.join(TERMS_DIR, f)); } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }

        return res.json({ data: { filename, enabled: true } });
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
    if (!errors.isEmpty()) return sendValidationErrors(res, errors);

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

module.exports = { getSettings, getAdminSettings, updateSettings, updateTermsSettings, serveTermsImage, uploadTermsImage, deleteTermsImage, termsUploadMiddleware };

