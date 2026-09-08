#!/usr/bin/env node
/**
 * Génère `seed-legal-pages.mysql.sql` : les douze documents légaux (quatre par
 * langue) dans la table `pages`.
 *
 * Pourquoi un fichier pour eux seuls, alors que `migrate-data.mjs` les écrit
 * déjà ? Parce que le besoin réel n'est pas une reprise complète des données :
 * c'est une base en production, remplie, dont l'écran « Pages légales » est
 * vide. Rejouer `migrate-data.mysql.sql` pour récupérer quatre documents
 * réécrirait au passage les produits, les actualités et les visuels travaillés
 * dans l'administration. Ce fichier ne touche donc que la table `pages`, et
 * uniquement les douze lignes concernées.
 *
 * Deuxième différence, la plus importante : la reprise complète écrase le
 * contenu, ici il est préservé. Un texte rédigé dans l'administration survit à
 * une réexécution du fichier — on ne répare que ce qui rend un document
 * trouvable (la famille, le type, l'emplacement) et ce qui le rend visible (le
 * statut). Un document vide, lui, reçoit le texte du fichier : c'est bien le cas
 * qu'on vient corriger.
 *
 * Usage : node backend/sql/generate-seed-legal.mjs
 *       (ou npm run sql:seed-legal depuis backend/)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../data');
const OUT = resolve(HERE, 'seed-legal-pages.mysql.sql');

/** Les quatre documents, dans l'ordre où on les lit. */
const DOC_TYPES = ['mentions', 'privacy', 'conditions', 'about'];
const LOCALES = ['fr', 'en', 'ar'];
/*
 * Aucun identifiant n'est écrit : la clé unique (slug, locale) désigne la ligne,
 * et imposer 9001… reviendrait à entrer en collision avec une base dont les ids
 * ont déjà avancé jusque-là — la reprise complète, elle, les pose parce qu'elle
 * part d'une table vide.
 */
/**
 * Date de première publication annoncée par le fichier de chaque langue, recopiée
 * dans `publishedAt` : c'est elle que la vitrine affiche sous le titre.
 */
const PUBLISHED_AT = {
  mentions: '2024-01-01 00:00:00.000',
  privacy: '2024-01-15 00:00:00.000',
  conditions: '2024-01-01 00:00:00.000',
  about: '2024-01-01 00:00:00.000',
};

function quote(value) {
  // MySQL et MariaDB interprètent la barre oblique inverse dans une chaîne :
  // elle doit être doublée, sinon un \n du texte deviendrait un retour ligne
  // réel — ou pire, une séquence d'échappement avortée en milieu de champ.
  const text = String(value).replace(/\u0000/g, '').replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${text}'`;
}

/** Le texte des documents tient sur une ligne, comme dans le JSON source. */
function oneLine(value) {
  return String(value ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();
}

const rows = [];
for (const locale of LOCALES) {
  const path = join(DATA_DIR, locale, 'legal.json');
  let docs;
  try {
    docs = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`✗ ${path} : illisible (${err.message})`);
    process.exit(1);
  }
  DOC_TYPES.forEach((type, index) => {
    const doc = docs[type];
    if (!doc || typeof doc !== 'object') {
      console.warn(`! ${locale}/${type} absent du fichier JSON — la ligne ne sera pas écrite`);
      return;
    }
    const content = oneLine(doc.content);
    if (!content) {
      console.warn(`! ${locale}/${type} : contenu vide dans le JSON — la ligne ne sera pas écrite`);
      return;
    }
    rows.push({
      slug: type,
      locale,
      type,
      title: oneLine(doc.title) || type,
      content,
      publishedAt: PUBLISHED_AT[type] ?? '2024-01-01 00:00:00.000',
      sortOrder: index,
    });
  });
}

if (!rows.length) {
  console.error('✗ Aucun document trouvé dans data/*/legal.json — rien à générer.');
  process.exit(1);
}

const values = rows
  .map(
    (r) =>
      `  (${quote(r.slug)}, ${quote(r.locale)}, 'legal', 'simple', ${quote(r.title)}, ` +
      `NULL, ${quote(r.type)}, ${quote(r.content)}, ${r.sortOrder}, 'published', ${quote(r.publishedAt)})`,
  )
  .join(',\n');

