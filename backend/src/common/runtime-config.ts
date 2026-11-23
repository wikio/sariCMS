/** Refuser un démarrage ambigu avant toute connexion à une base en production. */
export function validateRuntimeConfig(env: Record<string, unknown>) {
  if (env.NODE_ENV !== 'production') return env;
  const driver = String(env.DB_DRIVER || '').toLowerCase();
  if (!['mysql', 'postgres', 'postgresql', 'mongo', 'mongodb', 'json'].includes(driver)) {
    throw new Error('DB_DRIVER doit être défini explicitement en production.');
  }
  if (['mysql', 'postgres', 'postgresql'].includes(driver) && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL est nécessaire pour le pilote SQL.');
  }
  const internal = String(env.MAIL_INTERNAL_KEY || '');
  if (internal && (internal.trim().length < 32 || /^remplacer/i.test(internal.trim()))) {
    throw new Error('MAIL_INTERNAL_KEY : utiliser une clé aléatoire partagée (32 caractères minimum), ou laisser vide pour fermer le relais.');
  }
  const secret = String(env.JWT_ACCESS_SECRET || '').trim();
  if (secret.length < 32 || /^(?:change-me-|dev-secret-|remplacer)/i.test(secret)) {
    throw new Error('JWT_ACCESS_SECRET : générer un secret personnel d’au moins 32 caractères.');
  }
  return env;
}
