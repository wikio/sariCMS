-- backend/sql/fix-zero-dates.mysql.sql
--
-- RÉPARÉ — dates au zéro (jour ou mois à zéro), toutes tables. Généré par
-- `generate-fix-zero-dates.mjs` à partir de `schema.mysql.sql` ; ne pas éditer
-- à la main, relancer `npm run sql:fix-zero-dates` quand le schéma bouge.
--
-- SYMPTÔME. Une liste de l'administration tombe en 500, et le journal ne dit qu'une
-- chose, de Prisma : « The column `updatedAt` contained an invalid datetime value
-- with either day or month set to zero ». Une seule ligne aux dates illisibles suffit,
-- parce que l'ORM hydrate la ligne entière : c'est toute la table qui ne se lit plus.
-- La requête, le filtre, l'écran ouvert n'y sont pour rien — la liste ordinaire d'un
-- module tombe exactement de même.
--
-- COMMENT ÇA ENTRE. MySQL accepte `0000-00-00 00:00:00`, `2026-00-11`,
-- `2026-07-00` dès que `sql_mode` ne contient pas `NO_ZERO_DATE`/`NO_ZERO_IN_DATE` :
-- une reprise en SQL brut, un export de l'ancien site, ou un INSERT qui omet une
-- colonne NOT NULL sans défaut. Ce dépôt n'en produit pas : ses seeds écrivent
-- `CURRENT_TIMESTAMP(3)`. Les lignes fautives viennent de la base, pas du code.
--
-- CE QUE FAIT CE FICHIER, dans cet ordre :
--   1. il compte les lignes fautives, table par table et colonne par colonne.
--   2. il les répare — `createdAt` reçoit l'heure courante, `updatedAt` le
--      `createdAt` ainsi réparé, et une date facultative devient NULL, « pas de
--      date », plutôt qu'une date inventée.
--   3. il rejoue le même comptage : tout doit être à zéro.
--   4. il durcit les colonnes de date NOT NULL qui n'ont pas de défaut, pour que
--      personne n'en réécrive.
--
-- Rejouable : chaque ordre est gardé par son `WHERE`, une base saine ne change pas.
-- Clients graphiques (HeidiSQL, phpMyAdmin) y compris : pas de procédure, pas de
-- `DELIMITER`, pas de table temporaire, pas de requête préparée — du SQL écrit.
--
--   mysql -u utilisateur -p base < backend/sql/fix-zero-dates.mysql.sql
--
-- Après coup, côté serveur, laisser `sql_mode` contenir
-- `STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE` : la date fausse est alors
-- refusée à l'écriture au lieu d'être avalée.
--   SELECT @@sql_mode
--   SET GLOBAL sql_mode = CONCAT(@@sql_mode, ',STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE')
-- (point-virgule retiré de ces deux lignes : certains clients découpent un fichier
-- sur chaque « ; » même dans un commentaire, et un commentaire avalé devient erreur)
-- Sur un hébergement mutualisé, `SET GLOBAL` est en général refusé (pas de privilège) :
-- ce n'est pas bloquant, la section 4 ci-dessous durcit les colonnes elles-mêmes, et
-- le CMS n'écrit plus de date vide depuis que l'adaptateur Prisma la refuse.

