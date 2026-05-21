-- ============================================================
-- Migration: Add DisplayName column to dbo.Folders
-- Run once against the Celle database.
-- Safe to re-run (IF NOT EXISTS guard).
-- ============================================================
USE Celle;
GO

-- Add DisplayName (nullable) if it doesn't exist yet
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('dbo.Folders') AND name = 'DisplayName'
)
BEGIN
    ALTER TABLE dbo.Folders
        ADD DisplayName NVARCHAR(255) NULL;
    PRINT 'Added column: Folders.DisplayName';
END
ELSE
BEGIN
    PRINT 'Column Folders.DisplayName already exists — skipped.';
END
GO

-- Update stored procedure to return DisplayName
IF OBJECT_ID('dbo.sp_GetFolderTree', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetFolderTree;
GO

CREATE PROCEDURE dbo.sp_GetFolderTree
    @RootId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH FolderTree AS (
        SELECT
            f.Id, f.FolderName, f.DisplayName,
            COALESCE(f.DisplayName, f.FolderName) AS DisplayLabel,
            f.FullPath, f.ParentId,
            f.SortOrder, f.Icon, f.IsActive, f.Description, 0 AS Depth
        FROM dbo.Folders f
        WHERE
            f.IsActive = 1
            AND ((@RootId IS NULL AND f.ParentId IS NULL) OR f.Id = @RootId)

        UNION ALL

        SELECT
            f.Id, f.FolderName, f.DisplayName,
            COALESCE(f.DisplayName, f.FolderName) AS DisplayLabel,
            f.FullPath, f.ParentId,
            f.SortOrder, f.Icon, f.IsActive, f.Description, ft.Depth + 1
        FROM dbo.Folders f
        INNER JOIN FolderTree ft ON f.ParentId = ft.Id
        WHERE f.IsActive = 1
    )
    SELECT * FROM FolderTree
    ORDER BY Depth, SortOrder, FolderName;
END
GO

PRINT 'Migration complete.';
GO
