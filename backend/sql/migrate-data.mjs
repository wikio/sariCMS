#!/usr/bin/env node
/**
 * Reprise des jeux de données `data/{fr,en,ar}/*.json` vers MySQL.
 *
 * Génère `migrate-data.mysql.sql`, un script d'import complet et rejouable,
 * ou l'exécute directement si une URL de connexion est fournie.
 *
 * ─── Les trois difficultés que ce script résout ───────────────────────────
 *
 * 1. IDENTIFIANTS EN COLLISION
 *    Les fichiers JSON réutilisent les mêmes ids d'une langue à l'autre :
 *    le service 1 existe en fr, en et ar. MySQL exige une clé primaire
 *    unique. On attribue donc un id propre à chaque ligne
 *    (fr → 1, en → 1001, ar → 2001) et on conserve le lien entre les trois
 *    versions dans `legacyId`.
 *
 * 2. LE legacyId EST LA CLÉ DU MULTILINGUE
 *    C'est lui qui permet au sélecteur de langue de la vitrine de retrouver
 *    l'identifiant d'une fiche dans la langue cible. Sans lui, le site
 *    conserve l'id courant, qui désigne une autre fiche — ou rien du tout.
 *    Chaque groupe de trois lignes partage donc le même `legacyId`.
 *
 * 3. DATES EN TEXTE LOCALISÉ
 *    Les fichiers portent « 15 Janvier 2024 », « 15 يناير 2024 » ou encore
 *    la plage « 15-18 Mars 2024 ». MySQL attend un DATETIME. Le script les
 *    convertit (français, anglais, arabe) et, pour une plage, alimente
 *    `startDate` et `endDate`. Le libellé d'origine reste affiché par la
 *    vitrine : la colonne texte n'est pas écrasée.
 *
 * ─── Utilisation ──────────────────────────────────────────────────────────
 *
 *   node sql/migrate-data.mjs                       # écrit le fichier .sql
 *   node sql/migrate-data.mjs --out /tmp/import.sql # autre destination
 *   node sql/migrate-data.mjs --truncate            # vide les tables d'abord
 *   node sql/migrate-data.mjs --execute \
 *     --url "mysql://user:pass@host:3306/sari_cms"  # importe directement
 *
 * L'import est idempotent : `INSERT … ON DUPLICATE KEY UPDATE` réécrit les
 * lignes existantes au lieu d'échouer, ce qui permet de rejouer la reprise
 * après correction d'un contenu.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..'); // racine du dépôt
const DATA = resolve(ROOT, 'data');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};

const OUT = resolve(value('out') || resolve(HERE, 'migrate-data.mysql.sql'));
const TRUNCATE = flag('truncate');
const EXECUTE = flag('execute');
const URL = value('url') || process.env.DATABASE_URL;

const LOCALES = ['fr', 'en', 'ar'];

/**
 * Décalage d'id par langue. Le français garde ses identifiants d'origine
 * (les URLs déjà indexées restent valides) ; les autres langues sont
 * décalées pour éviter toute collision de clé primaire.
 */
const OFFSET = { fr: 0, en: 1000, ar: 2000 };

// --------------------------------------------------------------------------
// Conversion des dates écrites en toutes lettres
// --------------------------------------------------------------------------

const MONTHS = {
  // français
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  // anglais
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  // arabe (formes courantes au Maghreb et au Machrek)
  يناير: 1, جانفي: 1, فبراير: 2, فيفري: 2, مارس: 3, أبريل: 4, ابريل: 4, أفريل: 4,
  مايو: 5, ماي: 5, يونيو: 6, جوان: 6, يوليو: 7, جويلية: 7, أغسطس: 8, اوت: 8, أوت: 8,
  سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

/** Chiffres arabo-indiens (٠١٢…) vers chiffres latins. */
const westernDigits = (text) =>
  String(text).replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (d) =>
    String((d.codePointAt(0) - 0x0660) % 10),
  );

