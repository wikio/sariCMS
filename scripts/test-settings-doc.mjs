#!/usr/bin/env node
/**
 * Réglages en documents : accord entre l'écran et le serveur.
 *
 *   npm run settings-doc:test
 *
 * Le magasin de réglages est décrit DEUX fois : `DOC_SPECS` côté serveur
 * (`backend/src/modules/settings/settings-docs.service.ts`) et `DOC_SPECS` côté
 * navigateur (`lib/settings-doc.ts`). Les deux listes ne sont liées par aucun type
 * commun — l'une est du TypeScript de backend, l'autre du TypeScript de front, et
 * ils ne s'importent pas.
 *
 * Cet accord porte trois risques qui ne font pas de bruit :
 *
 * - un réglage ajouté côté écran et oublié côté serveur : l'écriture est refusée,
 *   l'opérateur voit « enregistré » sur un poste et rien en base ;
 * - un secret listé par mégarde du côté serveur : `smtp.pass`, `db.url`, une clé
 *   d'API atterrissent dans MySQL, lisibles par toute sauvegarde de la base ;
 * - un champ disparu de la liste blanche : il n'est pas refusé, il est **tu** à la
 *   première synchronisation, puis recraché vide à l'écran.
 *
 * Ce script ne rejoue donc aucune logique : il lit les deux sources et vérifie
 * qu'elles racontent la même histoire. Parsing par expression régulière, pas d'import
 * TypeScript — les deux fichiers tirent chacun leur propres dépendances d'exécution.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.log(`  ÉCHEC ${label}${detail ? `\n         ${detail}` : ''}`);
};

// ── lecture des deux spécifications ──────────────────────────────────────────

const serverSrc = readFileSync(
  join(ROOT, 'backend/src/modules/settings/settings-docs.service.ts'),
  'utf8',
);
const clientSrc = readFileSync(join(ROOT, 'lib/settings-doc.ts'), 'utf8');

/**
 * `DOC_SPECS` du serveur, dans un bloc délimité par l'accolade. Chaque entrée :
 * `nom: { shape: 'fields', fields: [ … ] }`, `nom: { shape: 'record' }`,
 * `nom: { shape: 'array' }`.
 */
function parseServer(text) {
  const start = text.indexOf('export const DOC_SPECS');
  if (start < 0) throw new Error('DOC_SPECS introuvable côté serveur');
  const open = text.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = text.slice(open + 1, end);
  const out = {};
  const entry = /(\w+):\s*\{([^}]*(?:\[[^\]]*\])?[^}]*)\}/g;
  for (const m of body.matchAll(entry)) {
    const [, name, inner] = m;
    const shape = /shape:\s*'(\w+)'/.exec(inner)?.[1];
    const fieldsBlock = /fields:\s*\[([^\]]*)\]/.exec(inner)?.[1] ?? '';
    const fields = fieldsBlock
      .split(',')
      .map((f) => f.trim().replace(/'/g, ''))
      .filter(Boolean);
    if (shape) out[name] = { shape, fields };
  }
  return out;
}

/** `DOC_SPECS` du navigateur : une entrée par ligne, `strip` en liste inline. */
function parseClient(text) {
  const out = {};
  const entry = /^\s*(\w+):\s*\{([^}]*)\},\s*$/gm;
  for (const m of text.matchAll(entry)) {
    const [, name, inner] = m;
    if (!/cacheKey:/.test(inner)) continue; // les autres objets du fichier
    const cacheKey = /cacheKey:\s*'([^']+)'/.exec(inner)?.[1];
    const shape = /shape:\s*'(\w+)'/.exec(inner)?.[1];
    const stripBlock = /strip:\s*\[([^\]]*)\]/.exec(inner)?.[1] ?? '';
    const strip = stripBlock
      .split(',')
      .map((f) => f.trim().replace(/'/g, ''))
      .filter(Boolean);
    out[name] = { cacheKey, shape, strip };
  }
  return out;
}

const server = parseServer(serverSrc);
const client = parseClient(clientSrc);

console.log('\nRéglages en documents — accord écran / serveur\n');
console.log(`  serveur : ${Object.keys(server).length} clés — ${Object.keys(server).join(', ')}`);
console.log(`  écran   : ${Object.keys(client).length} clés — ${Object.keys(client).join(', ')}`);
console.log('');

// ── 1. mêmes clés des deux côtés ─────────────────────────────────────────────

const serverKeys = Object.keys(server).sort();
const clientKeys = Object.keys(client).sort();
check(
  'les mêmes clés sont admises côté écran et côté serveur',
  serverKeys.join() === clientKeys.join(),
  `serveur: ${serverKeys.join(', ')}\n         écran  : ${clientKeys.join(', ')}`,
);