-- ——— 1. Diagnostic : 101 colonnes de date balayées ———
SELECT * FROM (
  SELECT 'roles' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `roles`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'roles' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `roles`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'roles' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `roles`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `users`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `users`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `users`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'lastLoginAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `users`
    WHERE `lastLoginAt` IS NOT NULL AND (CAST(`lastLoginAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`lastLoginAt`), 0) = 0 OR COALESCE(DAY(`lastLoginAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `refresh_tokens`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `refresh_tokens`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `refresh_tokens`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'expiresAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `refresh_tokens`
    WHERE `expiresAt` IS NOT NULL AND (CAST(`expiresAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`expiresAt`), 0) = 0 OR COALESCE(DAY(`expiresAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'revokedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `refresh_tokens`
    WHERE `revokedAt` IS NOT NULL AND (CAST(`revokedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`revokedAt`), 0) = 0 OR COALESCE(DAY(`revokedAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `permissions`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `permissions`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `permissions`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `pages`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `pages`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `pages`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `pages`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `faqs`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `faqs`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `faqs`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `testimonials`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `testimonials`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `testimonials`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `menus`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `menus`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `menus`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_info`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_info`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_info`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_messages`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_messages`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `contact_messages`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `translations`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `translations`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `translations`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `audit_logs`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `audit_logs`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `audit_logs`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `settings`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `settings`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `settings`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `authors`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `authors`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `authors`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `authors`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'date' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'publicationDate' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `publicationDate` IS NOT NULL AND (CAST(`publicationDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publicationDate`), 0) = 0 OR COALESCE(DAY(`publicationDate`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `news_articles`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'date' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'endDate' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `endDate` IS NOT NULL AND (CAST(`endDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`endDate`), 0) = 0 OR COALESCE(DAY(`endDate`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'startDate' AS `colonne`, COUNT(*) AS `lignes`
    FROM `events`
    WHERE `startDate` IS NOT NULL AND (CAST(`startDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`startDate`), 0) = 0 OR COALESCE(DAY(`startDate`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `products`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `products`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `products`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `products`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `services`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `services`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `services`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `partners`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `partners`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `partners`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `careers`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `careers`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `careers`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `careers`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `solutions`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `solutions`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `solutions`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `hero_slides`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `hero_slides`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `hero_slides`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `orders`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `orders`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'date' AS `colonne`, COUNT(*) AS `lignes`
    FROM `orders`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `orders`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `quotes`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `quotes`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'date' AS `colonne`, COUNT(*) AS `lignes`
    FROM `quotes`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `quotes`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'desiredDate' AS `colonne`, COUNT(*) AS `lignes`
    FROM `quotes`
    WHERE `desiredDate` IS NOT NULL AND (CAST(`desiredDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`desiredDate`), 0) = 0 OR COALESCE(DAY(`desiredDate`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `job_applications`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `job_applications`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'date' AS `colonne`, COUNT(*) AS `lignes`
    FROM `job_applications`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `job_applications`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `home_sections`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `home_sections`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `home_sections`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `newsletter_subscribers`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `newsletter_subscribers`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `newsletter_subscribers`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'subscribedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `newsletter_subscribers`
    WHERE `subscribedAt` IS NOT NULL AND (CAST(`subscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`subscribedAt`), 0) = 0 OR COALESCE(DAY(`subscribedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'unsubscribedAt' AS `colonne`, COUNT(*) AS `lignes`
    FROM `newsletter_subscribers`
    WHERE `unsubscribedAt` IS NOT NULL AND (CAST(`unsubscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`unsubscribedAt`), 0) = 0 OR COALESCE(DAY(`unsubscribedAt`), 0) = 0)
) s
WHERE s.`lignes` > 0
ORDER BY s.`lignes` DESC, s.`table`;

-- ——— 2. Réparation (101 écritures possibles, chacune gardée par son WHERE) ———
-- Sur une colonne `ON UPDATE CURRENT_TIMESTAMP`, MySQL reprend la main : la
-- date réparée devient l'heure de la réparation. C'est le rôle d'un tampon de
-- modification, et c'est ce que le site affiche de toute façon.

UPDATE `roles` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `roles` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `roles` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `users` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `users` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `users` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `users` SET `lastLoginAt` = NULL
 WHERE `lastLoginAt` IS NOT NULL AND (CAST(`lastLoginAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`lastLoginAt`), 0) = 0 OR COALESCE(DAY(`lastLoginAt`), 0) = 0);
UPDATE `refresh_tokens` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `refresh_tokens` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `refresh_tokens` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `refresh_tokens` SET `expiresAt` = NOW(3)
 WHERE `expiresAt` IS NOT NULL AND (CAST(`expiresAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`expiresAt`), 0) = 0 OR COALESCE(DAY(`expiresAt`), 0) = 0);
UPDATE `refresh_tokens` SET `revokedAt` = NULL
 WHERE `revokedAt` IS NOT NULL AND (CAST(`revokedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`revokedAt`), 0) = 0 OR COALESCE(DAY(`revokedAt`), 0) = 0);
UPDATE `permissions` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `permissions` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `permissions` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `pages` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `pages` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `pages` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `pages` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `faqs` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `faqs` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `faqs` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `testimonials` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `testimonials` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `testimonials` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `menus` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `menus` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `menus` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `contact_info` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `contact_info` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `contact_info` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `contact_messages` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `contact_messages` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `contact_messages` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `translations` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `translations` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `translations` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `audit_logs` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `audit_logs` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `audit_logs` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `settings` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `settings` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `settings` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `authors` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `authors` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `authors` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `authors` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `news_articles` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `news_articles` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `news_articles` SET `date` = NULL
 WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0);
UPDATE `news_articles` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `news_articles` SET `publicationDate` = NULL
 WHERE `publicationDate` IS NOT NULL AND (CAST(`publicationDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publicationDate`), 0) = 0 OR COALESCE(DAY(`publicationDate`), 0) = 0);
UPDATE `news_articles` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `events` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `events` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `events` SET `date` = NULL
 WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0);
UPDATE `events` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `events` SET `endDate` = NULL
 WHERE `endDate` IS NOT NULL AND (CAST(`endDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`endDate`), 0) = 0 OR COALESCE(DAY(`endDate`), 0) = 0);
UPDATE `events` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `events` SET `startDate` = NULL
 WHERE `startDate` IS NOT NULL AND (CAST(`startDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`startDate`), 0) = 0 OR COALESCE(DAY(`startDate`), 0) = 0);
UPDATE `products` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `products` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `products` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `products` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `services` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `services` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `services` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `partners` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `partners` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `partners` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `careers` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `careers` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `careers` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `careers` SET `publishedAt` = NULL
 WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0);
UPDATE `solutions` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `solutions` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `solutions` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `hero_slides` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `hero_slides` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `hero_slides` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `orders` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `orders` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `orders` SET `date` = NOW(3)
 WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0);
UPDATE `orders` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `quotes` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `quotes` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `quotes` SET `date` = NOW(3)
 WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0);
UPDATE `quotes` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `quotes` SET `desiredDate` = NULL
 WHERE `desiredDate` IS NOT NULL AND (CAST(`desiredDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`desiredDate`), 0) = 0 OR COALESCE(DAY(`desiredDate`), 0) = 0);
UPDATE `job_applications` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `job_applications` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `job_applications` SET `date` = NOW(3)
 WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0);
UPDATE `job_applications` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `home_sections` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `home_sections` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `home_sections` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `newsletter_subscribers` SET `createdAt` = NOW(3)
 WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0);
UPDATE `newsletter_subscribers` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0);
UPDATE `newsletter_subscribers` SET `deletedAt` = NULL
 WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0);
UPDATE `newsletter_subscribers` SET `subscribedAt` = NULL
 WHERE `subscribedAt` IS NOT NULL AND (CAST(`subscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`subscribedAt`), 0) = 0 OR COALESCE(DAY(`subscribedAt`), 0) = 0);
UPDATE `newsletter_subscribers` SET `unsubscribedAt` = NULL
 WHERE `unsubscribedAt` IS NOT NULL AND (CAST(`unsubscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`unsubscribedAt`), 0) = 0 OR COALESCE(DAY(`unsubscribedAt`), 0) = 0);

-- ——— 3. Contrôle : le même comptage, rejoué — il ne doit sortir aucune ligne ———
-- Un résultat vide ici veut dire que les listes de l'administration se reliront.
SELECT * FROM (
  SELECT 'roles' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `roles`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'roles' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `roles`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'roles' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `roles`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `users`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `users`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `users`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'users' AS `table`, 'lastLoginAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `users`
    WHERE `lastLoginAt` IS NOT NULL AND (CAST(`lastLoginAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`lastLoginAt`), 0) = 0 OR COALESCE(DAY(`lastLoginAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `refresh_tokens`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `refresh_tokens`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `refresh_tokens`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'expiresAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `refresh_tokens`
    WHERE `expiresAt` IS NOT NULL AND (CAST(`expiresAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`expiresAt`), 0) = 0 OR COALESCE(DAY(`expiresAt`), 0) = 0)
  UNION ALL
  SELECT 'refresh_tokens' AS `table`, 'revokedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `refresh_tokens`
    WHERE `revokedAt` IS NOT NULL AND (CAST(`revokedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`revokedAt`), 0) = 0 OR COALESCE(DAY(`revokedAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `permissions`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `permissions`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'permissions' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `permissions`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `pages`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `pages`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `pages`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'pages' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `pages`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `faqs`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `faqs`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'faqs' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `faqs`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `testimonials`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `testimonials`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'testimonials' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `testimonials`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `menus`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `menus`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'menus' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `menus`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_info`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_info`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_info' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_info`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_messages`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_messages`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'contact_messages' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `contact_messages`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `translations`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `translations`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'translations' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `translations`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `audit_logs`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `audit_logs`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'audit_logs' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `audit_logs`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `settings`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `settings`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'settings' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `settings`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `authors`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `authors`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `authors`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'authors' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `authors`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'date' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'publicationDate' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `publicationDate` IS NOT NULL AND (CAST(`publicationDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publicationDate`), 0) = 0 OR COALESCE(DAY(`publicationDate`), 0) = 0)
  UNION ALL
  SELECT 'news_articles' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `news_articles`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'date' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'endDate' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `endDate` IS NOT NULL AND (CAST(`endDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`endDate`), 0) = 0 OR COALESCE(DAY(`endDate`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'events' AS `table`, 'startDate' AS `colonne`, COUNT(*) AS `reste`
    FROM `events`
    WHERE `startDate` IS NOT NULL AND (CAST(`startDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`startDate`), 0) = 0 OR COALESCE(DAY(`startDate`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `products`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `products`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `products`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'products' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `products`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `services`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `services`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'services' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `services`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `partners`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `partners`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'partners' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `partners`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `careers`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `careers`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `careers`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'careers' AS `table`, 'publishedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `careers`
    WHERE `publishedAt` IS NOT NULL AND (CAST(`publishedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`publishedAt`), 0) = 0 OR COALESCE(DAY(`publishedAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `solutions`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `solutions`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'solutions' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `solutions`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `hero_slides`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `hero_slides`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'hero_slides' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `hero_slides`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `orders`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `orders`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'date' AS `colonne`, COUNT(*) AS `reste`
    FROM `orders`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'orders' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `orders`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `quotes`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `quotes`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'date' AS `colonne`, COUNT(*) AS `reste`
    FROM `quotes`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `quotes`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'quotes' AS `table`, 'desiredDate' AS `colonne`, COUNT(*) AS `reste`
    FROM `quotes`
    WHERE `desiredDate` IS NOT NULL AND (CAST(`desiredDate` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`desiredDate`), 0) = 0 OR COALESCE(DAY(`desiredDate`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `job_applications`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `job_applications`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'date' AS `colonne`, COUNT(*) AS `reste`
    FROM `job_applications`
    WHERE `date` IS NOT NULL AND (CAST(`date` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`date`), 0) = 0 OR COALESCE(DAY(`date`), 0) = 0)
  UNION ALL
  SELECT 'job_applications' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `job_applications`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `home_sections`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `home_sections`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'home_sections' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `home_sections`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'createdAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `newsletter_subscribers`
    WHERE `createdAt` IS NOT NULL AND (CAST(`createdAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`createdAt`), 0) = 0 OR COALESCE(DAY(`createdAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'updatedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `newsletter_subscribers`
    WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`updatedAt`), 0) = 0 OR COALESCE(DAY(`updatedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'deletedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `newsletter_subscribers`
    WHERE `deletedAt` IS NOT NULL AND (CAST(`deletedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`deletedAt`), 0) = 0 OR COALESCE(DAY(`deletedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'subscribedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `newsletter_subscribers`
    WHERE `subscribedAt` IS NOT NULL AND (CAST(`subscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`subscribedAt`), 0) = 0 OR COALESCE(DAY(`subscribedAt`), 0) = 0)
  UNION ALL
  SELECT 'newsletter_subscribers' AS `table`, 'unsubscribedAt' AS `colonne`, COUNT(*) AS `reste`
    FROM `newsletter_subscribers`
    WHERE `unsubscribedAt` IS NOT NULL AND (CAST(`unsubscribedAt` AS CHAR) LIKE '0000%' OR COALESCE(MONTH(`unsubscribedAt`), 0) = 0 OR COALESCE(DAY(`unsubscribedAt`), 0) = 0)
) s
WHERE s.`reste` > 0
ORDER BY s.`reste` DESC, s.`table`;

-- ——— 4. Prévention : les colonnes NOT NULL sans défaut ———
-- Ce que la base a réellement, d'abord : un `INSERT` brut qui omet une colonne de
-- date NOT NULL sans défaut y écrit un zéro, et c'est précisément ainsi qu'une table
-- se retrouve illisible. Cette requête liste les colonnes à durcir chez vous — la
-- liste peut différer du fichier, si la table a été créée avant les défauts du schéma.
SELECT TABLE_NAME AS `table`, COLUMN_NAME AS `colonne`, DATA_TYPE AS `type`
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND DATA_TYPE IN ('datetime', 'timestamp', 'date')
    AND IS_NULLABLE = 'NO'
    AND COLUMN_DEFAULT IS NULL
  ORDER BY TABLE_NAME, COLUMN_NAME;
-- Les mêmes, côté schéma du dépôt (si la requête ci-dessus en liste d'autres,
-- c'est que la base a été créée avant ces défauts : ajouter les ALTER qui
-- manquent, table par table, sur le même modèle).
ALTER TABLE `refresh_tokens` MODIFY `expiresAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
