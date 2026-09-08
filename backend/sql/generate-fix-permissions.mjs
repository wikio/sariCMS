#!/usr/bin/env node
/**
 * Génère `fix-permissions.mysql.sql` : met à jour le socle de permissions du
 * back-office sur une base DÉJÀ EN PLACE (ressources parues après le seed, liens
 * des rôles verrouillés, colonne `roles.permissionIds`).
 *
 *   node sql/generate-fix-permissions.mjs      # depuis backend/
 *   npm run sql:fix-permissions                # même chose, via le script npm
 *
 * Le fichier est ÉCRIT, pas calculé : ni procédure, ni table temporaire, ni
 * `PREPARE`, ni `DELIMITER` — il se joue tel quel dans HeidiSQL, phpMyAdmin ou
 * `mysql`. Les ressources et le barème des rôles viennent de
 * `permissions-catalog.mjs`, qui lit `src/common/constants/permissions.ts` : le SQL
 * suit donc le code, et le contrôle du catalogue refuse de générer un fichier qui
 * aurait été écrit à côté d'une ressource oubliée.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIONS,
  CONTENT_RESOURCES,
  CONSULT_ONLY_FOR_EDITOR,
  PERM_DESCRIPTIONS,
  RESOURCES,
  SYSTEM_ROLES,
  permKeysFor,
} from './permissions-catalog.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'fix-permissions.mysql.sql');

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const listOf = (values) => values.map(quote).join(', ');

/**
 * Liste littérale en ligne, sans table temporaire ni alias de colonne emprunté à
 * une autre requête — c'est exactement ce qui avait fait échouer une première
 * version de ces fichiers dans un client graphique (erreur 1054).
 */
function inlineTable(column, values) {
  return values
    .map((value, index) =>
      index === 0
        ? `  SELECT ${quote(value)} AS ${back(column)}`
        : `  UNION ALL SELECT ${quote(value)}`,
    )
    .join('\n');
}
const back = (name) => `\`${name}\``;

const actionLabels = Object.entries(PERM_DESCRIPTIONS)
  .map(([action, label]) => `   WHEN ${quote(action)} THEN ${quote(label)}`)
  .join('\n');

// ---------------------------------------------------------------------------
// Le barème des rôles verrouillés, écrit une seule fois.
//
// Il sert au diagnostic, à la réparation et au contrôle : trois formules
// différentes finiraient par se contredire, et c'est le genre de divergence que
// personne ne lit.
// ---------------------------------------------------------------------------
const VIEWER_READABLE = [...new Set([...CONTENT_RESOURCES, ...CONSULT_ONLY_FOR_EDITOR])];
const MATRIX_WHERE = `(
           r.${back('slug')} = 'super-admin'
        OR (r.${back('slug')} = 'admin'
            AND p.${back('resource')} NOT IN ('users', 'roles', 'permissions')
            AND (p.${back('resource')} <> 'audit' OR p.${back('action')} = 'read'))
        OR (r.${back('slug')} = 'editor'
            AND ((p.${back('resource')} IN (${listOf(CONTENT_RESOURCES)})
                  AND p.${back('action')} IN ('create', 'read', 'update'))
                 OR (p.${back('resource')} IN (${listOf(CONSULT_ONLY_FOR_EDITOR)})
                  AND p.${back('action')} = 'read')))
        OR (r.${back('slug')} = 'viewer'
            AND p.${back('action')} = 'read'
            AND p.${back('resource')} IN (${listOf(VIEWER_READABLE)}))
      )`;

/** Les liens que le barème réclame et que la table de liaison ne connaît pas. */
const MISSING_LINKS = `SELECT r.${back('slug')} AS ${back('rôle')}, p.${back('resource')} AS ${back('ressource')}, p.${back('action')} AS ${back('action')}
  FROM ${back('roles')} r
  JOIN ${back('permissions')} p ON p.${back('deletedAt')} IS NULL
 WHERE r.${back('isSystem')} = 1
   AND r.${back('deletedAt')} IS NULL
   AND ${MATRIX_WHERE}
   AND NOT EXISTS (
         SELECT 1 FROM ${back('role_permissions')} rp
          WHERE rp.${back('roleId')} = r.${back('id')} AND rp.${back('permissionId')} = p.${back('id')}
       )
 ORDER BY r.${back('slug')}, p.${back('resource')}, p.${back('action')}`;

