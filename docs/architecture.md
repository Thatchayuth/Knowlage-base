# Architecture — File/Folder Portal

## Overview

ระบบ File/Folder Portal เป็น feature เพิ่มเติมที่ integrate กับ Knowledge Base Portal เดิม
โดยใช้ Design/Layout/Theme เดิมทั้งหมด ไม่ redesign UI ใด ๆ

---

## Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18 + Vite + TailwindCSS (เดิม) |
| Backend   | Node.js + Express (เดิม)          |
| Database  | MSSQL Server (เดิม)               |
| Auth      | Windows Auth (IIS) / LDAP (เดิม) |
| Drive     | Windows Shared Drive / UNC Path   |

---

## Folder Structure

```
Back-end/
├── SQL/
│   └── portal.schema.sql          ← MSSQL DDL: 4 tables + SP
└── server/
    ├── app.js                     ← + 2 new app.use() for portal routes
    ├── repositories/
    │   ├── folder.repository.js   ← SQL: Folders table CRUD + recursive CTE
    │   ├── permission.repository.js ← SQL: FolderPermissions CRUD + permission map
    │   ├── fileMetadata.repository.js ← SQL: FileMetadata CRUD
    │   └── auditLog.repository.js ← SQL: PortalAuditLogs write/read
    ├── services/
    │   ├── cache.service.js       ← TTL in-memory cache (existing)
    │   ├── adGroup.service.js     ← Wraps ldapService.getUserGroups + cache
    │   ├── folder.service.js      ← Business logic: build/filter tree
    │   ├── permission.service.js  ← Business logic: read/write permissions
    │   ├── ntfsScanner.service.js ← Scan filesystem recursively
    │   └── folderSync.service.js  ← Orchestrate full drive → DB sync
    ├── controllers/
    │   ├── folder.controller.js   ← HTTP handlers for folder endpoints
    │   ├── permission.controller.js ← HTTP handlers for permission endpoints
    │   └── sync.controller.js     ← HTTP handlers for sync trigger/logs
    ├── middlewares/
    │   ├── auth.js                ← EXISTING: authenticateAD, authorizeGroup
    │   ├── windowsAuth.middleware.js ← NEW: reads IIS Windows Auth header
    │   └── permission.middleware.js  ← NEW: per-request folder access check
    └── routes/
        ├── folders.js             ← NEW: /api/portal/folders/* routes
        └── permissions.js         ← NEW: /api/portal/admin/permissions/* routes

Font-End/src/
├── services/
│   └── portal.service.js          ← Axios calls to /api/portal/*
├── hooks/
│   ├── useFolderTree.js           ← Fetch + state for folder tree
│   └── useFolderFiles.js          ← Fetch + state for files in folder
├── components/portal/
│   ├── FolderIcon.jsx             ← Extension-based file icon
│   ├── FolderBreadcrumb.jsx       ← Navigation breadcrumb
│   ├── FolderCard.jsx             ← Grid card for folder
│   ├── FileList.jsx               ← Table of files
│   └── FolderTree.jsx             ← Recursive sidebar tree
├── pages/
│   ├── FolderPortalPage.jsx       ← /portal (root)
│   ├── FolderViewPage.jsx         ← /portal/:id
│   └── admin/
│       ├── AdminFolderPage.jsx    ← /administrator/portal/folders
│       ├── FolderFormPage.jsx     ← /administrator/portal/folders/new|:id/edit
│       ├── AdminPermissionsPage.jsx ← /administrator/portal/permissions/:folderId
│       └── AdminSyncPage.jsx      ← /administrator/portal/sync
└── layouts/
    └── PublicLayout.jsx           ← + "File Portal" link in sidebar footer

docs/
├── architecture.md     ← this file
├── api-reference.md
├── database-schema.md
├── permission-model.md
└── deployment-guide.md
```

---

## Request Flow

### Public User — View Folder Tree

```
Browser (IIS Windows Auth)
  → GET /api/portal/folders/tree
  → windowsAuth.middleware        reads X-Auth-User header
  → adGroup.service.getGroups()   cache or LDAP query
  → folder.controller.getTree()
  → folder.service.getFilteredTree(userGroups)
      → cache.get('foldertree')       or folderRepo.getAllFolders()
      → cache.get('permmap')          or permRepo.getPermissionMap()
      → treeBuilder.buildTree(flat)
      → treeBuilder.filterTreeByPermission(tree, userGroups, permMap)
  → JSON response: nested filtered tree
```

### Admin — Trigger Sync

```
Admin Browser (Basic Auth session)
  → POST /api/portal/admin/sync  { rootPath }
  → authenticateAD + authorizeGroup('admin-dt')
  → sync.controller.triggerSync()
  → folderSync.service.syncDrive(rootPath)
      → ntfsScanner.scanFolders(rootPath)   [recursive fs.readdirSync]
      → folderRepo.getAllPaths()             [existing DB paths]
      → upsertByPath() for each new/changed folder
      → scanFiles() + upsertFile() per folder
      → deleteFolder() for removed folders
      → cache.flush()
      → auditRepo.log()
  → JSON: { inserted, updated, deleted, filesScanned, durationMs, errors[] }
```

---

## Key Design Decisions

1. **Permission Map in one query** — `permRepo.getPermissionMap()` loads ALL permissions in a single SQL call → `Map<folderId, groups[]>` → then filters in JS (no N+1)
2. **Parent visibility rule** — `filterTreeByPermission()` shows a parent folder even if user only has access to a child (for navigation), marked `_hasDirectAccess=false`
3. **Soft-delete** — `Folders.IsActive=0` instead of hard DELETE preserves audit trail
4. **In-memory TTL cache** — 2min for tree/permmap, 5min for AD groups; `cache.flush()` called after every sync
5. **Admin reuses existing auth** — `authenticateAD + authorizeGroup('admin-dt')` from `middlewares/auth.js` — no new admin auth system
6. **CSS unchanged** — All new components use only existing Tailwind classes (`nav-item`, `nav-item-active`, `btn-primary`, `input-field`, `skeleton`, `bg-slate-800`, etc.)
