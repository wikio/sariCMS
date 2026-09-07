-- backend/sql/fix-zero-dates.mysql.sql
--
-- Répare les dates illisibles (jour ou mois à zéro) dans toutes les tables.
--
-- SYMPTÔME. Une liste entière de l'administration tombe en 500 avec, dans les
-- journaux, ce message de Prisma :
--
--   PrismaClientKnownRequestError: Value out of range for the type: The column
--   `updatedAt` contained an invalid datetime value with either day or month set
--   to zero.
--
-- CAUSE. MySQL accepte `0000-00-00 00:00:00` et `2026-00-07` quand le mode
-- `NO_ZERO_DATE` / `NO_ZERO_IN_DATE` n'est pas actif : une reprise de données en
-- SQL brut, un import venant de l'ancien site, ou une colonne NOT NULL sans défaut
-- à laquelle un INSERT n'a pas donné de valeur, laissent passer ces lignes. Prisma,
-- lui, ne sait pas les lire — et comme l'ORM hydrate toute la ligne, **une seule**
-- date au zéro fait échouer la lecture de toute la table : la requête n'y est pour
-- rien, le filtre non plus.
--
-- CE QUE FAIT CE FICHIER. Il ne touche que les valeurs illisibles :
--   - `createdAt`      → l'`updatedAt` de la ligne, sinon maintenant ;
--   - `updatedAt`      → le `createdAt` de la ligne, sinon maintenant ;
--   - `deletedAt`, `revokedAt` → maintenant : la ligne reste marquée supprimée ou
--     révoquée, un NULL la ferait réapparaître ;
--   - toute autre colonne de date facultative → NULL, c'est-à-dire « pas de date »
--     (inventer une date de publication serait mentir) ;
--   - une colonne de date NOT NULL → maintenant.
-- Trois temps : le diagnostic, la réparation, puis la prévention (les défauts de
-- colonnes remis en place). Le tout est rejouable : rien n'est fait s'il n'y a
-- rien à réparer.
--
--   mysql -u utilisateur -p base < backend/sql/fix-zero-dates.mysql.sql
--
-- À FAIRE AUSSI, côté serveur, pour que ça ne revienne pas : laisser
-- `sql_mode` contenir `STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE` (sinon
-- MySQL avale silencieusement la date fausse au lieu de la refuser).

-- ——— 1. Diagnostic : quelles tables, quelles colonnes, combien de lignes ———
SET SESSION group_concat_max_len = 1048576;

DROP TEMPORARY TABLE IF EXISTS `sari_bad_dates`;
CREATE TEMPORARY TABLE `sari_bad_dates` (
  `table_name`  VARCHAR(64)  NOT NULL,
  `column_name` VARCHAR(64)  NOT NULL,
  `is_nullable` CHAR(3)      NOT NULL,
  `bad_count`   BIGINT       NOT NULL,
  KEY (`table_name`)
) ENGINE = InnoDB;

-- Les colonnes de date des tables du schéma, une par une. Le rapport est construit
-- puis exécuté, parce qu'un `SELECT` ne peut pas deviner les noms de colonnes :
-- c'est `information_schema` qui les donne.
SET @diag = NULL;
SELECT GROUP_CONCAT(
         CONCAT(
           'SELECT ''', c.TABLE_NAME, ''' AS t, ''', c.COLUMN_NAME,
           ''' AS col, ''', c.IS_NULLABLE, ''' AS nul, COUNT(*) AS n FROM `', c.TABLE_NAME,
           '` WHERE `', c.COLUMN_NAME, '` IS NOT NULL AND (CAST(`', c.COLUMN_NAME, '` AS CHAR) LIKE ''0000%''',
           ' OR CAST(`', c.COLUMN_NAME, '` AS CHAR) LIKE ''%-00-%''',
           ' OR CAST(`', c.COLUMN_NAME, '` AS CHAR) LIKE ''%-00 %''',
           ' OR CAST(`', c.COLUMN_NAME, '` AS CHAR) LIKE ''%-00'')'
         )
         SEPARATOR ' UNION ALL ')
INTO @diag
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.DATA_TYPE IN ('datetime', 'timestamp', 'date');

