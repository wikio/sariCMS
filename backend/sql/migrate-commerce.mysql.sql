-- ---------------------------------------------------------------------------
-- Migration additive : commandes, devis et candidatures
-- ---------------------------------------------------------------------------
-- À utiliser sur une base DÉJÀ EN PRODUCTION, à la place de schema.mysql.sql
-- (qui commence par DROP TABLE et détruirait vos données).
--
-- Ce fichier est idempotent : CREATE TABLE IF NOT EXISTS, aucun DROP.
-- Il ajoute les 3 tables qui manquaient — jusqu'ici commandes, devis et
-- candidatures ne vivaient que dans le localStorage du navigateur.
--
-- Généré depuis schema.mysql.sql. Ne pas éditer à la main.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;


-- orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id`        INT            NOT NULL AUTO_INCREMENT,
  `code`      VARCHAR(255)   NULL,
  `userId`    INT            NULL,
  `client`    VARCHAR(255)   NOT NULL,
  `email`     VARCHAR(255)   NOT NULL,
  `phone`     VARCHAR(255)   NULL,
  `company`   VARCHAR(255)   NULL,
  `date`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status`    VARCHAR(255)   NOT NULL DEFAULT 'pending',
  `total`     DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `cost`      DECIMAL(14, 2) NULL,
  `currency`  VARCHAR(255)   NOT NULL DEFAULT 'DZD',
  `items`     JSON           NULL,
  `address`   TEXT           NULL,
  `payment`   VARCHAR(255)   NULL,
  `paid`      TINYINT(1)     NOT NULL DEFAULT 0,
  `coupon`    VARCHAR(255)   NULL,
  `quoteId`   INT            NULL,
  `zone`      VARCHAR(255)   NULL,
  `ip`        VARCHAR(255)   NULL,
  `history`   JSON           NULL,
  `invoice`   JSON           NULL,
  `createdAt` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)    NULL,
  `createdBy` INT            NULL,
  `updatedBy` INT            NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_code_key` (`code`),
  KEY `orders_status_date_idx` (`status`, `date`),
  KEY `orders_email_idx` (`email`),
  KEY `orders_userId_idx` (`userId`),
  KEY `orders_deletedAt_idx` (`deletedAt`),
  CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- quotes
CREATE TABLE IF NOT EXISTS `quotes` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `reference`   VARCHAR(255)   NULL,
  `userId`      INT            NULL,
  `client`      VARCHAR(255)   NOT NULL,
  `email`       VARCHAR(255)   NOT NULL,
  `phone`       VARCHAR(255)   NULL,
  `company`     VARCHAR(255)   NULL,
  `date`        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status`      VARCHAR(255)   NOT NULL DEFAULT 'submitted',
  `total`       DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `currency`    VARCHAR(255)   NOT NULL DEFAULT 'DZD',
  `validity`    VARCHAR(255)   NULL,
  `items`       JSON           NULL,
  `coupon`      VARCHAR(255)   NULL,
  `orderId`     INT            NULL,
  `zone`        VARCHAR(255)   NULL,
  `ip`          VARCHAR(255)   NULL,
  `history`     JSON           NULL,
  `nature`      VARCHAR(255)   NULL,
  `natureOther` VARCHAR(255)   NULL,
  `note`        TEXT           NULL,
  `desiredDate` DATETIME(3)    NULL,
  `address`     TEXT           NULL,
  `country`     VARCHAR(255)   NULL,
  `attachments` JSON           NULL,
  `response`    JSON           NULL,
  `createdAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)    NULL,
  `createdBy`   INT            NULL,
  `updatedBy`   INT            NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotes_reference_key` (`reference`),
  KEY `quotes_status_date_idx` (`status`, `date`),
  KEY `quotes_email_idx` (`email`),
  KEY `quotes_userId_idx` (`userId`),
  KEY `quotes_deletedAt_idx` (`deletedAt`),
  CONSTRAINT `quotes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- job_applications
CREATE TABLE IF NOT EXISTS `job_applications` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `reference`  VARCHAR(255) NULL,
  `userId`     INT          NULL,
  `careerId`   INT          NULL,
  `candidate`  VARCHAR(255) NOT NULL,
  `email`      VARCHAR(255) NOT NULL,
  `phone`      VARCHAR(255) NULL,
  `jobTitle`   VARCHAR(255) NULL,
  `status`     VARCHAR(255) NOT NULL DEFAULT 'new',
  `date`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `experience` VARCHAR(255) NULL,
  `motivation` TEXT         NULL,
  `rating`     INT          NULL,
  `score`      INT          NULL,
  `note`       TEXT         NULL,
  `cv`         VARCHAR(255) NULL,
  `lm`         VARCHAR(255) NULL,
  `history`    JSON         NULL,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`  DATETIME(3)  NULL,
  `createdBy`  INT          NULL,
  `updatedBy`  INT          NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_applications_reference_key` (`reference`),
  KEY `job_applications_status_date_idx` (`status`, `date`),
  KEY `job_applications_email_idx` (`email`),
  KEY `job_applications_userId_idx` (`userId`),
  KEY `job_applications_careerId_idx` (`careerId`),
  KEY `job_applications_deletedAt_idx` (`deletedAt`),
  CONSTRAINT `job_applications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `job_applications_careerId_fkey` FOREIGN KEY (`careerId`) REFERENCES `careers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
