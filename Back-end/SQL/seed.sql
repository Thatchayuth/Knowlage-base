-- ============================================================
-- SEED DATA - Sample Ifaq Structure
-- ============================================================
USE KnowledgeDB;
GO

-- Level 1: Ifaq
INSERT INTO dbo.Categories_Level1 (Name, SortOrder, CreatedBy)
VALUES (N'Ifaq', 1, 'system');
GO

DECLARE @Level1Id INT = SCOPE_IDENTITY();

-- Level 2 categories
INSERT INTO dbo.Categories_Level2 (Level1Id, Name, IsEnabled, SortOrder, CreatedBy) VALUES
(@Level1Id, N'PC',       1, 1, 'system'),
(@Level1Id, N'Printer',  1, 2, 'system'),
(@Level1Id, N'Internet', 1, 3, 'system');
GO

DECLARE @L1 INT = (SELECT Id FROM dbo.Categories_Level1 WHERE Name = N'Ifaq');
DECLARE @PC       INT = (SELECT Id FROM dbo.Categories_Level2 WHERE Name = N'PC'       AND Level1Id = @L1);
DECLARE @Printer  INT = (SELECT Id FROM dbo.Categories_Level2 WHERE Name = N'Printer'  AND Level1Id = @L1);
DECLARE @Internet INT = (SELECT Id FROM dbo.Categories_Level2 WHERE Name = N'Internet' AND Level1Id = @L1);

-- Knowledge items under PC
INSERT INTO dbo.KnowledgeItems (Level1Id, Level2Id, Title, DisplayMode, ContentHtml, PdfUrl, SortOrder, CreatedBy) VALUES
(
    @L1, @PC,
    N'วิธีเปิดคอม',
    'PAGE',
    N'<h2>วิธีเปิดคอมพิวเตอร์</h2><ol><li>กดปุ่ม Power บนเครื่อง</li><li>รอให้ระบบบูทเสร็จสมบูรณ์</li><li>ล็อกอินด้วย Windows Account</li></ol>',
    N'http://fileserver.internal/docs/open-pc.pdf',
    1,
    'system'
),
(
    @L1, @PC,
    N'วิธีปิดเครื่อง',
    'PAGE',
    N'<h2>วิธีปิดเครื่องคอมพิวเตอร์</h2><ol><li>กดปุ่ม Start</li><li>เลือก Shut down</li><li>รอให้เครื่องปิดสนิท</li></ol>',
    N'http://fileserver.internal/docs/shutdown-pc.pdf',
    2,
    'system'
),
(
    @L1, @Printer,
    N'วิธีติดตั้ง Printer Driver',
    'PDF',
    NULL,
    N'http://fileserver.internal/docs/printer-driver-install.pdf',
    1,
    'system'
),
(
    @L1, @Internet,
    N'การตั้งค่า Proxy ภายในองค์กร',
    'PAGE',
    N'<h2>การตั้งค่า Proxy</h2><p>เปิด Settings &gt; Network &gt; Proxy และกรอก proxy.internal:8080</p>',
    N'http://fileserver.internal/docs/proxy-setup.pdf',
    1,
    'system'
);
GO
