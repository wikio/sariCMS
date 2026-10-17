#!/usr/bin/env node
/**
 * Garde-fou `legacyId`.
 *
 * `BaseCrudService.withLegacyId()` estampille un `legacyId` sur chaque
 * création. Or seules les tables de contenu traduisible portent cette colonne.
 * Sur les autres, Prisma refuse l'argument inconnu et l'API répond 500
 * (« Unknown argument `legacyId` ») — invisible en local, car le driver JSON
 * accepte n'importe quelle clé.
 *
 * Ce test relit le schéma Prisma et vérifie que chaque service CRUD déclare
 * `hasLegacyId: false` si et seulement si sa table n'a pas la colonne.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');

let pass = 0;
const failures = [];
const check = (label, cond, detail = '') => {
  if (cond) {
    pass += 1;
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  }
};

// ---------------------------------------------------------------- schéma
const schema = readFileSync(join(backend, 'prisma/schema.prisma'), 'utf8');
const modelHasLegacy = new Map();
for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  modelHasLegacy.set(m[1], /\blegacyId\b/.test(m[2]));
}
check('le schéma Prisma expose des modèles', modelHasLegacy.size > 0);

// délégué Prisma -> modèle (`solutionCategory` -> `SolutionCategory`)
const modelForDelegate = (delegate) => {
  for (const name of modelHasLegacy.keys()) {
    if (name[0].toLowerCase() + name.slice(1) === delegate) return name;
  }
  return null;
};

// ------------------------------------------------- collection -> délégué
const tokens = readFileSync(
  join(backend, 'src/common/constants/tokens.ts'),
  'utf8',
);
const delegates = new Map(
  [...tokens.matchAll(/(\w+):\s*'(\w+)',/g)].map((m) => [m[1], m[2]]),
);

// ------------------------------------------------------------- services
const modulesDir = join(backend, 'src/modules');
let audited = 0;

for (const mod of readdirSync(modulesDir)) {
  const dir = join(modulesDir, mod);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.service.ts'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    if (!src.includes('extends BaseCrudService')) continue;

    const resource = src.match(/resource:\s*'([a-z-]+)'/)?.[1];
    if (!resource) continue;

    const delegate = delegates.get(mod) ?? delegates.get(resource);
    const model = delegate ? modelForDelegate(delegate) : null;
    if (!model) continue; // pas de modèle Prisma traçable (store JSON seul)

    audited += 1;
    const tableHasLegacy = modelHasLegacy.get(model);
    const optedOut = /hasLegacyId:\s*false/.test(src);

    if (tableHasLegacy) {
      check(
        `${resource} : la table a legacyId, le service ne doit pas s'exclure`,
        !optedOut,
        `${file} déclare hasLegacyId: false alors que ${model}.legacyId existe`,
      );
    } else {
      check(
        `${resource} : table sans legacyId -> hasLegacyId: false requis`,
        optedOut,
        `${model} n'a pas de colonne legacyId : ${file} doit déclarer ` +
          `hasLegacyId: false, sinon POST /${resource} renvoie 500 sous MySQL`,
      );
    }
  }
}
check('des services CRUD ont été audités', audited >= 15, `${audited} audités`);

// --------------------------------------------------- socle base-crud
const base = readFileSync(
  join(backend, 'src/common/crud/base-crud.service.ts'),
  'utf8',
);
check(
  'CrudServiceOptions déclare hasLegacyId',
  /hasLegacyId\?:\s*boolean/.test(base),
);
check(
  'withLegacyId court-circuite quand hasLegacyId === false',
  /hasLegacyId === false\)\s*return dto;/.test(base),
);
check(
  'le court-circuit précède la génération de l’identifiant',
  base.indexOf('hasLegacyId === false') < base.indexOf('randomUUID().slice'),
);

// ------------------------------------------- cohérence SQL <-> Prisma
const sqlPath = join(backend, 'sql/schema.mysql.sql');
if (existsSync(sqlPath)) {
  const sql = readFileSync(sqlPath, 'utf8');
  for (const t of sql.matchAll(/CREATE TABLE[^`]*`(\w+)`\s*\(([\s\S]*?)\n\)/g)) {
    const [, table, body] = t;
    const sqlLegacy = /legacy_id|legacyId/i.test(body);
    const mapped = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].find(
      (m) => m[2].includes(`@@map("${table}")`),
    );
    if (!mapped) continue;
    check(
      `table ${table} : SQL et Prisma s'accordent sur legacyId`,
      sqlLegacy === modelHasLegacy.get(mapped[1]),
      `SQL=${sqlLegacy} Prisma=${modelHasLegacy.get(mapped[1])}`,
    );
  }
}

// ------------------------------------------------------------- rapport
if (failures.length) {
  console.error(`❌ ${failures.length} échec(s) sur ${pass + failures.length}`);
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`✅ legacyId : ${pass}/${pass} vérifications OK (${audited} services)`);
