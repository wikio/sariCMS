#!/usr/bin/env node
// scripts/test-event-registrations.mjs
// Contrôles unitaires + câblage de la gestion des participations aux événements.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${label} — ${err?.message || err}`);
    failed++;
  }
}

// Charger le magasin avec un fichier temporaire isolé pour ne jamais salir data/
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sari-evreg-'));
process.env.EVENT_REGISTRATIONS_FILE = path.join(tmpDir, 'event-registrations.json');

const store = await import('../lib/event-registrations.ts');
const captcha = await import('../lib/event-captcha.ts');

console.log('\n— Normalisation & unicité (e-mail / téléphone / inter-langue) —');

await test('normalizeEmail met en minuscules et supprime les espaces', () => {
  assert.equal(store.normalizeEmail('  Alice.Dupont@Example.COM '), 'alice.dupont@example.com');
});

await test('normalizePhone unifie les numéros algériens 05… et +2135…', () => {
  assert.equal(store.normalizePhone('0555 12 34 56'), '213555123456');
  assert.equal(store.normalizePhone('+213 555-12-34-56'), '213555123456');
  assert.equal(store.normalizePhone('00213 555 12 34 56'), '213555123456');
  assert.equal(store.normalizePhone('0770.11.22.33'), '213770112233');
  assert.equal(store.normalizePhone('+33 6 12 34 56 78'), '33612345678');
});

let reg1;
await test('createRegistration persiste une première candidature', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-fr-42',
    eventLegacyId: '42',
    eventSlug: 'salon-industrie-alger',
    eventTitle: 'Salon Industrie Alger',
    eventDate: '2026-12-10T09:00:00Z',
    eventLocation: 'SAFEX Alger',
    eventType: 'Salon',
    fullName: 'Amine Benali',
    email: 'Amine.Benali@Example.dz',
    phone: '0555 12 34 56',
    company: 'Sari Test',
    position: 'Directeur Technique',
    notes: 'Stand B12',
    locale: 'fr',
  });
  assert.equal(res.ok, true);
  reg1 = res.registration;
  assert.equal(reg1.email, 'amine.benali@example.dz');
  assert.equal(reg1.phoneNormalized, '213555123456');
  assert.equal(reg1.firstName, 'Amine');
  assert.equal(reg1.lastName, 'Benali');
  assert.equal(reg1.status, 'pending');
  assert.equal(fs.existsSync(process.env.EVENT_REGISTRATIONS_FILE), true);
});

await test('refuse un doublon sur le même e-mail pour le même événement (casse insensible)', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-fr-42',
    eventTitle: 'Salon Industrie Alger',
    fullName: 'Autre Nom',
    email: 'AMINE.BENALI@example.dz',
    phone: '0661 99 88 77',
  });
  assert.equal(res.ok, false);
  assert.equal(res.duplicate, 'email');
});

await test('refuse un doublon sur le même téléphone (+213 vs 05…)', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-fr-42',
    eventTitle: 'Salon Industrie Alger',
    fullName: 'Autre Personne',
    email: 'autre@example.dz',
    phone: '+213 555-12-34-56',
  });
  assert.equal(res.ok, false);
  assert.equal(res.duplicate, 'phone');
});

await test('refuse un doublon e-mail + téléphone simultanément', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-fr-42',
    eventTitle: 'Salon Industrie Alger',
    fullName: 'Amine Benali',
    email: 'amine.benali@example.dz',
    phone: '00213555123456',
  });
  assert.equal(res.ok, false);
  assert.equal(res.duplicate, 'both');
});

await test('refuse un doublon inter-langue via eventLegacyId', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-en-42',
    eventLegacyId: '42',
    eventTitle: 'Algiers Industry Fair',
    fullName: 'Amine Benali',
    email: 'amine.benali@example.dz',
    phone: '0770 00 11 22',
    locale: 'en',
  });
  assert.equal(res.ok, false);
  assert.equal(res.duplicate, 'email');
});

let reg2;
await test('autorise le même e-mail et téléphone sur un autre événement', async () => {
  const res = await store.createRegistration({
    eventId: 'ev-fr-99',
    eventLegacyId: '99',
    eventTitle: 'Webinaire Sécurité',
    fullName: 'Amine Benali',
    email: 'amine.benali@example.dz',
    phone: '0555 12 34 56',
  });
  assert.equal(res.ok, true);
  reg2 = res.registration;
});

console.log('\n— Association client par e-mail, cycle de vie & CSV —');

await test('linkClientByEmail rattache toutes les participations portant cet e-mail', async () => {
  const count = await store.linkClientByEmail('AMINE.BENALI@example.dz', 'client-uuid-777');
  assert.equal(count, 2);
  const mine = await store.listRegistrations({ email: 'amine.benali@example.dz' });
  assert.equal(mine.length, 2);
  assert.ok(mine.every((r) => r.clientUserId === 'client-uuid-777'));
});

await test('updateRegistration passe à attended et renseigne checkedInAt', async () => {
  const updated = await store.updateRegistration(reg1.id, { status: 'attended', adminNotes: 'Badge remis' });
  assert.equal(updated.ok, true);
  assert.equal(updated.registration.status, 'attended');
  assert.ok(updated.registration.checkedInAt);
  assert.equal(updated.registration.adminNotes, 'Badge remis');
});

