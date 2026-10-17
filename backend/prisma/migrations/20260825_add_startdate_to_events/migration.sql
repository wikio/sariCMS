-- Migration: Add startDate to events and publicationDate to news_articles
-- Created: 2026-08-25
-- Description: Adds missing date fields to match frontend expectations

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================

-- Add startDate field (frontend uses startDate, backend uses date)
ALTER TABLE `events` 
ADD COLUMN `startDate` DATETIME(3) NULL AFTER `date`;

-- Copy existing date values to startDate for backward compatibility
UPDATE `events` 
SET `startDate` = `date` 
WHERE `startDate` IS NULL AND `date` IS NOT NULL;

-- Add index for startDate
CREATE INDEX `events_startDate_idx` ON `events`(`startDate`);

-- ============================================================================
-- NEWS_ARTICLES TABLE
-- ============================================================================

-- publicationDate should already exist from previous migration
-- Verify it exists
-- DESCRIBE news_articles;

-- Copy existing date values to publicationDate for backward compatibility
UPDATE `news_articles` 
SET `publicationDate` = `date` 
WHERE `publicationDate` IS NULL AND `date` IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration success for events
SELECT 
  COUNT(*) as total_events,
  SUM(CASE WHEN date IS NOT NULL THEN 1 ELSE 0 END) as with_date,
  SUM(CASE WHEN startDate IS NOT NULL THEN 1 ELSE 0 END) as with_startDate,
  SUM(CASE WHEN endDate IS NOT NULL THEN 1 ELSE 0 END) as with_endDate,
  SUM(CASE WHEN category IS NOT NULL THEN 1 ELSE 0 END) as with_category,
  SUM(CASE WHEN targetAudience IS NOT NULL THEN 1 ELSE 0 END) as with_targetAudience
FROM events
WHERE deletedAt IS NULL;

-- Verify migration success for news_articles
SELECT 
  COUNT(*) as total_articles,
  SUM(CASE WHEN date IS NOT NULL THEN 1 ELSE 0 END) as with_date,
  SUM(CASE WHEN publicationDate IS NOT NULL THEN 1 ELSE 0 END) as with_publicationDate,
  SUM(CASE WHEN category IS NOT NULL THEN 1 ELSE 0 END) as with_category
FROM news_articles
WHERE deletedAt IS NULL;
