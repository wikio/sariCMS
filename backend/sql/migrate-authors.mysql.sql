-- ---------------------------------------------------------------------------
-- Migration additive : fiches auteurs des actualités
-- ---------------------------------------------------------------------------
-- À utiliser sur une base DÉJÀ EN PRODUCTION, à la place de schema.mysql.sql
-- (qui commence par DROP TABLE et détruirait vos données).
--
-- Ce fichier est idempotent : CREATE TABLE IF NOT EXISTS, et l'ajout de la
-- colonne `news_articles.authorId` n'est joué que si elle est absente.
--
-- Ce qu'il apporte : jusqu'ici un article ne portait qu'un nom d'auteur en
-- texte libre (`authorName`), sans qualification ni présentation — la fiche
-- vitrine affichait donc la rubrique de l'article en guise de fonction et une
-- phrase générique en guise de biographie. Les auteurs deviennent des
-- enregistrements réutilisables, avec un auteur de repli (`isFallback`) pour
-- les articles qui n'en désignent aucun.
--
-- Après ce fichier, importez les données :
--   mysql -u root -p sari_cms < backend/sql/migrate-data.mysql.sql
-- (rejouable : ON DUPLICATE KEY UPDATE)
--
-- Généré depuis schema.mysql.sql. Ne pas éditer à la main.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;


-- 1. Table des auteurs
CREATE TABLE IF NOT EXISTS `authors` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `locale`      VARCHAR(255) NOT NULL DEFAULT 'fr',
  `slug`        VARCHAR(255) NULL,
  `name`        VARCHAR(255) NOT NULL,
  `email`       VARCHAR(255) NULL,
  `role`        VARCHAR(255) NULL,
  `bio`         TEXT         NULL,
  `photo`       VARCHAR(255) NULL,
  `isFallback`  TINYINT(1)   NOT NULL DEFAULT 0,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `status`      VARCHAR(255) NOT NULL DEFAULT 'published',
  `legacyId`    VARCHAR(255) NULL,
  `parentId`    INT          NULL,
  `isDefault`   TINYINT(1)   NOT NULL DEFAULT 0,
  `publishedAt` DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy`   INT          NULL,
  `updatedBy`   INT          NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `authors_slug_locale_key` (`slug`, `locale`),
  KEY `authors_status_sortOrder_idx` (`status`, `sortOrder`),
  KEY `authors_isFallback_idx` (`isFallback`),
  KEY `authors_legacyId_idx` (`legacyId`),
  KEY `authors_parentId_idx` (`parentId`),
  KEY `authors_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. Colonne de liaison sur les actualités.
--    ADD COLUMN n'accepte pas IF NOT EXISTS sur MySQL 5.7/8.0 : on interroge
--    information_schema pour ne jouer l'ALTER que si la colonne manque, ce qui
--    rend le script rejouable sans erreur 1060 (Duplicate column name).
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'authorId'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `news_articles` ADD COLUMN `authorId` INT NULL AFTER `authorName`',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND INDEX_NAME = 'news_articles_authorId_idx'
);
SET @sql := IF(@idx = 0,
  'ALTER TABLE `news_articles` ADD KEY `news_articles_authorId_idx` (`authorId`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 3. Permissions de la nouvelle ressource (RBAC).
--    Les rôles existants ne les reçoivent pas automatiquement : accordez-les
--    depuis Administration → Rôles. Le super-admin contourne le contrôle.
INSERT IGNORE INTO `permissions` (`resource`, `action`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('authors', 'create', 'authors:create', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('authors', 'read',   'authors:read',   CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('authors', 'update', 'authors:update', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('authors', 'delete', 'authors:delete', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('authors', 'admin',  'authors:admin',  CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
