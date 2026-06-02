'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');

let uploadDir = process.env.UPLOAD_DIR || 'D:\\NCR_iBot\\NCR-iBot-Live\\src\\Pdf_file';
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    console.warn(`Warning: Failed to create or access upload directory "${uploadDir}". Falling back to local "Pdf_file" directory. Error: ${err.message}`);
    uploadDir = path.join(__dirname, '..', '..', 'Pdf_file');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const original = String(file.originalname || '').trim();
        const ext = path.extname(original).toLowerCase();

        if (ext !== '.mp4' && ext !== '.pdf') {
            return cb(new Error('Only .mp4 and .pdf files are supported'));
        }

        const baseName = path.basename(original, ext)
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || 'file';

        return cb(null, `${baseName}${ext}`);
    },
});

module.exports = multer({ storage });
