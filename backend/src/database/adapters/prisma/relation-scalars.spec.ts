// backend/src/database/adapters/prisma/relation-scalars.spec.ts
/**
 * Les clés étrangères de relation, traduites à l'écriture.
 *
 * Deux choses sont testées ici, et la seconde est la plus importante parce qu'elle
 * ne se voit pas : le fichier `relation-scalars.ts` est généré depuis
 * `prisma/schema.prisma`, et rien, dans un dépôt, n'oblige à le régénérer quand le
 * schéma change. Le contrôle recalcule donc la liste depuis le schéma et exige que
 * chaque relation déclarée y figure — une relation ajoutée sans régénération fait
 * échouer ce test, au lieu de faire échoyer une écriture en production six mois
 * plus tard sous la forme d'un 500 « Unknown argument ».
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaRepository } from './prisma-repository';
import { RELATION_SCALARS } from './relation-scalars';

const SCHEMA = readFileSync(join(__dirname, '../../../../prisma/schema.prisma'), 'utf8');

/** Toutes les relations déclarées avec leur colonne locale : `@relation(fields: [x], references: [y])`. */
function relationsFromSchema(): Array<{ model: string; column: string; relation: string; references: string }> {
  const found: Array<{ model: string; column: string; relation: string; references: string }> = [];
  for (const block of SCHEMA.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? []) {
    const name = /^model (\w+)/.exec(block)![1];
    const delegate = (name[0].toLowerCase() + name.slice(1)).toLowerCase();
    for (const line of block.split('\n')) {
      const m = /^\s*(\w+)\s+[A-Z]\w*\??\s+@relation\([^)]*\bfields:\s*\[(\w+)\][^)]*\breferences:\s*\[(\w+)\]/.exec(line);
      if (!m) continue;
      found.push({ model: delegate, column: m[2], relation: m[1], references: m[3] });
    }
  }
  return found;
}

describe('relation-scalars — fidélité au schéma', () => {
  const relations = relationsFromSchema();

  it('le schéma déclare bien des relations à clé étrangère (sinon le test ne prouve rien)', () => {
    expect(relations.length).toBeGreaterThanOrEqual(8);
  });

  it.each(relations.map((r) => [r.model, r.column, r.relation, r.references] as const))(
    '%s.%s est traduit en %s',
    (model, column, relation, references) => {
      const entry = RELATION_SCALARS[model]?.[column];
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({ relation, references });
    },
  );

  it('ne promet aucune colonne que le schéma ne déclare pas', () => {
    const declared = new Set(relations.map((r) => `${r.model}.${r.column}`));
    for (const [model, scalars] of Object.entries(RELATION_SCALARS)) {
      for (const column of Object.keys(scalars)) {
        expect(declared.has(`${model}.${column}`)).toBe(true);
      }
    }
  });
});

describe('PrismaRepository — écriture d’une clé étrangère', () => {
  type Repo = { toPrisma(data: Record<string, unknown>): Record<string, unknown> };

  function repo(model: string): Repo {
    const delegate = { count: async () => 0, findMany: async () => [] };
    const service = { delegate: () => delegate } as never;
    return new PrismaRepository('applications', service, model) as unknown as Repo;
  }

  const applications = () => repo('jobApplication');

  it('transforme careerId en connexion de la relation career', () => {
    expect(applications().toPrisma({ candidate: 'A', careerId: 12 })).toEqual({
      candidate: 'A',
      career: { connect: { id: 12 } },
    });
  });

  it('rend un id numérique donné en chaîne, qu’une colonne Int refuse', () => {
    expect(applications().toPrisma({ careerId: '3' })).toEqual({ career: { connect: { id: 3 } } });
  });

  it('ne laisse jamais la colonne seule : elle serait refusée au create', () => {
    const out = applications().toPrisma({ careerId: 1, userId: 2, date: '2026-07-15' });
    expect(out).not.toHaveProperty('careerId');
    expect(out).not.toHaveProperty('userId');
    expect(out).toEqual({
      career: { connect: { id: 1 } },
      user: { connect: { id: 2 } },
      date: new Date('2026-07-15T00:00:00.000Z'),
    });
  });

  it('déconnecte quand l’administration envoie une valeur vide', () => {
    expect(applications().toPrisma({ careerId: null })).toEqual({ career: { disconnect: true } });
    expect(applications().toPrisma({ careerId: '' })).toEqual({ career: { disconnect: true } });
  });

  it('ne déconnecte pas ce que la base exige : la colonne NOT NULL garde sa valeur', () => {
    expect(repo('refreshToken').toPrisma({ userId: null })).toEqual({});
  });

  it('respecte la relation fournie explicitement, même avec sa colonne à côté', () => {
    expect(
      applications().toPrisma({ careerId: 4, career: { connect: { id: 9 } } }),
    ).toEqual({ career: { connect: { id: 9 } } });
  });

  it('accepte un objet muni d’un id, comme les sélecteurs de l’administration', () => {
    expect(applications().toPrisma({ careerId: { id: '7' } })).toEqual({
      career: { connect: { id: 7 } },
    });
  });

  it('ignore les modèles sans relation et laisse passer leurs colonnes', () => {
    expect(repo('page').toPrisma({ slug: 'a-propos', category: 'about' })).toEqual({
      slug: 'a-propos',
      category: 'about',
    });
  });
});