/** Liens en trop au regard du barème : signalés, jamais supprimés. */
const EXTRA_LINKS = `SELECT r.${back('slug')} AS ${back('rôle')}, p.${back('resource')} AS ${back('ressource')}, p.${back('action')} AS ${back('action')}
  FROM ${back('roles')} r
  JOIN ${back('role_permissions')} rp ON rp.${back('roleId')} = r.${back('id')}
  JOIN ${back('permissions')} p ON p.${back('id')} = rp.${back('permissionId')}
 WHERE r.${back('isSystem')} = 1
   AND r.${back('deletedAt')} IS NULL
   AND NOT ${MATRIX_WHERE}
 ORDER BY r.${back('slug')}, p.${back('resource')}, p.${back('action')}`;

/** Écart entre la table de liaison (qui fait autorité) et le JSON lu par l'écran. */
const JSON_DRIFT = `SELECT r.${back('slug')} AS ${back('rôle')},
       (SELECT COUNT(*) FROM ${back('role_permissions')} rp WHERE rp.${back('roleId')} = r.${back('id')}) AS ${back('liens en base')},
       (SELECT COUNT(*) FROM ${back('role_permissions')} rp
         WHERE rp.${back('roleId')} = r.${back('id')}
           AND (r.${back('permissionIds')} IS NULL
                OR NOT JSON_VALID(r.${back('permissionIds')})
                OR NOT JSON_CONTAINS(r.${back('permissionIds')}, CAST(rp.${back('permissionId')} AS CHAR)))) AS ${back('absents du JSON')}
  FROM ${back('roles')} r
 WHERE r.${back('isSystem')} = 1 AND r.${back('deletedAt')} IS NULL
 ORDER BY r.${back('slug')}`;

const expected = SYSTEM_ROLES.map((role) => {
  const count = permKeysFor(role.slug).length;
  return `  SELECT ${quote(role.slug)} AS ${back('rôle')}, ${count} AS ${back('permissions attendues')}`;
}).join('\n  UNION ALL\n');

const lines = [];
const push = (line = '') => lines.push(line);

