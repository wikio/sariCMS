-- ---------------------------------------------------------------------------
-- Migration additive : relevé d'encaissements en base (`payment_records`)
-- ---------------------------------------------------------------------------
-- À utiliser sur une base DÉJÀ EN PRODUCTION, à la place de schema.mysql.sql
-- (qui commence par DROP TABLE et détruirait vos données).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS, et chaque index n'est créé que s'il
-- est absent — MySQL ne connaît pas `CREATE INDEX IF NOT EXISTS`, et rejouer un
-- fichier deux fois ne doit pas sortir l'opérateur avec une erreur 1061.
--
-- Aucune colonne existante n'est modifiée, aucun type changé, rien supprimé. Une
-- seule table neuve : ni les commandes, ni les factures, ni les règles de taxe
-- n'y touchent.
--
-- Ce qu'il apporte : le relevé d'encaissements (`sari_payment_records` en
-- `localStorage`, écran « Journal des paiements ») devient consultable de
-- n'importe quel poste, sauvegardé avec la base, et supprimable seulement quand
-- on le demande — la clé du cache est un dossier d'attente, plus un stock.
--
-- Après exécution : les lignes déjà présentes dans le navigateur d'un
-- administrateur partent en base à la première ouverture de l'écran (la base vide
-- fait du poste la source). Rien n'est donc perdu d'avance ; rien n'est dupliqué
-- non plus, l'`externalId` étant unique. Il reste à donner les droits : voir le
-- point 3.
--
-- Les montants sont en DECIMAL(14,2) : ce sont des écritures comptables, pas des
-- valeurs de configuration. Le numéro de carte n'est pas stocké — seuls les
-- quatre derniers chiffres, dont le masque est déduit à l'affichage.

-- 1. La table.
CREATE TABLE IF NOT EXISTS `payment_records` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `externalId`  VARCHAR(64)    NOT NULL,
  `orderId`     INT            NULL,
  `orderCode`   VARCHAR(40)    NULL,
  `client`      VARCHAR(160)   NOT NULL,
  `email`       VARCHAR(160)   NULL,
  `method`      VARCHAR(24)    NOT NULL,
  `methodName`  VARCHAR(60)    NULL,
  `amount`      DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `status`      VARCHAR(20)    NOT NULL DEFAULT 'pending',
  `cardLast4`   VARCHAR(4)     NULL,
  `note`        TEXT           NULL,
  `date`        DATETIME(3)    NOT NULL,
  `validatedAt` DATETIME(3)    NULL,
  `createdAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)    NULL,
  `createdBy`   INT            NULL,
  `updatedBy`   INT            NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_records_externalId_key` (`externalId`),
  KEY `payment_records_status_date_idx` (`status`, `date`),
  KEY `payment_records_orderId_idx` (`orderId`),
  KEY `payment_records_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Les index, un par un : `information_schema.STATISTICS` répond si le nom
--    existe déjà, et `DO 0` ne fait rien dans ce cas.
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records'
      AND INDEX_NAME = 'payment_records_orderId_idx') = 0,
  'ALTER TABLE `payment_records` ADD INDEX `payment_records_orderId_idx` (`orderId`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records'
      AND INDEX_NAME = 'payment_records_status_date_idx') = 0,
  'ALTER TABLE `payment_records` ADD INDEX `payment_records_status_date_idx` (`status`, `date`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records'
      AND INDEX_NAME = 'payment_records_deletedAt_idx') = 0,
  'ALTER TABLE `payment_records` ADD INDEX `payment_records_deletedAt_idx` (`deletedAt`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Permissions : rien ici, volontairement.
--
-- Le catalogue vivant des permissions est dans
-- `src/common/constants/permissions.ts` (`payments:read/create/update/delete`) et
-- le lot à insérer se régénère par `npm run sql:fix-permissions`, qui écrit
-- `fix-permissions.mysql.sql` — à passer après ce fichier. Les accorder aux rôles
-- reste une décision de l'exploitant, prise dans Administration → Rôles : ce
-- fichier crée une table, pas des droits.
--
-- Sans ces lignes, l'écran d'un poste pourtant bien autorisé répond 403 — et un
-- 403 sur une route neuve ressemble à un module absent, pas à un droit manquant.
-- C'est le silence le plus probable de toute cette migration.

-- 4. Contrôle. Doit répondre 1 table et 19 colonnes ; répondre 0 laisse la
--    place à un `SELECT` sur une table qui n'existe pas, donc à un écran en
--    erreur 500 — mieux vaut le savoir ici.
SELECT 'payment_records' AS table_, COUNT(*) AS colonnes_attendues_19
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records';

-- Et, après `fix-permissions.mysql.sql` :
-- SELECT COUNT(*) AS permissions_payments FROM `permissions` WHERE `resource` = 'payments';