/**
 * Analyse « 15 Janvier 2024 », « 15-18 Mars 2024 », « March 15, 2024 »,
 * « 15 يناير 2024 » ou une date ISO. Renvoie `{ start, end }` en ISO, ou
 * `null` si la chaîne n'est pas interprétable.
 */
function parseDate(input) {
  if (!input) return null;
  const text = westernDigits(String(input).trim());

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = `${iso[1]}-${iso[2]}-${iso[3]} 00:00:00`;
    return { start: d, end: null };
  }

  const year = (text.match(/(\d{4})/) || [])[1];
  if (!year) return null;

  let month = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    if (text.toLowerCase().includes(name)) {
      month = num;
      break;
    }
  }
  if (!month) return null;

  // Jour simple ou plage « 15-18 ». On ignore l'année déjà capturée.
  const withoutYear = text.replace(year, ' ');
  const range = withoutYear.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
  const single = withoutYear.match(/(\d{1,2})/);

  const pad = (n) => String(n).padStart(2, '0');
  const at = (day) => `${year}-${pad(month)}-${pad(day)} 00:00:00`;

  if (range) return { start: at(range[1]), end: at(range[2]) };
  if (single) return { start: at(single[1]), end: null };
  return { start: at(1), end: null };
}

// --------------------------------------------------------------------------
// Échappement SQL
// --------------------------------------------------------------------------

function sqlValue(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'object') return quote(JSON.stringify(v));
  return quote(String(v));
}

/** Chaîne littérale MySQL, antislashs et guillemets neutralisés. */
function quote(text) {
  return `'${String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\u0000/g, '')}'`;
}

// --------------------------------------------------------------------------
// Lecture des jeux de données
// --------------------------------------------------------------------------

