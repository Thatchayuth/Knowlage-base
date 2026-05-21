# API Reference — File Portal

Base path: `/api/portal`

All public endpoints require Windows Authentication (IIS forwards `X-Auth-User` header).
All admin endpoints require existing admin login (`Authorization: Basic ...` with AD group `admin-dt`).

---

## Public Endpoints

### GET /api/portal/folders/tree

Returns the full folder tree filtered by the current user's AD group permissions.

**Request:** No body. Windows Auth header required.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "Id": 1,
      "FolderName": "HR",
      "FullPath": "D:\\Shared\\HR",
      "ParentId": null,
      "SortOrder": 10,
      "Icon": "📁",
      "Description": "Human Resources",
      "IsActive": true,
      "_hasDirectAccess": true,
      "children": [
        {
          "Id": 2,
          "FolderName": "Salary",
          "FullPath": "D:\\Shared\\HR\\Salary",
          "ParentId": 1,
          "_hasDirectAccess": true,
          "children": []
        }
      ]
    }
  ]
}
```

**Errors:** 401 (no auth), 500

---

### GET /api/portal/folders/:id/children

Lazy-load direct children of a folder (for sidebar expand, avoids loading full deep tree).

**Params:** `id` — folder ID (integer)

**Response 200:**
```json
{ "success": true, "data": [ { "Id": 3, "FolderName": "2025", ... } ] }
```

**Errors:** 400 (invalid id), 401, 500

---

### GET /api/portal/folders/:id/files

Files inside a folder. Returns 403 if user has no CanView permission.

**Params:** `id` — folder ID

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "Id": 101,
      "FolderId": 2,
      "FileName": "Salary_Report_2025.xlsx",
      "FullPath": "D:\\Shared\\HR\\Salary\\Salary_Report_2025.xlsx",
      "FileSize": 204800,
      "FileExtension": "xlsx",
      "MimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "LastModified": "2025-06-01T10:30:00.000Z",
      "IsActive": true
    }
  ]
}
```

**Errors:** 400, 401, 403 (no permission), 500

---

## Admin Endpoints

All require: `Authorization: Basic <base64>` where credentials belong to `admin-dt` AD group.

### GET /api/portal/admin/folders

All folders (unfiltered, including inactive).

**Response 200:** `{ success: true, data: Folder[] }`

---

### POST /api/portal/admin/folders

Create a folder manually (not via sync).

**Body:**
```json
{
  "FolderName": "Finance",
  "FullPath": "D:\\Shared\\Finance",
  "ParentId": null,
  "SortOrder": 20,
  "Icon": "💰",
  "Description": "Finance documents",
  "IsActive": true
}
```

**Response 201:** `{ success: true, data: { id: 5 } }`

---

### PUT /api/portal/admin/folders/:id

Update folder metadata (partial update — only provided fields).

**Body:** Any subset of POST fields.

**Response 200:** `{ success: true }`

---

### DELETE /api/portal/admin/folders/:id

Soft-delete folder (sets `IsActive=0`).

**Response 200:** `{ success: true }`

---

### GET /api/portal/admin/permissions/:folderId

Get all AD group permissions for a folder.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "FolderId": 1, "AdGroup": "hr-staff", "CanView": true, "CanUpload": false, "CanDelete": false },
    { "FolderId": 1, "AdGroup": "hr-manager", "CanView": true, "CanUpload": true, "CanDelete": true }
  ]
}
```

---

### POST /api/portal/admin/permissions

Upsert a single permission.

**Body:**
```json
{ "folderId": 1, "adGroup": "hr-staff", "canView": true, "canUpload": false, "canDelete": false }
```

**Response 200:** `{ success: true }`

---

### DELETE /api/portal/admin/permissions/:folderId/:adGroup

Remove a group from a folder's permission list.

**Response 200:** `{ success: true }`

---

### PUT /api/portal/admin/permissions/:folderId

Replace ALL permissions for a folder.

**Body:**
```json
{
  "permissions": [
    { "adGroup": "hr-staff",   "canView": true, "canUpload": false, "canDelete": false },
    { "adGroup": "hr-manager", "canView": true, "canUpload": true,  "canDelete": true }
  ]
}
```

**Response 200:** `{ success: true }`

---

### POST /api/portal/admin/sync

Trigger a full drive sync. Scans the filesystem and syncs to DB.

**Body (optional):**
```json
{ "rootPath": "D:\\Shared" }
```
If omitted, uses `PORTAL_DRIVE_ROOT` env variable.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "inserted": 12,
    "updated": 34,
    "deleted": 2,
    "filesScanned": 456,
    "durationMs": 3241,
    "errors": []
  }
}
```

---

### GET /api/portal/admin/sync/logs?limit=50

Recent sync audit logs.

**Response 200:** `{ success: true, data: AuditLog[] }`
