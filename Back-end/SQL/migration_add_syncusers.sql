-- ============================================================
-- Migration: Create dbo.SyncUsers table
-- ============================================================
-- SyncUsers คือ User รายบุคคล (username จาก AD) ที่ได้รับอนุญาต
-- ให้ trigger folder sync ได้ โดยไม่ต้องเป็น admin กลุ่ม ICT
--
-- สิทธิ์: trigger sync เท่านั้น — ไม่สามารถจัดการโฟลเดอร์/สิทธิ์ได้
-- ผู้จัดการรายชื่อ: admin กลุ่มตาม LDAP_ADMIN_GROUP ใน .env
-- ============================================================

USE Celle;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE  object_id = OBJECT_ID('dbo.SyncUsers')
)
BEGIN
    CREATE TABLE dbo.SyncUsers (
        Id          INT IDENTITY(1,1)   NOT NULL,
        Username    NVARCHAR(100)       NOT NULL,
        CreatedAt   DATETIME2           NOT NULL CONSTRAINT DF_SyncUsers_CreatedAt DEFAULT GETDATE(),
        CreatedBy   NVARCHAR(100)       NOT NULL,
        IsActive    BIT                 NOT NULL CONSTRAINT DF_SyncUsers_IsActive  DEFAULT 1,

        CONSTRAINT PK_SyncUsers         PRIMARY KEY (Id),
        CONSTRAINT UQ_SyncUsers_Username UNIQUE (Username)
    );
    PRINT 'OK: Created table dbo.SyncUsers';
END
ELSE
BEGIN
    PRINT 'Table dbo.SyncUsers already exists — skipped.';
END
GO
