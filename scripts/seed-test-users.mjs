#!/usr/bin/env node
/**
 * Crée (ou remet à zéro) un jeu de comptes de test couvrant tous les profils.
 *
 * Objectif : pouvoir vérifier le contrôle d'accès sans fabriquer les comptes à
 * la main. Chaque profil possède son mot de passe, ce qui évite de tester
 * quatre rôles avec le même identifiant et de croire à tort que tout marche.
 *
 * Les mots de passe respectent la règle du serveur (10 caractères minimum,
 * majuscule, minuscule, chiffre) et restent lisibles au téléphone.
 *
 *   node scripts/seed-test-users.mjs --email admin@sarisysteme.com --password '…'
 *
 * Options :
 *   --api      URL de l'API (défaut http://localhost:3001/api/v1)
 *   --dry-run  Affiche le tableau des comptes sans rien écrire
 */

const args = process.argv.slice(2);
const arg = (nom, defaut = '') => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const flag = (nom) => args.includes(`--${nom}`);

const API = arg('api', process.env.API_URL || 'http://localhost:3001/api/v1');
const EMAIL = arg('email', process.env.ADMIN_EMAIL || '');
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || '');
const DRY = flag('dry-run');

/**
 * Jeu de comptes de test.
 *
 * Un mot de passe distinct par profil : si les quatre partageaient le même,
 * une erreur de saisie du type de compte passerait inaperçue puisque la
 * connexion réussirait quand même.
 */
const COMPTES = [
  {
    email: 'test.admin@sarisysteme.com',
    password: 'AdminSari_2026!',
    firstName: 'Amine', lastName: 'TEST-ADMIN',
    type: 'admin', status: 'active', locale: 'fr',
    phone: '(+213) 550 00 00 01', company: 'SARI Système SARL',
    position: 'Administrateur système', wilaya: 'Alger', country: 'Algérie',
    role: 'Accès complet au back-office',
  },
  {
    email: 'test.editeur@sarisysteme.com',
    password: 'Editeur_Sari26!',
    firstName: 'Nadia', lastName: 'TEST-EDITEUR',
    type: 'admin', status: 'active', locale: 'fr',
    phone: '(+213) 550 00 00 02', company: 'SARI Système SARL',
    position: 'Éditrice de contenu', wilaya: 'Alger', country: 'Algérie',
    roleSlug: 'editor',
    role: 'Back-office, contenu uniquement',
  },
  {
    email: 'test.client@clinique-test.dz',
    password: 'ClientSari_26!',
    firstName: 'Clinique', lastName: 'TEST-CLIENT',
    type: 'client', status: 'active', locale: 'fr',
    phone: '(+213) 550 00 00 03', company: 'Clinique de test',
    address: '12 rue des Oliviers, Alger-Centre', wilaya: 'Alger', country: 'Algérie',
    role: 'Espace client : commandes et devis',
  },
  {
    email: 'test.partenaire@meditest.dz',
    password: 'Partner_Sari26!',
    firstName: 'MediTest', lastName: 'TEST-PARTENAIRE',
    type: 'partner', status: 'active', locale: 'fr',
    phone: '(+213) 550 00 00 04', company: 'MediTest Algérie',
    wilaya: 'Oran', country: 'Algérie',
    role: 'Espace revendeur',
  },
  {
    email: 'test.candidat@gmail.com',
    password: 'Candidat_26!Az',
    firstName: 'Yacine', lastName: 'TEST-CANDIDAT',
    // Actif, et non « en attente » : un compte en attente ne peut pas se
    // connecter, l'espace candidat serait alors impossible à tester.
    type: 'candidate', status: 'active', locale: 'fr',
    phone: '(+213) 550 00 00 05',
    position: 'Technicien biomédical', experience: '3 ans en maintenance',
    wilaya: 'Constantine', country: 'Algérie',
    role: 'Espace candidat : candidatures',
  },
  {
    email: 'test.attente@sarisysteme.com',
    password: 'Attente_Sari26!',
    firstName: 'Compte', lastName: 'TEST-ATTENTE',
    type: 'client', status: 'pending', locale: 'fr',
    phone: '(+213) 550 00 00 08',
    wilaya: 'Sétif', country: 'Algérie',
    role: 'En attente : connexion refusée tant que non validé',
  },
  {
    email: 'test.bloque@sarisysteme.com',
    password: 'Bloque_Sari26!',
    firstName: 'Compte', lastName: 'TEST-BLOQUE',
    type: 'client', status: 'blocked', locale: 'fr',
    phone: '(+213) 550 00 00 06',
    wilaya: 'Blida', country: 'Algérie',
    role: 'Doit se voir refuser la connexion',
  },
  {
    email: 'test.english@sarisysteme.com',
    password: 'English_Sari26!',
    firstName: 'John', lastName: 'TEST-EN',
    type: 'client', status: 'active', locale: 'en',
    phone: '(+213) 550 00 00 07', company: 'Test Overseas Ltd',
    country: 'France',
    role: 'Vérifie les e-mails et l’interface en anglais',
  },
];

