-- Migration: Add translation and date fields to events and news_articles
-- Created: 2026-08-25
-- Description: Adds support for multilingual content with parent-child relationships
--              and proper date handling for events and news articles

-- ============================================================================
-- NEWS_ARTICLES TABLE
-- ============================================================================

-- Add publicationDate field (replaces date field for better datetime handling)
ALTER TABLE `news_articles` 
ADD COLUMN `publicationDate` DATETIME(3) NULL AFTER `date`;

-- Add translation relationship fields
ALTER TABLE `news_articles` 
ADD COLUMN `legacyId` VARCHAR(191) NULL AFTER `publishedAt`,
ADD COLUMN `parentId` INT NULL AFTER `legacyId`,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE AFTER `parentId`;

-- Add indexes for performance
CREATE INDEX `news_articles_legacyId_idx` ON `news_articles`(`legacyId`);
CREATE INDEX `news_articles_parentId_idx` ON `news_articles`(`parentId`);

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================

-- Add category and targetAudience fields
ALTER TABLE `events` 
ADD COLUMN `category` VARCHAR(191) NULL AFTER `type`,
ADD COLUMN `targetAudience` VARCHAR(191) NULL AFTER `category`;

-- Add translation relationship fields
ALTER TABLE `events` 
ADD COLUMN `legacyId` VARCHAR(191) NULL AFTER `publishedAt`,
ADD COLUMN `parentId` INT NULL AFTER `legacyId`,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE AFTER `parentId`;

-- Add indexes for performance
CREATE INDEX `events_legacyId_idx` ON `events`(`legacyId`);
CREATE INDEX `events_parentId_idx` ON `events`(`parentId`);

-- ============================================================================
-- DATA MIGRATION
-- ============================================================================

-- Set existing French records as default (isDefault = true)
UPDATE `news_articles` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `events` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;

-- Generate legacyId for existing French records (if not already set)
-- This creates a unique identifier that will be shared across all language versions
UPDATE `news_articles` 
SET `legacyId` = CONCAT('news_', id, '_', UUID()) 
WHERE `locale` = 'fr' AND (`legacyId` IS NULL OR `legacyId` = '');

UPDATE `events` 
SET `legacyId` = CONCAT('event_', id, '_', UUID()) 
WHERE `locale` = 'fr' AND (`legacyId` IS NULL OR `legacyId` = '');

-- Link existing translations to their parent French records
-- This assumes that translations have the same slug but different locale
UPDATE `news_articles` AS child
INNER JOIN `news_articles` AS parent 
  ON child.slug = parent.slug 
  AND parent.locale = 'fr' 
  AND child.locale != 'fr'
SET 
  child.parentId = parent.id,
  child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `events` AS child
INNER JOIN `events` AS parent 
  ON child.slug = parent.slug 
  AND parent.locale = 'fr' 
  AND child.locale != 'fr'
SET 
  child.parentId = parent.id,
  child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

-- Copy date to publicationDate for existing records (backward compatibility)
UPDATE `news_articles` 
SET `publicationDate` = `date` 
WHERE `publicationDate` IS NULL AND `date` IS NOT NULL;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

/*
TRANSLATION SYSTEM ARCHITECTURE
================================

1. PARENT-CHILD RELATIONSHIP:
   - Each content (event/news) in French (locale='fr') is the PARENT record
   - Translations in other languages (en, ar) are CHILD records
   - parentId: Points to the French parent record (NULL for parent records)
   - isDefault: TRUE for French records, FALSE for translations

2. LEGACY ID:
   - legacyId: Unique identifier shared across all language versions
   - Format: 'news_123_uuid' or 'event_456_uuid'
   - Used for routing and finding all translations of the same content
   - Example: legacyId='news_5_abc123' exists in fr, en, and ar records

3. QUERYING TRANSLATIONS:
   
   a) Get all translations of a specific article:
      SELECT * FROM news_articles WHERE legacyId = 'news_5_abc123';
   
   b) Get French parent with all translations:
      SELECT parent.*, 
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'locale', child.locale,
                 'title', child.title,
                 'id', child.id
               )
             ) as translations
      FROM news_articles parent
      LEFT JOIN news_articles child ON child.parentId = parent.id
      WHERE parent.isDefault = TRUE AND parent.id = 5
      GROUP BY parent.id;
   
   c) Get content for specific locale (with fallback to French):
      SELECT COALESCE(
        (SELECT * FROM news_articles WHERE legacyId = 'news_5_abc123' AND locale = 'ar'),
        (SELECT * FROM news_articles WHERE legacyId = 'news_5_abc123' AND locale = 'fr')
      );

4. CREATING NEW TRANSLATIONS:
   
   Step 1: Create parent (French) record
   INSERT INTO news_articles (locale, slug, title, ..., isDefault, legacyId)
   VALUES ('fr', 'mon-article', 'Mon Article', ..., TRUE, 'news_123_uuid');
   
   Step 2: Create translation (English)
   INSERT INTO news_articles (locale, slug, title, ..., parentId, legacyId, isDefault)
   VALUES ('en', 'my-article', 'My Article', ..., 123, 'news_123_uuid', FALSE);

5. FILTERING IN VITRINE:
   
   - Show only default (French) records in admin list:
     SELECT * FROM news_articles WHERE isDefault = TRUE;
   
   - Show all translations for editing:
     SELECT * FROM news_articles WHERE legacyId = 'news_5_abc123';

6. DATE HANDLING:
   
   - publicationDate: Full ISO-8601 datetime with timezone (e.g., '2026-09-20T15:00:00.000Z')
   - date: Legacy field, kept for backward compatibility
   - endDate: For multi-day events (e.g., '2026-09-22T18:00:00.000Z')
   
   Display logic:
   - If endDate exists and differs from publicationDate → show date range
   - If publicationDate has time (not 00:00:00) → show date and time
   - Otherwise → show date only
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration success
SELECT 
  'news_articles' as table_name,
  COUNT(*) as total_records,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french_records,
  SUM(CASE WHEN locale != 'fr' THEN 1 ELSE 0 END) as translation_records,
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END) as linked_translations,
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END) as with_legacy_id
FROM news_articles

UNION ALL

SELECT 
  'events' as table_name,
  COUNT(*) as total_records,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french_records,
  SUM(CASE WHEN locale != 'fr' THEN 1 ELSE 0 END) as translation_records,
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END) as linked_translations,
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END) as with_legacy_id
FROM events;
