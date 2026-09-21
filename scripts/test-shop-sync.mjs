#!/usr/bin/env node
/**
 * Coupons et taxes : conversions entre la forme « écran » et la forme « API ».
 *
 *   node --experimental-strip-types scripts/test-shop-sync.mjs
 *
 * Ce script importe `lib/shop-mapping.ts` — le module réellement utilisé par
 * `lib/shop-sync.ts` — et n'en rejoue aucune logique. C'est possible parce que
 * ce module n'a aucun import exécuté : Node 22 retire les annotations de type et
 * l'`import type` est effacé à la compilation.
 *
 * Les cas couverts sont ceux qui cassent en silence : un montant qui revient en
 * chaîne depuis une colonne numérique, un champ optionnel qui se transforme en
 * zéro, une date courte refusée par Prisma, un renommage pris pour une
 * suppression.
 */

import {
  couponFromApi,
  couponToApi,
  removedIds,
  serverId,
  taxFromApi,
  taxToApi,
  toNumber,
  toShortDate,
  toTimestamp,
  toStringArray,
} from '../lib/shop-mapping.ts';

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', b: '\x1b[1m', x: '\x1b[0m' }
  : { r: '', g: '', b: '', x: '' };

let passed = 0;
let failed = 0;
const check = (label, ok, detail) => {
  if (ok) { passed += 1; console.log(`  ${C.g}✅${C.x} ${label}`); }
  else { failed += 1; console.log(`  ${C.r}❌${C.x} ${label}${detail ? ` — ${detail}` : ''}`); }
};
const section = (s) => console.log(`\n${C.b}${s}${C.x}`);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------ primitives */

section('Dates');
check('date courte → horodatage minuit UTC',
  toTimestamp('2026-12-31') === '2026-12-31T00:00:00.000Z', toTimestamp('2026-12-31'));
check('chaîne vide → null (fin de validité non renseignée)', toTimestamp('') === null);
check('undefined → null', toTimestamp(undefined) === null);
check('horodatage déjà complet conservé tel quel',
  toTimestamp('2026-12-31T23:00:00.000Z') === '2026-12-31T23:00:00.000Z');
check('horodatage → jour seul', toShortDate('2026-12-31T00:00:00.000Z') === '2026-12-31');
check('null → chaîne vide', toShortDate(null) === '');
check('valeur illisible → chaîne vide, pas "Invalid Date"', toShortDate('n\'importe quoi') === '');

section('Nombres');
check('chaîne décimale convertie (colonne DECIMAL renvoyée en texte)',
  toNumber('10.00') === 10, String(toNumber('10.00')));
check('nombre conservé', toNumber(2500) === 2500);
check('null → 0', toNumber(null) === 0);
check('texte non numérique → 0, pas NaN', Number.isNaN(toNumber('abc')) === false && toNumber('abc') === 0);
check('plancher personnalisé', toNumber(undefined, 19) === 19);

section('Tableaux et identifiants');
check('tableau conservé', eq(toStringArray(['a', 'b']), ['a', 'b']));
check('non-tableau → tableau vide', eq(toStringArray('pas un tableau'), []));
check('valeurs nulles écartées', eq(toStringArray(['a', null, undefined, 'b']), ['a', 'b']));
check('id serveur numérique reconnu', serverId('42') === 42);
check('id local provisoire rejeté', serverId('c-1712345678') === undefined);
check('zéro rejeté (auto-incrémentation commence à 1)', serverId(0) === undefined);

/* ------------------------------------------------------------- coupons */

section('Coupon — aller-retour écran → API → écran');

const coupon = {
  id: '42',
  code: 'SARI10',
  type: 'percent',
  amount: 10,
  maxDiscount: 20000,
  minOrder: 5000,
  start: '2026-01-01',
  end: '2026-12-31',
  limitGlobal: 200,
  limitPerClient: 1,
  used: 18,
  scope: 'category',
  scopeValues: ['Diagnostic'],
  excludeValues: ['Consommables'],
  stackable: false,
  active: true,
  revenue: 142000,
};

const sent = couponToApi(coupon);
const back = couponFromApi({ ...sent, id: 42 });

check('les 17 champs reviennent identiques', eq(back, coupon), JSON.stringify(back));
check('id renvoyé en texte pour l\'écran', back.id === '42');
check('dates converties en horodatages à l\'envoi',
  sent.startDate === '2026-01-01T00:00:00.000Z' && sent.endDate === '2026-12-31T00:00:00.000Z');
check('montants envoyés en nombres, pas en texte',
  typeof sent.amount === 'number' && typeof sent.maxDiscount === 'number');

section('Coupon — montants revenus en chaîne depuis la base');

// Une colonne numérique renvoyée en texte donnerait `amount / 100` = NaN si la
// conversion manquait. C'est le comportement d'un export Decimal Prisma.
const stringy = couponFromApi({
  id: 7, code: 'TEST', type: 'fixed', amount: '5000.00', maxDiscount: '20000.00',
  minOrder: '1000.00', used: '3', revenue: '98000.00', scope: 'all',
});
check('amount redevenu un nombre', typeof stringy.amount === 'number' && stringy.amount === 5000);
check('maxDiscount redevenu un nombre', stringy.maxDiscount === 20000);
check('used redevenu un nombre', stringy.used === 3);
check('revenue redevenu un nombre', stringy.revenue === 98000);

section('Coupon — champs optionnels absents, pas à zéro');

const bare = couponFromApi({
  id: 9, code: 'NU', type: 'fixed', amount: 100, maxDiscount: null, minOrder: null,
  limitGlobal: null, limitPerClient: null, startDate: null, endDate: null,
  scope: 'all', scopeValues: null, excludeValues: null, used: 0, revenue: 0, active: true,
});
check('maxDiscount absent et non à 0', bare.maxDiscount === undefined);
check('minOrder absent et non à 0', bare.minOrder === undefined);
check('limitGlobal absent et non à 0', bare.limitGlobal === undefined);
check('limitPerClient absent et non à 0', bare.limitPerClient === undefined);
check('dates vides', bare.start === '' && bare.end === '');
check('tableaux vides plutôt que null', eq(bare.scopeValues, []) && eq(bare.excludeValues, []));
check('null renvoyé à l\'API pour un optionnel absent',
  couponToApi(bare).maxDiscount === null && couponToApi(bare).minOrder === null);

section('Coupon — valeurs par défaut et normalisation');

const defaults = couponFromApi({ id: 1, code: 'X' });
check('type inconnu → percent', defaults.type === 'percent');
check('périmètre inconnu → all', defaults.scope === 'all');
check('active absent → false (rien n\'est activé par accident)', defaults.active === false);
check('code présent conservé', defaults.code === 'X');
check('code absent → chaîne vide, pas "undefined"', couponFromApi({ id: 2 }).code === '');
check('coupon neuf : pas d\'id envoyé au serveur',
  couponToApi({ ...coupon, id: 'c-1712345678' }).id === undefined);

/* --------------------------------------------------------------- taxes */

section('Taxe — aller-retour écran → API → écran');

const tax = {
  id: '3',
  name: 'TVA standard',
  names: { fr: 'TVA standard', en: 'Standard VAT', ar: 'ضريبة القيمة المضافة' },
  labels: { fr: 'TVA 19 %', en: 'VAT 19%', ar: 'ض.ق.م 19٪' },
  mode: 'percent',
  rate: 19,
  zone: 'DZ',
  scope: 'all',
  scopeValues: [],
  included: false,
  priority: 1,
  active: true,
  isDefault: true,
  start: '',
  end: '',
};

const taxSent = taxToApi(tax);
const taxBack = taxFromApi({ ...taxSent, id: 3 });
check('libellés arabes conservés (facture PDF)',
  taxBack.names?.ar === 'ضريبة القيمة المضافة' && taxBack.labels?.ar === 'ض.ق.م 19٪');
check('les champs reviennent identiques', eq(taxBack, tax), JSON.stringify(taxBack));
check('dates vides → null à l\'envoi', taxSent.startDate === null && taxSent.endDate === null);

section('Taxe — ancien format sans `scope`');

// Avant l'ajout de `scope`, le périmètre se déduisait de `category`.
const legacy = taxFromApi({ id: 5, name: 'Éco-taxe', mode: 'fixed', rate: 250, category: 'Consommables' });
check('category → tableau de périmètre', eq(legacy.scopeValues, ['Consommables']));
check('libellés absents → pas de clé `names` inventée', legacy.names === undefined);
check('zone par défaut DZ', legacy.zone === 'DZ');
check('isDefault absent → false', legacy.isDefault === false);
const noNames = taxToApi({ id: '5', name: 'Éco-taxe', mode: 'fixed', rate: 250, priority: 3, active: true, included: true, scope: 'all', scopeValues: [] });
check('libellés manquants → repli sur le nom en français', eq(noNames.names, { fr: 'Éco-taxe' }));

/* ------------------------------------------------- différentiel de suppression */

section('Suppressions envoyées explicitement');

const before = [
  { id: '1', code: 'GARDE' },
  { id: '2', code: 'SUPPRIME' },
  { id: 'c-1712345678', code: 'JAMAIS_SYNC' },
  { id: '4', code: 'ANCIEN_NOM' },
];
const after = [
  { id: '1', code: 'GARDE' },
  { id: '4', code: 'NOUVEAU_NOM' }, // même ligne, code renommé
];
const removed = removedIds(before, after);
check('ligne disparue signalée', removed.includes(2), JSON.stringify(removed));
check('ligne conservée non signalée', !removed.includes(1));
check('ligne jamais synchronisée ignorée', !removed.some((v) => String(v).startsWith('c-')));
check('renommage non pris pour une suppression', removed.length === 1, JSON.stringify(removed));
check('envoi identique → aucune suppression', eq(removedIds(before, before), []));

/* ------------------------------------------------------------------ bilan */

console.log(`\n${C.b}${passed} réussi(s), ${failed} échec(s)${C.x}\n`);
process.exit(failed === 0 ? 0 : 1);
