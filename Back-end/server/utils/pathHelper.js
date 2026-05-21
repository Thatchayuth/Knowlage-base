'use strict';
/**
 * pathHelper.js
 * ─────────────
 * Filesystem path normalization and validation utilities.
 * Supports both local Windows paths (D:\Shared\HR) and UNC paths
 * (\\fileserver\department\HR).
 *
 * Called by : ntfsScanner.service.js, folderSync.service.js
 * Depends on: node:path (built-in only — no external deps)
 *
 * Exported functions:
 *   normalize(p)          → backslash-normalize
 *   stripTrailing(p)      → remove trailing slash
 *   folderName(p)         → extract basename
 *   isUncPath(p)          → detect UNC
 *   isSafePath(p, base)   → prevent directory traversal
 *   extName(filename)     → lowercase extension e.g. '.pdf'
 *   mimeFromExt(ext)      → basic MIME type mapping
 */

const path = require('path');

/** Map of common file extensions to MIME types. */
const MIME_MAP = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.zip':  'application/zip',
  '.rar':  'application/x-rar-compressed',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogg':  'video/ogg',
  '.mkv':  'video/x-matroska',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
  '.wmv':  'video/x-ms-wmv',
  '.flv':  'video/x-flv',
  '.m4v':  'video/mp4',
  '.3gp':  'video/3gpp',
  '.3g2':  'video/3gpp2',
  '.ts':   'video/mp2t',
  '.mpg':  'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mp3':  'audio/mpeg',
};

/**
 * Normalize path separators to backslash (Windows canonical form).
 * @param {string} p
 * @returns {string}
 */
function normalize(p) {
  return String(p).replace(/\//g, '\\');
}

/**
 * Remove trailing backslash or forward slash.
 * @param {string} p
 * @returns {string}
 */
function stripTrailing(p) {
  return normalize(p).replace(/[/\\]+$/, '');
}

/**
 * Extract the folder or file name (last segment) from a full path.
 * @param {string} fullPath
 * @returns {string}
 */
function folderName(fullPath) {
  return path.basename(stripTrailing(fullPath));
}

/**
 * Detect whether the path is a UNC network path (\\server\share\...).
 * @param {string} p
 * @returns {boolean}
 */
function isUncPath(p) {
  return normalize(p).startsWith('\\\\');
}

/**
 * Validate a path against an allowed base root (prevent directory traversal).
 * Always resolve both paths before comparison.
 *
 * @param {string} p         - path to validate
 * @param {string} basePath  - allowed root (e.g. 'D:\\Shared')
 * @returns {boolean}        - true if p is safely inside basePath
 */
function isSafePath(p, basePath) {
  // UNC paths cannot be resolved with path.resolve — do string check instead
  if (isUncPath(p) || isUncPath(basePath)) {
    return stripTrailing(p).toLowerCase()
      .startsWith(stripTrailing(basePath).toLowerCase());
  }
  const resolved = path.resolve(p);
  const base     = path.resolve(basePath);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

/**
 * Get lowercase file extension including dot.
 * @param {string} filename
 * @returns {string} e.g. '.pdf'
 */
function extName(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Map a file extension to a MIME type string.
 * @param {string} ext  - lowercase extension with dot e.g. '.pdf'
 * @returns {string}
 */
function mimeFromExt(ext) {
  return MIME_MAP[ext] || 'application/octet-stream';
}

module.exports = { normalize, stripTrailing, folderName, isUncPath, isSafePath, extName, mimeFromExt };
