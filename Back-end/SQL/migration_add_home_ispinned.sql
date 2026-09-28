-- ============================================================
-- MIGRATION: Add IsPinned to HomeItems
--   IsPinned = 1 → item shows on the home page by default.
--   IsPinned = 0 → item stays hidden until the user clicks "Show More".
--   A group with no pinned item shows all of its items.
-- ============================================================
USE Celle;
GO

IF COL_LENGTH('dbo.HomeItems', 'IsPinned') IS NULL
BEGIN
    ALTER TABLE dbo.HomeItems
        ADD IsPinned BIT NOT NULL CONSTRAINT DF_HomeItems_IsPinned DEFAULT 0;
    PRINT 'Added column: HomeItems.IsPinned';
END
GO

-- Initial defaults (Cell-E Onsite Desktop):
--   PRODUCTION REPORTS  → Daily Report, Weekly Report
--   PRODUCTION PAPERS   → OPL
--   SUPPORT DOCUMENTS   → Safety Report, Safety Rules
-- Review the result below and adjust by hand if titles differ.
UPDATE dbo.HomeItems
   SET IsPinned = 1
 WHERE Title LIKE N'%Daily%'
    OR Title LIKE N'%Weekly%'
    OR Title =    N'OPL'
    OR Title LIKE N'%Safety%';
GO

SELECT g.Title AS GroupTitle, i.Id, i.Title, i.IsPinned
FROM   dbo.HomeItems i
JOIN   dbo.HomeGroups g ON g.Id = i.GroupId
ORDER  BY g.SortOrder, i.SortOrder, i.Id;
GO
