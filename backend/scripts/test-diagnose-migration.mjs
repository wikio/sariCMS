/**
 * backend/scripts/test-diagnose-migration.mjs
 *
 * Vérifie la partie qui peut se tromper dans `diagnose-failed-migration.mjs` :
 * la lecture du SQL des migrations et la décision qui en découle. L'accès base
 * n'est pas testé ici (pas de MySQL dans l'environnement de contrôle) — il se
 * borne à des COUNT(*) sur information_schema.
 *
 * Les objets attendus sont extraits des **vraies** `migration.sql` du dépôt,
 * pas de fixtures écrites pour l'occasion.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decider, extraireObjets } from './diagnose-failed-migration.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ICI, '..', 'prisma', 'migrations');

let ok = 0;
let ko = 0;
const verif = (libelle, condition, detail = '') => {
  // Une condition qui n'est pas un booléen est un bug du test, pas un succès :
  // une fonction ou un objet passé par erreur serait toujours « vrai ».
  if (typeof condition !== 'boolean') {
    ko++;
    console.log(`  ❌ ${libelle} — condition de type ${typeof condition}, refusée`);
    return;
  }
  if (condition) { ok++; console.log(`  ✅ ${libelle}`); }
  else { ko++; console.log(`  ❌ ${libelle} ${detail}`); }
};

const sql = (nom) => readFileSync(join(MIGRATIONS, nom, 'migration.sql'), 'utf8');
const jeu = (tables, colonnes, index) => ({
  tables: new Set(tables),
  colonnes: new Set(colonnes),
  index: new Set(index),
});

console.log('1) Extraction sur la migration réellement en échec chez le destinataire');
const a907 = extraireObjets(sql('20260907_add_newsletter_unsubscribe_reason'));
verif('2 colonnes reconnues', a907.colonnes.length === 2, `(obtenu ${a907.colonnes.length})`);
verif(
  'unsubscribeReason sur newsletter_subscribers',
  a907.colonnes.some((c) => c.table === 'newsletter_subscribers' && c.colonne === 'unsubscribeReason'),
);
verif(
  'unsubscribeNote sur newsletter_subscribers',
  a907.colonnes.some((c) => c.table === 'newsletter_subscribers' && c.colonne === 'unsubscribeNote'),
);
verif('1 index reconnu', a907.index.length === 1, `(obtenu ${a907.index.length})`);
verif(
  'index newsletter_subscribers_unsubscribeReason_idx',
  a907.index[0]?.index === 'newsletter_subscribers_unsubscribeReason_idx'
    && a907.index[0]?.table === 'newsletter_subscribers',
  `(obtenu ${JSON.stringify(a907.index[0])})`,
);
verif('aucune table à créer ici', a907.tables.length === 0);

console.log('\n2) Extraction sur une migration à plusieurs ADD COLUMN');
const aShip = extraireObjets(sql('20260919_add_order_shipment_fields'));
verif('5 colonnes reconnues', aShip.colonnes.length === 5, `(obtenu ${aShip.colonnes.length})`);
verif(
  'toutes sur orders',
  aShip.colonnes.every((c) => c.table === 'orders'),
);
for (const attendu of ['trackingNumber', 'carrier', 'shippedAt', 'deliveredAt', 'paidAt']) {
  verif(`colonne ${attendu}`, aShip.colonnes.some((c) => c.colonne === attendu));
}

console.log('\n3) Extraction sur une migration avec CREATE TABLE');
const a906 = extraireObjets(sql('20260906_add_home_sections_and_newsletter'));
verif('2 tables reconnues', a906.tables.length === 2, `(obtenu ${a906.tables.length})`);
verif('home_sections', a906.tables.some((t) => t.table === 'home_sections'));
verif('newsletter_subscribers', a906.tables.some((t) => t.table === 'newsletter_subscribers'));

console.log('\n4) Décision — les objets existent tous');
let d = decider(a907, jeu(
  [],
  ['newsletter_subscribers.unsubscribeReason', 'newsletter_subscribers.unsubscribeNote'],
  ['newsletter_subscribers.newsletter_subscribers_unsubscribeReason_idx'],
));
verif('action = applied', d.action === 'applied', `(obtenu ${d.action})`);
verif('rien ne manque', d.manquants.length === 0);

console.log('\n5) Décision — rien n’existe');
d = decider(a907, jeu([], [], []));
verif('action = rolled-back', d.action === 'rolled-back', `(obtenu ${d.action})`);
verif('3 objets manquants', d.manquants.length === 3, `(obtenu ${d.manquants.length})`);

console.log('\n6) Décision — état partiel (colonnes là, index absent)');
d = decider(a907, jeu(
  [],
  ['newsletter_subscribers.unsubscribeReason', 'newsletter_subscribers.unsubscribeNote'],
  [],
));
verif('action = manuel', d.action === 'manuel', `(obtenu ${d.action})`);
verif('seul l’index manque', d.manquants.length === 1 && d.manquants[0].libelle.startsWith('INDEX'),
  `(obtenu ${JSON.stringify(d.manquants)})`);

console.log('\n7) Décision — état partiel (une seule colonne sur deux)');
d = decider(a907, jeu([], ['newsletter_subscribers.unsubscribeReason'], []));
verif('action = manuel', d.action === 'manuel');
verif('2 manquants', d.manquants.length === 2, `(obtenu ${d.manquants.length})`);

console.log('\n8) Décision — SQL sans objet reconnu');
d = decider({ tables: [], colonnes: [], index: [] }, jeu([], [], []));
verif('action = manuel', d.action === 'manuel');
verif('le motif renvoie vers la colonne logs', /logs/.test(d.raison));

console.log('\n9) Le SQL restitué est bien celui de la migration');
const idxManquant = decider(a907, jeu(
  [],
  ['newsletter_subscribers.unsubscribeReason', 'newsletter_subscribers.unsubscribeNote'],
  [],
)).manquants[0];
verif('énoncé CREATE INDEX fourni', /CREATE\s+INDEX/i.test(idxManquant.sql), `(obtenu ${idxManquant.sql})`);
verif(
  'le bon nom d’index',
  idxManquant.sql.includes('`newsletter_subscribers_unsubscribeReason_idx`'),
);
verif('la bonne table', /ON\s+`newsletter_subscribers`/i.test(idxManquant.sql));
verif('la bonne colonne', idxManquant.sql.includes('`unsubscribeReason`'));
verif('énoncé terminé par un point-virgule', idxManquant.sql.trimEnd().endsWith(';'));

const colManquante = decider(a907, jeu([], [], [])).manquants.find((m) => m.libelle.startsWith('COLONNE'));
verif('ALTER fourni pour une colonne', /ALTER\s+TABLE\s+`newsletter_subscribers`/i.test(colManquante.sql));
verif('ADD COLUMN présent', /ADD\s+COLUMN\s+`unsubscribeReason`/i.test(colManquante.sql));

const tbl = decider(a906, jeu([], [], [])).manquants.find((m) => m.libelle === 'TABLE home_sections');
verif('CREATE TABLE fourni', /CREATE\s+TABLE\s+`home_sections`/i.test(tbl.sql));
verif('corps de la table inclus', /PRIMARY\s+KEY/i.test(tbl.sql));

console.log(`\n${ok} ✅ / ${ko} ❌`);
process.exit(ko ? 1 : 0);
