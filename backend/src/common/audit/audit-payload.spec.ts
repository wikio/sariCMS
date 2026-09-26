import {
  AUDIT_MAX_STRING,
  AUDIT_MAX_VALUE,
  auditDiff,
  compactAuditPayload,
} from './audit-payload';

describe('compactAuditPayload', () => {
  it('retire les champs secrets', () => {
    const out = compactAuditPayload({
      email: 'a@b.dz',
      password: 'clair',
      passwordHash: '$2b$10$x',
      totpSecret: 'JBSW',
      totpCode: '123456',
      partnerKey: 'pk',
      refreshToken: 'rt',
    });

    expect(out).toEqual({ email: 'a@b.dz' });
  });

  it('tronque une chaîne longue en signalant ce qui manque', () => {
    const long = 'a'.repeat(AUDIT_MAX_STRING + 400);
    const out = compactAuditPayload({ body: long }) as Record<string, string>;

    expect(out.body.startsWith('a'.repeat(AUDIT_MAX_STRING))).toBe(true);
    expect(out.body.endsWith('… [+400 car.]')).toBe(true);
    expect(out.body.length).toBeLessThan(long.length);
  });

  it('laisse une chaîne courte intacte', () => {
    const out = compactAuditPayload({ title: 'Titre court' }) as Record<string, string>;
    expect(out.title).toBe('Titre court');
  });

  it('remplace un tableau volumineux par un résumé, pas par son contenu', () => {
    const bulky = { blocks: Array.from({ length: 80 }, (_, i) => ({ id: i, html: 'x'.repeat(60) })) };
    const out = compactAuditPayload(bulky) as Record<string, unknown>;

    expect(typeof out.blocks).toBe('string');
    expect(String(out.blocks)).toMatch(/^…\[tableau 80 éléments, \d+ car.\]$/);
    expect(JSON.stringify(out).length).toBeLessThan(AUDIT_MAX_VALUE);
  });

  it('résume un objet volumineux avec son nombre de clés', () => {
    const bulky: Record<string, string> = {};
    for (let i = 0; i < 120; i += 1) bulky[`champ_${i}`] = 'valeur assez longue pour peser';
    const out = compactAuditPayload({ config: bulky }) as Record<string, unknown>;

    expect(String(out.config)).toMatch(/^…\[objet 120 clés, \d+ car.\]$/);
  });

  it('résume un tableau volumineux avec son nombre d’éléments', () => {
    const out = compactAuditPayload({ rows: Array.from({ length: 200 }, (_, i) => ({ i })) }) as Record<
      string,
      unknown
    >;
    expect(String(out.rows)).toMatch(/^…\[tableau 200 éléments, \d+ car.\]$/);
  });

  it('conserve un petit objet tel quel', () => {
    const small = { seo: { title: 'x', desc: 'y' } };
    const out = compactAuditPayload(small) as Record<string, unknown>;
    expect(out.seo).toEqual({ title: 'x', desc: 'y' });
  });

  it('conserve les nombres, booléens et null', () => {
    const out = compactAuditPayload({ n: 12, ok: false, nothing: null }) as Record<string, unknown>;
    expect(out).toEqual({ n: 12, ok: false, nothing: null });
  });

  it('rend undefined plutôt qu’un objet vide', () => {
    expect(compactAuditPayload(null)).toBeUndefined();
    expect(compactAuditPayload(undefined)).toBeUndefined();
    expect(compactAuditPayload('pas un objet')).toBeUndefined();
    expect(compactAuditPayload({ password: 'x' })).toBeUndefined();
  });

  it('borne la taille totale d’une payload d’article de news', () => {
    const article = {
      title: 'Actualité',
      slug: 'actualite',
      content: '<p>'.concat('texte '.repeat(5_000), '</p>'),
      excerpt: 'Court',
      published: true,
    };
    const out = compactAuditPayload(article) as Record<string, unknown>;
    // Sans la troncature, la seule clé `content` dépasserait 30 Ko.
    expect(JSON.stringify(out).length).toBeLessThan(2_000);
    expect(out.title).toBe('Actualité');
    expect(out.published).toBe(true);
  });
});

describe('auditDiff', () => {
  const before = { id: 1, title: 'Avant', body: 'corps', views: 10, at: new Date('2026-01-01T00:00:00.000Z') };

  it('ne retient que les champs modifiés', () => {
    expect(auditDiff(before, { id: 1, title: 'Après', body: 'corps', views: 10 })).toEqual({
      title: 'Après',
    });
  });

  it('ignore une date renvoyée sous forme ISO', () => {
    expect(auditDiff(before, { at: '2026-01-01T00:00:00.000Z' })).toBeUndefined();
  });

  it('signale une date réellement changée', () => {
    expect(auditDiff(before, { at: '2026-06-01T00:00:00.000Z' })).toEqual({ at: '2026-06-01T00:00:00.000Z' });
  });

  it('compare les objets et tableaux par valeur', () => {
    const src = { seo: { title: 'x' }, tags: ['a', 'b'] };
    expect(auditDiff(src, { seo: { title: 'x' }, tags: ['a', 'b'] })).toBeUndefined();
    expect(auditDiff(src, { tags: ['a', 'b', 'c'] })).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('traite un champ absent de la source comme nouveau', () => {
    expect(auditDiff({ id: 1 }, { id: 1, slug: 'nouveau' })).toEqual({ slug: 'nouveau' });
  });

  it('ignore un champ à undefined — omission du DTO, pas remise à zéro', () => {
    expect(auditDiff(before, { title: 'Avant', body: undefined })).toBeUndefined();
  });

  it('rend undefined quand rien n’a bougé', () => {
    expect(auditDiff(before, { ...before, at: before.at.toISOString() })).toBeUndefined();
  });

  it('tolère une source absente', () => {
    expect(auditDiff(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(auditDiff(null, { a: 1 })).toEqual({ a: 1 });
  });

  it('rend undefined sur une cible qui n’est pas un objet', () => {
    expect(auditDiff(before, null)).toBeUndefined();
    expect(auditDiff(before, 'x')).toBeUndefined();
  });

  it('combiné à compactAuditPayload, un PUT complet ne garde que la correction', () => {
    const dto = {
      id: 1,
      title: 'Titre corrigé',
      body: '<p>'.concat('texte '.repeat(5_000), '</p>'),
      views: 10,
    };
    const out = compactAuditPayload(auditDiff({ ...before, body: dto.body }, dto));
    expect(out).toEqual({ title: 'Titre corrigé' });
  });
});
