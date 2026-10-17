-- Migration: Home section configs + newsletter subscribers
-- Created: 2026-09-06
-- Description: Ajoute les deux tables qui permettent d'administrer les blocs de
--              la page d'accueil (un enregistrement par bloc et par langue) et
--              la liste unique des abonné·es à la newsletter pour tout le site.
--              Ces deux tables s'ajoutent aux modules de contenu existants ; le
--              pilote JSON n'a pas besoin de migration (collections créées à la
--              première écriture).

-- ============================================================================
-- HOME_SECTIONS — configuration des blocs de la page d'accueil
-- ============================================================================

CREATE TABLE `home_sections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(64) NOT NULL,
  `locale` VARCHAR(8) NOT NULL DEFAULT 'fr',
  `label` VARCHAR(191) NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `texts` JSON NULL,
  `selection` JSON NULL,
  `style` JSON NULL,
  `settings` JSON NULL,
  `items` JSON NULL,
  `builder` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'published',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `home_sections_key_locale_key` (`key`, `locale`),
  KEY `home_sections_locale_status_sort_idx` (`locale`, `status`, `sortOrder`),
  KEY `home_sections_deleted_at_idx` (`deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- NEWSLETTER_SUBSCRIBERS — adresses inscrites depuis n'importe quel bloc
-- ============================================================================

CREATE TABLE `newsletter_subscribers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `locale` VARCHAR(8) NOT NULL DEFAULT 'fr',
  `status` VARCHAR(24) NOT NULL DEFAULT 'subscribed',
  `source` VARCHAR(80) NULL,
  `consent` TINYINT(1) NOT NULL DEFAULT 0,
  `topics` JSON NULL,
  `notes` TEXT NULL,
  `token` VARCHAR(80) NULL,
  `ip` VARCHAR(64) NULL,
  `userAgent` TEXT NULL,
  `subscribedAt` DATETIME(3) NULL,
  `unsubscribedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `newsletter_subscribers_email_key` (`email`),
  KEY `newsletter_subscribers_status_locale_idx` (`status`, `locale`),
  KEY `newsletter_subscribers_source_idx` (`source`),
  KEY `newsletter_subscribers_deleted_at_idx` (`deletedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT COUNT(*) AS home_sections FROM `home_sections`;
SELECT COUNT(*) AS newsletter_subscribers FROM `newsletter_subscribers`;