const vert = (s) => `\x1b[32m${s}\x1b[0m`;
const rouge = (s) => `\x1b[31m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;

function tableau() {
  const l1 = 'Adresse e-mail';
  const l2 = 'Mot de passe';
  const l3 = 'Profil';
  const w1 = Math.max(l1.length, ...COMPTES.map((c) => c.email.length));
  const w2 = Math.max(l2.length, ...COMPTES.map((c) => c.password.length));
  const sep = `+-${'-'.repeat(w1)}-+-${'-'.repeat(w2)}-+-${'-'.repeat(44)}-+`;
  const lignes = [sep, `| ${l1.padEnd(w1)} | ${l2.padEnd(w2)} | ${l3.padEnd(44)} |`, sep];
  for (const c of COMPTES) {
    lignes.push(`| ${c.email.padEnd(w1)} | ${c.password.padEnd(w2)} | ${c.role.slice(0, 44).padEnd(44)} |`);
  }
  lignes.push(sep);
  return lignes.join('\n');
}

/**
 * Extrait la liste d'une réponse d'API.
 *
 * L'enveloppe varie selon l'endpoint : `{data: {data: []}}` pour les listes
 * paginées, `{data: []}` ailleurs. Tester une seule forme renvoyait un
 * tableau vide sans le signaler.
 */
function extraireListe(corps) {
  const candidats = [corps?.data?.data, corps?.data?.items, corps?.data, corps?.items, corps];
  for (const c of candidats) if (Array.isArray(c)) return c;
  return [];
}

async function api(chemin, options = {}, token = '') {
  const res = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const texte = await res.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { ok: res.ok, status: res.status, body: corps };
}

async function main() {
  console.log('\nComptes de test SARI CMS\n');
  console.log(tableau());
  console.log(gris('\nRègle serveur : 10 caractères minimum, une majuscule, une minuscule, un chiffre.'));

  if (DRY) {
    console.log(gris('\n--dry-run : aucun compte créé.\n'));
    return;
  }
  if (!EMAIL || !PASSWORD) {
    console.log(gris('\nAjoutez --email et --password (compte administrateur) pour créer réellement ces comptes.'));
    console.log(gris(`Exemple : node scripts/seed-test-users.mjs --email admin@sarisysteme.com --password '…'\n`));
    return;
  }

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.data?.accessToken || login.body?.accessToken;
  if (!token) {
    console.log(rouge(`\n✗ Connexion impossible (HTTP ${login.status}). Vérifiez les identifiants et que l'API tourne sur ${API}.\n`));
    process.exitCode = 1;
    return;
  }

  // Les rôles sont désignés par leur slug dans la table ci-dessus : leur
  // identifiant numérique change d'une installation à l'autre.
  const rolesRes = await api('/roles?limit=100', {}, token);
  const roles = extraireListe(rolesRes.body);
  const idRole = (slug) => roles.find((r) => r.slug === slug)?.id ?? null;

  // `limit` est plafonné à 100 côté serveur : demander davantage renvoie une
  // erreur 400, et la liste vide qui en résultait faisait recréer des comptes
  // pourtant existants (HTTP 409 à la chaîne).
  const existantsRes = await api('/users?limit=100', {}, token);
  const existants = extraireListe(existantsRes.body);
  if (!existants.length && existantsRes.status >= 400) {
    console.log(rouge(`\n✗ Liste des comptes illisible (HTTP ${existantsRes.status}). Abandon pour ne rien dupliquer.\n`));
    process.exitCode = 1;
    return;
  }

  console.log('');
  let crees = 0;
  let majs = 0;
  for (const c of COMPTES) {
    const { role: _desc, roleSlug, ...donnees } = c;
    if (roleSlug) {
      const rid = idRole(roleSlug);
      if (rid != null) donnees.roleId = rid;
    }
    const deja = existants.find((u) => String(u.email).toLowerCase() === c.email.toLowerCase());
    if (deja) {
      // Compte déjà présent : on remet le mot de passe et le statut attendus,
      // sinon un test précédent ayant bloqué le compte fausserait le suivant.
      const res = await api(`/users/${deja.id}`, { method: 'PATCH', body: JSON.stringify(donnees) }, token);
      if (res.ok) { console.log(`  ${vert('↻')} ${c.email} ${gris('(réinitialisé)')}`); majs += 1; }
      else console.log(`  ${rouge('✗')} ${c.email} — HTTP ${res.status} ${gris(JSON.stringify(res.body?.message || res.body?.details?.message || ''))}`);
    } else {
      const res = await api('/users', { method: 'POST', body: JSON.stringify(donnees) }, token);
      if (res.ok) { console.log(`  ${vert('✓')} ${c.email} ${gris('(créé)')}`); crees += 1; }
      else console.log(`  ${rouge('✗')} ${c.email} — HTTP ${res.status} ${gris(JSON.stringify(res.body?.message || res.body?.details?.message || ''))}`);
    }
  }

  console.log(`\n${crees} compte(s) créé(s), ${majs} réinitialisé(s).`);
  console.log(gris('Le compte « test.bloque » doit refuser la connexion : c’est le comportement attendu.\n'));
}

main().catch((err) => {
  console.error(rouge(`\nErreur : ${err.message}\n`));
  process.exitCode = 1;
});
