/**
 * Minimal structural seed — no real catalogue content.
 * Creates roles, the permission catalog, one admin account and empty collections.
 *
 * À exécuter sur une installation neuve uniquement, avec SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD.
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

async function seedJson(email: string, password: string) {
  const dir = process.env.JSON_STORE_PATH || './storage/json';
  if (fs.existsSync(dir) && fs.readdirSync(dir).some(name => name.endsWith('.json'))) {
    throw new Error(`Amorçage refusé : ${dir} contient déjà des collections JSON. Aucun fichier modifié.`);
  }
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

  const admin = base({
    email,
    passwordHash: await bcrypt.hash(password, 12),
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

  await store.write(COLLECTIONS.permissions, permissions);
  await store.write(COLLECTIONS.roles, [superAdmin, editor, viewer]);
  await store.write(COLLECTIONS.users, [admin]);
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
  await store.write(COLLECTIONS.homeSections, []);
  await store.write(COLLECTIONS.newsletter, []);

  const marker = path.join(dir, '.seeded');
  fs.writeFileSync(marker, now());
  // eslint-disable-next-line no-console
  console.log(`JSON seed written to ${path.resolve(dir)}`);
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.DB_DRIVER) {
    throw new Error('Spécifiez DB_DRIVER avant l’amorçage en production.');
  }
  const driver = (process.env.DB_DRIVER || 'json').toLowerCase();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 16 || password === 'ChangeMe_Sari2026!') {
    throw new Error('Définissez SEED_ADMIN_EMAIL et un SEED_ADMIN_PASSWORD personnel (16 caractères minimum).');
  }
  if (driver === 'json') {
    await seedJson(email, password);
    return;
  }
  if (!['mysql', 'postgres', 'postgresql'].includes(driver)) throw new Error(`Seed non pris en charge pour DB_DRIVER=${driver}.`);
  // Prisma path — same structure, uses generated client when available.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    // Pas de création partielle de droits ou d’écrasement d’un administrateur
    // si une étape échoue. Le client reste une dépendance facultative en JSON.
    type BootstrapTx = Pick<typeof prisma, 'user' | 'permission' | 'role' | 'rolePermission'>;
    await prisma.$transaction(async (tx: BootstrapTx) => {
      if (await tx.user.count() || await tx.role.count() || await tx.permission.count()) {
        throw new Error('Amorçage refusé : les tables de comptes ou de droits ne sont pas vides.');
      }
      await tx.permission.createMany({ data: ALL_PERMISSIONS.map(key => {
        const [resource, action] = key.split(':');
        return { resource, action, description: key };
      }) });
      const permissions: { id: number }[] = await tx.permission.findMany({ select: { id: true } });
      const role = await tx.role.create({ data: {
        name: 'Super Admin', slug: SUPER_ADMIN_SLUG, isSystem: true, description: 'Accès intégral',
        permissionIds: permissions.map(p => p.id),
      } });
      await tx.rolePermission.createMany({ data: permissions.map(p => ({ roleId: role.id, permissionId: p.id })) });
      await tx.user.create({ data: { email, passwordHash, firstName: 'Admin', lastName: 'SARI', type: 'admin', status: 'active', roleId: role.id } });
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