// ── 2. formes concordantes ───────────────────────────────────────────────────
/*
 * `array` côté serveur correspond à `array` côté écran ; `fields` et `record` sont
 * tous deux des objets côté navigateur, la différence de souplesse étant un détail
 * serveur. Cette concordance est ce qui empêche l'écran d'envoyer `{…}` là où le
 * serveur attend une liste nue — refusé, donc écran vide, donc liste vidée.
 */
const expectShape = { array: 'array', fields: 'object', record: 'object' };
for (const kind of serverKeys.filter((k) => client[k])) {
  check(
    `${kind}: la forme attendue est la même des deux côtés`,
    client[kind].shape === expectShape[server[kind].shape],
    `serveur dit « ${server[kind].shape} », écran dit « ${client[kind].shape} »`,
  );
}

// ── 3. aucun secret dans une liste blanche ───────────────────────────────────
/*
 * La règle, pas la liste : tout champ dont le nom évoque un secret ne doit pas
 * figurer dans les champs admis par le serveur. Nominative, donc aveugle à un
 * champ renommé — le retrait côté écran (`strip`) est la seconde barrière, et
 * c'est pour ça que les deux sont vérifiés.
 */
/*
 * Un champ dont le NOM évoque un secret n'a rien à faire dans une liste blanche.
 * Le mot `auth` en est absent, sur preuve : il désignait `requireAuthToApply`, un
 * simple interrupteur « faut-il être connecté pour postuler ». Un test qui signale
 * le bon réflexe au mauvais endroit est un test qu'on désactive — il valait mieux
 * le rendre faux devant nous qu'en silence.
 */
const SECRET = /pass\w*|secret|token|api[_-]?key|credential|url|password/i;
for (const [kind, spec] of Object.entries(server)) {
  const leaked = spec.fields.filter((f) => SECRET.test(f));
  check(`${kind}: aucun champ à secret admis par le serveur`, leaked.length === 0, leaked.join(', '));
}

// Les quatre champs connus comme sensibles, nommément.
for (const [kind, forbidden] of [
  ['admin', ['smtp', 'db', 'erp', 'siteLogo']],
  ['shop', ['importApi']],
]) {
  const spec = server[kind];
  if (!spec) continue;
  const present = forbidden.filter((f) => spec.fields.includes(f));
  check(`${kind}: ${forbidden.join(', ')} restent hors de la base`, present.length === 0, `admis: ${present.join(', ')}`);
}

// ── 4. l'écran retire bien ce qu'il ne doit pas envoyer ──────────────────────
for (const [kind, spec] of Object.entries(client)) {
  if (!server[kind]) continue;
  const admitted = server[kind].fields;
  const contradict = spec.strip.filter((f) => admitted.includes(f));
  check(
    `${kind}: ce que l'écran retire n'est pas ce que le serveur admet`,
    contradict.length === 0,
    `retiré ET admis: ${contradict.join(', ')} — l'un des deux fichier est faux`,
  );
  check(`${kind}: la clé de cache du poste est déclarée`, Boolean(spec.cacheKey));
}

// `siteLogo` est le cas particulier : retiré DU document, mais pas oublié — il
// vit dans `contact_info.logo`, lu au rendu serveur. Le contrôle est là pour
// qu'on ne le « répare » pas en le remettant dans `admin`.
check(
  'siteLogo est hors du document admin et hors de sa clé de cache',
  !server.admin?.fields?.includes('siteLogo') && !client.admin?.strip?.includes('siteLogo'),
  'soit il revient dans `admin` (mauvais endroit), soit il est oublié partout (logo perdu)',
);

// ── est-ce que l'écran relit, une fois la base descendue ? ───────────────────
//
// Le défaut remonté sur « Modes de paiement » n'était pas une histoire de
// requête : la base répondait bien. Cinq écrans copiaient leur magasin dans un
// `useState` au montage, l'amorçage d'`AdminLayout` arrivant juste après — sur un
// poste neuf, l'écran restait donc vide pendant que la base était pleine ; et dans
// l'autre sens il affichait le vieux cache, que l'opérateur enregistrait par-dessus
// la configuration d'un collègue. Ces contrôles vérifient que l'abonnement est là
// et que rien ne se repeuple tout seul.

const ECRANS = {
  payments: 'app/[locale]/admin/payments/page.tsx',
  currencies: 'app/[locale]/admin/currencies/page.tsx',
  admin: 'app/[locale]/admin/settings/page.tsx',
  taxonomies: 'app/[locale]/admin/taxonomies/page.tsx',
  notify: 'app/[locale]/admin/messages/page.tsx',
  shop: 'app/[locale]/admin/shop-config/page.tsx',
};

