// backend/src/database/adapters/prisma/model-fields.spec.ts
/**
 * Les champs d'un modèle, tels que le schéma les déclare.
 *
 * Un `careerId` refusé coûtait déjà un import entier ; un `legacyId` refusé en a
 * coûté un deuxième, sur un champ que personne n'avait oublié d'écrire — c'est le
 * service CRUD qui l'ajoutait d'office, et le modèle `JobApplication` ne le
 * déclare pas. Prisma ne glisse pas sous le tapis : une clé inconnue jette la
 * ligne, et huit candidatures postées répondent huit 500.
 *
 * Deux choses sont testées ici. D'abord la fidélité : `model-fields.ts` est généré
 * depuis `prisma/schema.prisma`, et rien, dans un dépôt, n'oblige à le régénérer
 * quand le schéma bouge — le contrôle recalcule la liste et échoue si les deux
 * divergent. Ensuite le comportement : une clé que le modèle ne connaît pas est
 * écartée de l'écriture avec un avertissement, une fois, et rien d'autre n'est
 * touché — surtout pas les colonnes qui existent.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { PrismaRepository } from './prisma-repository';
import { PRISMA_MODEL_FIELDS } from './model-fields';

const SCHEMA = readFileSync(join(__dirname, '../../../../prisma/schema.prisma'), 'utf8');

/** Un champ déclaré : deux espaces d'indentation, un nom, un type. */
function fieldsFromSchema(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const block of SCHEMA.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? []) {
    const name = /^model (\w+)/.exec(block)![1];
    const delegate = (name[0].toLowerCase() + name.slice(1)).toLowerCase();
    const fields: string[] = [];
    for (const line of block.split('\n')) {
      const m = /^\s{2}([a-zA-Z_]\w*)\s+\S/.exec(line);
      if (m && !fields.includes(m[1])) fields.push(m[1]);
    }
    out[delegate] = fields;
  }
  return out;
}

/** Les colonnes d'un modèle, telles que le fichier généré les connaît. */
function fieldsOf(model: string): readonly string[] {
  return PRISMA_MODEL_FIELDS[model] ?? [];
}

type Repo = {
  toPrisma(data: Record<string, unknown>): Record<string, unknown>;
  knowsField(name: string): boolean;
};

function repo(model: string): Repo {
  const delegate = { count: async () => 0, findMany: async () => [] };
  const service = { delegate: () => delegate } as never;
  const collection = model === 'jobapplication' ? 'job_applications' : model;
  return new PrismaRepository(collection, service, model) as unknown as Repo;
}

describe('model-fields — fidélité au schéma', () => {
  const declared = fieldsFromSchema();

  it('le schéma déclare des modèles et des champs (sinon le test ne prouve rien)', () => {
    expect(Object.keys(declared).length).toBeGreaterThanOrEqual(20);
    const total = Object.values(declared).reduce((n, list) => n + list.length, 0);
    expect(total).toBeGreaterThan(400);
  });

  it('décrit exactement les modèles du schéma', () => {
    expect(Object.keys(PRISMA_MODEL_FIELDS).sort()).toEqual(Object.keys(declared).sort());
  });

  it.each(Object.entries(declared))('%s : les champs du schéma sont tous connus', (model, fields) => {
    for (const field of fields) expect(fieldsOf(model)).toContain(field);
  });

  it('ne promet aucun champ que le schéma ne déclare', () => {
    for (const [model, list] of Object.entries(PRISMA_MODEL_FIELDS)) {
      for (const field of list) expect(declared[model] ?? []).toContain(field);
    }
  });

  it('laisse sans colonne `legacyId` les tables qui ne sont pas traduites', () => {
    // Le couple qui a fait tomber l’import des candidatures : le service injectait
    // un `legacyId` là où le modèle n’a rien pour le recevoir.
    expect(fieldsOf('jobapplication')).not.toContain('legacyId');
    expect(fieldsOf('page')).not.toContain('legacyId');
    expect(fieldsOf('contactmessage')).not.toContain('legacyId');
    expect(fieldsOf('auditlog')).not.toContain('legacyId');
  });

  it('donne la colonne de traduction aux fiches qui en ont une', () => {
    for (const model of ['newsarticle', 'eventitem', 'product', 'serviceitem', 'career', 'testimonial']) {
      expect(fieldsOf(model)).toContain('legacyId');
    }
  });
});

describe('PrismaRepository — une clé que le modèle ne déclare pas', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('écarte la clé et laisse passer les colonnes du modèle', () => {
    const out = repo('jobapplication').toPrisma({ candidate: 'A', email: 'a@b.c', legacyId: 'appl-1' });
    expect(out).toEqual({ candidate: 'A', email: 'a@b.c' });
    expect(out).not.toHaveProperty('legacyId');
  });

  it('avertit une seule fois par champ, et dit où reprendre la colonne', () => {
    const applications = repo('jobapplication');
    applications.toPrisma({ candidate: 'A', legacyId: 'appl-1' });
    applications.toPrisma({ candidate: 'B', legacyId: 'appl-2' });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('legacyId');
    expect(message).toContain('job_applications');
    expect(message).toContain('db:schema-fix');
  });

  it('ne touche pas à une colonne que le modèle déclare', () => {
    expect(repo('newsarticle').toPrisma({ title: 'T', legacyId: 'news-1' })).toEqual({
      title: 'T',
      legacyId: 'news-1',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('laisse la clé de relation être traduite avant d’être jugée', () => {
    // `careerId` n'est pas un champ d'écriture pour Prisma, mais il est déclaré :
    // le filtre ne doit pas le cueillir avant que la relation soit construite.
    expect(repo('jobapplication').toPrisma({ careerId: 3 })).toEqual({
      career: { connect: { id: 3 } },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('ne filtre rien sur un modèle que le schéma ne décrit pas', () => {
    expect(repo('quelquechosedautre').knowsField('nImporteQuoi')).toBe(true);
    expect(repo('quelquechosedautre').toPrisma({ nImporteQuoi: 1 })).toEqual({ nImporteQuoi: 1 });
  });

  it('sait répondre à la question du service : le modèle a-t-il la colonne ?', () => {
    expect(repo('page').knowsField('title')).toBe(true);
    expect(repo('page').knowsField('legacyId')).toBe(false);
    expect(repo('career').knowsField('legacyId')).toBe(true);
  });
});
