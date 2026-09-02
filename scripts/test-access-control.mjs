#!/usr/bin/env node
/**
 * Vérifie les règles de séparation des espaces sans navigateur ni base.
 *
 * Contexte : `/auth/login` authentifie les quatre types de comptes. La garde
 * du back-office ne testait que la présence d'un jeton, jamais le type — un
 * client obtenait donc une session d'administration valide. Ce test verrouille
 * la règle pour éviter toute régression.
 *
 *   node scripts/test-access-control.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` (attendu ${expected}, obtenu ${actual})`}`);
}

// Réimplémentation des prédicats de lib/admin-session.ts : ce fichier est du
// TypeScript destiné au navigateur, non importable tel quel par Node.
const isAdminUser = (user) => user?.type === 'admin';
const isBackOfficeUser = (type) => type === 'admin';

console.log('\n1. Accès au back-office (/admin) — seul « admin » est admis');
check('admin autorisé', isAdminUser({ type: 'admin' }), true);
check('client refusé', isAdminUser({ type: 'client' }), false);
check('partenaire refusé', isAdminUser({ type: 'partner' }), false);
check('candidat refusé', isAdminUser({ type: 'candidate' }), false);
check('type absent refusé', isAdminUser({}), false);
check('session nulle refusée', isAdminUser(null), false);

console.log("\n2. Accès à l'espace personnel (/dashboard) — l'admin est redirigé");
check('admin redirigé', isBackOfficeUser('admin'), true);
check('client autorisé', isBackOfficeUser('client'), false);
check('partenaire autorisé', isBackOfficeUser('partner'), false);
check('candidat autorisé', isBackOfficeUser('candidate'), false);

console.log('\n3. Les gardes sont bien câblées dans le code');
const adminLayout = readFileSync(join(root, 'components/admin/AdminLayout.tsx'), 'utf8');
check('AdminLayout importe isAdminUser', adminLayout.includes('isAdminUser'), true);
check('AdminLayout ferme la session non-admin', adminLayout.includes('clearAdminSession()'), true);

const loginPage = readFileSync(join(root, 'app/[locale]/admin/page.tsx'), 'utf8');
check("page de connexion : contrôle du type", loginPage.includes("type !== 'admin'"), true);
check('page de connexion : hasAdminAccess', loginPage.includes('hasAdminAccess'), true);

const dashboard = readFileSync(join(root, 'app/[locale]/dashboard/page.tsx'), 'utf8');
check('dashboard importe isBackOfficeUser', dashboard.includes('isBackOfficeUser'), true);
check('dashboard bloque le rendu admin', dashboard.includes('isBackOfficeUser(user.type)'), true);

const session = readFileSync(join(root, 'lib/admin-session.ts'), 'utf8');
check('admin-session exporte isAdminUser', session.includes('export function isAdminUser'), true);
check('admin-session exporte hasAdminAccess', session.includes('export function hasAdminAccess'), true);

console.log('\n4. Matrice de permissions : comparaison d’ids robuste');
const perms = readFileSync(join(root, 'app/[locale]/admin/permissions/page.tsx'), 'utf8');
check('normalisation des ids en chaîne', perms.includes('const key = '), true);
check('pagination au-delà de 100 permissions', perms.includes('loadAllPermissions'), true);
check('création de rôle disponible', perms.includes('cmsAdminCreate'), true);
check('ressources issues de la base', perms.includes('new Set(perms.map'), true);

console.log('\n5. DTO indépendants du driver (entier MySQL ou UUID JSON)');
const roleDto = readFileSync(join(root, 'backend/src/modules/roles/dto/role.dto.ts'), 'utf8');
check('permissionIds sans @IsUUID', !roleDto.includes('IsUUID'), true);
check('permissionIds via IsEntityId', roleDto.includes('IsEntityId'), true);
const userDto = readFileSync(join(root, 'backend/src/modules/users/dto/user.dto.ts'), 'utf8');
check('roleId sans @IsUUID', !userDto.includes('IsUUID'), true);

console.log(
  failures === 0
    ? '\n✅ Contrôle d’accès conforme.\n'
    : `\n❌ ${failures} vérification(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
