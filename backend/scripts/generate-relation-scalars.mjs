#!/usr/bin/env node
// backend/scripts/generate-relation-scalars.mjs
/**
 * Génère `src/database/adapters/prisma/relation-scalars.ts` : la table des clés
 * étrangères que l'ORM refuse de voir écrites directement.
 *
 * Le piège, et il a coûté un import de catalogue entier : dès qu'une colonne est
 * déclarée comme le support d'une relation dans `schema.prisma`
 * (`careerId` + `career Career? @relation(fields: [careerId]…)`), Prisma n'accepte
 * plus `careerId` dans les données d'écriture. Il veut `career: { connect: { id } }`.
 * Le champ existe pourtant en lecture, il existe dans les formulaires
 * d'administration, il existe dans les fichiers JSON repris — et l'erreur tombe au
 * `create`, en 500, sans rapport avec le lien métier : « Unknown argument
 * `careerId`. Did you mean `career`? ».
 *
 * Plutôt que de corriger ressource par ressource — et de voir le même 500
 * réapparaître à la next relation déclarée —, l'adaptateur traduisit tout, avec
 * cette table. D'où un générateur : la liste ne peut pas rester en arrière du
 * schéma, puisqu'elle en sort. Le contrôle `relation-scalars.spec.ts` rejoue le
 * même calcul et échoue si le fichier commite diverge de `schema.prisma`.
 *
 * Usage : node scripts/generate-relation-scalars.mjs   (npm run prisma:relations)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.join(here, '../prisma/schema.prisma');
const outFile = path.join(here, '../src/database/adapters/prisma/relation-scalars.ts');

/** Une ligne de relation supportée : un seul champ local, un seul champ distant. */
const RELATION_LINE =
  /^\s*(\w+)\s+([A-Z]\w*)(\?)?\s+@relation\(([^)]*\bfields:\s*\[(\w+)\][^)]*\breferences:\s*\[(\w+)\][^)]*)\)/;

/** Une colonne, pour savoir si la clé étrangère est facultative. */
const COLUMN_LINE = /^\s*(\w+)\s+(Int|BigInt|String)(\?)?/;

export function collect(schema) {
  const out = {};
  const models = schema.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? [];
  for (const block of models) {
    const name = /^model (\w+)/.exec(block)[1];
    // Le nom du délégué, tel que l'adaptateur le reçoit de `database.module` :
    // la première lettre en minuscule, tout en bas de casse pour la recherche.
    const delegate = (name[0].toLowerCase() + name.slice(1)).toLowerCase();
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

const file = `// backend/src/database/adapters/prisma/relation-scalars.ts
/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : prisma/schema.prisma. Générateur : \`npm run prisma:relations\`
 * (backend/scripts/generate-relation-scalars.mjs). Contrôle :
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

fs.writeFileSync(outFile, file, 'utf8');
console.log(
  `relation-scalars.ts écrit : ${Object.keys(map).length} modèles, ${count} clés étrangères de relation`,
);