for (const [kind, rel] of Object.entries(ECRANS)) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const abonné =
    /useDocRefresh\(\s*'[a-z]+'/.test(src) ||
    /addEventListener\(\s*'(sari-shop-config-changed|sari-settings-doc-changed)'/.test(src);
  const relit = /set[A-Z]\w+\(\s*(load|all)/.test(src) || /refresh\(\)/.test(src);
  check(
    `écran ${kind}: abonné à la descente de la base`,
    abonné,
    `${rel} lit son magasin au montage mais n'écoute ni l'événement des documents ni celui de son magasin — un poste neuf affiche une liste vide`,
  );
  check(`écran ${kind}: relit bien son magasin quelque part`, relit, rel);
}

// La lecture qui écrit : le jeu par défaut posé dans le cache au premier appel.
// Depuis que ces magasins sont réplifiés, ce n'est plus une paresse inoffensive —
// `localHasContent()` prend le jeu pour une saisie, la branche `seed` de
// `pullDoc()` l'envoie en base, et la configuration d'un autre poste est écrasée
// par des lignes que personne n'a écrites.
for (const file of ['lib/shop-store.ts', 'lib/currencies.ts', 'lib/notify-store.ts']) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  check(
    `${file}: une lecture ne fabrique pas le magasin`,
    !/setItem\(\s*(key|KEY)\s*,\s*JSON\.stringify\(\s*fallback\s*\)\s*\)/.test(src),
    'remplacer par `if (!raw) return fallback;` — le repli reste une valeur rendue, pas une donnée écrite',
  );
}

// Un changement venu de la base doit être visible aux composants qui écoutent leur
// magasin (en-têtes de prix, sélecteurs), pas seulement aux écrans de réglages.
check(
  'writeCache émet aussi l’événement propre au magasin touché',
  /EXTRA_EVENTS\[kind\]/.test(clientSrc) &&
    /currencies:\s*\['sari-currencies'\]/.test(clientSrc) &&
    /taxonomies:\s*\['sari-taxonomies'\]/.test(clientSrc) &&
    /payments:\s*\['sari-payments-changed'\]/.test(clientSrc),
  'sinon le composant abonné garde sa valeur du chargement jusqu’au rechargement de la page',
);

// Et l'adoption de la réponse du serveur ne vaut QUE pour les listes nues : la
// réponse d'un objet est la projection de la liste blanche du serveur, repartir
// d'elle effacerait du cache tout champ qu'elle ne connaît pas encore.
check(
  'syncDoc n’adopte la réponse que pour les listes nues',
  /shape === 'array' && after/.test(clientSrc),
  'sur une forme objet, cette adoption effacerait `smtp`, `db`, `erp` et tout champ non encore admis côté serveur',
);

// Le bandeau « d'où vient cette liste » n'a de sens que si les trois états sont
// distingués à la lecture : prendre la base quand `source === 'default'` reviendrait
// à vider tous les postes parce qu'un document n'a jamais été enregistré.
check(
  'pullDoc ne prend la base que sur source « db »',
  /source === 'db'/.test(clientSrc) && /serverPresent \? 1 : 0/.test(clientSrc),
  'sinon un document jamais enregistré écrase le cache local d’un poste qui, lui, a des lignes',
);

check(
  'docStatus rend trois états distincts (db, default, na)',
  /'db' \| 'default' \| 'na'/.test(clientSrc) &&
    /export async function docStatus/.test(clientSrc) &&
    /export function restoreDocBackup/.test(clientSrc),
  'un écran qui ne distingue pas « enregistré vide » de « jamais enregistré » ne peut pas proposer le bon remède',
);

// Les types de paiement sont une constante du magasin, pas une table : l'écran doit
// les présenter tous. Un type ajouté à `PaymentType` et oublié dans `TYPES` ne se
// choisit nulle part — et rien ne le dit, ni au build ni à l'exécution.
const storeSrc = readFileSync(join(ROOT, 'lib/shop-store.ts'), 'utf8');
const screenSrc = readFileSync(join(ROOT, 'app/[locale]/admin/payments/page.tsx'), 'utf8');
const union = /export type PaymentType =([^;]+);/.exec(storeSrc)?.[1] ?? '';
const declared = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
const offered = [...screenSrc.matchAll(/\{ value: '([a-z-]+)', labelKey/g)].map((m) => m[1]);
check(
  'l’écran « Modes de paiement » offre tous les types du magasin',
  declared.length > 0 &&
    offered.length > 0 &&
    declared.filter((v) => v !== 'pending').every((v) => offered.includes(v)),
  `PaymentType connaît ${declared.join(', ')} ; le sélecteur n'offre que ${offered.join(', ')} — ` +
    '« pending » est exclus à dessein (marqueur « à choisir »), tout autre oubli est un type injoignable',
);

console.log(
  failures === 0
    ? '\n  ✓ écran, serveur et navigation d\u2019accord\n'
    : `\n  ${failures} désaccord(s) — voir ci-dessus\n`,
);
process.exit(failures === 0 ? 0 : 1);