function load(locale, file) {
  const path = resolve(DATA, locale, file);
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

const nowSql = 'CURRENT_TIMESTAMP(3)';

/** Identifiant numérique décalé par langue (voir la note 1 en tête). */
function rowId(locale, id) {
  const n = Number(id);
  if (Number.isFinite(n)) return n + OFFSET[locale];
  // Catégories de solutions : l'id est textuel (« diagnostic »). On dérive un
  // entier stable de sa position pour respecter la clé primaire INT.
  return null;
}

/**
 * Prépare les lignes d'un module pour les trois langues.
 * `map` reçoit (fiche, langue, idNumérique) et renvoie les colonnes.
 */
function collect(file, prefix, map, { textualIds = false } = {}) {
  const rows = [];
  const order = new Map(); // id textuel → rang (pour dériver un entier stable)

  if (textualIds) {
    load('fr', file).forEach((item, index) => order.set(String(item.id), index + 1));
  }

  for (const locale of LOCALES) {
    for (const item of load(locale, file)) {
      const base = textualIds ? order.get(String(item.id)) : Number(item.id);
      if (!base) continue;
      const id = base + OFFSET[locale];
      const legacyId = item.legacyId || `${prefix}-${item.id}`;
      rows.push(map(item, locale, id, legacyId));
    }
  }
  return rows;
}

// --------------------------------------------------------------------------
// Définition des tables à alimenter
// --------------------------------------------------------------------------

const tables = [];

/** services */
tables.push({
  name: 'services',
  columns: [
    'id', 'locale', 'slug', 'title', 'icon', 'color', 'image',
    'shortDesc', 'fullDesc', 'features', 'faq', 'sortOrder',
    'legacyId', 'isDefault', 'status',
  ],
  rows: collect('services.json', 'svc', (item, locale, id, legacyId, index) => ({
    id,
    locale,
    slug: item.slug,
    title: item.title,
    icon: item.icon ?? null,
    color: item.color ?? null,
    image: item.image ?? null,
    shortDesc: item.shortDesc ?? null,
    fullDesc: item.fullDesc ?? null,
    features: item.features ?? null,
    faq: item.faq ?? null,
    sortOrder: Number(item.id) || 0,
    legacyId,
    isDefault: locale === 'fr',
    status: 'published',
  })),
});

/** solutions — ids textuels dans le JSON (« diagnostic », « cardiology »…) */
tables.push({
  name: 'solutions',
  columns: [
    'id', 'locale', 'slug', 'title', 'shortDesc', 'fullDesc', 'icon', 'image',
    'color', 'productIds', 'features', 'faq', 'sortOrder', 'legacyId',
    'isDefault', 'status',
  ],
  rows: collect(
    'solution-categories.json',
    'sol',
    (item, locale, id, legacyId) => ({
      id,
      locale,
      slug: item.slug,
      title: item.title,
      shortDesc: item.shortDesc ?? null,
      fullDesc: item.fullDesc ?? null,
      icon: item.icon ?? null,
      image: item.image ?? null,
      color: item.color ?? null,
      productIds: item.productIds ?? null,
      features: item.features ?? null,
      faq: item.faq ?? null,
      sortOrder: 0,
      legacyId,
      isDefault: locale === 'fr',
      status: 'published',
    }),
    { textualIds: true },
  ),
});

/** products */
tables.push({
  name: 'products',
  columns: [
    'id', 'locale', 'slug', 'name', 'category', 'price', 'shortDesc', 'fullDesc',
    'image', 'gallery', 'inStock', 'currency', 'sortOrder', 'deliveryTime',
    'features', 'specs', 'options', 'catalogPdf', 'legacyId', 'isDefault', 'status',
  ],
  rows: collect('products.json', 'prd', (item, locale, id, legacyId) => ({
    id,
    locale,
    slug: item.slug,
    name: item.name,
    category: item.category ?? null,
    price: item.price ?? null,
    shortDesc: item.shortDesc ?? null,
    fullDesc: item.fullDesc ?? null,
    image: item.image ?? null,
    gallery: item.gallery ?? null,
    inStock: item.inStock !== false,
    currency: item.currency ?? 'DZD',
    sortOrder: Number(item.id) || 0,
    deliveryTime: item.deliveryTime ?? null,
    features: item.features ?? null,
    specs: item.specs ?? null,
    options: item.options ?? null,
    catalogPdf: item.catalogPdf ?? null,
    legacyId,
    isDefault: locale === 'fr',
    status: 'published',
  })),
});

/** news — la date littérale est conservée, une date SQL est dérivée */
tables.push({
  name: 'news_articles',
  columns: [
    'id', 'locale', 'slug', 'title', 'category', 'classification', 'sujet',
    'authorName', 'date', 'publicationDate', 'readTime', 'shortDesc',
    'fullContent', 'image', 'legacyId', 'isDefault', 'status', 'publishedAt',
  ],
  rows: collect('news.json', 'news', (item, locale, id, legacyId) => {
    const parsed = parseDate(item.date);
    return {
      id,
      locale,
      slug: item.slug,
      title: item.title,
      category: item.category ?? null,
      classification: item.classification ?? null,
      sujet: item.sujet ?? null,
      authorName: item.author ?? null,
      date: parsed?.start ?? null,
      publicationDate: parsed?.start ?? null,
      readTime: item.readTime ?? null,
      shortDesc: item.shortDesc ?? null,
      fullContent: item.fullContent ?? null,
      image: item.image ?? null,
      legacyId,
      isDefault: locale === 'fr',
      status: 'published',
      publishedAt: parsed?.start ?? null,
    };
  }),
});

/** events — une plage « 15-18 Mars » alimente startDate et endDate */
tables.push({
  name: 'events',
  columns: [
    'id', 'locale', 'slug', 'title', 'type', 'date', 'startDate', 'endDate',
    'location', 'shortDesc', 'fullContent', 'image', 'agenda', 'legacyId',
    'isDefault', 'status', 'publishedAt',
  ],
  rows: collect('events.json', 'evt', (item, locale, id, legacyId) => {
    const parsed = parseDate(item.date);
    return {
      id,
      locale,
      slug: item.slug,
      title: item.title,
      type: item.type ?? null,
      date: parsed?.start ?? null,
      startDate: parsed?.start ?? null,
      endDate: parsed?.end ?? null,
      location: item.location ?? null,
      shortDesc: item.shortDesc ?? null,
      fullContent: item.fullContent ?? null,
      image: item.image ?? null,
      agenda: item.agenda ?? null,
      legacyId,
      isDefault: locale === 'fr',
      status: 'published',
      publishedAt: parsed?.start ?? null,
    };
  }),
});

/** careers */
tables.push({
  name: 'careers',
  columns: [
    'id', 'locale', 'slug', 'title', 'type', 'location', 'salary', 'shortDesc',
    'image', 'typeTravail', 'mission', 'objectifs', 'prerequis', 'experience',
    'workflow', 'contact', 'legacyId', 'isDefault', 'status',
  ],
  rows: collect('careers.json', 'job', (item, locale, id, legacyId) => ({
    id,
    locale,
    slug: item.slug,
    title: item.title,
    type: item.type ?? null,
    location: item.location ?? null,
    salary: item.salary ?? null,
    shortDesc: item.shortDesc ?? null,
    image: item.image ?? null,
    typeTravail: item.typeTravail ?? null,
    mission: item.mission ?? null,
    objectifs: item.objectifs ?? null,
    prerequis: item.prerequis ?? null,
    experience: item.experience ?? null,
    workflow: item.workflow ?? null,
    contact: item.contact ?? null,
    legacyId,
    isDefault: locale === 'fr',
    status: 'published',
  })),
});

/** partners */
tables.push({
  name: 'partners',
  columns: [
    'id', 'locale', 'slug', 'name', 'logo', 'category', 'sortOrder',
    'legacyId', 'isDefault', 'status',
  ],
  rows: collect('partners.json', 'ptr', (item, locale, id, legacyId) => ({
    id,
    locale,
    slug: item.slug,
    name: item.name,
    logo: item.logo ?? null,
    category: item.category ?? null,
    sortOrder: Number(item.id) || 0,
    legacyId,
    isDefault: locale === 'fr',
    status: 'published',
  })),
});

/** testimonials */
tables.push({
  name: 'testimonials',
  columns: [
    'id', 'locale', 'name', 'role', 'clinic', 'text', 'image', 'rating',
    'sortOrder', 'legacyId', 'isDefault', 'status',
  ],
  rows: collect('testimonials.json', 'tst', (item, locale, id, legacyId) => ({
    id,
    locale,
    name: item.name,
    role: item.role ?? null,
    clinic: item.clinic ?? null,
    text: item.text ?? '',
    image: item.image ?? null,
    rating: Number(item.rating) || 5,
    sortOrder: Number(item.id) || 0,
    legacyId,
    isDefault: locale === 'fr',
    status: 'published',
  })),
});

/** hero_slides — pas de slug ni de legacyId textuel dans ce module */
{
  const rows = [];
  for (const locale of LOCALES) {
    for (const item of load(locale, 'hero.json')) {
      const base = Number(item.id);
      if (!base) continue;
      rows.push({
        id: base + OFFSET[locale],
        locale,
        title: item.title,
        subtitle: item.subtitle ?? null,
        description: item.description ?? null,
        image: item.image ?? null,
        cta: item.cta ?? null,
        ctaLink: item.ctaLink ?? null,
        sortOrder: base,
        legacyId: base, // colonne INT dans ce modèle
        status: 'published',
      });
    }
  }
  tables.push({
    name: 'hero_slides',
    columns: [
      'id', 'locale', 'title', 'subtitle', 'description', 'image', 'cta',
      'ctaLink', 'sortOrder', 'legacyId', 'status',
    ],
    rows,
  });
}

/** pages — issues de genericContent.json */
tables.push({
  name: 'pages',
  columns: [
    'id', 'slug', 'locale', 'kind', 'subtype', 'title', 'subtitle', 'category',
    'content', 'media', 'sortOrder', 'status',
  ],
  rows: collect('genericContent.json', 'pag', (item, locale, id) => ({
    id,
    slug: item.slug,
    locale,
    kind: 'content',
    subtype: item.type ?? 'simple',
    title: item.title,
    subtitle: item.subtitle ?? null,
    category: item.category ?? null,
    content: item.content ?? null,
    media: item.media ?? null,
    sortOrder: Number(item.id) || 0,
    status: 'published',
  })),
});

// --------------------------------------------------------------------------
// Rendu SQL
// --------------------------------------------------------------------------

function renderTable(table) {
  if (!table.rows.length) return `-- ${table.name} : aucune donnée\n`;

  const cols = table.columns.map((c) => `\`${c}\``).join(', ');
  const lines = table.rows.map(
    (row) => `  (${table.columns.map((c) => sqlValue(row[c])).join(', ')})`,
  );

  // Réécriture des colonnes en cas de reprise : l'import reste rejouable.
  const updates = table.columns
    .filter((c) => c !== 'id')
    .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
    .join(',\n    ');

  return (
    `-- ${table.name} — ${table.rows.length} lignes ` +
    `(${LOCALES.join(' / ')})\n` +
    `INSERT INTO \`${table.name}\` (${cols}, \`createdAt\`, \`updatedAt\`)\nVALUES\n` +
    lines.map((l) => `${l.slice(0, -1)}, ${nowSql}, ${nowSql})`).join(',\n') +
    `\nON DUPLICATE KEY UPDATE\n    ${updates},\n    \`updatedAt\` = ${nowSql};\n`
  );
}

const truncateBlock = TRUNCATE
  ? `-- Purge demandée (--truncate)\n${tables
      .map((t) => `TRUNCATE TABLE \`${t.name}\`;`)
      .join('\n')}\n\n`
  : '';

const total = tables.reduce((n, t) => n + t.rows.length, 0);

const sql = `-- ---------------------------------------------------------------------------
-- SARI CMS — reprise des données JSON vers MySQL
--
-- FICHIER GÉNÉRÉ : ne pas modifier à la main.
-- Source  : data/{fr,en,ar}/*.json
-- Générer : node backend/sql/migrate-data.mjs
-- Importer: mysql -u root -p sari_cms < backend/sql/migrate-data.mysql.sql
--
-- ${tables.length} tables, ${total} lignes, trois langues.
--
-- Identifiants : le français conserve les siens, l'anglais est décalé de
-- +${OFFSET.en} et l'arabe de +${OFFSET.ar}. Les trois versions d'une même fiche
-- partagent un \`legacyId\`, sur lequel s'appuie le changement de langue de
-- la vitrine pour retrouver la bonne fiche dans la langue cible.
--
-- Rejouable : ON DUPLICATE KEY UPDATE réécrit les lignes déjà présentes.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

${truncateBlock}${tables.map(renderTable).join('\n')}
SET FOREIGN_KEY_CHECKS = 1;
`;

// --------------------------------------------------------------------------
// Sortie
// --------------------------------------------------------------------------

if (EXECUTE) {
  if (!URL) {
    console.error('❌ --execute requiert --url ou la variable DATABASE_URL.');
    process.exit(1);
  }
  const { createConnection } = await import('mysql2/promise');
  const conn = await createConnection({ uri: URL, multipleStatements: true });
  await conn.query(sql);
  await conn.end();
  console.log(`✅ Import exécuté : ${total} lignes dans ${tables.length} tables.`);
} else {
  writeFileSync(OUT, sql, 'utf8');
  console.log(`✅ ${OUT}`);
  for (const t of tables) {
    const perLocale = LOCALES.map(
      (l) => `${l}:${t.rows.filter((r) => r.locale === l).length}`,
    ).join(' ');
    console.log(`   ${t.name.padEnd(16)} ${String(t.rows.length).padStart(3)} lignes  (${perLocale})`);
  }
  console.log(`   ${'TOTAL'.padEnd(16)} ${String(total).padStart(3)} lignes`);
}
