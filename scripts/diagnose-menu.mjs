#!/usr/bin/env node
/**
 * Diagnostic : d'où vient le menu affiché sur la vitrine ?
 *
 *   node scripts/diagnose-menu.mjs [locale]
 *
 * La vitrine lit le menu en cascade : API (base de données) -> fichier JSON
 * statique -> repli vide. Ce script interroge le même endpoint que la vitrine
 * et dit quel étage répond réellement, pour éviter de chercher un bug de menu
 * dans l'admin alors que c'est le repli statique qui s'affiche.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locale = process.argv[2] || 'fr';
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:3001/api/v1';

const line = (s = '') => console.log(s);
const head = (s) => {
  line();
  line('\x1b[1m' + s + '\x1b[0m');
  line('-'.repeat(s.length));
};

line(`\x1b[1mDiagnostic du menu — locale « ${locale} »\x1b[0m`);
line(`API interrogée : ${API}`);

/** Liste publiée d'un module, telle que la vitrine la reçoit. */
async function fetchModule(source) {
  const url = `${API}/public/${source}?view=block&limit=100&locale=${encodeURIComponent(locale)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const payload = await res.json();
  const rows = payload?.data?.data ?? payload?.data ?? payload ?? [];
  return Array.isArray(rows) ? rows : [];
}

// ─────────────────────────────────────────────── étage 1 : l'API (la BD)
head('1. API  /public/menus  (source réelle : votre base de données)');

let rows = [];
let apiUp = false;
try {
  const url = `${API}/public/menus?view=block&limit=100&locale=${encodeURIComponent(locale)}`;
  const res = await fetch(url, { cache: 'no-store' });
  apiUp = true;
  const payload = await res.json();
  rows = payload?.data?.data ?? payload?.data ?? payload ?? [];
  if (!Array.isArray(rows)) rows = [];
  line(`HTTP ${res.status} — ${rows.length} enregistrement(s) renvoyé(s)`);

  if (!rows.length) {
    line('\x1b[33m⚠ Aucun menu pour cette langue en base.\x1b[0m');
    line('  La vitrine bascule donc sur le fichier JSON statique (étage 2).');
  }

  for (const r of rows) {
    const items = Array.isArray(r.items) ? r.items : [];
    line(
      `  • location=\x1b[1m${r.location}\x1b[0m  locale=${r.locale}  ` +
        `statut=${r.status}  ${items.length} entrée(s)`,
    );
    for (const it of items) {
      const sub = Array.isArray(it.submenu) ? it.submenu : [];
      const auto = it.auto
        ? `  \x1b[36mauto → ${it.auto.source}/${it.auto.mode}` +
          `${it.auto.limit ? ' max ' + it.auto.limit : ''}\x1b[0m`
        : '';
      line(`      - ${String(it.label ?? '').padEnd(16)} ${String(it.href ?? '').padEnd(14)} ` +
           `sous-menu:${sub.length}${auto}`);
    }
  }

  // mapMenu() exige location === 'main' ; sinon le menu principal est ignoré
  const locations = rows.map((r) => r.location);
  if (rows.length && !locations.includes('main')) {
    line();
    line('\x1b[31m✖ PROBLÈME : aucun enregistrement avec location = "main".\x1b[0m');
    line(`  Emplacements trouvés : ${locations.join(', ') || '(aucun)'}`);
    line('  La vitrine ne lit le menu du header que depuis location="main".');
    line('  Un menu enregistré sous un autre emplacement est ignoré.');
  }

  const published = rows.filter((r) => r.status === 'published');
  if (rows.length && !published.length) {
    line();
    line('\x1b[31m✖ PROBLÈME : aucun menu publié.\x1b[0m');
    line('  Les endpoints publics ne renvoient que status="published".');
    line('  Un menu en brouillon reste invisible sur la vitrine.');
  }
} catch (e) {
  line(`\x1b[31m✖ API injoignable : ${e.message}\x1b[0m`);
  line('  La vitrine utilise alors le JSON statique (étage 2).');
}

// ───────────────────────── étage 1 bis : résolution des règles « auto »
const autoItems = [];
for (const r of rows) {
  for (const it of Array.isArray(r.items) ? r.items : []) {
    if (it?.auto?.source) autoItems.push(it);
  }
}

if (autoItems.length) {
  head('1 bis. Sous-menus générés — résolution réelle de chaque règle');
  line('Rappel : « sous-menu:0 » ci-dessus est NORMAL pour une règle auto.');
  line('Le sous-menu n’est pas stocké en base, il est calculé à l’affichage.');
  line('Ce qui compte, c’est le nombre d’entrées résolues ci-dessous.');
  line();

  for (const it of autoItems) {
    const { source, mode, ids = [], limit = 0 } = it.auto;
    line(`\x1b[1m${it.label}\x1b[0m — ${source} / ${mode}` +
         `${limit ? ` (max ${limit})` : ''}`);

    let pool = [];
    try {
      pool = await fetchModule(source);
    } catch (e) {
      line(`  \x1b[31m✖ module « ${source} » injoignable : ${e.message}\x1b[0m`);
      continue;
    }
    line(`  ${pool.length} fiche(s) publiée(s) dans « ${source} » pour cette langue.`);

    if (!pool.length) {
      line(`  \x1b[31m✖ Le sous-menu sera VIDE : aucune fiche publiée.\x1b[0m`);
      line(`    Publiez des fiches dans « ${source} », en langue « ${locale} ».`);
      line();
      continue;
    }

    if (mode === 'pick') {
      const wanted = ids.map(String);
      line(`  ids choisis dans l’admin : ${wanted.length ? wanted.join(', ') : '(aucun)'}`);

      if (!wanted.length) {
        line('  \x1b[31m✖ Le sous-menu sera VIDE : mode « sélection » sans aucun id.\x1b[0m');
        line('    Cochez des fiches dans l’admin, ou passez la règle sur « tout ».');
        line();
        continue;
      }

      const found = [];
      const missing = [];
      for (const id of wanted) {
        const hit = pool.find(
          (e) => String(e.id) === id || String(e.legacyId ?? '') === id,
        );
        (hit ? found : missing).push(hit ?? id);
      }

      for (const e of found) {
        line(`      \x1b[32m✔\x1b[0m ${e.title ?? e.name ?? e.slug}  (id ${e.id})`);
      }
      for (const id of missing) {
        line(`      \x1b[31m✖ id ${id} introuvable\x1b[0m — fiche archivée, supprimée,` +
             ` ou d’une autre langue`);
      }

      const total = limit > 0 ? Math.min(found.length, limit) : found.length;
      line(`  → ${total} entrée(s) affichée(s) dans le menu.`);
      if (!found.length) {
        line('  \x1b[31m✖ Le sous-menu sera VIDE : aucun id ne correspond.\x1b[0m');
        line('    Les ids enregistrés ne désignent aucune fiche publiée de cette');
        line('    langue. Rouvrez la règle dans l’admin et resélectionnez les fiches.');
      }
    } else {
      const total = limit > 0 ? Math.min(pool.length, limit) : pool.length;
      line(`  → ${total} entrée(s) affichée(s) dans le menu :`);
      for (const e of pool.slice(0, total)) {
        line(`      \x1b[32m✔\x1b[0m ${e.title ?? e.name ?? e.slug}  (id ${e.id})`);
      }
    }
    line();
  }
}

// ──────────────────────────────────────── étage 2 : le JSON statique
head('2. Fichier statique  data/' + locale + '/menu.json  (repli)');

const jsonPath = join(root, 'data', locale, 'menu.json');
if (existsSync(jsonPath)) {
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const main = data.mainMenu ?? [];
  line(`Présent — ${main.length} entrée(s) dans mainMenu :`);
  for (const it of main) {
    const sub = Array.isArray(it.submenu) ? it.submenu : [];
    line(`  - ${String(it.label ?? '').padEnd(16)} ${String(it.href ?? '').padEnd(14)} sous-menu:${sub.length}`);
  }
  line();
  line('\x1b[33mCe fichier n’est PAS modifié par l’admin.\x1b[0m');
  line('Il sert de repli quand l’API ne renvoie rien d’exploitable.');
} else {
  line('Absent — la vitrine afficherait un menu vide.');
}

// ────────────────────────────────────────────────── verdict
head('Verdict');

const usable =
  rows.length &&
  rows.some((r) => r.location === 'main') &&
  rows.some((r) => r.status === 'published');

if (usable) {
  line('\x1b[32m✔ La vitrine sert le menu de la BASE DE DONNÉES.\x1b[0m');
  line('  Vos changements admin doivent apparaître.');
  line('  S’ils n’apparaissent pas, c’est le cache mémoire du serveur Next :');
  line('  redémarrez `npm run dev` (voir la note ci-dessous).');
} else {
  line('\x1b[31m✖ La vitrine sert le FICHIER JSON STATIQUE, pas votre BD.\x1b[0m');
  line('  C’est pourquoi vos modifications admin ne se voient pas :');
  line('  elles sont bien enregistrées, mais jamais lues.');
}

line();
line('\x1b[1mNote sur le cache\x1b[0m');
line('lib/data.ts garde un cache mémoire (dataCache) SANS expiration, rempli');
line('au premier rendu et vidé seulement au redémarrage du serveur Next.');
line('Après un changement dans l’admin, redémarrez `npm run dev` pour le voir.');
