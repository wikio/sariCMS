-- ---------------------------------------------------------------------------
-- Réparation des permissions du back-office (base déjà en place)
-- ---------------------------------------------------------------------------
--
-- Généré par `sql/generate-fix-permissions.mjs` d'après
-- `src/common/constants/permissions.ts`. Ne pas éditer à la main : relancer
-- `npm run sql:fix-permissions` après toute modification du catalogue.
--
-- Le besoin. Chaque route du back-office réclame une permission écrite
-- `<ressource>:<action>`. Sur une base ancienne, trois choses ont pu manquer :
-- la ligne de la ressource dans `permissions` (l'écran « Rôles et permissions »
-- n'a alors plus rien à afficher pour elle), le lien vers le rôle dans
-- `role_permissions`, et la copie de ces liens dans `roles.permissionIds`, que
-- l'écran lit pour cocher les cases. Un seul des trois et la case reste vide.
--
-- Pourquoi ce fichier existe pour les rôles verrouillés. `super-admin`, `admin`,
-- `editor` et `viewer` portent `isSystem = 1` : l'écran refuse d'y cocher quoi
-- que ce soit, à juste titre, puisque ces quatre rôles sont redéfinis par le dépôt.
-- Une ressource parue après leur dernier seed ne peut donc pas leur être accordée
-- à la main — ni jamais. Ce fichier applique le barème du dépôt à leur place.
--
-- Ce que ce fichier ne touche pas. Les rôles que vous avez créés (`isSystem = 0`)
-- gardent exactement leurs permissions. Un lien en trop n'est jamais supprimé :
-- la section 1.3 le signale et vous décidez. Aucune ligne de `permissions` n'est
-- effacée, aucune table n'est recréée, et `schema.mysql.sql` n'est jamais joué ici.
--
-- Exécution. Tout le fichier d'un bloc, ou sélection-exécution section par section.
-- Il est rejouable : les insertions sont conditionnées et les remises à plat sont
-- recalculées, vous pouvez le relancer après chaque ajout de ressource.

SET NAMES utf8mb4;

-- ===========================================================================
-- 1. Diagnostic — à lire avant de réparer
-- ===========================================================================

-- 1.1 Permissions attendues et absentes de la table. Le barème complet fait
-- 26 ressources × 5 actions, soit 130 lignes attendues.

SELECT res.`resource` AS `ressource`, act.`action` AS `action`
  FROM (
  SELECT 'users' AS `resource`
  UNION ALL SELECT 'roles'
  UNION ALL SELECT 'permissions'
  UNION ALL SELECT 'pages'
  UNION ALL SELECT 'faqs'
  UNION ALL SELECT 'testimonials'
  UNION ALL SELECT 'menus'
  UNION ALL SELECT 'contact'
  UNION ALL SELECT 'translations'
  UNION ALL SELECT 'audit'
  UNION ALL SELECT 'settings'
  UNION ALL SELECT 'news'
  UNION ALL SELECT 'events'
  UNION ALL SELECT 'products'
  UNION ALL SELECT 'services'
  UNION ALL SELECT 'partners'
  UNION ALL SELECT 'careers'
  UNION ALL SELECT 'solutions'
  UNION ALL SELECT 'hero'
  UNION ALL SELECT 'dashboard'
  UNION ALL SELECT 'orders'
  UNION ALL SELECT 'quotes'
  UNION ALL SELECT 'applications'
  UNION ALL SELECT 'authors'
  UNION ALL SELECT 'home'
  UNION ALL SELECT 'newsletter'
  ) AS res
  CROSS JOIN (
  SELECT 'create' AS `action`
  UNION ALL SELECT 'read'
  UNION ALL SELECT 'update'
  UNION ALL SELECT 'delete'
  UNION ALL SELECT 'admin'
  ) AS act
 WHERE NOT EXISTS (
         SELECT 1 FROM `permissions` p
          WHERE p.`resource` = res.`resource`
            AND p.`action` = act.`action`
       )
 ORDER BY res.`resource`, act.`action`;

-- 1.2 Liens que le barème réclame et que `role_permissions` ignore.
-- C'est la requête qui ressemble le plus au symptôme : un rôle verrouillé sans
-- droit écrit n'a aucune case cochée à l'écran et ne peut pas en recevoir.

SELECT r.`slug` AS `rôle`, p.`resource` AS `ressource`, p.`action` AS `action`
  FROM `roles` r
  JOIN `permissions` p ON p.`deletedAt` IS NULL
 WHERE r.`isSystem` = 1
   AND r.`deletedAt` IS NULL
   AND (
           r.`slug` = 'super-admin'
        OR (r.`slug` = 'admin'
            AND p.`resource` NOT IN ('users', 'roles', 'permissions')
            AND (p.`resource` <> 'audit' OR p.`action` = 'read'))
        OR (r.`slug` = 'editor'
            AND ((p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home')
                  AND p.`action` IN ('create', 'read', 'update'))
                 OR (p.`resource` IN ('newsletter', 'contact', 'audit', 'dashboard')
                  AND p.`action` = 'read')))
        OR (r.`slug` = 'viewer'
            AND p.`action` = 'read'
            AND p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home', 'newsletter', 'contact', 'audit', 'dashboard'))
      )
   AND NOT EXISTS (
         SELECT 1 FROM `role_permissions` rp
          WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
       )
 ORDER BY r.`slug`, p.`resource`, p.`action`;

-- 1.3 Liens en trop, accordés à la main sur un rôle verrouillé. Inoffensifs,
-- mais ils disparaissent mal : le prochain seed du dépôt ne les connaît pas.

SELECT r.`slug` AS `rôle`, p.`resource` AS `ressource`, p.`action` AS `action`
  FROM `roles` r
  JOIN `role_permissions` rp ON rp.`roleId` = r.`id`
  JOIN `permissions` p ON p.`id` = rp.`permissionId`
 WHERE r.`isSystem` = 1
   AND r.`deletedAt` IS NULL
   AND NOT (
           r.`slug` = 'super-admin'
        OR (r.`slug` = 'admin'
            AND p.`resource` NOT IN ('users', 'roles', 'permissions')
            AND (p.`resource` <> 'audit' OR p.`action` = 'read'))
        OR (r.`slug` = 'editor'
            AND ((p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home')
                  AND p.`action` IN ('create', 'read', 'update'))
                 OR (p.`resource` IN ('newsletter', 'contact', 'audit', 'dashboard')
                  AND p.`action` = 'read')))
        OR (r.`slug` = 'viewer'
            AND p.`action` = 'read'
            AND p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home', 'newsletter', 'contact', 'audit', 'dashboard'))
      )
 ORDER BY r.`slug`, p.`resource`, p.`action`;

-- 1.4 Désaccord entre `role_permissions` et `roles.permissionIds`. L'écran ne lit
-- que le JSON : une permission liée mais non recopiée est invisible, et une
-- permission recopiée sans lien est un fantôme que la route refuse.

SELECT r.`slug` AS `rôle`,
       (SELECT COUNT(*) FROM `role_permissions` rp WHERE rp.`roleId` = r.`id`) AS `liens en base`,
       (SELECT COUNT(*) FROM `role_permissions` rp
         WHERE rp.`roleId` = r.`id`
           AND (r.`permissionIds` IS NULL
                OR NOT JSON_VALID(r.`permissionIds`)
                OR NOT JSON_CONTAINS(r.`permissionIds`, CAST(rp.`permissionId` AS CHAR)))) AS `absents du JSON`
  FROM `roles` r
 WHERE r.`isSystem` = 1 AND r.`deletedAt` IS NULL
 ORDER BY r.`slug`;

-- ===========================================================================
-- 2. Les permissions qui manquent
-- ===========================================================================

-- Une seule insertion pour tout le barème, conditionnée ligne à ligne : ni
-- index unique requis, ni doublon possible. Le `IGNORE` couvre les tables qui
-- possèdent la clé (resource, action) et qui refuseraient autrement la reprise.
--
-- 2.1 Les lignes absentes.

INSERT IGNORE INTO `permissions` (`resource`, `action`, `description`, `createdAt`, `updatedAt`)
SELECT res.`resource`,
       act.`action`,
       CONCAT(
         CASE act.`action`
   WHEN 'create' THEN 'Créer'
   WHEN 'read' THEN 'Consulter'
   WHEN 'update' THEN 'Modifier'
   WHEN 'delete' THEN 'Supprimer'
   WHEN 'admin' THEN 'Administrer'
         ELSE act.`action`
         END,
         ' ',
         res.`resource`
       ),
       CURRENT_TIMESTAMP(3),
       CURRENT_TIMESTAMP(3)
  FROM (
  SELECT 'users' AS `resource`
  UNION ALL SELECT 'roles'
  UNION ALL SELECT 'permissions'
  UNION ALL SELECT 'pages'
  UNION ALL SELECT 'faqs'
  UNION ALL SELECT 'testimonials'
  UNION ALL SELECT 'menus'
  UNION ALL SELECT 'contact'
  UNION ALL SELECT 'translations'
  UNION ALL SELECT 'audit'
  UNION ALL SELECT 'settings'
  UNION ALL SELECT 'news'
  UNION ALL SELECT 'events'
  UNION ALL SELECT 'products'
  UNION ALL SELECT 'services'
  UNION ALL SELECT 'partners'
  UNION ALL SELECT 'careers'
  UNION ALL SELECT 'solutions'
  UNION ALL SELECT 'hero'
  UNION ALL SELECT 'dashboard'
  UNION ALL SELECT 'orders'
  UNION ALL SELECT 'quotes'
  UNION ALL SELECT 'applications'
  UNION ALL SELECT 'authors'
  UNION ALL SELECT 'home'
  UNION ALL SELECT 'newsletter'
  ) AS res
  CROSS JOIN (
  SELECT 'create' AS `action`
  UNION ALL SELECT 'read'
  UNION ALL SELECT 'update'
  UNION ALL SELECT 'delete'
  UNION ALL SELECT 'admin'
  ) AS act
 WHERE NOT EXISTS (
         SELECT 1 FROM `permissions` p
          WHERE p.`resource` = res.`resource` AND p.`action` = act.`action`
       );

-- 2.2 Une permission effacée de la liste se remet en service plutôt que de
-- renaitre en doublon. Sans quoi la ressource reste invisible à l'écran, alors
-- que 2.1 a cru l'avoir insérée.

UPDATE `permissions`
   SET `deletedAt` = NULL,
       `updatedAt` = CURRENT_TIMESTAMP(3)
 WHERE `deletedAt` IS NOT NULL;

-- ===========================================================================
-- 3. Le barème accordé aux quatre rôles verrouillés
-- ===========================================================================

-- Le rôle « Lecteur » ne reçoit que `read` ; « Éditeur de contenu » crée, lit et
-- modifie le contenu mais ne supprime rien et ne touche ni aux comptes, ni aux
-- rôles, ni aux réglages ; « Administrateur » gère tout sauf le noyau ; le
-- « Super Administrateur » contourne le contrôle, on lui lie tout pour que les
-- cases de l'écran soient cohérentes avec ce qu'il peut réellement faire.

INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT r.`id`, p.`id`
  FROM `roles` r
  JOIN `permissions` p ON p.`deletedAt` IS NULL
 WHERE r.`isSystem` = 1
   AND r.`deletedAt` IS NULL
   AND (
           r.`slug` = 'super-admin'
        OR (r.`slug` = 'admin'
            AND p.`resource` NOT IN ('users', 'roles', 'permissions')
            AND (p.`resource` <> 'audit' OR p.`action` = 'read'))
        OR (r.`slug` = 'editor'
            AND ((p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home')
                  AND p.`action` IN ('create', 'read', 'update'))
                 OR (p.`resource` IN ('newsletter', 'contact', 'audit', 'dashboard')
                  AND p.`action` = 'read')))
        OR (r.`slug` = 'viewer'
            AND p.`action` = 'read'
            AND p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home', 'newsletter', 'contact', 'audit', 'dashboard'))
      )
   AND NOT EXISTS (
         SELECT 1 FROM `role_permissions` rp
          WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
       );

-- ===========================================================================
-- 4. `roles.permissionIds` remis à l'heure
-- ===========================================================================

-- La colonne JSON est la copie que lit l'écran, la table de liaison est ce que
-- vérifie le serveur : on recopie la seconde dans la première, et seulement pour
-- les rôles verrouillés. Les rôles créés par vous ne sont pas recalculés — leur
-- JSON peut porter des droits que vous avez accordés à la main et que le barème
-- du dépôt n'a jamais vus, les écraserait serait une perte de données.
--
-- `group_concat_max_len` est relevé parce que le super-admin porte le barème
-- complet et que la valeur par défaut (1024 octets) tronquerait la liste en
-- milieu de tableau, ce qui produit un JSON invalide plutôt qu'une erreur.

SET SESSION group_concat_max_len = 262144;

UPDATE `roles` r
   SET r.`permissionIds` = COALESCE(
         (SELECT CONCAT('[', GROUP_CONCAT(rp.`permissionId` ORDER BY rp.`permissionId` SEPARATOR ','), ']')
            FROM `role_permissions` rp
           WHERE rp.`roleId` = r.`id`),
         '[]')
 WHERE r.`isSystem` = 1;

-- ===========================================================================
-- 5. Contrôle — rejouez cette section après la réparation
-- ===========================================================================

-- 5.1 Doit rendre 0 ligne : chaque rôle verrouillé porte ce que le barème exige.

SELECT r.`slug` AS `rôle`, p.`resource` AS `ressource`, p.`action` AS `action`
  FROM `roles` r
  JOIN `permissions` p ON p.`deletedAt` IS NULL
 WHERE r.`isSystem` = 1
   AND r.`deletedAt` IS NULL
   AND (
           r.`slug` = 'super-admin'
        OR (r.`slug` = 'admin'
            AND p.`resource` NOT IN ('users', 'roles', 'permissions')
            AND (p.`resource` <> 'audit' OR p.`action` = 'read'))
        OR (r.`slug` = 'editor'
            AND ((p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home')
                  AND p.`action` IN ('create', 'read', 'update'))
                 OR (p.`resource` IN ('newsletter', 'contact', 'audit', 'dashboard')
                  AND p.`action` = 'read')))
        OR (r.`slug` = 'viewer'
            AND p.`action` = 'read'
            AND p.`resource` IN ('pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products', 'services', 'partners', 'careers', 'solutions', 'hero', 'translations', 'authors', 'home', 'newsletter', 'contact', 'audit', 'dashboard'))
      )
   AND NOT EXISTS (
         SELECT 1 FROM `role_permissions` rp
          WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
       )
 ORDER BY r.`slug`, p.`resource`, p.`action`;

-- 5.2 Doit rendre 0 dans « absents du JSON » sur les quatre lignes, et le même
-- nombre de liens que le barème ci-dessous.

SELECT r.`slug` AS `rôle`,
       (SELECT COUNT(*) FROM `role_permissions` rp WHERE rp.`roleId` = r.`id`) AS `liens en base`,
       (SELECT COUNT(*) FROM `role_permissions` rp
         WHERE rp.`roleId` = r.`id`
           AND (r.`permissionIds` IS NULL
                OR NOT JSON_VALID(r.`permissionIds`)
                OR NOT JSON_CONTAINS(r.`permissionIds`, CAST(rp.`permissionId` AS CHAR)))) AS `absents du JSON`
  FROM `roles` r
 WHERE r.`isSystem` = 1 AND r.`deletedAt` IS NULL
 ORDER BY r.`slug`;

-- 5.3 Le barème, pour comparer 5.2 à la main.

  SELECT 'super-admin' AS `rôle`, 130 AS `permissions attendues`
  UNION ALL
  SELECT 'admin' AS `rôle`, 111 AS `permissions attendues`
  UNION ALL
  SELECT 'editor' AS `rôle`, 49 AS `permissions attendues`
  UNION ALL
  SELECT 'viewer' AS `rôle`, 19 AS `permissions attendues`
;

-- ===========================================================================
-- 6. Après ce fichier
-- ===========================================================================

-- 1. Redémarrez le backend : les permissions des rôles sont mises en cache avec la
--    session, un rôle réparé en base reste refusé tant que le processus ne les a
--    pas relues.
-- 2. Administration → Rôles et permissions : les cases des quatre rôles
--    verrouillés se présentent cochées et grises — grises parce que le barème est
--    écrit dans le dépôt, pas parce que la base serait muette.
-- 3. Un rôle créé par vous se règle à l'écran, pas ici : c'est la différence
--    entre un rôle verrouillé, redéfini à chaque seed, et un rôle à vous.

