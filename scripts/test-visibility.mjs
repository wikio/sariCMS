#!/usr/bin/env node
/**
 * Visibilité par langue : contrôles fonctionnels contre un serveur en marche.
 *
 *   node scripts/test-visibility.mjs
 *   node scripts/test-visibility.mjs --api https://mon-site.tld/api/v1 \
 *        --email admin@… --password '…'
 *
 * Contrairement aux gardes-fous statiques, ce script n'inspecte pas le code
 * source : il écrit réellement des réglages par l'API, relit ce que le serveur
 * renvoie, et vérifie que les langues restent indépendantes. Les réglages
 * d'origine sont restaurés à la fin, y compris en cas d'échec.
 *
 * Sans identifiants, seuls les contrôles de lecture sont exécutés.
 */

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
};

const API = argOf('api', process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const EMAIL = argOf('email', process.env.ADMIN_EMAIL || '');
const PASSWORD = argOf('password', process.env.ADMIN_PASSWORD || '');
let TOKEN = argOf('token', process.env.ADMIN_TOKEN || '');

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', d: '', x: '' };

let passed = 0;
let failed = 0;
const check = (label, ok, detail) => {
  if (ok) { passed += 1; console.log(`  ${C.g}✅${C.x} ${label}`); }
  else { failed += 1; console.log(`  ${C.r}❌${C.x} ${label}${detail ? ` — ${detail}` : ''}`); }
};

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: body?.data ?? body };
}

const lire = async (locale) => (await api(`/public/visibility?locale=${locale}`)).data;

async function main() {
  console.log(`${C.b}Visibilité par langue${C.x}`);
  console.log(`API : ${API}\n`);

  const sonde = await api('/public/visibility?locale=fr');
  if (!sonde.ok) {
    console.log(`${C.r}Serveur injoignable ou route absente (HTTP ${sonde.status}).${C.x}`);
    console.log(`${C.d}Démarrez l'API, puis relancez.${C.x}`);
    process.exit(1);
  }

  console.log(`${C.b}Lecture publique${C.x}`);
  check('la lecture ne demande pas de jeton', sonde.ok);
  check('la réponse est un dictionnaire', sonde.data && typeof sonde.data === 'object' && !Array.isArray(sonde.data));
  for (const l of ['fr', 'en', 'ar']) {
    const v = await lire(l);
    check(`« ${l} » répond`, v && typeof v === 'object');
  }

  if (!TOKEN && EMAIL && PASSWORD) {
    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    TOKEN = login.data?.accessToken || login.data?.access_token || '';
  }

  console.log(`\n${C.b}Protection en écriture${C.x}`);
  const jetonSauve = TOKEN;
  TOKEN = '';
  const anonyme = await api('/visibility/fr', { method: 'PATCH', body: JSON.stringify({ key: 'footer.events', on: false }) });
  check("l'écriture anonyme est refusée", anonyme.status === 401 || anonyme.status === 403, `HTTP ${anonyme.status}`);
  TOKEN = jetonSauve;

  if (!TOKEN) {
    console.log(`\n${C.y}Sans identifiants : contrôles d'écriture ignorés.${C.x}`);
    console.log(`${C.d}Ajoutez --email et --password pour les exécuter.${C.x}`);
    console.log(`\n${passed} contrôle(s) réussi(s), ${failed} échec(s).`);
    process.exit(failed ? 1 : 0);
  }

  // Sauvegarde pour restauration finale.
  const avant = { fr: await lire('fr'), en: await lire('en'), ar: await lire('ar') };

  try {
    console.log(`\n${C.b}Indépendance des langues${C.x}`);
    await api('/visibility/fr', { method: 'POST', body: JSON.stringify({ overrides: {} }) });
    await api('/visibility/ar', { method: 'POST', body: JSON.stringify({ overrides: {} }) });

    const ecrit = await api('/visibility/fr', { method: 'PATCH', body: JSON.stringify({ key: 'footer.events', on: false }) });
    check("l'écriture authentifiée est acceptée", ecrit.ok, `HTTP ${ecrit.status}`);
    check('fr porte bien le réglage', (await lire('fr'))['footer.events'] === false);
    check('ar n’est PAS affecté', (await lire('ar'))['footer.events'] === undefined);
    check('en n’est PAS affecté', (await lire('en'))['footer.events'] === undefined);

    console.log(`\n${C.b}Persistance${C.x}`);
    check('le réglage survit à une relecture', (await lire('fr'))['footer.events'] === false);

    console.log(`\n${C.b}Copie entre langues${C.x}`);
    const copie = await api('/visibility/copy/all', { method: 'POST', body: JSON.stringify({ from: 'fr', to: ['ar'] }) });
    check('la copie répond', copie.ok, `HTTP ${copie.status}`);
    check('ar a reçu le réglage', (await lire('ar'))['footer.events'] === false);
    check('en reste intact', (await lire('en'))['footer.events'] === undefined);

    console.log(`\n${C.b}Réinitialisation${C.x}`);
    await api('/visibility/ar', { method: 'DELETE' });
    check('ar est revenu aux défauts', Object.keys(await lire('ar')).length === 0);
    check('fr conserve son réglage', (await lire('fr'))['footer.events'] === false);

    console.log(`\n${C.b}Robustesse${C.x}`);
    const sale = await api('/visibility/fr', {
      method: 'POST',
      body: JSON.stringify({ overrides: { 'footer.events': false, 'clé invalide !': true, nombre: 3 } }),
    });
    const apresSale = await lire('fr');
    check('une clé invalide est ignorée', apresSale['clé invalide !'] === undefined, JSON.stringify(sale.data));
    check('une valeur non booléenne est ignorée', apresSale.nombre === undefined);
    check('la clé valide est conservée', apresSale['footer.events'] === false);
  } finally {
    for (const [locale, value] of Object.entries(avant)) {
      await api(`/visibility/${locale}`, { method: 'POST', body: JSON.stringify({ overrides: value }) });
    }
    console.log(`\n${C.d}Réglages d'origine restaurés.${C.x}`);
  }

  console.log(`\n${passed} contrôle(s) réussi(s), ${failed} échec(s).`);
  if (failed) process.exit(1);
  console.log(`${C.g}Tous les contrôles passent.${C.x}`);
}

main().catch((err) => {
  console.error(`${C.r}Échec : ${err.message}${C.x}`);
  process.exit(1);
});
