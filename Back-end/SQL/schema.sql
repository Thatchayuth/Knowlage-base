-- ============================================================
-- KNOWLEDGE MANAGEMENT SYSTEM - FULL SQL SCHEMA
-- MSSQL 2019+
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'KnowledgeDB')
BEGIN
    CREATE DATABASE KnowledgeDB
    COLLATE Thai_CI_AS;
END
GO

USE KnowledgeDB;
GO

-- ============================================================
-- TABLE: Categories_Level1
-- ============================================================
IF OBJECT_ID('dbo.Categories_Level1', 'U') IS NOT NULL DROP TABLE dbo.Categories_Level1;
GO

CREATE TABLE dbo.Categories_Level1 (
    Id          INT IDENTITY(1,1)   NOT NULL,
    Name        NVARCHAR(200)       NOT NULL,
    SortOrder   INT                 NOT NULL DEFAULT 0,
    IsActive    BIT                 NOT NULL DEFAULT 1,
    Icon        NVARCHAR(100)       NULL,
    CreatedBy   NVARCHAR(100)       NOT NULL,
    UpdatedBy   NVARCHAR(100)       NULL,
    CreatedAt   DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt   DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    DeletedAt   DATETIME2(3)        NULL,

    CONSTRAINT PK_Categories_Level1 PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT UQ_Categories_Level1_Name UNIQUE (Name)
);
GO

CREATE INDEX IX_Categories_Level1_IsActive  ON dbo.Categories_Level1 (IsActive) INCLUDE (Name, SortOrder, DeletedAt);
CREATE INDEX IX_Categories_Level1_DeletedAt ON dbo.Categories_Level1 (DeletedAt) WHERE DeletedAt IS NULL;
GO

-- ============================================================
-- TABLE: Categories_Level2
-- ============================================================
IF OBJECT_ID('dbo.Categories_Level2', 'U') IS NOT NULL DROP TABLE dbo.Categories_Level2;
GO

CREATE TABLE dbo.Categories_Level2 (
    Id          INT IDENTITY(1,1)   NOT NULL,
    Level1Id    INT                 NOT NULL,
    Name        NVARCHAR(200)       NOT NULL,
    Icon        NVARCHAR(100)       NULL,
    IsEnabled   BIT                 NOT NULL DEFAULT 1,   -- enable/disable toggle
    SortOrder   INT                 NOT NULL DEFAULT 0,
    IsActive    BIT                 NOT NULL DEFAULT 1,
    CreatedBy   NVARCHAR(100)       NOT NULL,
    UpdatedBy   NVARCHAR(100)       NULL,
    CreatedAt   DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt   DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    DeletedAt   DATETIME2(3)        NULL,

    CONSTRAINT PK_Categories_Level2 PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Categories_Level2_Level1 FOREIGN KEY (Level1Id) REFERENCES dbo.Categories_Level1 (Id)
);
GO

CREATE INDEX IX_Categories_Level2_Level1Id  ON dbo.Categories_Level2 (Level1Id) INCLUDE (Name, IsEnabled, SortOrder, IsActive, DeletedAt);
CREATE INDEX IX_Categories_Level2_IsActive  ON dbo.Categories_Level2 (IsActive) INCLUDE (Level1Id, IsEnabled);
CREATE INDEX IX_Categories_Level2_DeletedAt ON dbo.Categories_Level2 (DeletedAt) WHERE DeletedAt IS NULL;
CREATE INDEX IX_Categories_Level2_IsEnabled ON dbo.Categories_Level2 (IsEnabled, IsActive) WHERE DeletedAt IS NULL;
GO

-- ============================================================
-- TABLE: KnowledgeItems
-- ============================================================
IF OBJECT_ID('dbo.KnowledgeItems', 'U') IS NOT NULL DROP TABLE dbo.KnowledgeItems;
GO

