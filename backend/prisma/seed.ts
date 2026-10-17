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

  const marker = path.join(dir, '.seeded');
  fs.writeFileSync(marker, now());
  // eslint-disable-next-line no-console
  console.log(`JSON seed written to ${path.resolve(dir)}`);
  // eslint-disable-next-line no-console
  console.log(`Admin: ${email} / ${password}`);
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
