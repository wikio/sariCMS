import { validateRuntimeConfig } from './runtime-config';

const base = { NODE_ENV: 'production', DB_DRIVER: 'mysql', DATABASE_URL: 'mysql://db/sari', JWT_ACCESS_SECRET: 'x'.repeat(48) };
describe('Configuration au démarrage', () => {
  it('accepte le pilote déclaré et préserve les autres variables', () => expect(validateRuntimeConfig(base)).toBe(base));
  it.each([
    { JWT_ACCESS_SECRET: '' }, { JWT_ACCESS_SECRET: 'change-me-access-secret-min-32-chars-please' },
    { MAIL_INTERNAL_KEY: 'short' }, { MAIL_INTERNAL_KEY: 'REMPLACER_PAR_LA_CLE_COMMUNE' },
    { DB_DRIVER: '' }, { DB_DRIVER: 'myslq' }, { DATABASE_URL: '' },
  ])('refuse une configuration de production incomplète (%j)', patch => {
    expect(() => validateRuntimeConfig({ ...base, ...patch })).toThrow();
  });
  it('permet JSON explicite sans URL SQL', () => expect(() => validateRuntimeConfig({ ...base, DB_DRIVER: 'json', DATABASE_URL: '' })).not.toThrow());
  it('ne change pas les valeurs de développement', () => expect(validateRuntimeConfig({})).toEqual({}));
});