push('-- ---------------------------------------------------------------------------');
push('-- Réparation des permissions du back-office (base déjà en place)');
push('-- ---------------------------------------------------------------------------');
push('--');
push('-- Généré par `sql/generate-fix-permissions.mjs` d\'après');
push('-- `src/common/constants/permissions.ts`. Ne pas éditer à la main : relancer');
push('-- `npm run sql:fix-permissions` après toute modification du catalogue.');
push('--');
push('-- Le besoin. Chaque route du back-office réclame une permission écrite');
push('-- `<ressource>:<action>`. Sur une base ancienne, trois choses ont pu manquer :');
push('-- la ligne de la ressource dans `permissions` (l\'écran « Rôles et permissions »');
push('-- n\'a alors plus rien à afficher pour elle), le lien vers le rôle dans');
push('-- `role_permissions`, et la copie de ces liens dans `roles.permissionIds`, que');
push('-- l\'écran lit pour cocher les cases. Un seul des trois et la case reste vide.');
push('--');
push('-- Pourquoi ce fichier existe pour les rôles verrouillés. `super-admin`, `admin`,');
push('-- `editor` et `viewer` portent `isSystem = 1` : l\'écran refuse d\'y cocher quoi');
push('-- que ce soit, à juste titre, puisque ces quatre rôles sont redéfinis par le dépôt.');
push('-- Une ressource parue après leur dernier seed ne peut donc pas leur être accordée');
push('-- à la main — ni jamais. Ce fichier applique le barème du dépôt à leur place.');
push('--');
push('-- Ce que ce fichier ne touche pas. Les rôles que vous avez créés (`isSystem = 0`)');
push('-- gardent exactement leurs permissions. Un lien en trop n\'est jamais supprimé :');
push('-- la section 1.3 le signale et vous décidez. Aucune ligne de `permissions` n\'est');
push('-- effacée, aucune table n\'est recréée, et `schema.mysql.sql` n\'est jamais joué ici.');
push('--');
push('-- Exécution. Tout le fichier d\'un bloc, ou sélection-exécution section par section.');
push('-- Il est rejouable : les insertions sont conditionnées et les remises à plat sont');
push('-- recalculées, vous pouvez le relancer après chaque ajout de ressource.');
push('');
push('SET NAMES utf8mb4;');
push('');
push('-- ===========================================================================');
push('-- 1. Diagnostic — à lire avant de réparer');
push('-- ===========================================================================');
push('');
push(`-- 1.1 Permissions attendues et absentes de la table. Le barème complet fait`);
push(`-- ${RESOURCES.length} ressources × ${ACTIONS.length} actions, soit ${RESOURCES.length * ACTIONS.length} lignes attendues.`);
push('');
push(`SELECT res.${back('resource')} AS ${back('ressource')}, act.${back('action')} AS ${back('action')}`);
push('  FROM (');
push(inlineTable('resource', RESOURCES));
push('  ) AS res');
push('  CROSS JOIN (');
push(inlineTable('action', ACTIONS));
push('  ) AS act');
push(' WHERE NOT EXISTS (');
push('         SELECT 1 FROM `permissions` p');
push('          WHERE p.`resource` = res.`resource`');
push('            AND p.`action` = act.`action`');
push('       )');
push(' ORDER BY res.`resource`, act.`action`;');
push('');
push('-- 1.2 Liens que le barème réclame et que `role_permissions` ignore.');
push('-- C\'est la requête qui ressemble le plus au symptôme : un rôle verrouillé sans');
push('-- droit écrit n\'a aucune case cochée à l\'écran et ne peut pas en recevoir.');
push('');
push(`${MISSING_LINKS};`);
push('');
push('-- 1.3 Liens en trop, accordés à la main sur un rôle verrouillé. Inoffensifs,');
push('-- mais ils disparaissent mal : le prochain seed du dépôt ne les connaît pas.');
push('');
push(`${EXTRA_LINKS};`);
push('');
push('-- 1.4 Désaccord entre `role_permissions` et `roles.permissionIds`. L\'écran ne lit');
push('-- que le JSON : une permission liée mais non recopiée est invisible, et une');
push('-- permission recopiée sans lien est un fantôme que la route refuse.');
push('');
push(`${JSON_DRIFT};`);
push('');
push('-- ===========================================================================');
push('-- 2. Les permissions qui manquent');
push('-- ===========================================================================');
push('');
push('-- Une seule insertion pour tout le barème, conditionnée ligne à ligne : ni');
push('-- index unique requis, ni doublon possible. Le `IGNORE` couvre les tables qui');
push('-- possèdent la clé (resource, action) et qui refuseraient autrement la reprise.');
push('--');
push('-- 2.1 Les lignes absentes.');
push('');
push('INSERT IGNORE INTO `permissions` (`resource`, `action`, `description`, `createdAt`, `updatedAt`)');
push('SELECT res.`resource`,');
push('       act.`action`,');
push('       CONCAT(');
push('         CASE act.`action`');
push(actionLabels);
push('         ELSE act.`action`');
push('         END,');
push('         \' \',');
push('         res.`resource`');
push('       ),');
push('       CURRENT_TIMESTAMP(3),');
push('       CURRENT_TIMESTAMP(3)');
push('  FROM (');
push(inlineTable('resource', RESOURCES));
push('  ) AS res');
push('  CROSS JOIN (');
push(inlineTable('action', ACTIONS));
push('  ) AS act');
push(' WHERE NOT EXISTS (');
push('         SELECT 1 FROM `permissions` p');
push('          WHERE p.`resource` = res.`resource` AND p.`action` = act.`action`');
push('       );');
push('');
push('-- 2.2 Une permission effacée de la liste se remet en service plutôt que de');
push('-- renaitre en doublon. Sans quoi la ressource reste invisible à l\'écran, alors');
push('-- que 2.1 a cru l\'avoir insérée.');
push('');
push('UPDATE `permissions`');
push('   SET `deletedAt` = NULL,');
push('       `updatedAt` = CURRENT_TIMESTAMP(3)');
push(' WHERE `deletedAt` IS NOT NULL;');
push('');
push('-- ===========================================================================');
push('-- 3. Le barème accordé aux quatre rôles verrouillés');
push('-- ===========================================================================');
push('');
push('-- Le rôle « Lecteur » ne reçoit que `read` ; « Éditeur de contenu » crée, lit et');
push('-- modifie le contenu mais ne supprime rien et ne touche ni aux comptes, ni aux');
push('-- rôles, ni aux réglages ; « Administrateur » gère tout sauf le noyau ; le');
push('-- « Super Administrateur » contourne le contrôle, on lui lie tout pour que les');
push('-- cases de l\'écran soient cohérentes avec ce qu\'il peut réellement faire.');
push('');
push('INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)');
push('SELECT r.`id`, p.`id`');
push('  FROM `roles` r');
push('  JOIN `permissions` p ON p.`deletedAt` IS NULL');
push(' WHERE r.`isSystem` = 1');
push('   AND r.`deletedAt` IS NULL');
push(`   AND ${MATRIX_WHERE}`);
push('   AND NOT EXISTS (');
push('         SELECT 1 FROM `role_permissions` rp');
push('          WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`');
push('       );');
push('');
push('-- ===========================================================================');
push('-- 4. `roles.permissionIds` remis à l\'heure');
push('-- ===========================================================================');
push('');
push('-- La colonne JSON est la copie que lit l\'écran, la table de liaison est ce que');
push('-- vérifie le serveur : on recopie la seconde dans la première, et seulement pour');
push('-- les rôles verrouillés. Les rôles créés par vous ne sont pas recalculés — leur');
push('-- JSON peut porter des droits que vous avez accordés à la main et que le barème');
push('-- du dépôt n\'a jamais vus, les écraserait serait une perte de données.');
push('--');
push('-- `group_concat_max_len` est relevé parce que le super-admin porte le barème');
push('-- complet et que la valeur par défaut (1024 octets) tronquerait la liste en');
push('-- milieu de tableau, ce qui produit un JSON invalide plutôt qu\'une erreur.');
push('');
push('SET SESSION group_concat_max_len = 262144;');
push('');
push('UPDATE `roles` r');
push('   SET r.`permissionIds` = COALESCE(');
push('         (SELECT CONCAT(\'[\', GROUP_CONCAT(rp.`permissionId` ORDER BY rp.`permissionId` SEPARATOR \',\'), \']\')');
push('            FROM `role_permissions` rp');
push('           WHERE rp.`roleId` = r.`id`),');
push('         \'[]\')');
push(' WHERE r.`isSystem` = 1;');
push('');
push('-- ===========================================================================');
push('-- 5. Contrôle — rejouez cette section après la réparation');
push('-- ===========================================================================');
push('');
push('-- 5.1 Doit rendre 0 ligne : chaque rôle verrouillé porte ce que le barème exige.');
push('');
push(`${MISSING_LINKS};`);
push('');
push('-- 5.2 Doit rendre 0 dans « absents du JSON » sur les quatre lignes, et le même');
push('-- nombre de liens que le barème ci-dessous.');
push('');
push(`${JSON_DRIFT};`);
push('');
push('-- 5.3 Le barème, pour comparer 5.2 à la main.');
push('');
push(expected);
push(';');
push('');
push('-- ===========================================================================');
push('-- 6. Après ce fichier');
push('-- ===========================================================================');
push('');
push('-- 1. Redémarrez le backend : les permissions des rôles sont mises en cache avec la');
push('--    session, un rôle réparé en base reste refusé tant que le processus ne les a');
push('--    pas relues.');
push('-- 2. Administration → Rôles et permissions : les cases des quatre rôles');
push('--    verrouillés se présentent cochées et grises — grises parce que le barème est');
push('--    écrit dans le dépôt, pas parce que la base serait muette.');
push('-- 3. Un rôle créé par vous se règle à l\'écran, pas ici : c\'est la différence');
push('--    entre un rôle verrouillé, redéfini à chaque seed, et un rôle à vous.');
push('');

const text = lines.join('\n') + '\n';
writeFileSync(OUT, text, 'utf8');

const statements = (text.match(/;/g) || []).length;
// Le fichier ne doit contenir aucun point-virgule en fin de commentaire : plusieurs
// clients découpent le script sur chaque `;`, y compris dans un commentaire.
const badComment = text
  .split('\n')
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => line.trimStart().startsWith('--') && /;\s*$/.test(line));
const forbidden = ['DELIMITER', 'CREATE PROCEDURE', 'PREPARE ', 'TEMPORARY'].filter((needle) =>
  new RegExp(needle, 'i').test(text),
);

console.log(`✅ ${OUT}`);
console.log(`   ${lines.length} lignes, ${statements} instructions, ${RESOURCES.length} ressources × ${ACTIONS.length} actions`);
if (badComment.length) console.log(`   ⚠ ${badComment.length} commentaire(s) se terminent par un point-virgule (ligne ${badComment[0].index + 1})`);
if (forbidden.length) console.log(`   ⚠ mécanismes refusés par un client graphique : ${forbidden.join(', ')}`);