await test('une candidature annulée ou en corbeille ne bloque plus une nouvelle inscription', async () => {
  const del = await store.deleteRegistration(reg2.id, false);
  assert.equal(del, true);
  const again = await store.createRegistration({
    eventId: 'ev-fr-99',
    eventLegacyId: '99',
    eventTitle: 'Webinaire Sécurité',
    fullName: 'Amine Benali',
    email: 'amine.benali@example.dz',
    phone: '0555 12 34 56',
  });
  assert.equal(again.ok, true);
  await store.deleteRegistration(again.registration.id, true);
  const restored = await store.restoreRegistration(reg2.id);
  assert.ok(restored && restored.deleted === false);
});

await test('registrationsToCsv neutralise les formules Excel (=, +, -, @)', async () => {
  const risky = await store.createRegistration({
    eventId: 'ev-csv-1',
    eventTitle: '=CMD|calc',
    fullName: '+BadName',
    email: 'csv.test@example.dz',
    phone: '0551 22 33 44',
    company: '@Injected',
  });
  assert.equal(risky.ok, true);
  const csv = store.registrationsToCsv([risky.registration]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=CMD|calc"));
  assert.ok(csv.includes("'+BadName"));
  assert.ok(csv.includes("'@Injected"));
});

console.log('\n— Anti-robot serveur (captcha & rate-limit) —');

await test('captcha serveur : création, SVG, vérification à usage unique et rejet replay', () => {
  const issued = captcha.issueCaptcha();
  assert.ok(issued.id && issued.imageUrl.includes('/api/events/captcha?id='));
  const svg = captcha.captchaImage(issued.id);
  assert.ok(svg && svg.includes('<svg') && svg.includes('</svg>'));
  assert.equal(captcha.verifyCaptcha(issued.id, 'WRONG'), false);
  // Extraire les 5 caractères rendus dans les balises <text> du SVG
  const chars = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]).join('');
  assert.equal(chars.length, 5);
  assert.equal(captcha.verifyCaptcha(issued.id, chars.toLowerCase()), true);
  // Rejeu refusé
  assert.equal(captcha.verifyCaptcha(issued.id, chars), false);
});

await test('rateLimited bloque après dépassement de la fenêtre', () => {
  const ip = 'test-ip-rate-limit';
  for (let i = 0; i < 3; i += 1) assert.equal(captcha.rateLimited(ip, 3, 60_000), false);
  assert.equal(captcha.rateLimited(ip, 3, 60_000), true);
});

console.log('\n— Câblage routes, CSRF, UI & traductions —');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

await test('lib/csrf.ts exempte /api/events/captcha et /api/events/register', () => {
  const src = read('lib/csrf.ts');
  assert.ok(src.includes("'/api/events/captcha'"));
  assert.ok(src.includes("'/api/events/register'"));
});

await test('app/api/register/route.ts rattache automatiquement les candidatures événement par e-mail', () => {
  const src = read('app/api/register/route.ts');
  assert.ok(src.includes('linkClientByEmail'));
});

await test('page événement utilise ServerCaptcha + /api/events/register et ne pointe plus vers /evenements', () => {
  const src = read('app/[locale]/events/[id]/page.tsx');
  assert.ok(src.includes('ServerCaptcha'));
  assert.ok(src.includes('endpoint="/api/events/captcha"'));
  assert.ok(src.includes("'/api/events/register'"));
  assert.ok(src.includes('DUPLICATE_EMAIL'));
  assert.ok(src.includes('DUPLICATE_PHONE'));
  assert.equal(src.includes('/evenements'), false);
});

await test('dashboard client expose l’onglet Événements branché sur /api/events/my', () => {
  const src = read('app/[locale]/dashboard/page.tsx');
  assert.ok(src.includes("id: 'events'"));
  assert.ok(src.includes("'/api/events/my'"));
});

await test('AdminLayout expose l’entrée CRM Participations événements avant /admin/events', () => {
  const src = read('components/admin/AdminLayout.tsx');
  assert.ok(src.includes("id: 'event-registrations'"));
  assert.ok(src.includes('/admin/events/registrations'));
  assert.ok(src.indexOf('/admin/events/registrations') < src.indexOf("item.id !== 'events'"));
});

await test('fiches client (PeopleDesk + UserSheet) affichent les participations aux événements', () => {
  assert.ok(read('components/admin/PeopleDesk.tsx').includes('listEventRegistrations'));
  assert.ok(read('components/admin/UserSheet.tsx').includes('listEventRegistrations'));
});

await test('traductions FR/EN/AR contiennent admin.eventRegistrations, menu, eventDetail et dashboard', () => {
  for (const locale of ['fr', 'en', 'ar']) {
    const msg = JSON.parse(read(`messages/${locale}.json`));
    assert.ok(msg.admin?.menu?.eventRegistrations, `${locale}: admin.menu.eventRegistrations`);
    assert.ok(msg.admin?.eventRegistrations?.title, `${locale}: admin.eventRegistrations.title`);
    assert.ok(msg.admin?.eventRegistrations?.addAsClient, `${locale}: admin.eventRegistrations.addAsClient`);
    assert.ok(msg.pages?.eventDetail?.captchaLabel, `${locale}: pages.eventDetail.captchaLabel`);
    assert.ok(msg.pages?.eventDetail?.duplicatePhone, `${locale}: pages.eventDetail.duplicatePhone`);
    assert.ok(msg.pages?.dashboard?.eventsTab, `${locale}: pages.dashboard.eventsTab`);
  }
});

// Nettoyage du répertoire temporaire
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${passed} contrôle(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
console.log('✅ Tous les contrôles participations événements passent.');
