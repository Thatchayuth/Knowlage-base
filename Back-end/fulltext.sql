-- ============================================================
-- FULL-TEXT SEARCH SETUP
-- Run AFTER schema.sql
-- ============================================================

USE KnowledgeDB;
GO

-- ============================================================
-- 1) Create Full-Text Catalog
-- ============================================================
IF NOT EXISTS (SELECT name FROM sys.fulltext_catalogs WHERE name = 'KnowledgeFTCatalog')
BEGIN
    CREATE FULLTEXT CATALOG KnowledgeFTCatalog
    WITH ACCENT_SENSITIVITY = OFF
    AS DEFAULT;
END
GO

-- ============================================================
-- 2) Create Full-Text Index on KnowledgeItems
--    LANGUAGE 1054 = Thai
-- ============================================================
IF NOT EXISTS (
    SELECT object_id FROM sys.fulltext_indexes
    WHERE object_id = OBJECT_ID('dbo.KnowledgeItems')
)
BEGIN
    CREATE FULLTEXT INDEX ON dbo.KnowledgeItems
    (
        Title           LANGUAGE 1054,
        ContentHtml     LANGUAGE 1054
    )
    KEY INDEX PK_KnowledgeItems
    ON KnowledgeFTCatalog
    WITH CHANGE_TRACKING AUTO, STOPLIST = OFF;
END
GO

-- Wait for population to complete (run separately if needed)
-- EXEC sp_fulltext_catalog 'KnowledgeFTCatalog', 'rebuild'

-- ============================================================
-- 3) Search Stored Procedure using CONTAINSTABLE
-- ============================================================
IF OBJECT_ID('dbo.usp_SearchKnowledge', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SearchKnowledge;
GO

CREATE PROCEDURE dbo.usp_SearchKnowledge
    @SearchTerm     NVARCHAR(500),
    @MaxResults     INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SearchQuery NVARCHAR(500);
    -- Wrap in quotes for phrase or use FORMSOF for inflectional
    SET @SearchQuery = '"' + REPLACE(@SearchTerm, '"', '') + '*"';

    SELECT TOP (@MaxResults)
        ki.Id,
        ki.Title,
        ki.DisplayMode,
        ki.Level1Id,
        ki.Level2Id,
        -- Snippet: first 300 chars of ContentHtml stripped of tags
        LEFT(
            REPLACE(REPLACE(REPLACE(CAST(ki.ContentHtml AS NVARCHAR(500)), '<', ' <'), '>', '> '),
            '  ', ' '),
        300) AS Snippet,
        ft.[RANK]           AS SearchRank,
        ki.CreatedAt,
        ki.UpdatedAt
    FROM dbo.KnowledgeItems ki
    INNER JOIN CONTAINSTABLE(
        dbo.KnowledgeItems,
        (Title, ContentHtml),
        @SearchQuery,
        LANGUAGE 1054
    ) AS ft ON ki.Id = ft.[KEY]
    WHERE ki.IsActive = 1
      AND ki.DeletedAt IS NULL
    ORDER BY ft.[RANK] DESC, ki.ViewCount DESC;
END
GO

-- ============================================================
-- 4) Fallback LIKE search for when FTS index not ready
-- ============================================================
IF OBJECT_ID('dbo.usp_SearchKnowledgeLike', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SearchKnowledgeLike;
GO

CREATE PROCEDURE dbo.usp_SearchKnowledgeLike
    @SearchTerm     NVARCHAR(500),
    @MaxResults     INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@MaxResults)
        ki.Id,
        ki.Title,
        ki.DisplayMode,
        ki.Level1Id,
        ki.Level2Id,
        LEFT(CAST(ki.ContentHtml AS NVARCHAR(500)), 300) AS Snippet,
        0 AS SearchRank,
        ki.CreatedAt,
        ki.UpdatedAt
    FROM dbo.KnowledgeItems ki
    WHERE ki.IsActive = 1
      AND ki.DeletedAt IS NULL
      AND (
          ki.Title LIKE N'%' + @SearchTerm + N'%'
          OR ki.ContentHtml LIKE N'%' + @SearchTerm + N'%'
      )
    ORDER BY ki.ViewCount DESC, ki.UpdatedAt DESC;
END
GO
