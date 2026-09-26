/**
 * Catalogue des permissions — source unique des deux générateurs SQL.
 *
 * `RESOURCES` et `ACTIONS` sont LUS dans `src/common/constants/permissions.ts`,
 * qui est ce que le garde des routes vérifie réellement. La liste était recopiée
 * à la main dans `generate-seed.mjs` : quand `home` et `newsletter` ont été
 * ajoutés au backend, le seed ne les a jamais reçus, et les rôles du back-office
 * se sont retrouvés sans droit sur ces écrans. Le lecteur évite que le fossé se
 * rouvre ; il est doublé d'un contrôle, ce fichier échoue si les deux listes ne
 * se couvrent pas exactement.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSTANTS = join(HERE, '../src/common/constants/permissions.ts');

/** Extrait le contenu d'un tableau de chaînes littérales `export const X = […]`. */
function readArray(source, name) {
  const pattern = new RegExp(`export const ${name} = \\[([^\\]]+)\\]`, 'm');
  const match = pattern.exec(source);
  if (!match) throw new Error(`${name} introuvable dans ${CONSTANTS}`);
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

const source = readFileSync(CONSTANTS, 'utf8');

export const ACTIONS = readArray(source, 'ACTIONS');
export const API_RESOURCES = readArray(source, 'RESOURCES');

/** Libellés posés dans la colonne `description`, inchangés depuis le premier seed. */
export const PERM_DESCRIPTIONS = {
  create: 'Créer',
  read: 'Consulter',
  update: 'Modifier',
  delete: 'Supprimer',
  admin: 'Administrer',
};

/**
 * Ordre d'insertion des permissions dans le seed.
 *
 * Les ids de `seed.mysql.sql` sont séquentiels et la table de liaison des rôles
 * les référence : une ressource insérée au milieu décalerait tous les ids suivants.
 * Les nouveautés vont donc EN FIN, et l'ordre historique est figé ici.
 */
export const SEED_ORDER = [
  'users', 'roles', 'permissions', 'pages', 'faqs', 'testimonials', 'menus',
  'contact', 'translations', 'audit', 'settings', 'news', 'events', 'products',
  'services', 'partners', 'careers', 'solutions', 'hero', 'dashboard',
  'orders', 'quotes', 'applications', 'authors', 'home', 'newsletter',
];

const unknown = SEED_ORDER.filter((r) => !API_RESOURCES.includes(r));
const forgotten = API_RESOURCES.filter((r) => !SEED_ORDER.includes(r));
if (unknown.length || forgotten.length) {
  throw new Error(
    `Catalogue de permissions désaligné sur ${CONSTANTS}\n` +
      (unknown.length ? `  inconnues du seed : ${unknown.join(', ')}\n` : '') +
      (forgotten.length ? `  oubliées par le seed : ${forgotten.join(', ')} (à ajouter EN FIN de SEED_ORDER)\n` : ''),
  );
}

export const RESOURCES = SEED_ORDER.slice();

/** Contenu éditorial : l'éditeur le crée, le lit et le modifie. */
export const CONTENT_RESOURCES = [
  'pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products',
  'services', 'partners', 'careers', 'solutions', 'hero', 'translations',
  'authors', 'home',
];

/**
 * Données que l'éditeur ne fait que consulter : l'adresse des abonnés et le
 * journal appartiennent à l'administrateur, la corbeille aussi.
 */
export const CONSULT_ONLY_FOR_EDITOR = ['newsletter', 'contact', 'audit', 'dashboard'];

/** Ce que chaque rôle système reçoit. `true` = l'action est accordée. */
export const ROLE_MATRIX = {
  'super-admin': () => true,
  admin: (resource, action) =>
    !['users', 'roles', 'permissions'].includes(resource) &&
    !(resource === 'audit' && action !== 'read'),
  editor: (resource, action) =>
    (CONTENT_RESOURCES.includes(resource) && ['create', 'read', 'update'].includes(action)) ||
    (CONSULT_ONLY_FOR_EDITOR.includes(resource) && action === 'read'),
  viewer: (resource, action) =>
    action === 'read' &&
    (CONTENT_RESOURCES.includes(resource) || CONSULT_ONLY_FOR_EDITOR.includes(resource)),
};

export const SYSTEM_ROLES = [
  { slug: 'super-admin', name: 'Super Administrateur', desc: 'Accès complet au système (contourne le contrôle de permissions).' },
  { slug: 'admin', name: 'Administrateur', desc: 'Gestion du contenu, du catalogue et des commandes.' },
  { slug: 'editor', name: 'Éditeur de contenu', desc: 'Rédaction et mise à jour du contenu de la vitrine.' },
  { slug: 'viewer', name: 'Lecteur', desc: 'Accès en lecture seule au back-office.' },
];

/** Toutes les clés `resource:action` d'un rôle système. */
export function permKeysFor(slug) {
  const granted = ROLE_MATRIX[slug];
  if (!granted) throw new Error(`Rôle système inconnu : ${slug}`);
  const out = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      if (granted(resource, action)) out.push(`${resource}:${action}`);
    }
  }
  return out;
}

export function permKey(resource, action) {
  return `${resource}:${action}`;
}

export function permDescription(resource, action) {
  return `${PERM_DESCRIPTIONS[action] ?? action} ${resource}`;
}
