-- =============================================================================
-- SARI CMS — Schéma MySQL (MySQL 8.0+ / MariaDB 10.4+)
-- Généré à partir du schéma Prisma (backend/prisma/schema.prisma).
--
-- Les noms de tables (@@map) et de colonnes (camelCase) correspondent
-- EXACTEMENT à ceux attendus par le client Prisma du backend NestJS :
--   ne renommez ni les tables ni les colonnes.
--
-- Import :
--   mysql -u root -p < backend/sql/schema.mysql.sql
-- Puis :
--   mysql -u root -p < backend/sql/seed.mysql.sql
--
-- Contexte : SARI Système SARL — distribution d'équipements médicaux, Algérie.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `sari_cms`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sari_cms`;

-- -----------------------------------------------------------------------------
-- Identity & access
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255) NOT NULL,
  `slug`          VARCHAR(255) NOT NULL,
  `description`   TEXT         NULL,
  `isSystem`      TINYINT(1)   NOT NULL DEFAULT 0,
  `permissionIds` JSON         NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`     DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_slug_key` (`slug`),
  KEY `roles_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `email`        VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `firstName`    VARCHAR(255) NOT NULL DEFAULT '',
  `lastName`     VARCHAR(255) NOT NULL DEFAULT '',
  `phone`        VARCHAR(64)  NULL,
  `company`      VARCHAR(255) NULL,
  `avatar`       VARCHAR(255) NULL,
  `type`         VARCHAR(32)  NOT NULL DEFAULT 'client',
  `status`       VARCHAR(32)  NOT NULL DEFAULT 'pending',
  `locale`       VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `roleId` INT  NULL,
  `totpEnabled`  TINYINT(1)   NOT NULL DEFAULT 0,
  `totpSecret`   VARCHAR(255) NULL,
  `partnerCode`  VARCHAR(64)  NULL,
  `partnerKey`   VARCHAR(255) NULL,
  `address`      TEXT         NULL,
  `wilaya`       VARCHAR(64)  NULL,
  `country`      VARCHAR(64)  NULL,
  `position`     VARCHAR(128) NULL,
  `experience`   VARCHAR(128) NULL,
  `motivation`   TEXT         NULL,
  `cvUrl`        VARCHAR(255) NULL,
  `lastLoginAt`  DATETIME(3)  NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`    DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_type_status_idx` (`type`, `status`),
  KEY `users_deletedAt_idx` (`deletedAt`),
  KEY `users_roleId_idx` (`roleId`),
  CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `refresh_tokens`;
CREATE TABLE `refresh_tokens` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `userId` INT  NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `revokedAt` DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `userAgent` TEXT         NULL,
  `ip`        VARCHAR(64)  NULL,
  PRIMARY KEY (`id`),
  KEY `refresh_tokens_userId_idx` (`userId`),
  KEY `refresh_tokens_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `resource`    VARCHAR(64)  NOT NULL,
  `action`      VARCHAR(32)  NOT NULL,
  `description` TEXT         NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_resource_action_key` (`resource`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `roleId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`),
  KEY `role_permissions_permissionId_idx` (`permissionId`),
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Content — group 2
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `pages`;
CREATE TABLE `pages` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(255) NOT NULL,
  `locale`      VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `kind`        VARCHAR(32)  NOT NULL,
  `subtype`     VARCHAR(32)  NOT NULL DEFAULT 'simple',
  `title`       VARCHAR(255) NOT NULL,
  `subtitle`    VARCHAR(255) NULL,
  `category`    VARCHAR(255) NULL,
  `content`     TEXT         NULL,
  `media`       JSON         NULL,
  `slides`      JSON         NULL,
  `sections`    JSON         NULL,
  `features`    JSON         NULL,
  `pdfUrl`      VARCHAR(255) NULL,
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `publishedAt` DATETIME(3)  NULL,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pages_slug_locale_key` (`slug`, `locale`),
  KEY `pages_kind_subtype_idx` (`kind`, `subtype`),
  KEY `pages_status_idx` (`status`),
  KEY `pages_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `faqs`;
CREATE TABLE `faqs` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `question`  TEXT         NOT NULL,
  `answer`    TEXT         NOT NULL,
  `category`  VARCHAR(255) NULL,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `status`    VARCHAR(32)  NOT NULL DEFAULT 'published',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  KEY `faqs_locale_category_idx` (`locale`, `category`),
  KEY `faqs_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `testimonials`;
