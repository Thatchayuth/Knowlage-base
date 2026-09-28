'use strict';
/**
 * folder.controller.js
 * ────────────────────
 * HTTP handlers for folder-related endpoints.
 * Calls folder.service.js — never talks to DB directly.
 *
 * Called by : routes/folders.js
 * Depends on: services/folder.service.js
 *             repositories/auditLog.repository.js
 *
 * Public endpoints  (windowsAuth middleware applied in route):
 *   GET  /api/portal/folders/tree          → getTree
 *   GET  /api/portal/folders/:id/children  → getChildren
 *   GET  /api/portal/folders/:id/files     → getFiles
 *
 * Admin endpoints  (authenticateAD + authorizeGroup applied in route):
 *   GET    /api/portal/admin/folders       → adminList
 *   POST   /api/portal/admin/folders       → adminCreate
 *   PUT    /api/portal/admin/folders/:id   → adminUpdate
 *   DELETE /api/portal/admin/folders/:id   → adminDelete
 */

const folderService = require('../services/folder.service');
const folderRepo    = require('../repositories/folder.repository');
const fileRepo      = require('../repositories/fileMetadata.repository');
const permRepo      = require('../repositories/permission.repository');
const cache         = require('../services/cache.service');
const fs            = require('fs');
const path          = require('path');

/**
 * If user is admin (role set by authenticateAD), return ['*'] sentinel
 * to bypass the permission filter and see all folders.
 */
function effectiveGroups(portalUser) {
  return portalUser.role === 'admin' ? ['*'] : (portalUser.groups || []);
}

// ──────────────────────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/portal/folders/tree
 * Returns the full folder tree filtered by the user's AD groups.
 *
 * Response 200:
 * { success:true, data:[ { Id, FolderName, Icon, children:[...], _hasDirectAccess:bool } ] }
 */