const sql = `-- ---------------------------------------------------------------------------
-- SARI CMS — documents légaux dans la table \`pages\`
--
-- FICHIER GÉNÉRÉ : ne pas modifier à la main.
-- Source   : data/{fr,en,ar}/legal.json
-- Générer  : node backend/sql/generate-seed-legal.mjs   (npm run sql:seed-legal)
-- Importer : mysql -u utilisateur -p base < backend/sql/seed-legal-pages.mysql.sql
-- Vérifier : node backend/sql/test-seed-legal-sql.mjs
--
-- ${rows.length} lignes (${LOCALES.length} langues × ${DOC_TYPES.length} documents). Chaque document
-- porte sa famille (\`kind = 'legal'\`) et son type (\`category\`), ce qui les rend
-- visibles dans Administration → Pages légales et publiés sur /{langue}/legal/{type}.
--
-- Rejouable et prudent : ON DUPLICATE KEY UPDATE (clé unique slug + locale) ne
-- réécrit JAMAIS un \`content\` ni un \`title\` déjà renseignés. On relance donc ce
-- fichier sans risque après une suppression accidentelle ou sur une base
-- existante ; seul un document vide reçoit le texte du JSON.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Avant : ce que l'administration voit
--
-- Une base saine répond « 4 » pour chaque langue. Un « 0 » signifie que les
-- documents existent peut-être en base, mais sous une famille que l'écran ne
-- filtre pas — c'est le cas nº 2 ci-dessous.
-- ---------------------------------------------------------------------------
SELECT \`locale\` AS langue, COUNT(*) AS documents_legaux_vus_par_l_admin
  FROM \`pages\`
 WHERE \`kind\` = 'legal' AND \`deletedAt\` IS NULL
 GROUP BY \`locale\`
 ORDER BY \`locale\`;

-- ---------------------------------------------------------------------------
-- 2. Après-coup : les lignes qui étaient là sans être déclarées
--
-- Trois origines connues : une fiche créée à la main dans « Pages CMS » avec la
-- famille « Légal » oubliée, un \`category\` saisi en clair (« Mentions légales »
-- au lieu de « mentions »), ou un import ancien qui écrivait la fiche À propos
-- en \`kind = 'about'\`. Ces lignes étaient en base et invisibles. On ne corrige
-- que ce qui est certain — une catégorie qui porte déjà l'un des quatre types,
-- ou une famille « legal » sans catégorie — et le contenu n'est touché par
-- aucune de ces corrections.
-- ---------------------------------------------------------------------------
UPDATE \`pages\`
   SET \`kind\` = 'legal'
 WHERE \`deletedAt\` IS NULL
   AND \`kind\` <> 'legal'
   AND LOWER(COALESCE(\`category\`, '')) IN ('mentions', 'privacy', 'conditions', 'about');

UPDATE \`pages\`
   SET \`category\` = LOWER(\`slug\`)
 WHERE \`deletedAt\` IS NULL
   AND \`kind\` = 'legal'
   AND IFNULL(LOWER(\`category\`), '') NOT IN ('mentions', 'privacy', 'conditions', 'about')
   AND LOWER(\`slug\`) IN ('mentions', 'privacy', 'conditions', 'about');

-- Une catégorie écrite en toutes lettres (« Mentions légales ») n'est pas un
-- type de document au sens du site : la ramener à la valeur attendue évite que
-- la fiche existe, publiée, et ne s'affiche nulle part.
UPDATE \`pages\`
   SET \`category\` = CASE
         WHEN LOWER(\`category\`) LIKE '%mention%' THEN 'mentions'
         WHEN LOWER(\`category\`) LIKE '%confidentialit%' THEN 'privacy'
         WHEN LOWER(\`category\`) LIKE '%rgpd%' THEN 'privacy'
         WHEN LOWER(\`category\`) LIKE '%condition%' OR LOWER(\`category\`) LIKE '%cgv%' THEN 'conditions'
         WHEN LOWER(\`category\`) LIKE '%propos%' THEN 'about'
         ELSE \`category\`
       END
 WHERE \`deletedAt\` IS NULL
   AND \`kind\` = 'legal'
   AND LOWER(COALESCE(\`category\`, '')) NOT IN ('mentions', 'privacy', 'conditions', 'about');

-- ---------------------------------------------------------------------------
-- 3. Les douze documents
--
-- \`publishedAt\` n'est repris que si la ligne n'en a pas : le « dernière mise à
-- jour » affiché sous le titre doit rester celui de la dernière rédaction, pas
-- celui du fichier importé. \`deletedAt\` remis à NULL, en revanche : un document
-- légal absent du site est une faute, une suppression volontaire se dit
-- ailleurs (statut « archived »).
-- ---------------------------------------------------------------------------
INSERT INTO \`pages\`
  (\`slug\`, \`locale\`, \`kind\`, \`subtype\`, \`title\`, \`subtitle\`, \`category\`,
   \`content\`, \`sortOrder\`, \`status\`, \`publishedAt\`)
VALUES
${values}
ON DUPLICATE KEY UPDATE
  \`kind\` = 'legal',
  \`subtype\` = IF(COALESCE(\`subtype\`, '') = '', 'simple', \`subtype\`),
  \`title\` = IF(IFNULL(\`title\`, '') = '', VALUES(\`title\`), \`title\`),
  \`content\` = IF(IFNULL(\`content\`, '') = '', VALUES(\`content\`), \`content\`),
  \`status\` = IF(IFNULL(\`status\`, '') = '', 'published', \`status\`),
  \`category\` = VALUES(\`category\`),
  \`sortOrder\` = VALUES(\`sortOrder\`),
  \`publishedAt\` = COALESCE(\`publishedAt\`, VALUES(\`publishedAt\`)),
  \`deletedAt\` = NULL;

-- ---------------------------------------------------------------------------
-- 4. Contrôle : la même requête qu'après, et la liste lisible
--
-- Douze lignes, quatre par langue, toutes \`published\`. C'est exactement ce que
-- l'écran « Pages légales » doit afficher (filtre \`kind = 'legal'\`).
-- ---------------------------------------------------------------------------
SELECT \`locale\` AS langue, \`slug\`, \`category\` AS type, \`status\`,
       CHAR_LENGTH(\`content\`) AS longueur_texte, \`title\`
  FROM \`pages\`
 WHERE \`kind\` = 'legal' AND \`deletedAt\` IS NULL
 ORDER BY \`locale\`, \`sortOrder\`;

-- ---------------------------------------------------------------------------
-- 5. Et les liens du pied de page ?
--
-- Le site répond sur /{langue}/legal/{type}. Les liens courts que le pied de
-- page a gardés en base (/fr/privacy, /fr/terms, /fr/mentions…) n'étaient des
-- erreurs que tant que rien ne les reconnaissait : next.config.mjs les renvoie
-- maintenant sur le document correspondant. Rien n'est donc obligatoire en base ;
-- pour que l'adresse affichée soit celle du lien, on peut aligner les lignes de
-- la table des menus sur l'adresse canonique. La requête ci-dessous d'abord, la
-- correction ensuite — à décommenter, et à ajuster langue par langue.
--
-- SELECT locale, label, href FROM menus
--  WHERE LOWER(href) LIKE '%/privacy' OR LOWER(href) LIKE '%/terms'
--     OR LOWER(href) LIKE '%/mentions' OR LOWER(href) LIKE '%/legal'
--  ORDER BY locale, sortOrder
--
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/privacy')
--  WHERE LOWER(href) = CONCAT('/', locale, '/privacy')
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/conditions')
--  WHERE LOWER(href) IN (CONCAT('/', locale, '/terms'), CONCAT('/', locale, '/conditions'))
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/mentions')
--  WHERE LOWER(href) IN (CONCAT('/', locale, '/mentions'), CONCAT('/', locale, '/legal-notice'))
-- ---------------------------------------------------------------------------
`
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, sql, 'utf8');
console.log(`✓ ${rows.length} lignes écrites dans ${OUT.replace(`${process.cwd()}/`, '')}`);
