#!/usr/bin/env node
// backend/scripts/generate-schema-maps.mjs
/**
 * Génère les deux tables que l'adaptateur Prisma tire de `prisma/schema.prisma` :
 *
 * - `src/database/adapters/prisma/relation-scalars.ts` — les colonnes qui portent
 *   une clé étrangère de relation, donc qu'on n'écrit jamais directement ;
 * - `src/database/adapters/prisma/model-fields.ts` — la liste des champs que
 *   chaque modèle connaît, c'est-à-dire ce que Prisma accepte dans `data`.
 *
 * Le piège, et il a coûté deux imports de catalogue entiers : le DTO et le fichier
 * JSON reprennent un champ que le modèle ne déclare pas. Prisma ne prévient pas à
 * l'avance, il refuse à l'écriture — « Unknown argument `careerId`. Did you mean
 * `career`? » pour une clé de relation, « Unknown argument `legacyId` » pour une
 * colonne que le modèle n'a pas. Et le refus touche la ligne entière : huit
 * candidatures postées, huit 500, la reprise du catalogue abandonnée en route.
 *
 * Deux traductions, donc, faites à la source :
 *
 * - une clé de relation (`careerId` + `career Career? @relation(fields: [careerId]…)`)
 *   devient `career: { connect: { id } }` — le champ existe en lecture, il existe
 *   dans les formulaires d'administration, il existe dans les JSON repris ;
 * - une clé absente du modèle est écartée de l'écriture, avec un avertissement
 *   qui nomme le modèle et le champ : le lot passe, et le message dit quoi corriger.
 *
 * Plutôt que de corriger ressource par ressource — et de voir le même 500
 * réapparaître au prochain champ déclaré de travers —, les tables sont dérivées du
 * schéma. Elles ne peuvent pas rester en arrière, puisqu'elles en sortent ; et les
 * contrôles `relation-scalars.spec.ts` et `model-fields.spec.ts` rejouent le même
 * calcul et échouent si les fichiers committés divergent de `schema.prisma`.
 *
 * Usage : node scripts/generate-schema-maps.mjs   (npm run prisma:maps)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.join(here, '../prisma/schema.prisma');
const outRelations = path.join(here, '../src/database/adapters/prisma/relation-scalars.ts');
const outFields = path.join(here, '../src/database/adapters/prisma/model-fields.ts');

/** Une ligne de relation supportée : un seul champ local, un seul champ distant. */
const RELATION_LINE =
  /^\s*(\w+)\s+([A-Z]\w*)(\?)?\s+@relation\(([^)]*\bfields:\s*\[(\w+)\][^)]*\breferences:\s*\[(\w+)\][^)]*)\)/;

/** Une colonne, pour savoir si la clé étrangère est facultative. */
const COLUMN_LINE = /^\s*(\w+)\s+(Int|BigInt|String)(\?)?/;

/**
 * Un champ déclaré : deux espaces d'indentation, un nom, un type. Les lignes
 * d'attribut (`@@index`, `@@map`) commencent par `@` et les commentaires par `/`,
 * donc ne tombent pas dans ce motif.
 */
const FIELD_LINE = /^\s{2}([a-zA-Z_]\w*)\s+\S/;

/** Le nom sous lequel l'adaptateur reçoit le modèle : délégué, tout en bas de casse. */
function delegateName(model) {
  return (model[0].toLowerCase() + model.slice(1)).toLowerCase();
}

function modelBlocks(schema) {
  return schema.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? [];
}

export function collect(schema) {
  const out = {};
  for (const block of modelBlocks(schema)) {
    const name = /^model (\w+)/.exec(block)[1];
    // Le nom du délégué, tel que l'adaptateur le reçoit de `database.module` :
    // la première lettre en minuscule, tout en bas de casse pour la recherche.
    const delegate = delegateName(name);
    const scalars = {};
    const columns = {};
    for (const line of block.split('\n')) {
      const col = COLUMN_LINE.exec(line);
      if (col) columns[col[1]] = { nullable: Boolean(col[3]) };
      const rel = RELATION_LINE.exec(line);
      if (!rel) continue;
      const [, relation, , optionalRelation, , local, remote] = rel;
      // Une relation dont la colonne locale est absente du schéma (vue, implicit
      // many-to-many) n'a rien à traduire ; une relation NON facultative ne se
      // déconnecte pas, et le lui proposer serait une autre 500.
      if (!columns[local]) continue;
      scalars[local] = {
        relation,
        references: remote,
        nullable: columns[local].nullable,
        optionalRelation: Boolean(optionalRelation),
      };
    }
    if (Object.keys(scalars).length) out[delegate] = scalars;
  }
  return out;
}

/** Pour chaque modèle, les champs que Prisma accepte dans `create` / `update`. */
export function collectFields(schema) {
  const out = {};
  for (const block of modelBlocks(schema)) {
    const name = /^model (\w+)/.exec(block)[1];
    const fields = [];
    for (const line of block.split('\n')) {
      const field = FIELD_LINE.exec(line);
      if (field && !fields.includes(field[1])) fields.push(field[1]);
    }
    out[delegateName(name)] = fields;
  }
  return out;
}

