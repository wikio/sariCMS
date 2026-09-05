#!/usr/bin/env node
/**
 * Vérifie les colonnes de la vue « Liste » de l'administration, sans navigateur.
 *
 * Trois régressions constatées sur le module Événements sont couvertes ici :
 *   1. la date s'affichait brute (`2024-10-15T00:00:00.000Z`) parce que
 *      `subtitleKey` pointait un champ hérité (`date`) absent de `fields` :
 *      faute de champ `datetime` déclaré, `CmsList` retombait sur `String(...)`
 *      au lieu de passer par `DateText` ;
 *   2. l'en-tête de cette colonne affichait « Meta », libellé générique codé en
 *      dur qui n'annonçait pas son contenu ;
 *   3. le type de l'événement n'apparaissait nulle part en vue Liste, alors que
 *      le module le déclare comme `badgeKey`.
 *
 * Les contrôles portent sur tous les modules, pas seulement les événements :
 * la même erreur de configuration ailleurs serait signalée ici.
 *
 * Usage : node scripts/test-admin-list.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const modulesSrc = readFileSync(resolve(ROOT, 'lib/cms-modules.ts'), 'utf8');
const listSrc = readFileSync(resolve(ROOT, 'components/admin/CmsList.tsx'), 'utf8');
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, `messages/${l}.json`), 'utf8'))]),
);

/** Découpe `lib/cms-modules.ts` en blocs de module. */
function parseModules() {
  const out = [];
  for (const m of modulesSrc.matchAll(/key: '([a-zA-Z]+)', resource:[\s\S]*?(?=\n {2}\{|\n\];)/g)) {
    const blk = m[0];
    const grab = (re) => (blk.match(re) || [, null])[1];
    out.push({
      key: m[1],
      blk,
      subtitleKey: grab(/subtitleKey: '([a-zA-Z]+)'/) || 'slug',
      badgeKey: grab(/badgeKey: '([a-zA-Z]+)'/),
      // Clés de champ déclarées dans `fields: [...]`
      fieldKeys: [...blk.matchAll(/\{ key: '([a-zA-Z]+)',/g)].map((f) => f[1]),
      fieldKind: (key) => {
        const f = blk.match(new RegExp(`\\{ key: '${key}',[^}]*\\}`));
        return f ? (f[0].match(/kind: '([a-z]+)'/) || [, null])[1] : null;
      },
    });
  }
  return out;
}

const mods = parseModules();

console.log('\n— Configuration des modules —');
check('modules détectés', mods.length >= 12, `${mods.length} modules`);

// 1. Le champ affiché en sous-titre doit exister dans `fields`, sinon la
//    colonne rend une valeur que l'éditeur ne sait ni afficher ni corriger.
{
  const orphans = mods.filter(
    (m) => m.subtitleKey !== 'slug' && !m.fieldKeys.includes(m.subtitleKey),
  );
  check(
    'chaque subtitleKey correspond à un champ déclaré',
    orphans.length === 0,
    orphans.length ? orphans.map((m) => `${m.key}.${m.subtitleKey}`).join(', ') : `${mods.length} modules`,
  );
}

// 2. Idem pour la seconde colonne (badgeKey) : `status` est géré à part.
{
  const orphans = mods.filter(
    (m) => m.badgeKey && m.badgeKey !== 'status' && !m.fieldKeys.includes(m.badgeKey),
  );
  check(
    'chaque badgeKey correspond à un champ déclaré',
    orphans.length === 0,
    orphans.length ? orphans.map((m) => `${m.key}.${m.badgeKey}`).join(', ') : 'ok',
  );
}

// 3. Le module Événements doit pointer la date réellement enregistrée.
//    L'éditeur supprime `date` du payload (CmsEditor) au profit de `startDate`.
{
  const ev = mods.find((m) => m.key === 'events');
  check('événements : subtitleKey = startDate', ev?.subtitleKey === 'startDate', String(ev?.subtitleKey));
  check("événements : le champ est de type datetime", ev?.fieldKind('startDate') === 'datetime', String(ev?.fieldKind('startDate')));
  check('événements : le type est exposé en colonne', ev?.badgeKey === 'type', String(ev?.badgeKey));

  const editorSrc = readFileSync(resolve(ROOT, 'components/admin/CmsEditor.tsx'), 'utf8');
  check(
    "l'éditeur enregistre bien startDate et non date",
    /'date' in payload/.test(editorSrc) && /delete payload\.date/.test(editorSrc),
    'CmsEditor retire le champ hérité',
  );
}

console.log('\n— Rendu de la colonne date —');

// 4. La vue Liste comme la vue Cartes doivent passer par DateText.
{
  check(
    'un helper partagé décide du formatage de date',
    /function isDateSubtitle\(mod: CmsModule\)/.test(listSrc),
    'isDateSubtitle',
  );
  const uses = [...listSrc.matchAll(/const subtitleIsDate = isDateSubtitle\(mod\);/g)].length;
  check('les deux vues (Liste + Cartes) l’utilisent', uses === 2, `${uses} appel(s)`);
  const dateTextUses = [...listSrc.matchAll(/<DateText value=\{row\[/g)].length;
  check('les deux vues rendent la date via DateText', dateTextUses === 2, `${dateTextUses} rendu(s)`);
}

// 5. Plus d'en-tête « Meta » codé en dur.
{
  check("l'en-tête « Meta » codé en dur a disparu", !/>Meta /.test(listSrc));
  check(
    "l'en-tête reprend le libellé du champ",
    /const subtitleLabel = labels\.field\(subtitleKey, subtitleKey\)/.test(listSrc),
  );
  check(
    'la colonne du badge a son propre en-tête',
    /const badgeLabel = badgeKey \? labels\.field\(badgeKey, badgeKey\)/.test(listSrc),
  );
  // La colonne Statut ne doit plus retomber sur badgeKey : elle doublonnait
  // la nouvelle colonne (l'événement affichait « Salon » en guise de statut).
  check(
    'la colonne Statut n’emprunte plus la valeur du badge',
    !/row\.status \|\| row\[mod\.badgeKey/.test(listSrc),
  );
}

console.log('\n— Libellés traduits —');

/** Résout un libellé comme `useAdminLabels(moduleKey).field(key)`. */
function labelFor(locale, moduleKey, key) {
  const fields = messages[locale]?.admin?.fields || {};
  const scoped = fields[moduleKey];
  if (scoped && typeof scoped === 'object' && typeof scoped[key] === 'string') return scoped[key];
  return typeof fields[key] === 'string' ? fields[key] : null;
}

// 6. Chaque en-tête affiché doit être traduit dans les trois langues, sinon
//    l'utilisateur verrait la clé technique (« startDate ») en en-tête.
{
  const missing = [];
  for (const m of mods) {
    const keys = [m.subtitleKey, m.badgeKey && m.badgeKey !== 'status' ? m.badgeKey : null].filter(Boolean);
    for (const k of keys) {
      for (const l of LOCALES) {
        if (!labelFor(l, m.key, k)) missing.push(`${l}:${m.key}.${k}`);
      }
    }
  }
  check(
    'tous les en-têtes de colonne sont traduits (fr/en/ar)',
    missing.length === 0,
    missing.length ? missing.join(', ') : `${mods.length} modules × ${LOCALES.length} langues`,
  );
}

console.log(
  failures === 0
    ? '\n✅ Tous les contrôles passent.\n'
    : `\n❌ ${failures} contrôle(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
