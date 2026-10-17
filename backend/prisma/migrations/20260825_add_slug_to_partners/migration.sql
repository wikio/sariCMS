-- Migration: Add slug field to partners table
-- Created: 2026-08-25
-- Description: Adds slug field to partners for URL-friendly identifiers
--              matching the pattern used by other content modules

-- ============================================================================
-- PARTNERS TABLE
-- ============================================================================

-- Add slug field (required for URL routing)
ALTER TABLE `partners` 
ADD COLUMN `slug` VARCHAR(191) NOT NULL DEFAULT '' AFTER `locale`;

-- Generate slugs from existing partner names
-- Format: lowercase, spaces to hyphens, remove special chars
UPDATE `partners` 
SET `slug` = LOWER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(name, ' ', '-'),
          'é', 'e'
        ),
        'è', 'e'
      ),
      'à', 'a'
    ),
    'ç', 'c'
  )
)
WHERE `slug` = '' AND `name` IS NOT NULL;

-- For duplicates, append ID to make them unique
UPDATE `partners` p1
INNER JOIN (
  SELECT slug, locale, MIN(id) as min_id
  FROM partners
  GROUP BY slug, locale
  HAVING COUNT(*) > 1
) p2 ON p1.slug = p2.slug AND p1.locale = p2.locale AND p1.id != p2.min_id
SET p1.slug = CONCAT(p1.slug, '-', p1.id);

-- Add unique constraint on [slug, locale]
ALTER TABLE `partners` 
ADD UNIQUE KEY `partners_slug_locale_key` (`slug`, `locale`);

-- Add index on slug for performance
CREATE INDEX `partners_slug_idx` ON `partners`(`slug`);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration success
SELECT 
  COUNT(*) as total_partners,
  SUM(CASE WHEN slug != '' THEN 1 ELSE 0 END) as with_slug,
  SUM(CASE WHEN slug = '' THEN 1 ELSE 0 END) as without_slug
FROM partners
WHERE deletedAt IS NULL;

-- Check for duplicate slugs (should be 0)
SELECT slug, locale, COUNT(*) as count
FROM partners
WHERE deletedAt IS NULL
GROUP BY slug, locale
HAVING count > 1;
