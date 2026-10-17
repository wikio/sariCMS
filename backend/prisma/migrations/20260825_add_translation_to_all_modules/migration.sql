-- Migration: Add translation system to all content modules
-- Created: 2026-08-25
-- Description: Adds legacyId, parentId, isDefault to all content modules
--              and converts legacyId from Int to String where needed

-- ============================================================================
-- SERVICES TABLE
-- ============================================================================

-- Drop old legacyId (Int) and add new one (String)
ALTER TABLE `services` DROP COLUMN `legacyId`;
ALTER TABLE `services` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `services_legacyId_idx` ON `services`(`legacyId`);
CREATE INDEX `services_parentId_idx` ON `services`(`parentId`);

-- ============================================================================
-- CAREERS TABLE
-- ============================================================================

ALTER TABLE `careers` DROP COLUMN `legacyId`;
ALTER TABLE `careers` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `careers_legacyId_idx` ON `careers`(`legacyId`);
CREATE INDEX `careers_parentId_idx` ON `careers`(`parentId`);

-- ============================================================================
-- PARTNERS TABLE
-- ============================================================================

ALTER TABLE `partners` DROP COLUMN `legacyId`;
ALTER TABLE `partners` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `partners_legacyId_idx` ON `partners`(`legacyId`);
CREATE INDEX `partners_parentId_idx` ON `partners`(`parentId`);

-- ============================================================================
-- SOLUTIONS TABLE
-- ============================================================================

ALTER TABLE `solutions` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `solutions_legacyId_idx` ON `solutions`(`legacyId`);
CREATE INDEX `solutions_parentId_idx` ON `solutions`(`parentId`);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

ALTER TABLE `products` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `products_legacyId_idx` ON `products`(`legacyId`);
CREATE INDEX `products_parentId_idx` ON `products`(`parentId`);

-- ============================================================================
-- TESTIMONIALS TABLE
-- ============================================================================

ALTER TABLE `testimonials` 
ADD COLUMN `legacyId` VARCHAR(191) NULL,
ADD COLUMN `parentId` INT NULL,
ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX `testimonials_legacyId_idx` ON `testimonials`(`legacyId`);
CREATE INDEX `testimonials_parentId_idx` ON `testimonials`(`parentId`);

-- ============================================================================
-- DATA MIGRATION - Set French records as default
-- ============================================================================

UPDATE `services` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `careers` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `partners` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `solutions` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `products` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;
UPDATE `testimonials` SET `isDefault` = TRUE WHERE `locale` = 'fr' AND `isDefault` = FALSE;

-- ============================================================================
-- DATA MIGRATION - Generate legacyId for French records
-- ============================================================================

UPDATE `services` SET `legacyId` = CONCAT('service_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;
UPDATE `careers` SET `legacyId` = CONCAT('career_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;
UPDATE `partners` SET `legacyId` = CONCAT('partner_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;
UPDATE `solutions` SET `legacyId` = CONCAT('solution_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;
UPDATE `products` SET `legacyId` = CONCAT('product_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;
UPDATE `testimonials` SET `legacyId` = CONCAT('testimonial_', id, '_', UUID()) WHERE `locale` = 'fr' AND `legacyId` IS NULL;

-- ============================================================================
-- DATA MIGRATION - Link translations to parents
-- ============================================================================

UPDATE `services` AS child
INNER JOIN `services` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `careers` AS child
INNER JOIN `careers` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `partners` AS child
INNER JOIN `partners` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `solutions` AS child
INNER JOIN `solutions` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `products` AS child
INNER JOIN `products` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

UPDATE `testimonials` AS child
INNER JOIN `testimonials` AS parent ON child.slug = parent.slug AND parent.locale = 'fr' AND child.locale != 'fr'
SET child.parentId = parent.id, child.legacyId = parent.legacyId
WHERE child.parentId IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

SELECT 'services' as table_name, COUNT(*) as total,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french,
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END) as linked,
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END) as with_legacy_id
FROM services WHERE deletedAt IS NULL
UNION ALL
SELECT 'careers', COUNT(*),
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END)
FROM careers WHERE deletedAt IS NULL
UNION ALL
SELECT 'partners', COUNT(*),
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END)
FROM partners WHERE deletedAt IS NULL
UNION ALL
SELECT 'solutions', COUNT(*),
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END)
FROM solutions WHERE deletedAt IS NULL
UNION ALL
SELECT 'products', COUNT(*),
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END)
FROM products WHERE deletedAt IS NULL
UNION ALL
SELECT 'testimonials', COUNT(*),
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END),
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN legacyId IS NOT NULL THEN 1 ELSE 0 END)
FROM testimonials WHERE deletedAt IS NULL;
