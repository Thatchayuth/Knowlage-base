-- ============================================================
-- MIGRATION: Home Columns (3-column dashboard on user homepage)
--   HomeGroups            — 3 groups (NORMAL_WORK / ABNORMAL_WORK / ADDITIONAL_INFO)
--   HomeItems             — items inside each group (polymorphic link)
--   HomeItemFileMappings  — for 'program' items: AD-group → filePath table
-- ============================================================
USE Celle;
GO

-- ── HomeGroups ──────────────────────────────────────────────
IF OBJECT_ID('dbo.HomeGroups', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HomeGroups (
        Id          INT IDENTITY(1,1) NOT NULL,
        GroupKey    NVARCHAR(50)      NOT NULL,                         -- 'NORMAL_WORK' | 'ABNORMAL_WORK' | 'ADDITIONAL_INFO'
        Title       NVARCHAR(200)     NOT NULL,
        Subtitle    NVARCHAR(300)     NULL,
        Icon        NVARCHAR(2000)    NULL,                             -- SVG path d-attr or icon name
        Color       NVARCHAR(20)      NOT NULL DEFAULT 'blue',          -- 'blue' | 'red' | 'green' | hex
        SortOrder   INT               NOT NULL DEFAULT 0,
        IsEnabled   BIT               NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2(3)      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2(3)      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedBy   NVARCHAR(100)     NULL,
        CONSTRAINT PK_HomeGroups PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_HomeGroups_GroupKey UNIQUE (GroupKey)
    );
    PRINT 'Created table: HomeGroups';
END
GO

-- ── HomeItems ───────────────────────────────────────────────
IF OBJECT_ID('dbo.HomeItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HomeItems (
        Id           INT IDENTITY(1,1) NOT NULL,
        GroupId      INT               NOT NULL,
        Title        NVARCHAR(200)     NOT NULL,
        Subtitle     NVARCHAR(300)     NULL,
        Icon         NVARCHAR(2000)    NULL,
        LinkType     NVARCHAR(30)      NOT NULL,                        -- 'program' | 'folder' | 'knowledge' | 'external_link'
        ProgramType  NVARCHAR(50)      NULL,                            -- 'powerbi' | 'excel' | 'word' | 'file'
        FolderId     INT               NULL,
        KnowledgeId  INT               NULL,
        ExternalUrl  NVARCHAR(2000)    NULL,
        SortOrder    INT               NOT NULL DEFAULT 0,
        IsEnabled    BIT               NOT NULL DEFAULT 1,
        CreatedAt    DATETIME2(3)      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt    DATETIME2(3)      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedBy    NVARCHAR(100)     NULL,
        CONSTRAINT PK_HomeItems PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_HomeItems_Group     FOREIGN KEY (GroupId)     REFERENCES dbo.HomeGroups(Id) ON DELETE CASCADE,
        CONSTRAINT FK_HomeItems_Folder    FOREIGN KEY (FolderId)    REFERENCES dbo.Folders(Id),
        CONSTRAINT FK_HomeItems_Knowledge FOREIGN KEY (KnowledgeId) REFERENCES dbo.KnowledgeItems(Id),
        CONSTRAINT CK_HomeItems_LinkType  CHECK (LinkType IN ('program','folder','knowledge','external_link'))
    );
    PRINT 'Created table: HomeItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HomeItems_GroupId')
    CREATE INDEX IX_HomeItems_GroupId ON dbo.HomeItems(GroupId, SortOrder, IsEnabled);
GO

-- ── HomeItemFileMappings ────────────────────────────────────
IF OBJECT_ID('dbo.HomeItemFileMappings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HomeItemFileMappings (
        Id         INT IDENTITY(1,1) NOT NULL,
        ItemId     INT               NOT NULL,
        AdGroup    NVARCHAR(200)     NOT NULL,
        FilePath   NVARCHAR(1000)    NOT NULL,
        SortOrder  INT               NOT NULL DEFAULT 0,
        CreatedAt  DATETIME2(3)      NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_HomeItemFileMappings PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_HomeItemFileMappings_Item FOREIGN KEY (ItemId) REFERENCES dbo.HomeItems(Id) ON DELETE CASCADE
    );
    PRINT 'Created table: HomeItemFileMappings';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HomeItemFileMappings_ItemGroup')
    CREATE INDEX IX_HomeItemFileMappings_ItemGroup
        ON dbo.HomeItemFileMappings(ItemId, AdGroup);
GO

-- ── Seed default 3 groups ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.HomeGroups WHERE GroupKey = 'NORMAL_WORK')
BEGIN
    INSERT INTO dbo.HomeGroups (GroupKey, Title, Subtitle, Icon, Color, SortOrder, IsEnabled, UpdatedBy)
    VALUES ('NORMAL_WORK',
            'NORMAL WORK',
            N'ให้เปิดหน้าจอค้างไว้ดังนี้',
            'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
            'blue', 1, 1, 'system');
END
IF NOT EXISTS (SELECT 1 FROM dbo.HomeGroups WHERE GroupKey = 'ABNORMAL_WORK')
BEGIN
    INSERT INTO dbo.HomeGroups (GroupKey, Title, Subtitle, Icon, Color, SortOrder, IsEnabled, UpdatedBy)
    VALUES ('ABNORMAL_WORK',
            'ABNORMAL WORK',
            N'สามารถเข้าถึงข้อมูลได้ดังนี้',
            'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
            'red', 2, 1, 'system');
END
IF NOT EXISTS (SELECT 1 FROM dbo.HomeGroups WHERE GroupKey = 'ADDITIONAL_INFO')
BEGIN
    INSERT INTO dbo.HomeGroups (GroupKey, Title, Subtitle, Icon, Color, SortOrder, IsEnabled, UpdatedBy)
    VALUES ('ADDITIONAL_INFO',
            'ADDITIONAL INFO',
            N'ประกอบการบริหารการจัดการ',
            'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            'green', 3, 1, 'system');
END
GO

PRINT 'Migration completed: Home Columns';
