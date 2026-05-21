-- ============================================================
-- Migration: Add ExternalUrl + LINK display mode
-- ============================================================
USE Celle;
GO

-- 1. Add ExternalUrl column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.KnowledgeItems') AND name = 'ExternalUrl')
BEGIN
    ALTER TABLE dbo.KnowledgeItems ADD ExternalUrl NVARCHAR(2000) NULL;
    PRINT 'OK: Added column ExternalUrl';
END
ELSE
    PRINT 'SKIP: ExternalUrl already exists';
GO

-- 2. Drop old CHECK constraint and recreate with LINK added
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_KnowledgeItems_DisplayMode')
BEGIN
    ALTER TABLE dbo.KnowledgeItems DROP CONSTRAINT CHK_KnowledgeItems_DisplayMode;
    PRINT 'OK: Dropped old CHK_KnowledgeItems_DisplayMode';
END
GO

ALTER TABLE dbo.KnowledgeItems
    ADD CONSTRAINT CHK_KnowledgeItems_DisplayMode
    CHECK (DisplayMode IN ('PDF','PAGE','LINK'));
PRINT 'OK: Recreated CHK_KnowledgeItems_DisplayMode with LINK support';
GO
