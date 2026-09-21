-- ---------------------------------------------------------------------------
-- Migration additive : coupons et taxes en base, + rattrapage de `orders`
-- ---------------------------------------------------------------------------
-- À utiliser sur une base DÉJÀ EN PRODUCTION, à la place de schema.mysql.sql
-- (qui commence par DROP TABLE et détruirait vos données).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS, et chaque ALTER TABLE ADD COLUMN
-- n'est joué que si la colonne est absente — MySQL ne connaît pas
-- `ADD COLUMN IF NOT EXISTS`, et l'erreur 1060 « Duplicate column name » est
-- exactement ce qui bloque `prisma migrate deploy` sur certaines bases.
--
-- Aucune colonne existante n'est modifiée, aucun type changé, rien supprimé.
-- Les cinq colonnes d'`orders` sont toutes NULLables : les commandes déjà
-- enregistrées gardent leur contenu, elles ont simplement ces champs à vide.
--
-- Ce qu'il apporte :
--   1. `coupons`    — le catalogue de promotions quitte le localStorage du
--                    navigateur d'administration, où il n'était sauvegardé
--                    par personne ;
--   2. `tax_rules`  — idem pour les taux de taxe ;
--   3. `orders`     — les champs d'expédition que le Centre de courrier
--                    envoie sans que la fiche commande sache les stocker.
--
-- Les colonnes sont ajoutées telles que `prisma/schema.prisma` les décrit :
-- ce fichier est dérivé de `sql/schema.mysql.sql`, lui-même généré du schéma
-- Prisma. Ne pas l'éditer à la main ; régénérer les deux avec
--   npm run sql:schema
--
-- Après ce fichier, la base est à jour : relancer le backend suffit.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Catalogue de promotions.
CREATE TABLE IF NOT EXISTS `coupons` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `code`           VARCHAR(40)  NOT NULL,
  `type`           VARCHAR(255) NOT NULL DEFAULT 'percent',
  `amount`         DOUBLE       NOT NULL DEFAULT 0,
  `maxDiscount`    DOUBLE       NULL,
  `minOrder`       DOUBLE       NULL,
  `startDate`      DATETIME(3)  NULL,
  `endDate`        DATETIME(3)  NULL,
  `limitGlobal`    INT          NULL,
  `limitPerClient` INT          NULL,
  `used`           INT          NOT NULL DEFAULT 0,
  `scope`          VARCHAR(255) NOT NULL DEFAULT 'all',
  `scopeValues`    JSON         NULL,
  `excludeValues`  JSON         NULL,
  `stackable`      TINYINT(1)   NOT NULL DEFAULT 0,
  `active`         TINYINT(1)   NOT NULL DEFAULT 1,
  `revenue`        DOUBLE       NOT NULL DEFAULT 0,
  `notes`          TEXT         NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`      DATETIME(3)  NULL,
  `createdBy`      INT          NULL,
  `updatedBy`      INT          NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_key` (`code`),
  KEY `coupons_active_idx` (`active`),
  KEY `coupons_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Règles de taxe.
CREATE TABLE IF NOT EXISTS `tax_rules` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(255) NOT NULL,
  `names`       JSON         NULL,
  `labels`      JSON         NULL,
  `mode`        VARCHAR(255) NOT NULL DEFAULT 'percent',
  `rate`        DOUBLE       NOT NULL DEFAULT 0,
  `zone`        VARCHAR(255) NOT NULL DEFAULT 'DZ',
  `category`    VARCHAR(255) NULL,
  `scope`       VARCHAR(255) NOT NULL DEFAULT 'all',
  `scopeValues` JSON         NULL,
  `included`    TINYINT(1)   NOT NULL DEFAULT 0,
  `priority`    INT          NOT NULL DEFAULT 0,
  `active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `isDefault`   TINYINT(1)   NOT NULL DEFAULT 0,
  `startDate`   DATETIME(3)  NULL,
  `endDate`     DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy`   INT          NULL,
  `updatedBy`   INT          NULL,
  PRIMARY KEY (`id`),
  KEY `tax_rules_active_priority_idx` (`active`, `priority`),
  KEY `tax_rules_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Rattrapage de `orders`.
--    Ces colonnes viennent de la migration 20260919_add_order_shipment_fields.
--    Sur une base créée en jouant un ancien schema.mysql.sql, la table existe
--    mais ces colonnes manquent, et `migrate deploy` échoue en 1060 dès que
--    l'une d'elles est déjà là. Le garde ci-dessous rend chaque ajout rejouable.
--    trackingNumber
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'trackingNumber'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `orders` ADD COLUMN `trackingNumber` VARCHAR(80) NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
--    carrier
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'carrier'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `orders` ADD COLUMN `carrier` VARCHAR(80) NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
--    shippedAt
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shippedAt'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `orders` ADD COLUMN `shippedAt` DATETIME(3) NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
--    deliveredAt
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'deliveredAt'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `orders` ADD COLUMN `deliveredAt` DATETIME(3) NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
--    paidAt
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'paidAt'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `orders` ADD COLUMN `paidAt` DATETIME(3) NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Contrôle. Les trois requêtes doivent répondre ce qui est attendu ; si
--    l'une d'elles manque, la table préexistait avec une autre forme et il faut
--    intervenir à la main plutôt que de continuer.
SELECT 'coupons' AS table_, COUNT(*) AS colonnes_attendues_29 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons'
UNION ALL
SELECT 'tax_rules', COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tax_rules'
UNION ALL
SELECT 'orders (5 champs d''expédition)', COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
   AND COLUMN_NAME IN ('trackingNumber','carrier','shippedAt','deliveredAt','paidAt');