async function getTree(req, res) {
  try {
    const { username } = req.portalUser;
    const tree = await folderService.getFilteredTree(effectiveGroups(req.portalUser), username, req.ip);
    return res.json({ success: true, data: tree });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/portal/folders/:id/children
 * Lazy-load direct children of a folder (for sidebar expand).
 *
 * Response 200: { success:true, data:[ { Id, FolderName, Icon, hasChildren:bool } ] }
 */
async function getChildren(req, res) {
  try {
    const parentId = parseInt(req.params.id, 10);
    const children = await folderService.getChildren(parentId, effectiveGroups(req.portalUser));
    return res.json({ success: true, data: children });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/portal/folders/:id/files
 * Files inside a folder. 403 if user has no permission (handled by middleware).
 *
 * Response 200: { success:true, data:[ { Id, FileName, FileSize, MimeType, LastModified } ] }
 */
async function getFiles(req, res) {
  try {
    const folderId = parseInt(req.params.id, 10);
    const { username } = req.portalUser;
    const files = await folderService.getFiles(folderId, effectiveGroups(req.portalUser), username, req.ip);
    if (files === null) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true, data: files });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// FILE SERVE
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/portal/files/:fileId
 * Streams the actual file from the Shared Drive to the browser.
 * - PDF: Content-Disposition: inline  → renders in browser/iframe
 * - Video: supports Range header      → HTML5 <video> streaming
 * - Others: Content-Disposition: attachment (download)
 */
async function serveFile(req, res) {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (!fileId) return res.status(400).json({ success: false, message: 'Invalid file id' });

    const fileMeta = await fileRepo.getFileById(fileId);
    if (!fileMeta) return res.status(404).json({ success: false, message: 'File not found' });

    // Permission check — admin bypasses
    const groups = effectiveGroups(req.portalUser);
    if (!groups.includes('*')) {
      const hasAccess = await folderService.canAccessFolder(fileMeta.FolderId, groups);
      if (!hasAccess) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filePath = fileMeta.FullPath;
    // console.log(`Serving file ${fileMeta.FileName} (id=${fileId}) to ${req.portalUser.username} from IP ${req.ip}`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }

    const stat     = fs.statSync(filePath);
    const mimeType = fileMeta.MimeType || 'application/octet-stream';
    const fileName = fileMeta.FileName;
    console.log(`Serving file ${fileName} (id=${fileId}, size=${stat.size}, mime=${mimeType}) to ${req.portalUser.username} from IP ${req.ip}`);
    // PDF — inline with Range request support (allows progressive/page-by-page rendering in browser PDF viewer)
    if (mimeType === 'application/pdf') {
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', "frame-ancestors *");
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Accept-Ranges', 'bytes');

      const range = req.headers.range;
      if (range) {
        const parts    = range.replace(/bytes=/, '').split('-');
        const start    = parseInt(parts[0], 10);
        const end      = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkLen = end - start + 1;
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': chunkLen,
          'Content-Type':   'application/pdf',
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      return fs.createReadStream(filePath).pipe(res);
    }

    // Video — range support
    if (mimeType.startsWith('video/')) {
      console.log(`Video request with Range: J${req.headers}`);
      const range = req.headers.range;
      if (range) {
        const parts    = range.replace(/bytes=/, '').split('-');
        const start    = parseInt(parts[0], 10);
        const end      = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkLen = end - start + 1;
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': chunkLen,
          'Content-Type':   mimeType,
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Accept-Ranges', 'bytes');
      return fs.createReadStream(filePath).pipe(res);
    }

    // Other — download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(filePath).pipe(res);

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// ADMIN
// ──────────────────────────────────────────────────────────────
async function adminList(req, res) {
  try {
    const folders = await folderService.getAllForAdmin();
    return res.json({ success: true, data: folders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/portal/admin/folders
 * Body: { FolderName, FullPath, ParentId?, SortOrder?, Icon?, Description?, IsActive? }
 */
async function adminCreate(req, res) {
  try {
    const b = req.body;
    const id = await folderService.createFolder({
      folderName:  (b.FolderName  ?? b.folderName  ?? '').trim(),
      fullPath:    (b.FullPath    ?? b.fullPath     ?? '').trim(),
      parentId:    b.ParentId     ?? b.parentId     ?? null,
      sortOrder:   b.SortOrder    ?? b.sortOrder    ?? 0,
      icon:        b.Icon         ?? b.icon         ?? 'folder',
      description: b.Description  ?? b.description  ?? null,
      isHidden:    toBool(b.IsHidden ?? b.isHidden),
    });
    return res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** true / 1 / 'true' / '1' → true; anything else → false */
function toBool(v) {
  return v === true || v === 1 || v === 'true' || v === '1';
}

/** 400 with both `message` and `error` so either frontend convention shows the text. */
function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg, error: msg });
}

/**
 * PUT /api/portal/admin/folders/:id
 * Body: same shape as POST (partial update OK — only provided fields updated)
 *
 * FullPath is deliberately IGNORED: it is owned by drive sync (the MERGE key),
 * so editing it here would detach the row from its folder on disk.
 * ParentId may change (validated: must exist, must not be the folder itself or
 * one of its descendants). Note: sync re-sets ParentId of non-manual folders
 * from the disk layout on its next run.
 *
 * Response 200: { success:true, data:<saved folder row> }
 */
async function adminUpdate(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const b  = req.body;

    const existing = await folderRepo.getFolderById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบโฟลเดอร์', error: 'ไม่พบโฟลเดอร์' });
    }

    // Normalize PascalCase (from frontend/validator) → camelCase (for service/repo).
    // Only include a field in the payload if it was present in the request body so
    // COALESCE in the repository can distinguish "not provided" from "set to null".
    const data = {};
    if ('FolderName'  in b || 'folderName'  in b) data.folderName  = (b.FolderName  ?? b.folderName  ?? '').trim() || undefined;
    if ('SortOrder'   in b || 'sortOrder'   in b) data.sortOrder   = b.SortOrder   ?? b.sortOrder;
    if ('Icon'        in b || 'icon'        in b) data.icon        = b.Icon        ?? b.icon;
    if ('IsHidden'    in b || 'isHidden'    in b) { const h = b.IsHidden ?? b.isHidden; data.isHidden = h == null ? h : toBool(h); }
    if ('Description' in b || 'description' in b) data.description = b.Description ?? b.description;

    if ('ParentId' in b || 'parentId' in b) {
      const raw = 'ParentId' in b ? b.ParentId : b.parentId;
      const newParent = (raw === null || raw === undefined || raw === '') ? null : parseInt(raw, 10);
      if (newParent !== null) {
        if (!Number.isInteger(newParent) || newParent < 1) {
          return badRequest(res, 'ParentId ไม่ถูกต้อง');
        }
        if (newParent === id) {
          return badRequest(res, 'ไม่สามารถย้ายโฟลเดอร์ไปอยู่ใต้ตัวเองได้');
        }
        const parent = await folderRepo.getFolderById(newParent);
        if (!parent) {
          return badRequest(res, 'ไม่พบโฟลเดอร์แม่ที่เลือก');
        }
        if (await folderRepo.isSelfOrDescendant(id, newParent)) {
          return badRequest(res, 'ไม่สามารถย้ายโฟลเดอร์ไปอยู่ใต้โฟลเดอร์ย่อยของตัวเองได้');
        }
      }
      data.parentId = newParent;
    }
    // FullPath / fullPath in the body are intentionally ignored (see doc above).

    await folderService.updateFolder(id, data);
    const saved = await folderRepo.getFolderById(id);
    return res.json({ success: true, data: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/portal/admin/folders/:id
 * Soft-delete (sets IsActive=0).
 */
async function adminDelete(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await folderService.deleteFolder(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────────
// PORTAL SEARCH
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/portal/search?q=...
 * Search files by filename within folders the user has permission to access.
 * Admin users see all files.
 *
 * Response 200: { success:true, data:[ { Id, FolderId, FolderName, FileName, FileSize, FileExtension, MimeType, LastModified, FolderPath } ] }
 */
async function searchPortalFiles(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });
    if (q.length > 200) return res.status(400).json({ success: false, message: 'Query too long' });

    const groups = effectiveGroups(req.portalUser);

    // Admin bypass — search all files
    if (groups.includes('*')) {
      const files = await fileRepo.searchFilesAll(q);
      return res.json({ success: true, data: files });
    }

    // Get permission map (cached)
    const PERM_TTL_MS = 2 * 60 * 1000;
    let permMap = cache.get('permmap');
    if (!permMap) {
      permMap = await permRepo.getPermissionMap();
      cache.set('permmap', permMap, PERM_TTL_MS);
    }

    // Find folder IDs user can access
    const lowerGroups = groups.map(g => g.toLowerCase());
    const folderIds = [];
    for (const [folderId, allowed] of permMap) {
      if (allowed.some(g => lowerGroups.includes(g))) folderIds.push(folderId);
    }

    if (!folderIds.length) return res.json({ success: true, data: [] });

    const files = await fileRepo.searchFiles(q, folderIds);
    return res.json({ success: true, data: files });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getTree, getChildren, getFiles, serveFile, adminList, adminCreate, adminUpdate, adminDelete, searchPortalFiles };