SET @diag = IFNULL(@diag, 'SELECT ''(aucune colonne de date)'' t, '''' col, '''' nul, 0 n WHERE 1 = 0');
SET @diag = CONCAT(
  'INSERT INTO `sari_bad_dates` SELECT * FROM (', @diag, ') s WHERE s.n > 0');
PREPARE stmt FROM @diag; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '1 — lignes aux dates illisibles' AS étape,
       IFNULL((SELECT GROUP_CONCAT(CONCAT(t, '.', col) SEPARATOR ' | ')
               FROM (SELECT t, col FROM `sari_bad_dates`) x),
              'aucune — rien à réparer') AS constat;

-- Détail table par table, pour savoir où regarder avant d'écrire.
SELECT `table_name` AS `table`, `column_name` AS `colonne`, `is_nullable` AS `facultative`, `bad_count` AS `lignes`
FROM `sari_bad_dates`
ORDER BY `bad_count` DESC, `table_name`;

-- ——— 2. Réparation ———
-- Une seule table préparée à la fois, et seulement celles signalées au-dessus.
DROP PROCEDURE IF EXISTS `sari_fix_zero_dates`;
DELIMITER $$
CREATE PROCEDURE `sari_fix_zero_dates`()
BEGIN
  DECLARE done TINYINT DEFAULT 0;
  DECLARE v_table VARCHAR(64);
  DECLARE v_column VARCHAR(64);
  DECLARE v_nullable CHAR(3);
  DECLARE stmt TEXT;

  DECLARE cur CURSOR FOR
    SELECT b.`table_name`, b.`column_name`, b.`is_nullable` FROM `sari_bad_dates` b;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  repair_loop: LOOP
    FETCH cur INTO v_table, v_column, v_nullable;
    IF done = 1 THEN
      LEAVE repair_loop;
    END IF;

    SET @fallback = CASE
      WHEN v_column = 'createdAt' AND EXISTS (
             SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = v_table AND COLUMN_NAME = 'updatedAt')
        THEN 'COALESCE(`updatedAt`, NOW(3))'
      WHEN v_column = 'updatedAt' AND EXISTS (
             SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = v_table AND COLUMN_NAME = 'createdAt')
        THEN 'COALESCE(`createdAt`, NOW(3))'
      -- Une trace de suppression ou de révocation doit rester une trace : la
      -- passer à NULL rendrait vivante une ligne supprimée.
      WHEN v_column IN ('deletedAt', 'revokedAt') THEN 'NOW(3)'
      WHEN v_nullable = 'YES' THEN 'NULL'
      ELSE 'NOW(3)'
    END;

    -- La même condition qu'au diagnostic : ne toucher que ce qui est illisible,
    -- jamais une date juste.
    SET stmt = CONCAT(
      'UPDATE `', v_table, '` SET `', v_column, '` = ', @fallback,
      ' WHERE `', v_column, '` IS NOT NULL AND (CAST(`', v_column, '` AS CHAR) LIKE ''0000%''',
      ' OR CAST(`', v_column, '` AS CHAR) LIKE ''%-00-%''',
      ' OR CAST(`', v_column, '` AS CHAR) LIKE ''%-00 %''',
      ' OR CAST(`', v_column, '` AS CHAR) LIKE ''%-00'')');
    SET @sql = stmt;
    PREPARE fix FROM @sql;
    EXECUTE fix;
    DEALLOCATE PREPARE fix;
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;

CALL `sari_fix_zero_dates`();
DROP PROCEDURE `sari_fix_zero_dates`;

SELECT '2 — réparation jouée' AS étape,
       'le contrôle ci-dessous doit donner 0 partout' AS attendu;

-- Contrôle : rejouer le diagnostic doit donner zéro partout.
SET @check = NULL;
SELECT GROUP_CONCAT(
         CONCAT('SELECT ''', `table_name`, '.', `column_name`, ''' AS quoi, COUNT(*) AS reste FROM `', `table_name`,
                '` WHERE `', `column_name`, '` IS NOT NULL AND (CAST(`', `column_name`, '` AS CHAR) LIKE ''0000%''',
                ' OR CAST(`', `column_name`, '` AS CHAR) LIKE ''%-00-%''',
                ' OR CAST(`', `column_name`, '` AS CHAR) LIKE ''%-00 %''',
                ' OR CAST(`', `column_name`, '` AS CHAR) LIKE ''%-00'')')
         SEPARATOR ' UNION ALL ')
