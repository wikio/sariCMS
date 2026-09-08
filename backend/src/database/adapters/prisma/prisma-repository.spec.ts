// backend/src/database/adapters/prisma/prisma-repository.spec.ts
/**
 * Le garde-fou des dates.
 *
 * Un `0000-00-00` ou un `2026-00-11` enregistré en base ne se voit pas à
 * l'écriture : il se voit à la lecture, et il fait échouer la lecture de **toute**
 * la table (l'ORM hydrate la ligne entière). D'où deux règles testées ici : une
 * date vide ou fausse ne part pas en base, et la colonne facultative reçoit NULL
 * — « pas de date » — plutôt qu'une date inventée. Une colonne NOT NULL est omise,
 * son défaut (ou `@updatedAt`) joue.
 *
 * Et une date qui n'est pas une date n'est pas touchée : vider un titre ou un
 * sous-titre doit rester un effacement, pas une erreur silencieuse.
 */
import { PrismaRepository } from './prisma-repository';

type Repo = {
  toPrisma(data: Record<string, unknown>): Record<string, unknown>;
  explainDate(error: unknown): never;
  buildWhere(options: Record<string, unknown>): Record<string, unknown>;
};

function repo(): Repo {
  const delegate = { count: async () => 0, findMany: async () => [] };
  const service = { delegate: () => delegate } as never;
  // Le nom du modèle est volontairement hors de la table générée : ces tests portent
  // sur les dates, pas sur la liste des colonnes de `Page`. Un modèle inconnu n'est
  // pas filtré (voir model-fields.spec.ts pour ce filtrage).
  const instance = new PrismaRepository('pages', service, 'datesSansContrainte') as unknown as Repo;
  return instance;
}

describe('PrismaRepository — colonnes de date', () => {
  const r = () => repo();

  it('remplace une date vide par NULL sur une colonne facultative', () => {
    expect(r().toPrisma({ publishedAt: '' })).toEqual({ publishedAt: null });
    expect(r().toPrisma({ date: '   ' })).toEqual({ date: null });
  });

  it('écarte une date fausse, jour ou mois à zéro', () => {
    expect(r().toPrisma({ date: '2026-00-11' })).toEqual({ date: null });
    expect(r().toPrisma({ publishedAt: '2026-07-00' })).toEqual({ publishedAt: null });
    expect(r().toPrisma({ deletedAt: '0000-00-00 00:00:00' })).toEqual({ deletedAt: null });
  });

  it('ne touche pas aux horodatages NOT NULL : la colonne est omise, son défaut joue', () => {
    expect(r().toPrisma({ updatedAt: '', title: 'x' })).toEqual({ title: 'x' });
    expect(r().toPrisma({ createdAt: null })).toEqual({});
    expect(r().toPrisma({ expiresAt: '' })).toEqual({});
    expect(r().toPrisma({ expiresAt: '2026-13-45' })).toEqual({});
  });

  it("laisse une chaîne qui n'est pas une date remonter à la validation de Prisma", () => {
    // « nope » n'est pas une date vide : c'est un appel incorrect. Le garder tel
    // quel, c'est une erreur nette à l'écriture ; le convertir en NULL, ce serait
    // effacer la demande de quelqu'un en silence.
    expect(r().toPrisma({ date: 'nope' })).toEqual({ date: 'nope' });
  });

  it('laisse passer un texte vide et une durée', () => {
    expect(r().toPrisma({ title: '', subtitle: '', content: '' })).toEqual({
      title: '',
      subtitle: '',
      content: '',
    });
    // `readTime` et `deliveryTime` sont des minutes, pas des dates.
    expect(r().toPrisma({ readTime: '', deliveryTime: 30 })).toEqual({
      readTime: '',
      deliveryTime: 30,
    });
  });

  it('conserve une date correcte, y compris écrite en ISO', () => {
    expect(r().toPrisma({ publishedAt: '2026-07-05T08:00:00.000Z' })).toEqual({
      publishedAt: '2026-07-05T08:00:00.000Z',
    });
    expect(r().toPrisma({ date: new Date('2026-07-05T00:00:00Z') })).toEqual({
      date: new Date('2026-07-05T00:00:00Z'),
    });
  });

  it('nomme la table et le fichier de réparation quand la lecture échoue', () => {
    let message = '';
    try {
      r().explainDate({ code: 'P2023', message: 'Value out of range for the type: …' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('pages');
    expect(message).toContain('backend/sql/fix-zero-dates.mysql.sql');
  });

  it("relaie sans rien changer une erreur qui n'est pas une date", () => {
    const boom = { code: 'P2002', message: 'Unique constraint failed' };
    expect(() => r().explainDate(boom)).toThrow(boom as never);
  });
});

describe('PrismaRepository — une date écrite sans heure', () => {
  const r = () => repo();

  it('accepte une date seule, telle que la rend un input type="date"', () => {
    // C'est le cas qui faisait échouer `POST /api/v1/applications` : le champ
    // `date` valait « 2026-07-15 », Prisma répondait « premature end of input »
    // et toute une reprise de catalogue tombait.
    expect(r().toPrisma({ date: '2026-07-15' })).toEqual({
      date: new Date('2026-07-15T00:00:00.000Z'),
    });
    expect(r().toPrisma({ createdAt: '2026-01-08' })).toEqual({
      createdAt: new Date('2026-01-08T00:00:00.000Z'),
    });
  });

  it('accepte une date-heure sans fuseau, telle que la rend un datetime-local', () => {
    expect(r().toPrisma({ publishedAt: '2026-07-15T10:30' })).toEqual({
      publishedAt: new Date('2026-07-15T10:30:00.000Z'),
    });
    // Le format que renvoie MySQL, séparé par une espace.
    expect(r().toPrisma({ date: '2026-07-15 10:30:15' })).toEqual({
      date: new Date('2026-07-15T10:30:15.000Z'),
    });
  });

  it('ne touche pas à un horodatage complet, ni à un objet Date', () => {
    expect(r().toPrisma({ date: '2026-07-15T10:30:00.000Z' })).toEqual({
      date: '2026-07-15T10:30:00.000Z',
    });
    expect(r().toPrisma({ date: '2026-07-15T10:30:00+02:00' })).toEqual({
      date: '2026-07-15T10:30:00+02:00',
    });
    const d = new Date('2026-07-15T10:30:00Z');
    expect(r().toPrisma({ date: d })).toEqual({ date: d });
  });

  it('remet aussi en forme les dates qui servent à filtrer', () => {
    const where = r().buildWhere({
      filters: [
        { field: 'date', op: 'gte', value: '2026-07-01' },
        { field: 'date', op: 'between', value: ['2026-07-01', '2026-07-31'] },
        { field: 'title', op: 'contains', value: '2026-07-01' },
      ],
    }) as { AND: Array<Record<string, unknown>> };
    expect(where.AND[0]).toEqual({ date: { gte: new Date('2026-07-01T00:00:00.000Z') } });
    expect(where.AND[1]).toEqual({
      date: { gte: new Date('2026-07-01T00:00:00.000Z'), lte: new Date('2026-07-31T00:00:00.000Z') },
    });
    // Un texte garde sa valeur littérale : « contient 2026-07-01 » reste une recherche.
    expect(where.AND[2]).toEqual({ title: { contains: '2026-07-01' } });
  });
});
