-- ============================================================
-- Migration: Add IsHidden column to dbo.Folders
-- Run ONCE on the production database (celle).
-- ============================================================
-- Purpose:
--   Separates "hidden by admin" (IsHidden) from "not found on disk" (IsActive).
--
--   IsActive  = managed ONLY by sync
--               1 = folder exists on disk
--               0 = soft-deleted by sync (folder missing from disk)
--
--   IsHidden  = managed ONLY by admin UI
--               0 = visible to users (default)
--               1 = admin chose to hide — sync will NEVER reset this
--
--   Users see folders WHERE IsActive = 1 AND IsHidden = 0
-- ============================================================

USE celle;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('dbo.Folders') AND name = 'IsHidden'
)
BEGIN
    ALTER TABLE dbo.Folders
        ADD IsHidden BIT NOT NULL CONSTRAINT DF_Folders_IsHidden DEFAULT 0;
    PRINT 'OK: Added column IsHidden to dbo.Folders (default = 0, all folders visible)';
END
ELSE
BEGIN
    PRINT 'SKIP: Column IsHidden already exists.';
END
GO
