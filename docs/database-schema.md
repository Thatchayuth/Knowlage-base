# Database Schema — File Portal

Run `Back-end/SQL/portal.schema.sql` against your MSSQL database to create all tables.

---

## Tables

### dbo.Folders

| Column      | Type           | Notes                            |
|-------------|----------------|----------------------------------|
| Id          | INT IDENTITY   | PK                               |
| FolderName  | NVARCHAR(255)  | NOT NULL                         |
| FullPath    | NVARCHAR(1000) | NOT NULL UNIQUE (natural key)    |
| ParentId    | INT            | FK → Folders.Id (self-ref), NULL = root |
| SortOrder   | INT            | Default 0, controls display order |
| Icon        | NVARCHAR(50)   | Emoji or icon identifier         |
| Description | NVARCHAR(500)  | Optional                         |
| IsActive    | BIT            | 0 = soft-deleted / hidden        |
| CreatedAt   | DATETIME2      | Auto-set                         |
| UpdatedAt   | DATETIME2      | Auto-set                         |

**Key index:** `IX_Folders_ParentId` on `ParentId` (for recursive CTE performance)

---

### dbo.FolderPermissions

| Column    | Type          | Notes                                    |
|-----------|---------------|------------------------------------------|
| Id        | INT IDENTITY  | PK                                       |
| FolderId  | INT           | FK → Folders.Id NOT NULL                |
| AdGroup   | NVARCHAR(255) | Lowercase AD group CN name               |
| CanView   | BIT           | Default 1                               |
| CanUpload | BIT           | Default 0                               |
| CanDelete | BIT           | Default 0                               |
| CreatedAt | DATETIME2     |                                          |
| UpdatedAt | DATETIME2     |                                          |

**UNIQUE constraint:** `(FolderId, AdGroup)` — no duplicate group per folder
**Index:** `IX_FolderPermissions_AdGroup` for group-based lookups

---

### dbo.FileMetadata

| Column        | Type           | Notes                           |
|---------------|----------------|---------------------------------|
| Id            | INT IDENTITY   | PK                              |
| FolderId      | INT            | FK → Folders.Id NOT NULL        |
| FileName      | NVARCHAR(500)  | NOT NULL                        |
| FullPath      | NVARCHAR(2000) | NOT NULL UNIQUE (natural key)   |
| FileSize      | BIGINT         | Bytes                           |
| FileExtension | NVARCHAR(50)   |                                 |
| MimeType      | NVARCHAR(255)  |                                 |
| LastModified  | DATETIME2      | From filesystem mtime           |
| IsActive      | BIT            | 0 = file removed from disk      |
| CreatedAt     | DATETIME2      |                                 |
| UpdatedAt     | DATETIME2      |                                 |

---

### dbo.PortalAuditLogs

| Column       | Type           | Notes                              |
|--------------|----------------|------------------------------------|
| Id           | INT IDENTITY   | PK                                 |
| Username     | NVARCHAR(255)  | sAMAccountName                     |
| Action       | NVARCHAR(100)  | VIEW_FOLDER, VIEW_FILE, SYNC, PERM_CHANGE, etc. |
| ResourceType | NVARCHAR(50)   | FOLDER, FILE                       |
| ResourceId   | INT            | FK → Folders.Id (nullable)         |
| ResourcePath | NVARCHAR(2000) | Full path for context              |
| Details      | NVARCHAR(MAX)  | JSON string for extra data         |
| IpAddress    | NVARCHAR(50)   |                                    |
| CreatedAt    | DATETIME2      | Auto-set                           |

---

## Stored Procedure

### dbo.sp_GetFolderTree

Recursive CTE that returns the full subtree starting from a given root folder ID.

```sql
EXEC dbo.sp_GetFolderTree @RootId = NULL;    -- Full tree
EXEC dbo.sp_GetFolderTree @RootId = 5;       -- Subtree from folder 5
```

Returns columns: `Id, FolderName, FullPath, ParentId, SortOrder, Icon, Description, IsActive, Depth`

This mirrors `folder.repository.js → getSubtree()` and can be used directly from SQL tools for reporting.

---

## Permission Map Query

The key query in `permission.repository.js → getPermissionMap()`:

```sql
SELECT FolderId, AdGroup, CanView, CanUpload, CanDelete
FROM dbo.FolderPermissions
ORDER BY FolderId;
```

This loads ALL permissions in one call, then JS code builds a `Map<folderId, string[]>` for O(1) lookup during tree filtering. No per-node permission queries.