const schema = fs.readFileSync(schemaFile, 'utf8');
const map = collect(schema);
const count = Object.values(map).reduce((n, m) => n + Object.keys(m).length, 0);

const body = Object.entries(map)
  .map(([model, scalars]) => {
    const entries = Object.entries(scalars)
      .map(
        ([column, info]) =>
          `    ${column}: { relation: '${info.relation}', references: '${info.references}', ` +
          `nullable: ${info.nullable}, optionalRelation: ${info.optionalRelation} },`,
      )
      .join('\n');
    return `  ${model}: {\n${entries}\n  },`;
  })
  .join('\n');

const relationsFile = `// backend/src/database/adapters/prisma/relation-scalars.ts
/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : prisma/schema.prisma. Générateur : \`npm run prisma:maps\`
 * (backend/scripts/generate-schema-maps.mjs). Contrôle :
 * relation-scalars.spec.ts, qui échoue si le schéma bouge sans régénération.
 *
 * Colonnes qui portent une clé étrangère de relation : elles se lisent, elle ne
 * s'écrivent pas — l'ORM demande la relation elle-même (\`connect\` /
 * \`disconnect\`). L'adaptateur Prisma s'en sert pour traduire les fiches venues
 * de l'administration, des imports et des JSON, où le champ s'appelle
 * \`careerId\`, \`userId\`, \`authorId\`… sans jamais passer par \`career\`.
 *
 * Clé de premier niveau : le nom du délégué Prisma, en bas de casse
 * (\`jobApplication\`). Les colonnes d'une table sans relation déclarée n'y
 * figurent pas, et s'écrivent normalement.
 */
export interface RelationScalar {
  /** Le nom de la relation côté Prisma (\`career\` pour \`careerId\`). */
  relation: string;
  /** La colonne visée chez le voisin, en général \`id\`. */
  references: string;
  /** La colonne locale accepte NULL — la clé étrangère est donc effaçable. */
  nullable: boolean;
  /** La relation elle-même est facultative : \`disconnect\` a un sens. */
  optionalRelation: boolean;
}

export const RELATION_SCALARS: Record<string, Record<string, RelationScalar>> = {
${body}
};
`;

const fields = collectFields(schema);
const fieldsBody = Object.entries(fields)
  .map(([model, list]) => {
    const inline = `  ${model}: [${list.map((f) => `'${f}'`).join(', ')}],`;
    // Prettier garde une ligne ce qui y tient ; au-delà, un élément par ligne.
    // Le fichier est généré : il doit être stable au \`npm run format\`.
    if (inline.length <= 80) return inline;
    const items = list.map((f) => `    '${f}',`).join('\n');
    return `  ${model}: [\n${items}\n  ],`;
  })
  .join('\n');
const fieldCount = Object.values(fields).reduce((n, list) => n + list.length, 0);

const fieldsFile = `// backend/src/database/adapters/prisma/model-fields.ts
/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : prisma/schema.prisma. Générateur : \`npm run prisma:maps\`
 * (backend/scripts/generate-schema-maps.mjs). Contrôle : model-fields.spec.ts,
 * qui échoue si le schéma bouge sans régénération.
 *
 * Les champs que chaque modèle déclare — c'est-à-dire ce que Prisma accepte dans
 * \`data\` d'un \`create\` ou d'un \`update\`. Tout le reste est refusé, et le refus est
 * brutal : une seule clé inconnue fait échouer la ligne entière (« Unknown argument
 * \`legacyId\` »), donc un import de catalogue entier, donc un écran qui répond 500.
 *
 * Deux lectures de cette table, toutes deux dans l'adaptateur Prisma :
 * \`knowsField()\` — le service CRUD demande si le modèle a la colonne avant d'y
 * mettre quoi que ce soit, notamment le \`legacyId\` qu'il ajoute d'office ; et le
 * filtrage de \`toPrisma\`, qui écarte une clé inconnue avec un avertissement au
 * lieu de laisser l'ORM tout rejeter.
 *
 * Clé : le nom du délégué Prisma, en bas de casse (\`jobApplication\`). Un modèle
 * absent de cette table n'est pas filtré — prudence vaut mieux qu'un faux négatif.
 */
export const PRISMA_MODEL_FIELDS: Record<string, readonly string[]> = {
${fieldsBody}
};

`;

fs.writeFileSync(outRelations, relationsFile, 'utf8');
fs.writeFileSync(outFields, fieldsFile, 'utf8');
console.log(
  `relation-scalars.ts écrit : ${Object.keys(map).length} modèles, ${count} clés étrangères de relation`,
);
console.log(`model-fields.ts écrit : ${Object.keys(fields).length} modèles, ${fieldCount} champs`);
