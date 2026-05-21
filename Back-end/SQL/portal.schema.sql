-- ============================================================
-- portal.schema.sql
-- File/Folder Portal — MSSQL Schema
-- ============================================================
-- Tables:
--   Folders            — virtual folder registry (maps to real drive paths)
--   FolderPermissions  — AD group → folder access mapping
--   FileMetadata       — scanned file info per folder
--   PortalAuditLogs    — access/action audit trail
--
-- Run AFTER existing schema.sql (does not modify existing tables)
-- Usage: sqlcmd -S <server> -d Celle -i portal.schema.sql
-- ============================================================

USE Celle;
GO

-- ============================================================
-- 1. Folders
-- ============================================================
IF OBJECT_ID('dbo.Folders', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Folders (
        Id          INT            IDENTITY(1,1) NOT NULL,
        FolderName  NVARCHAR(255)  NOT NULL,          -- real OS folder name (updated by sync)
        DisplayName NVARCHAR(255)  NULL,              -- custom display label (preserved by sync)
        FullPath    NVARCHAR(1000) NOT NULL,          -- real path: D:\Shared\HR or \\srv\dept\HR
        ParentId    INT            NULL,              -- NULL = root folder
        SortOrder   INT            NOT NULL DEFAULT 0,
        Icon        NVARCHAR(50)   NOT NULL DEFAULT 'folder', -- icon class/name
        IsActive    BIT            NOT NULL DEFAULT 1,
        Description NVARCHAR(500)  NULL,
        CreatedAt   DATETIME2      NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT PK_Folders PRIMARY KEY (Id),
        CONSTRAINT UQ_Folders_FullPath UNIQUE (FullPath),
        CONSTRAINT FK_Folders_Parent FOREIGN KEY (ParentId)
            REFERENCES dbo.Folders(Id)
    );
    PRINT 'Created table: Folders';
END
GO

-- ============================================================
-- 2. FolderPermissions
-- ============================================================
IF OBJECT_ID('dbo.FolderPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FolderPermissions (
        Id        INT            IDENTITY(1,1) NOT NULL,
        FolderId  INT            NOT NULL,
        AdGroup   NVARCHAR(255)  NOT NULL,  -- CN name of AD group, e.g. "HR-Staff"
        CanView   BIT            NOT NULL DEFAULT 1,
        CanUpload BIT            NOT NULL DEFAULT 0,
        CanDelete BIT            NOT NULL DEFAULT 0,
        CreatedAt DATETIME2      NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT PK_FolderPermissions PRIMARY KEY (Id),
        CONSTRAINT UQ_FolderPermissions_Grp UNIQUE (FolderId, AdGroup),
        CONSTRAINT FK_FolderPermissions_Folder FOREIGN KEY (FolderId)
            REFERENCES dbo.Folders(Id) ON DELETE CASCADE
    );
    PRINT 'Created table: FolderPermissions';
END
GO

-- ============================================================
-- 3. FileMetadata
-- ============================================================
IF OBJECT_ID('dbo.FileMetadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FileMetadata (
        Id            INT             IDENTITY(1,1) NOT NULL,
        FolderId      INT             NOT NULL,
        FileName      NVARCHAR(255)   NOT NULL,
        FullPath      NVARCHAR(1000)  NOT NULL,
        FileSize      BIGINT          NOT NULL DEFAULT 0,    -- bytes
        FileExtension NVARCHAR(20)    NULL,                  -- e.g. '.pdf'
        MimeType      NVARCHAR(100)   NULL,
        IsActive      BIT             NOT NULL DEFAULT 1,
        LastModified  DATETIME2       NULL,
        CreatedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),
        UpdatedAt     DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT PK_FileMetadata PRIMARY KEY (Id),
        CONSTRAINT UQ_FileMetadata_Path UNIQUE (FullPath),
        CONSTRAINT FK_FileMetadata_Folder FOREIGN KEY (FolderId)
            REFERENCES dbo.Folders(Id) ON DELETE CASCADE
    );
    PRINT 'Created table: FileMetadata';
END
GO

-- ============================================================
-- 4. PortalAuditLogs
-- ============================================================
IF OBJECT_ID('dbo.PortalAuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PortalAuditLogs (
        Id           INT             IDENTITY(1,1) NOT NULL,
        Username     NVARCHAR(100)   NULL,          -- DOMAIN\user or 'anonymous'
        Action       NVARCHAR(50)    NOT NULL,      -- VIEW_FOLDER | DOWNLOAD | SYNC | ...
        ResourceType NVARCHAR(50)    NOT NULL,      -- FOLDER | FILE
        ResourceId   INT             NULL,
        ResourcePath NVARCHAR(1000)  NULL,
        Details      NVARCHAR(MAX)   NULL,          -- JSON extra info
        IpAddress    NVARCHAR(50)    NULL,
        UserAgent    NVARCHAR(500)   NULL,
        CreatedAt    DATETIME2       NOT NULL DEFAULT GETDATE(),

        CONSTRAINT PK_PortalAuditLogs PRIMARY KEY (Id)
    );
    PRINT 'Created table: PortalAuditLogs';
END
GO

-- ============================================================
-- 5. Indexes
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Folders_ParentId')
    CREATE INDEX IX_Folders_ParentId ON dbo.Folders(ParentId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Folders_IsActive')
    CREATE INDEX IX_Folders_IsActive ON dbo.Folders(IsActive);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FolderPermissions_FolderId')
    CREATE INDEX IX_FolderPermissions_FolderId ON dbo.FolderPermissions(FolderId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FolderPermissions_AdGroup')
    CREATE INDEX IX_FolderPermissions_AdGroup ON dbo.FolderPermissions(AdGroup);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FileMetadata_FolderId')
    CREATE INDEX IX_FileMetadata_FolderId ON dbo.FileMetadata(FolderId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PortalAuditLogs_Username')
    CREATE INDEX IX_PortalAuditLogs_Username ON dbo.PortalAuditLogs(Username);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PortalAuditLogs_CreatedAt')
    CREATE INDEX IX_PortalAuditLogs_CreatedAt ON dbo.PortalAuditLogs(CreatedAt);
GO
PRINT 'Indexes created.';
GO

-- ============================================================
-- 6. Stored Procedure: GetFolderTree (Recursive CTE)
--    Returns entire subtree from a given root folder id.
--    Pass @RootId = NULL to get full tree.
-- ============================================================
IF OBJECT_ID('dbo.sp_GetFolderTree', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetFolderTree;
GO

CREATE PROCEDURE dbo.sp_GetFolderTree
    @RootId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH FolderTree AS (
        -- Anchor: root folders (or specific root)
        SELECT
            f.Id, f.FolderName, f.FullPath, f.ParentId,
            f.SortOrder, f.Icon, f.IsActive, f.Description, 0 AS Depth
        FROM dbo.Folders f
        WHERE
            f.IsActive = 1
            AND ((@RootId IS NULL AND f.ParentId IS NULL) OR f.Id = @RootId)

        UNION ALL

        -- Recursive: children
        SELECT
            f.Id, f.FolderName, f.FullPath, f.ParentId,
            f.SortOrder, f.Icon, f.IsActive, f.Description, ft.Depth + 1
        FROM dbo.Folders f
        INNER JOIN FolderTree ft ON f.ParentId = ft.Id
        WHERE f.IsActive = 1
    )
    SELECT * FROM FolderTree
    ORDER BY Depth, SortOrder, FolderName;
END
GO
PRINT 'Stored procedure: sp_GetFolderTree created.';
GO