CREATE TABLE `testimonials` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `name`      VARCHAR(255) NOT NULL,
  `role`      VARCHAR(255) NULL,
  `clinic`    VARCHAR(255) NULL,
  `text`      TEXT         NOT NULL,
  `image`     VARCHAR(255) NULL,
  `rating`    INT          NOT NULL DEFAULT 5,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `status`    VARCHAR(32)  NOT NULL DEFAULT 'published',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  KEY `testimonials_locale_status_idx` (`locale`, `status`),
  KEY `testimonials_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `menus`;
CREATE TABLE `menus` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)  NOT NULL DEFAULT 'fr',
  `name`      VARCHAR(255) NOT NULL,
  `location`  VARCHAR(32) NOT NULL,
  `items`     JSON        NOT NULL,
  `status`    VARCHAR(32) NOT NULL DEFAULT 'published',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `menus_location_locale_key` (`location`, `locale`),
  KEY `menus_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `contact_info`;
CREATE TABLE `contact_info` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)  NOT NULL DEFAULT 'fr',
  `company`   VARCHAR(255) NULL,
  `tagline`   VARCHAR(255) NULL,
  `phone`     VARCHAR(64)  NULL,
  `email`     VARCHAR(255) NULL,
  `address`   TEXT        NULL,
  `hours`     VARCHAR(128) NULL,
  `currency`  VARCHAR(16)  NULL,
  `logo`      VARCHAR(255) NULL,
  `social`    JSON        NULL,
  `extras`    JSON        NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contact_info_locale_key` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `contact_messages`;
CREATE TABLE `contact_messages` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(255) NOT NULL,
  `email`     VARCHAR(255) NOT NULL,
  `phone`     VARCHAR(64)  NULL,
  `subject`   VARCHAR(255) NULL,
  `message`   TEXT         NOT NULL,
  `status`    VARCHAR(32)  NOT NULL DEFAULT 'new',
  `meta`      JSON         NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  KEY `contact_messages_status_idx` (`status`),
  KEY `contact_messages_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Transverse
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `translations`;
CREATE TABLE `translations` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(64)  NOT NULL,
  `entityId` INT  NOT NULL,
  `locale`     VARCHAR(8)   NOT NULL,
  `field`      VARCHAR(64)  NOT NULL,
  `value`      TEXT         NOT NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`  DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `translations_entity_key` (`entityType`, `entityId`, `locale`, `field`),
  KEY `translations_entity_idx` (`entityType`, `entityId`),
  KEY `translations_locale_idx` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `actorId` INT NULL,
  `action`     VARCHAR(64) NOT NULL,
  `resource`   VARCHAR(64) NOT NULL,
  `resourceId` INT NULL,
  `payload`    JSON        NULL,
  `ip`         VARCHAR(64) NULL,
  `userAgent`  TEXT        NULL,
  `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`  DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_resource_idx` (`resource`, `resourceId`),
  KEY `audit_logs_actorId_idx` (`actorId`),
  KEY `audit_logs_createdAt_idx` (`createdAt`),
  CONSTRAINT `audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `key`       VARCHAR(191) NOT NULL,
  `value`     JSON        NOT NULL,
  `group`     VARCHAR(64) NOT NULL DEFAULT 'general',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  `createdBy` INT NULL,
  `updatedBy` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Catalogue — news, events, products
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `news_articles`;
CREATE TABLE `news_articles` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`         VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`           VARCHAR(255) NOT NULL,
  `title`          VARCHAR(255) NOT NULL,
  `category`       VARCHAR(255) NULL,
  `classification` VARCHAR(255) NULL,
  `sujet`          VARCHAR(255) NULL,
  `authorName`     VARCHAR(255) NULL,
  `authorId` INT  NULL,
  `date`           DATETIME(3)  NULL,
  `readTime`       VARCHAR(32)  NULL,
  `shortDesc`      TEXT         NULL,
  `fullContent`    TEXT         NULL,
  `image`          VARCHAR(255) NULL,
  `tags`           JSON         NULL,
  `status`         VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `publishedAt`    DATETIME(3)  NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`      DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `news_articles_slug_locale_key` (`slug`, `locale`),
  KEY `news_articles_status_date_idx` (`status`, `date`),
  KEY `news_articles_authorId_idx` (`authorId`),
  KEY `news_articles_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`      VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`        VARCHAR(255) NOT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `type`        VARCHAR(64)  NULL,
  `date`        DATETIME(3)  NULL,
  `endDate`     DATETIME(3)  NULL,
  `location`    VARCHAR(255) NULL,
  `shortDesc`   TEXT         NULL,
  `fullContent` TEXT         NULL,
  `image`       VARCHAR(255) NULL,
  `agenda`      JSON         NULL,
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `publishedAt` DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `events_slug_locale_key` (`slug`, `locale`),
  KEY `events_date_idx` (`date`),
  KEY `events_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`       VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`         VARCHAR(255) NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `category`     VARCHAR(255) NULL,
  `sku`          VARCHAR(64)  NULL,
  `price`        VARCHAR(64)  NULL,
  `shortDesc`    TEXT         NULL,
  `fullDesc`     TEXT         NULL,
  `image`        VARCHAR(255) NULL,
  `gallery`      JSON         NULL,
  `inStock`      TINYINT(1)   NOT NULL DEFAULT 1,
  `stockQty`     INT          NULL,
  `stockFinal`   TINYINT(1)   NOT NULL DEFAULT 0,
  `currency`     VARCHAR(16)  NULL,
  `sortOrder`    INT          NOT NULL DEFAULT 0,
  `deliveryTime` VARCHAR(64)  NULL,
  `features`     JSON         NULL,
  `specs`        JSON         NULL,
  `options`      JSON         NULL,
  `catalogPdf`   VARCHAR(255) NULL,
  `status`       VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `publishedAt`  DATETIME(3)  NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`    DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_locale_key` (`slug`, `locale`),
  KEY `products_category_inStock_idx` (`category`, `inStock`),
  KEY `products_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Catalogue — group 3 (services, partners, careers, solutions, hero)
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS `services`;
CREATE TABLE `services` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`      VARCHAR(255) NOT NULL,
  `title`     VARCHAR(255) NOT NULL,
  `icon`      VARCHAR(64)  NULL,
  `shortDesc` TEXT         NULL,
  `fullDesc`  TEXT         NULL,
  `features`  JSON         NULL,
  `faq`       JSON         NULL,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `legacyId`  INT          NULL,
  `status`    VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `services_slug_locale_key` (`slug`, `locale`),
  KEY `services_status_idx` (`status`),
  KEY `services_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `partners`;
CREATE TABLE `partners` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`    VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `name`      VARCHAR(255) NOT NULL,
  `logo`      VARCHAR(255) NULL,
  `category`  VARCHAR(255) NULL,
  `website`   VARCHAR(255) NULL,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `legacyId`  INT          NULL,
  `status`    VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  KEY `partners_locale_status_idx` (`locale`, `status`),
  KEY `partners_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `careers`;
CREATE TABLE `careers` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`      VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`        VARCHAR(255) NOT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `type`        VARCHAR(64)  NULL,
  `location`    VARCHAR(255) NULL,
  `salary`      VARCHAR(128) NULL,
  `shortDesc`   TEXT         NULL,
  `fullDesc`    TEXT         NULL,
  `image`       VARCHAR(255) NULL,
  `typeTravail` VARCHAR(64)  NULL,
  `mission`     TEXT         NULL,
  `objectifs`   JSON         NULL,
  `prerequis`   JSON         NULL,
  `experience`  VARCHAR(128) NULL,
  `workflow`    JSON         NULL,
  `benefits`    JSON         NULL,
  `contact`     VARCHAR(255) NULL,
  `legacyId`    INT          NULL,
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `publishedAt` DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `careers_slug_locale_key` (`slug`, `locale`),
  KEY `careers_status_location_idx` (`status`, `location`),
  KEY `careers_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `solutions`;