CREATE TABLE dbo.KnowledgeItems (
    Id              INT IDENTITY(1,1)   NOT NULL,
    Level1Id        INT                 NOT NULL,
    Level2Id        INT                 NULL,       -- nullable: if Level2 disabled, items go direct
    Title           NVARCHAR(500)       NOT NULL,
    DisplayMode     NVARCHAR(10)        NOT NULL    -- 'PDF' or 'PAGE'
                    CONSTRAINT CHK_KnowledgeItems_DisplayMode CHECK (DisplayMode IN ('PDF','PAGE')),
    ContentHtml     NVARCHAR(MAX)       NULL,       -- used when DisplayMode = 'PAGE'
    PdfUrl          NVARCHAR(1000)      NULL,       -- URL on internal file server
    SortOrder       INT                 NOT NULL DEFAULT 0,
    ViewCount       INT                 NOT NULL DEFAULT 0,
    IsActive        BIT                 NOT NULL DEFAULT 1,
    CreatedBy       NVARCHAR(100)       NOT NULL,
    UpdatedBy       NVARCHAR(100)       NULL,
    CreatedAt       DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt       DATETIME2(3)        NOT NULL DEFAULT SYSDATETIME(),
    DeletedAt       DATETIME2(3)        NULL,

    CONSTRAINT PK_KnowledgeItems PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_KnowledgeItems_Level1 FOREIGN KEY (Level1Id) REFERENCES dbo.Categories_Level1 (Id),
    CONSTRAINT FK_KnowledgeItems_Level2 FOREIGN KEY (Level2Id) REFERENCES dbo.Categories_Level2 (Id),
    CONSTRAINT CHK_KnowledgeItems_PageContent CHECK (
        (DisplayMode = 'PAGE' AND ContentHtml IS NOT NULL) OR
        (DisplayMode = 'PDF')
    )
);
GO

CREATE INDEX IX_KnowledgeItems_Level1Id  ON dbo.KnowledgeItems (Level1Id) INCLUDE (Level2Id, Title, DisplayMode, IsActive, DeletedAt);
CREATE INDEX IX_KnowledgeItems_Level2Id  ON dbo.KnowledgeItems (Level2Id) INCLUDE (Level1Id, Title, DisplayMode, IsActive, DeletedAt);
CREATE INDEX IX_KnowledgeItems_IsActive  ON dbo.KnowledgeItems (IsActive) WHERE DeletedAt IS NULL;
CREATE INDEX IX_KnowledgeItems_DeletedAt ON dbo.KnowledgeItems (DeletedAt) WHERE DeletedAt IS NULL;
CREATE INDEX IX_KnowledgeItems_SortOrder ON dbo.KnowledgeItems (Level1Id, Level2Id, SortOrder) WHERE DeletedAt IS NULL AND IsActive = 1;
GO

-- ============================================================
-- TABLE: SystemLogs
-- ============================================================
IF OBJECT_ID('dbo.SystemLogs', 'U') IS NOT NULL DROP TABLE dbo.SystemLogs;
GO

CREATE TABLE dbo.SystemLogs (
    Id              BIGINT IDENTITY(1,1)    NOT NULL,
    LogLevel        NVARCHAR(20)            NOT NULL,
    ActionType      NVARCHAR(50)            NOT NULL,
    Username        NVARCHAR(100)           NULL,
    IpAddress       NVARCHAR(50)            NULL,
    UserAgent       NVARCHAR(500)           NULL,
    Entity          NVARCHAR(100)           NULL,
    EntityId        NVARCHAR(50)            NULL,
    Message         NVARCHAR(MAX)           NOT NULL,
    ExecutionTimeMs INT                     NULL,
    ErrorStack      NVARCHAR(MAX)           NULL,
    Metadata        NVARCHAR(MAX)           NULL,   -- JSON extras
    CreatedAt       DATETIME2(3)            NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT PK_SystemLogs PRIMARY KEY CLUSTERED (Id)
);
GO

CREATE INDEX IX_SystemLogs_ActionType ON dbo.SystemLogs (ActionType, CreatedAt DESC);
CREATE INDEX IX_SystemLogs_Username   ON dbo.SystemLogs (Username, CreatedAt DESC);
CREATE INDEX IX_SystemLogs_LogLevel   ON dbo.SystemLogs (LogLevel, CreatedAt DESC);
CREATE INDEX IX_SystemLogs_CreatedAt  ON dbo.SystemLogs (CreatedAt DESC);
GO

-- ============================================================
-- STORED PROCEDURE: Increment ViewCount
-- ============================================================
IF OBJECT_ID('dbo.usp_IncrementViewCount', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_IncrementViewCount;
GO
CREATE PROCEDURE dbo.usp_IncrementViewCount
    @KnowledgeId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.KnowledgeItems SET ViewCount = ViewCount + 1 WHERE Id = @KnowledgeId AND DeletedAt IS NULL;
END
GO
