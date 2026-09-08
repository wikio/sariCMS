#!/usr/bin/env node
/**
 * Garde-fou du cache de `lib/data.ts`.
 *
 * Ce cache vit dans le module : côté serveur il dure aussi longtemps que le
 * processus Node. Tant qu'il n'expirait pas, une modification faite dans
 * l'administration n'apparaissait sur la vitrine qu'après un redémarrage
 * complet — le contenu était pourtant bien enregistré et bien renvoyé par
 * l'API, mais jamais relu.
 *
 * Ces contrôles verrouillent l'expiration : ils sont statiques (lecture du
 * source), donc utilisables sans serveur ni base de données.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'lib/data.ts'), 'utf8');

let pass = 0;
const failures = [];
const check = (label, cond, detail = '') => {
  if (cond) pass += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

// ─────────────────────────────────────────────── structure du cache
check(
  'le cache stocke une date d’expiration',
  /type CacheEntry\s*=\s*\{[^}]*expiresAt:\s*number/.test(src),
  'les entrées doivent porter un expiresAt, sinon elles ne périment jamais',
);

check(
  'une durée de vie par défaut est définie',
  /const CACHE_TTL_MS\s*=/.test(src),
);

const ttl = src.match(/return Number\.isFinite\(raw\) && raw >= 0 \? raw : ([\d_]+);/);
check('la durée de vie par défaut est finie et non nulle', Boolean(ttl));
if (ttl) {
  const ms = Number(ttl[1].replace(/_/g, ''));
  check(
    'la durée de vie par défaut reste courte (≤ 5 min)',
    ms > 0 && ms <= 300_000,
    `${ms} ms`,
  );
}

check(
  'la durée de vie est réglable par variable d’environnement',
  /process\.env\.CMS_CACHE_TTL/.test(src),
);

// ───────────────────────────────────────────────── lecture du cache
check(
  'un helper de lecture centralise le contrôle d’expiration',
  /function cacheGet\(/.test(src),
);

check(
  'une entrée périmée est retirée puis rechargée',
  /expiresAt <= Date\.now\(\)[\s\S]{0,160}dataCache\.delete/.test(src),
);

// Aucune lecture ne doit court-circuiter cacheGet() : c'était précisément le
// défaut d'origine (`if (dataCache.has(k)) return dataCache.get(k)`).
const rawReads = [...src.matchAll(/dataCache\.(has|get)\(/g)];
const insideHelper = src.slice(
  src.indexOf('function cacheGet('),
  src.indexOf('async function loadData'),
);
const strayReads = rawReads.filter(
  (m) => !insideHelper.includes(src.slice(m.index, m.index + 20)),
);
check(
  'aucune lecture directe du cache hors du helper',
  strayReads.length === 0,
  `${strayReads.length} lecture(s) contournant l’expiration`,
);

// ───────────────────────────────────────────────── écriture du cache
check(
  'une durée de vie nulle désactive la mise en cache',
  /if \(CACHE_TTL_MS <= 0\) return value;/.test(src),
);

check(
  'les écritures passent par cacheSet',
  /function cacheSet[\s\S]{0,320}dataCache\.set\(/.test(src),
);

// loadData() doit lui aussi mémoriser via cacheSet, sinon le JSON statique
// serait remis en cache sans date d'expiration.
const loadData = src.slice(
  src.indexOf('async function loadData'),
  src.indexOf('function cacheSet'),
);
check(
  'loadData mémorise via cacheSet (et non dataCache.set)',
  loadData.includes('cacheSet(') && !loadData.includes('dataCache.set('),
);

// ─────────────────────────────── les utilitaires d’invalidation restent
check(
  'clearCache() et invalidateCache() sont toujours exportés',
  /export function clearCache/.test(src) && /export function invalidateCache/.test(src),
);

// ───────────────────────────────────────────────────────── rapport
if (failures.length) {
  console.error(`❌ ${failures.length} échec(s) sur ${pass + failures.length}`);
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`✅ cache de lib/data : ${pass}/${pass} vérifications OK`);