CREATE TABLE `solutions` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`     VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `slug`       VARCHAR(255) NOT NULL,
  `title`      VARCHAR(255) NOT NULL,
  `shortDesc`  TEXT         NULL,
  `fullDesc`   TEXT         NULL,
  `icon`       VARCHAR(64)  NULL,
  `image`      VARCHAR(255) NULL,
  `color`      VARCHAR(64)  NULL,
  `productIds` JSON         NULL,
  `features`   JSON         NULL,
  `faq`        JSON         NULL,
  `sortOrder`  INT          NOT NULL DEFAULT 0,
  `status`     VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`  DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `solutions_slug_locale_key` (`slug`, `locale`),
  KEY `solutions_status_idx` (`status`),
  KEY `solutions_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `hero_slides`;
CREATE TABLE `hero_slides` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `locale`      VARCHAR(8)   NOT NULL DEFAULT 'fr',
  `title`       VARCHAR(255) NOT NULL,
  `subtitle`    VARCHAR(255) NULL,
  `description` TEXT         NULL,
  `image`       VARCHAR(255) NULL,
  `cta`         VARCHAR(128) NULL,
  `ctaLink`     VARCHAR(255) NULL,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `legacyId`    INT          NULL,
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'draft',
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy` INT  NULL,
  `updatedBy` INT  NULL,
  PRIMARY KEY (`id`),
  KEY `hero_slides_locale_status_sortOrder_idx` (`locale`, `status`, `sortOrder`),
  KEY `hero_slides_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
