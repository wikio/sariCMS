/**
 * Minimal structural seed — no real catalogue content.
 * Creates roles, the permission catalog, one admin account and empty collections.
 *
 *   DB_DRIVER=json npm run seed
 */
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_PERMISSIONS, EDITOR_SLUG, SUPER_ADMIN_SLUG, VIEWER_SLUG } from '../src/common/constants/permissions';
import { COLLECTIONS } from '../src/common/constants/tokens';
import { JsonStore } from '../src/database/adapters/json/json-store';

const now = () => new Date().toISOString();

function base(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const id = (extra.id as string) || randomUUID();
  return {
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...extra,
    id,
  };
}

async function seedJson() {
  const dir = process.env.JSON_STORE_PATH || './storage/json';
  const store = new JsonStore(dir);

  const permissions = ALL_PERMISSIONS.map((key) => {
    const [resource, action] = key.split(':');
    return base({ resource, action, description: key });
  });

  const superPermIds = permissions.map((p) => p.id);
  const editorPermIds = permissions
    .filter((p) => ['read', 'create', 'update'].includes(String(p.action)))
    .map((p) => p.id);
  const viewerPermIds = permissions.filter((p) => p.action === 'read').map((p) => p.id);

  const superAdmin = base({
    name: 'Super Admin',
    slug: SUPER_ADMIN_SLUG,
    description: 'Accès intégral',
    isSystem: true,
    permissionIds: superPermIds,
  });
  const editor = base({
    name: 'Éditeur',
    slug: EDITOR_SLUG,
    description: 'Lecture / création / mise à jour',
    isSystem: true,
    permissionIds: editorPermIds,
  });
  const viewer = base({
    name: 'Lecteur',
    slug: VIEWER_SLUG,
    description: 'Lecture seule',
    isSystem: true,
    permissionIds: viewerPermIds,
  });

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@sarisysteme.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe_Sari2026!';
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = base({
    email,
    passwordHash,
    firstName: 'Admin',
    lastName: 'SARI',
    type: 'admin',
    status: 'active',
    locale: 'fr',
    roleId: superAdmin.id,
    totpEnabled: false,
    totpSecret: null,
    company: 'SARI Système',
  });

  const demoPeople = [
    { email: 'marie@clinique-saintlouis.fr', firstName: 'Marie', lastName: 'Laurent', phone: '+33 6 12 34 56 78', company: 'Clinique Saint-Louis', type: 'client', status: 'active', address: '12 rue des Lilas, Lyon' },
    { email: 'achats@chu-lyon.fr', firstName: 'Hélène', lastName: 'Moreau', phone: '+33 4 72 11 22 33', company: 'CHU de Lyon', type: 'client', status: 'active', address: '103 Grande Rue de la Croix-Rousse, Lyon' },
    { email: 'secretariat@cabinet-parc.dz', firstName: 'Nassim', lastName: 'Benali', phone: '+213 21 44 55 66', company: 'Cabinet Médical du Parc', type: 'client', status: 'active', address: 'Lotissement El Biar, Alger' },
    { email: 'direction@eliafia.dz', firstName: 'Soraya', lastName: 'Hamidi', phone: '+213 23 11 22 33', company: 'Clinique El Afia', type: 'client', status: 'active', address: 'Route de Staoueli, Alger' },
    { email: 'achats@mustapha.dz', firstName: 'Youcef', lastName: 'Kaci', phone: '+213 21 23 45 67', company: 'CHU Mustapha Pacha', type: 'client', status: 'active', address: 'Place du 1er Mai, Alger' },
    { email: 'contact@ibn-sina.dz', firstName: 'Amine', lastName: 'Cherif', phone: '+213 555 88 21 09', company: 'Laboratoire Ibn Sina', type: 'client', status: 'pending', address: 'Hydra, Alger' },
    { email: 'amina.k@cabinet.dz', firstName: 'Amina', lastName: 'Khelifi', phone: '+213 555 12 34 56', company: 'Cabinet Khelifi', type: 'client', status: 'active', address: 'Bir Mourad Raïs, Alger' },
    { email: 'direction@oran-est.dz', firstName: 'Farid', lastName: 'Messaoudi', phone: '+213 41 33 20 18', company: 'Polyclinique Oran Est', type: 'client', status: 'active', address: 'Bd de l’ALN, Oran' },
    { email: 'achats@ghn.dz', firstName: 'Leila', lastName: 'Saadi', phone: '+213 21 98 76 54', company: 'Groupe Hospitalier Nord', type: 'client', status: 'active', address: 'Bab El Oued, Alger' },
    { email: 'fatima.zahra@email.dz', firstName: 'Fatima', lastName: 'Zahra', phone: '+213 555 567 890', position: 'Technicienne biomédicale', experience: '3 ans — CHU Mustapha', motivation: 'Passionnée par la maintenance des échographes et le SAV terrain.', type: 'candidate', status: 'active' },
    { email: 'karim.boudiaf@email.dz', firstName: 'Karim', lastName: 'Boudiaf', phone: '+213 555 111 222', position: 'Commercial médical', experience: '5 ans — distributeur dispositifs', motivation: 'Portefeuille cliniques privées à Alger et Oran.', type: 'candidate', status: 'pending' },
    { email: 'sara.meziane@email.dz', firstName: 'Sara', lastName: 'Meziane', phone: '+213 555 440 118', position: 'Ingénieure application imagerie', experience: '4 ans — GE Healthcare partenaire', motivation: 'Formations utilisateurs et recette de salles.', type: 'candidate', status: 'active' },
    { email: 'yacine.larbi@email.dz', firstName: 'Yacine', lastName: 'Larbi', phone: '+213 555 902 441', position: 'Technicien autoclaves', experience: '6 ans — bloc opératoire', motivation: 'Spécialiste classe B et qualification IQ/OQ.', type: 'candidate', status: 'active' },
    { email: 'ines.hammoudi@email.dz', firstName: 'Inès', lastName: 'Hammoudi', phone: '+213 555 220 773', position: 'Chargée de clientèle B2B', experience: '2 ans — call center médical', motivation: 'Suivi devis et relance hôpitaux publics.', type: 'candidate', status: 'pending' },
  ].map((person) => base({
    ...person,
    passwordHash,
    locale: 'fr',
    roleId: viewer.id,
  }));

  await store.write(COLLECTIONS.permissions, permissions);
  await store.write(COLLECTIONS.roles, [superAdmin, editor, viewer]);
  await store.write(COLLECTIONS.users, [admin, ...demoPeople]);
  await store.write(COLLECTIONS.refreshTokens, []);
  await store.write(COLLECTIONS.pages, []);
  await store.write(COLLECTIONS.faqs, []);
  await store.write(COLLECTIONS.testimonials, []);
  await store.write(COLLECTIONS.menus, []);
  await store.write(COLLECTIONS.contactInfo, [
    base({
      locale: 'fr',
      company: 'SARI Système',
      tagline: '',
      phone: '',
      email: 'contact@sarisysteme.com',
      address: '',
      hours: '',
      currency: 'DZD',
      logo: '',
      social: {},
    }),
  ]);
  await store.write(COLLECTIONS.contactMessages, []);
  await store.write(COLLECTIONS.translations, []);
  await store.write(COLLECTIONS.auditLogs, []);
  await store.write(COLLECTIONS.settings, [
    base({ key: 'trash.retentionHours', value: 720, group: 'trash' }),
    base({ key: 'maintenance.enabled', value: false, group: 'general' }),
  ]);
  await store.write(COLLECTIONS.news, []);
  await store.write(COLLECTIONS.events, []);
  await store.write(COLLECTIONS.products, []);
  await store.write(COLLECTIONS.services, []);
  await store.write(COLLECTIONS.partners, []);
  await store.write(COLLECTIONS.careers, []);
  await store.write(COLLECTIONS.solutions, []);
  await store.write(COLLECTIONS.hero, []);

  const marker = path.join(dir, '.seeded');
  fs.writeFileSync(marker, now());
  // eslint-disable-next-line no-console
  console.log(`JSON seed written to ${path.resolve(dir)}`);
  // eslint-disable-next-line no-console
  console.log(`Admin: ${email} / ${password}`);
  // eslint-disable-next-line no-console
  console.log('Catalogue vitrine : importé automatiquement au démarrage de l’API si products est vide.');
}

async function main() {
  const driver = (process.env.DB_DRIVER || 'json').toLowerCase();
  if (driver === 'json') {
    await seedJson();
    return;
  }
  // Prisma path — same structure, uses generated client when available.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    for (const key of ALL_PERMISSIONS) {
      const [resource, action] = key.split(':');
      await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action, description: key },
      });
    }
    const all = await prisma.permission.findMany();
    const role = await prisma.role.upsert({
      where: { slug: SUPER_ADMIN_SLUG },
      update: {},
      create: { name: 'Super Admin', slug: SUPER_ADMIN_SLUG, isSystem: true, description: 'Accès intégral' },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: all.map((p: { id: string }) => ({ roleId: role.id, permissionId: p.id })),
    });
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@sarisysteme.com').toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe_Sari2026!';
    await prisma.user.upsert({
      where: { email },
      update: { roleId: role.id, status: 'active' },
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: 'Admin',
        lastName: 'SARI',
        type: 'admin',
        status: 'active',
        roleId: role.id,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Prisma seed done. Admin: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
