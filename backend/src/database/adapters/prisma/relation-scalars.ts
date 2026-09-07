// backend/src/database/adapters/prisma/relation-scalars.ts
/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : prisma/schema.prisma. Générateur : `npm run prisma:relations`
 * (backend/scripts/generate-relation-scalars.mjs). Contrôle :
 * relation-scalars.spec.ts, qui échoue si le schéma bouge sans régénération.
 *
 * Colonnes qui portent une clé étrangère de relation : elles se lisent, elle ne
 * s'écrivent pas — l'ORM demande la relation elle-même (`connect` /
 * `disconnect`). L'adaptateur Prisma s'en sert pour traduire les fiches venues
 * de l'administration, des imports et des JSON, où le champ s'appelle
 * `careerId`, `userId`, `authorId`… sans jamais passer par `career`.
 *
 * Clé de premier niveau : le nom du délégué Prisma, en bas de casse
 * (`jobApplication`). Les colonnes d'une table sans relation déclarée n'y
 * figurent pas, et s'écrivent normalement.
 */
export interface RelationScalar {
  /** Le nom de la relation côté Prisma (`career` pour `careerId`). */
  relation: string;
  /** La colonne visée chez le voisin, en général `id`. */
  references: string;
  /** La colonne locale accepte NULL — la clé étrangère est donc effaçable. */
  nullable: boolean;
  /** La relation elle-même est facultative : `disconnect` a un sens. */
  optionalRelation: boolean;
}

export const RELATION_SCALARS: Record<string, Record<string, RelationScalar>> = {
  user: {
    roleId: { relation: 'role', references: 'id', nullable: true, optionalRelation: true },
  },
  refreshtoken: {
    userId: { relation: 'user', references: 'id', nullable: false, optionalRelation: false },
  },
  rolepermission: {
    roleId: { relation: 'role', references: 'id', nullable: false, optionalRelation: false },
    permissionId: { relation: 'permission', references: 'id', nullable: false, optionalRelation: false },
  },
  auditlog: {
    actorId: { relation: 'actor', references: 'id', nullable: true, optionalRelation: true },
  },
  newsarticle: {
    authorId: { relation: 'author', references: 'id', nullable: true, optionalRelation: true },
  },
  order: {
    userId: { relation: 'user', references: 'id', nullable: true, optionalRelation: true },
  },
  quote: {
    userId: { relation: 'user', references: 'id', nullable: true, optionalRelation: true },
  },
  jobapplication: {
    userId: { relation: 'user', references: 'id', nullable: true, optionalRelation: true },
    careerId: { relation: 'career', references: 'id', nullable: true, optionalRelation: true },
  },
};
