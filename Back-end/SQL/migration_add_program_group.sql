-- ============================================================
-- MIGRATION: Add 'program_group' link type to HomeItems
--   program_group — AD-group → Folder Path mapping.
--   Clicking the item lists all files inside the mapped folder
--   (server-side readdir) and lets the user pick which to open.
-- ============================================================
USE Celle;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HomeItems_LinkType')
BEGIN
    ALTER TABLE dbo.HomeItems DROP CONSTRAINT CK_HomeItems_LinkType;
    PRINT 'Dropped constraint: CK_HomeItems_LinkType';
END
GO

ALTER TABLE dbo.HomeItems ADD CONSTRAINT CK_HomeItems_LinkType
    CHECK (LinkType IN ('program','program_group','folder','knowledge','external_link'));
PRINT 'Re-created constraint: CK_HomeItems_LinkType (now includes program_group)';
GO
