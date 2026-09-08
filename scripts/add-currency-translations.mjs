#!/usr/bin/env node
/**
 * Clés de traduction du réglage « devise du site » (page admin Devises).
 *
 * N'écrase jamais une clé existante : relançable sans risque.
 * Usage : node scripts/add-currency-translations.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const LOCALES = ['fr', 'en', 'ar'];

/** Ordre des valeurs : [français, anglais, arabe]. */
const T = {
  'admin.currencies': {
    isDefault: ['Par défaut', 'Default', 'الافتراضية'],
    isDefaultHint: [
      'Devise utilisée pour tous les montants du site et de l’administration.',
      'Currency used for every amount across the site and the admin.',
      'العملة المستخدمة لجميع المبالغ في الموقع ولوحة الإدارة.',
    ],
    setDefault: ['Définir comme devise par défaut', 'Set as default currency', 'تعيينها كعملة افتراضية'],
    setDefaultInactive: [
      'Activez la devise pour pouvoir la définir par défaut',
      'Activate the currency before making it the default',
      'فعّل العملة قبل تعيينها كعملة افتراضية',
    ],
    defaultChanged: ['Devise par défaut : {code}', 'Default currency: {code}', 'العملة الافتراضية: {code}'],
    appliedNotice: [
      'Montants affichés en {name} ({symbol}).',
      'Amounts are displayed in {name} ({symbol}).',
      'تُعرض المبالغ بـ {name} ({symbol}).',
    ],
  },
};

function setDeep(root, path, value) {
  const parts = path.split('.');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null || Array.isArray(node[part])) node[part] = {};
    node = node[part];
  }
  const leaf = parts[parts.length - 1];
  if (leaf in node) return false;
  node[leaf] = value;
  return true;
}

const added = {};
for (const [index, locale] of LOCALES.entries()) {
  const path = resolve(ROOT, 'messages', `${locale}.json`);
  const bundle = JSON.parse(readFileSync(path, 'utf8'));
  added[locale] = 0;
  for (const [namespace, keys] of Object.entries(T)) {
    for (const [key, values] of Object.entries(keys)) {
      if (setDeep(bundle, `${namespace}.${key}`, values[index])) added[locale] += 1;
    }
  }
  if (!DRY) writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
}

console.log(DRY ? '— SIMULATION —' : '— Clés devises ajoutées —');
for (const locale of LOCALES) console.log(`  ${locale} : ${added[locale]}`);