INTO @check
FROM `sari_bad_dates`;
SET @check = IFNULL(@check, 'SELECT ''(rien à contrôler)'' AS quoi, 0 AS reste WHERE 1 = 0');
PREPARE stmt FROM @check; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ——— 3. Prévention : les défauts qui empêchent de reproduire le problème ———
-- Un `createdAt` / `updatedAt` NOT NULL sans défaut est la porte d'entrée classique
-- du zéro : tout INSERT qui omet la colonne en fabrique un. Ce bloc remet le défaut
-- là où il manque (et seulement là), sur le modèle de `schema.mysql.sql`.
-- Détail à savoir : sur une colonne `ON UPDATE CURRENT_TIMESTAMP`, réparer l'`updatedAt`
-- lui donne l'heure de la réparation, pas la date du `createdAt` — MySQL reprend la
-- main sur la colonne. C'est le comportement attendu d'un tampon de modification.
SET @ddl = NULL;
SELECT GROUP_CONCAT(
         CONCAT(
           'ALTER TABLE `', c.TABLE_NAME, '` MODIFY `', c.COLUMN_NAME, '` DATETIME(3) NOT NULL',
           ' DEFAULT CURRENT_TIMESTAMP(3)',
           IF(c.COLUMN_NAME = 'updatedAt', ' ON UPDATE CURRENT_TIMESTAMP(3)', ''), ';'
         )
         SEPARATOR ' ')
INTO @ddl
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.COLUMN_NAME IN ('createdAt', 'updatedAt')
  AND c.IS_NULLABLE = 'NO'
  AND c.COLUMN_DEFAULT IS NULL;

-- Une requête préparée ne contient qu'un seul ordre : ils sont joués un par un
-- juste après, ce SELECT n'est que le journal de ce qui va l'être.
SELECT IFNULL(@ddl, '(aucune colonne à durcir)') AS `3 — défauts remis en place`;

DROP PROCEDURE IF EXISTS `sari_harden_date_defaults`;
DELIMITER $$
CREATE PROCEDURE `sari_harden_date_defaults`()
BEGIN
  DECLARE done TINYINT DEFAULT 0;
  DECLARE v_table VARCHAR(64);
  DECLARE v_column VARCHAR(64);
  DECLARE v_nullable CHAR(3);
  DECLARE v_def VARCHAR(64);
  DECLARE stmt TEXT;

  DECLARE cur CURSOR FOR
    SELECT c.TABLE_NAME, c.COLUMN_NAME, c.IS_NULLABLE, c.COLUMN_DEFAULT
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = DATABASE()
      AND c.COLUMN_NAME IN ('createdAt', 'updatedAt')
      AND c.IS_NULLABLE = 'NO'
      AND c.COLUMN_DEFAULT IS NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  harden_loop: LOOP
    FETCH cur INTO v_table, v_column, v_nullable, v_def;
    IF done = 1 THEN
      LEAVE harden_loop;
    END IF;
    SET @sql = CONCAT(
      'ALTER TABLE `', v_table, '` MODIFY `', v_column, '` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
      IF(v_column = 'updatedAt', ' ON UPDATE CURRENT_TIMESTAMP(3)', ''));
    PREPARE alter_it FROM @sql;
    EXECUTE alter_it;
    DEALLOCATE PREPARE alter_it;
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;

CALL `sari_harden_date_defaults`();
DROP PROCEDURE `sari_harden_date_defaults`;

DROP TEMPORARY TABLE IF EXISTS `sari_bad_dates`;

SELECT '3 — colonnes durcies' AS étape,
       CONCAT(COUNT(*), ' colonne(s) de date restante(s) sans défaut') AS constat
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('createdAt', 'updatedAt')
  AND IS_NULLABLE = 'NO'
  AND COLUMN_DEFAULT IS NULL;
