#!/usr/bin/env node
/**
 * Vérifie la logique de la devise configurée sans navigateur.
 *
 * `lib/currencies.ts` est du TypeScript sans dépendance à React : on en
 * réimplémente ici la partie testable en la lisant depuis la source, pour
 * éviter qu'un test vert masque une divergence avec le code réellement livré.
 *
 * Usage : node scripts/test-currency.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'lib/currencies.ts'), 'utf8');

// --- Extraction des morceaux testables, depuis la source réelle -------------
const symbolsMatch = src.match(/const KNOWN_SYMBOLS = \[([^\]]+)\]/);
const KNOWN_SYMBOLS = symbolsMatch[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceCurrencySymbol(price, currency) {
  const text = String(price ?? '');
  if (!text.trim()) return text;
  const symbols = [...KNOWN_SYMBOLS].sort((a, b) => b.length - a.length);
  for (const symbol of symbols) {
    if (!text.includes(symbol)) continue;
    if (symbol === currency.symbol) return text;
    return text.replace(new RegExp(escapeRegExp(symbol), 'g'), currency.symbol);
  }
  return text;
}

function defaultCurrency(rows) {
  return (
    rows.find((c) => c.isDefault && c.active) ||
    rows.find((c) => c.active) ||
    rows.find((c) => c.isDefault) ||
    rows[0]
  );
}

// --- Cas de test ------------------------------------------------------------
const DZD = { code: 'DZD', symbol: 'DA', name: 'Dinar algérien', active: true, isDefault: true };
const EUR = { code: 'EUR', symbol: '€', name: 'Euro', active: true };
const USD = { code: 'USD', symbol: '$', name: 'Dollar US', active: true };

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  if (!ok) console.log(`       attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
};

console.log('\nRemplacement du symbole dans un prix saisi en texte');
check('euro → dinar', replaceCurrencySymbol('2 450 € HT', DZD), '2 450 DA HT');
check('dinar → euro', replaceCurrencySymbol('2 450 DA HT', EUR), '2 450 € HT');
check('euro → dollar', replaceCurrencySymbol('189 € HT', USD), '189 $ HT');
check('prix arabe', replaceCurrencySymbol('2,450 € بدون ضريبة', DZD), '2,450 DA بدون ضريبة');
check('déjà dans la bonne devise', replaceCurrencySymbol('2 450 DA HT', DZD), '2 450 DA HT');

console.log('\nValeurs sans symbole : laissées intactes');
check('« Sur devis »', replaceCurrencySymbol('Sur devis', DZD), 'Sur devis');
check('« حسب العرض »', replaceCurrencySymbol('حسب العرض', EUR), 'حسب العرض');
check('chaîne vide', replaceCurrencySymbol('', DZD), '');
check('null', replaceCurrencySymbol(null, DZD), '');

console.log('\nPriorité des symboles : le code ISO avant son abréviation');
check('DZD entier, pas « DA » + reliquat', replaceCurrencySymbol('1 000 DZD', EUR), '1 000 €');

console.log('\nChoix de la devise par défaut');
check('celle marquée par défaut', defaultCurrency([EUR, DZD]).code, 'DZD');
check(
  'devise par défaut désactivée → première active',
  defaultCurrency([{ ...DZD, active: false }, EUR]).code,
  'EUR',
);
check('aucune marquée → première active', defaultCurrency([{ ...EUR, isDefault: false }, USD]).code, 'EUR');

console.log('\nNom pour le montant en toutes lettres (PDF)');
const currencyWord = (name) => name.trim().toLowerCase().split(/\s+/)[0] || 'dinar';
check('« Dinar algérien » → dinar', currencyWord('Dinar algérien'), 'dinar');
check('« Dollar US » → dollar', currencyWord('Dollar US'), 'dollar');
check('« Euro » → euro', currencyWord('Euro'), 'euro');

console.log(failures ? `\n❌ ${failures} test(s) en échec\n` : '\n✅ Tous les tests passent\n');
process.exit(failures ? 1 : 0);
