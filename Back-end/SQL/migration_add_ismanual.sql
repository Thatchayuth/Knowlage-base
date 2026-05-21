-- ============================================================
-- Migration: Add IsManual column to dbo.Folders
-- ============================================================
-- IsManual = 1 → สร้างผ่าน Admin UI (ไม่ได้มาจาก disk sync)
-- IsManual = 0 → sync มาจาก disk (default)
--
-- ผล: sync จะไม่ soft-delete โฟลเดอร์ที่ IsManual = 1
--     เพราะโฟลเดอร์เหล่านี้ไม่ได้อยู่บน filesystem จริง
-- ============================================================

USE Celle;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('dbo.Folders') AND name = 'IsManual'
)
BEGIN
    ALTER TABLE dbo.Folders
        ADD IsManual BIT NOT NULL CONSTRAINT DF_Folders_IsManual DEFAULT 0;
    PRINT 'OK: Added column IsManual to dbo.Folders (default = 0 = synced from disk)';
END
ELSE
BEGIN
    PRINT 'Column Folders.IsManual already exists — skipped.';
END
GO
