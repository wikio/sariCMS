/**
 * Magasin serveur des candidatures / inscriptions aux événements.
 *
 * Stocké dans `data/event-registrations.json` avec écriture atomique et file
 * d'exclusion (même modèle éprouvé que `lib/newsletter-store.ts`).
 *
 * Garanties métier :
 * - Unicité par événement sur l'adresse e-mail normalisée OU le numéro de
 *   téléphone normalisé (y compris entre versions linguistiques d'un même
 *   événement partageant le même `eventLegacyId`).
 * - Association possible au profil client via l'adresse e-mail (`clientUserId`,
 *   `clientLinkedAt`), appliquée à toutes les candidatures partageant cet e-mail.
 * - Suppression douce (corbeille) et purge définitive.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type EventRegistrationStatus =
  | 'pending'
  | 'confirmed'
  | 'attended'
  | 'waitlist'
  | 'rejected'
  | 'cancelled';

export const EVENT_REGISTRATION_STATUSES: readonly EventRegistrationStatus[] = [
  'pending',
  'confirmed',
  'attended',
  'waitlist',
  'rejected',
  'cancelled',
] as const;

export interface EventRegistration {
  id: string;
  eventId: string;
  eventLegacyId?: string;
  eventSlug?: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  eventType?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  phoneNormalized: string;
  company?: string;
  position?: string;
  notes?: string;
  adminNotes?: string;
  locale: string;
  status: EventRegistrationStatus;
  checkedInAt?: string | null;
  clientUserId?: string | null;
  clientLinkedAt?: string | null;
  clientEmail?: string | null;
  source: 'frontend' | 'admin';
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

interface Store {
  version: number;
  rows: EventRegistration[];
}

function storeFile(): string {
  return process.env.EVENT_REGISTRATIONS_FILE || path.join(process.cwd(), 'data', 'event-registrations.json');
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * Normalise un numéro de téléphone pour la détection de doublons :
 * - ne conserve que les chiffres ;
 * - retire un éventuel préfixe international `00` ;
 * - harmonise le format national algérien (`05/06/07/02/03/04…` sur 10 chiffres)
 *   avec le format international (`213…` sur 12 chiffres) afin que
 *   `0550 12 34 56` et `+213 550 12 34 56` soient reconnus comme identiques.
 */
export function normalizePhone(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && /^0[2-7]/.test(digits)) {
    digits = `213${digits.slice(1)}`;
  }
  return digits;
}

export function splitFullName(fullName: string): { firstName: string; lastName: string; fullName: string } {
  const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { firstName: '', lastName: '', fullName: '' };
  const parts = clean.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName, fullName: clean };
}

export function isValidStatus(value: unknown): value is EventRegistrationStatus {
  return typeof value === 'string' && (EVENT_REGISTRATION_STATUSES as readonly string[]).includes(value);
}

/** Deux fiches concernent le même événement (même id ou même legacyId multilingue). */
export function matchesSameEvent(
  row: Pick<EventRegistration, 'eventId' | 'eventLegacyId'>,
  eventId: string,
  eventLegacyId?: string,
): boolean {
  const aId = String(row.eventId || '').trim();
  const bId = String(eventId || '').trim();
  if (aId && bId && aId === bId) return true;
  const aLeg = String(row.eventLegacyId || '').trim();
  const bLeg = String(eventLegacyId || '').trim();
  if (aLeg && bLeg && aLeg === bLeg) return true;
  if (aLeg && bId && aLeg === bId) return true;
  if (aId && bLeg && aId === bLeg) return true;
  return false;
}

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(storeFile(), 'utf8');
    const parsed = JSON.parse(raw) as Store;
    if (parsed && Array.isArray(parsed.rows)) return parsed;
  } catch {
    /* fichier absent : registre vide */
  }
  return { version: 1, rows: [] };
}

let tmpSeq = 0;

async function writeStore(store: Store): Promise<void> {
  const target = storeFile();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${(tmpSeq += 1)}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

let storeLock: Promise<unknown> = Promise.resolve();

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = storeLock.then(task, task);
  storeLock = run.then(() => undefined, () => undefined);
  return run;
}

export interface RegistrationFilters {
  eventId?: string;
  eventLegacyId?: string;
  status?: string;
  search?: string;
  email?: string;
  clientLinked?: 'linked' | 'unlinked' | '';
  includeDeleted?: boolean;
}

export async function listRegistrations(filters: RegistrationFilters = {}): Promise<EventRegistration[]> {
  const store = await readStore();
  const wantTrash = Boolean(filters.includeDeleted);
  const q = String(filters.search || '').trim().toLowerCase();
  const targetEmail = filters.email ? normalizeEmail(filters.email) : '';

  return store.rows
    .filter((row) => Boolean(row.deleted) === wantTrash)
    .filter((row) => {
      if (filters.eventId || filters.eventLegacyId) {
        if (!matchesSameEvent(row, filters.eventId || '', filters.eventLegacyId)) return false;
      }
      if (filters.status && row.status !== filters.status) return false;
      if (targetEmail && normalizeEmail(row.email) !== targetEmail) return false;
      if (filters.clientLinked === 'linked' && !row.clientUserId) return false;
      if (filters.clientLinked === 'unlinked' && row.clientUserId) return false;
      if (q) {
        const hay = [
          row.fullName,
          row.firstName,
          row.lastName,
          row.email,
          row.phone,
          row.phoneNormalized,
          row.company,
          row.position,
          row.eventTitle,
          row.notes,
          row.adminNotes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getRegistration(id: string): Promise<EventRegistration | null> {
  const store = await readStore();
  return store.rows.find((r) => r.id === id) || null;
}

export async function findRegistrationsByEmail(email: string): Promise<EventRegistration[]> {
  const clean = normalizeEmail(email);
  if (!clean) return [];
  return listRegistrations({ email: clean, includeDeleted: false });
}

export interface CreateRegistrationInput {
  eventId: string;
  eventLegacyId?: string;
  eventSlug?: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  eventType?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  adminNotes?: string;
  locale?: string;
  status?: EventRegistrationStatus;
  clientUserId?: string | null;
  source?: 'frontend' | 'admin';
  ip?: string | null;
  userAgent?: string | null;
}

export type DuplicateKind = 'email' | 'phone' | 'both';

export type CreateRegistrationResult =
  | { ok: true; registration: EventRegistration }
  | { ok: false; duplicate: DuplicateKind; existing: EventRegistration };

function findDuplicate(
  rows: EventRegistration[],
  eventId: string,
  eventLegacyId: string | undefined,
  email: string,
  phoneNormalized: string,
  excludeId?: string,
): { duplicate: DuplicateKind; existing: EventRegistration } | null {
  let emailMatch: EventRegistration | null = null;
  let phoneMatch: EventRegistration | null = null;

  for (const row of rows) {
    if (row.deleted) continue;
    if (excludeId && row.id === excludeId) continue;
    // Une inscription annulée ne bloque pas une nouvelle candidature si le visiteur revient.
    if (row.status === 'cancelled') continue;
    if (!matchesSameEvent(row, eventId, eventLegacyId)) continue;

    if (email && normalizeEmail(row.email) === email) {
      emailMatch = row;
    }
    if (phoneNormalized && row.phoneNormalized && row.phoneNormalized === phoneNormalized) {
      phoneMatch = row;
    }
  }

  if (emailMatch && phoneMatch) {
    return { duplicate: 'both', existing: emailMatch };
  }
  if (emailMatch) {
    return { duplicate: 'email', existing: emailMatch };
  }
  if (phoneMatch) {
    return { duplicate: 'phone', existing: phoneMatch };
  }
  return null;
}

export function createRegistration(input: CreateRegistrationInput): Promise<CreateRegistrationResult> {
  return exclusive(async () => {
    const store = await readStore();
    const email = normalizeEmail(input.email);
    const phone = String(input.phone || '').trim().slice(0, 40);
    const phoneNormalized = normalizePhone(phone);
    const eventId = String(input.eventId || '').trim();
    const eventLegacyId = input.eventLegacyId ? String(input.eventLegacyId).trim() : undefined;

    const dup = findDuplicate(store.rows, eventId, eventLegacyId, email, phoneNormalized);
    if (dup) {
      return { ok: false, duplicate: dup.duplicate, existing: dup.existing };
    }

    const parsed = input.firstName
      ? {
          firstName: String(input.firstName).trim(),
          lastName: String(input.lastName || '').trim(),
          fullName: [input.firstName, input.lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' '),
        }
      : splitFullName(input.fullName || '');

    const now = new Date().toISOString();
    const status: EventRegistrationStatus = isValidStatus(input.status) ? input.status : 'pending';

    // Si une autre inscription portant le même e-mail est déjà associée à un profil client,
    // on hérite automatiquement de cette association.
    const existingLinked = store.rows.find(
      (r) => !r.deleted && normalizeEmail(r.email) === email && r.clientUserId,
    );
    const clientUserId = input.clientUserId || existingLinked?.clientUserId || null;

    const row: EventRegistration = {
      id: randomUUID(),
      eventId,
      eventLegacyId,
      eventSlug: input.eventSlug ? String(input.eventSlug).trim() : undefined,
      eventTitle: String(input.eventTitle || '').trim().slice(0, 200) || `Événement #${eventId}`,
      eventDate: input.eventDate ? String(input.eventDate).trim() : undefined,
      eventLocation: input.eventLocation ? String(input.eventLocation).trim().slice(0, 200) : undefined,
      eventType: input.eventType ? String(input.eventType).trim().slice(0, 80) : undefined,
      firstName: parsed.firstName.slice(0, 80),
      lastName: parsed.lastName.slice(0, 80),
      fullName: parsed.fullName.slice(0, 160),
      email,
      phone,
      phoneNormalized,
      company: input.company ? String(input.company).trim().slice(0, 160) : '',
      position: input.position ? String(input.position).trim().slice(0, 120) : '',
      notes: input.notes ? String(input.notes).trim().slice(0, 2000) : '',
      adminNotes: input.adminNotes ? String(input.adminNotes).trim().slice(0, 2000) : '',
      locale: String(input.locale || 'fr').slice(0, 8),
      status,
      checkedInAt: status === 'attended' ? now : null,
      clientUserId,
      clientLinkedAt: clientUserId ? now : null,
      clientEmail: clientUserId ? email : null,
      source: input.source === 'admin' ? 'admin' : 'frontend',
      ip: input.ip || null,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 300) : null,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    store.rows.unshift(row);
    await writeStore(store);
    return { ok: true, registration: row };
  });
}

export interface UpdateRegistrationPatch {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  adminNotes?: string;
  status?: EventRegistrationStatus;
  clientUserId?: string | null;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  eventType?: string;
}

export type UpdateRegistrationResult =
  | { ok: true; registration: EventRegistration }
  | { ok: false; notFound: true }
  | { ok: false; duplicate: DuplicateKind; existing: EventRegistration };

export function updateRegistration(id: string, patch: UpdateRegistrationPatch): Promise<UpdateRegistrationResult> {
  return exclusive(async () => {
    const store = await readStore();
    const idx = store.rows.findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, notFound: true };

    const cur = store.rows[idx];
    const nextEmail = patch.email !== undefined ? normalizeEmail(patch.email) : cur.email;
    const nextPhone = patch.phone !== undefined ? String(patch.phone).trim().slice(0, 40) : cur.phone;
    const nextPhoneNorm = normalizePhone(nextPhone);
    const nextStatus = patch.status !== undefined && isValidStatus(patch.status) ? patch.status : cur.status;

    if (nextStatus !== 'cancelled' && (nextEmail !== cur.email || nextPhoneNorm !== cur.phoneNormalized)) {
      const dup = findDuplicate(store.rows, cur.eventId, cur.eventLegacyId, nextEmail, nextPhoneNorm, cur.id);
      if (dup) {
        return { ok: false, duplicate: dup.duplicate, existing: dup.existing };
      }
    }

    let firstName = cur.firstName;
    let lastName = cur.lastName;
    let fullName = cur.fullName;
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      firstName = (patch.firstName !== undefined ? String(patch.firstName) : cur.firstName).trim().slice(0, 80);
      lastName = (patch.lastName !== undefined ? String(patch.lastName) : cur.lastName).trim().slice(0, 80);
      fullName = [firstName, lastName].filter(Boolean).join(' ').slice(0, 160);
    } else if (patch.fullName !== undefined) {
      const split = splitFullName(patch.fullName);
      firstName = split.firstName.slice(0, 80);
      lastName = split.lastName.slice(0, 80);
      fullName = split.fullName.slice(0, 160);
    }

    const now = new Date().toISOString();
    let checkedInAt = cur.checkedInAt || null;
    if (nextStatus === 'attended' && !checkedInAt) checkedInAt = now;
    if (nextStatus !== 'attended' && cur.status === 'attended') checkedInAt = null;

    const nextClientId = patch.clientUserId !== undefined ? patch.clientUserId : cur.clientUserId;

    const updated: EventRegistration = {
      ...cur,
      firstName,
      lastName,
      fullName,
      email: nextEmail,
      phone: nextPhone,
      phoneNormalized: nextPhoneNorm,
      company: patch.company !== undefined ? String(patch.company).trim().slice(0, 160) : cur.company,
      position: patch.position !== undefined ? String(patch.position).trim().slice(0, 120) : cur.position,
      notes: patch.notes !== undefined ? String(patch.notes).trim().slice(0, 2000) : cur.notes,
      adminNotes: patch.adminNotes !== undefined ? String(patch.adminNotes).trim().slice(0, 2000) : cur.adminNotes,
      eventTitle: patch.eventTitle !== undefined ? String(patch.eventTitle).trim().slice(0, 200) : cur.eventTitle,
      eventDate: patch.eventDate !== undefined ? String(patch.eventDate).trim() : cur.eventDate,
      eventLocation: patch.eventLocation !== undefined ? String(patch.eventLocation).trim().slice(0, 200) : cur.eventLocation,
      eventType: patch.eventType !== undefined ? String(patch.eventType).trim().slice(0, 80) : cur.eventType,
      status: nextStatus,
      checkedInAt,
      clientUserId: nextClientId ?? null,
      clientLinkedAt: nextClientId ? (cur.clientLinkedAt || now) : null,
      clientEmail: nextClientId ? nextEmail : null,
      updatedAt: now,
    };

    store.rows[idx] = updated;
    await writeStore(store);
    return { ok: true, registration: updated };
  });
}

export function deleteRegistration(id: string, hard = false): Promise<boolean> {
  return exclusive(async () => {
    const store = await readStore();
    const idx = store.rows.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    if (hard) {
      store.rows.splice(idx, 1);
    } else {
      store.rows[idx] = { ...store.rows[idx], deleted: true, updatedAt: new Date().toISOString() };
    }
    await writeStore(store);
    return true;
  });
}

export function restoreRegistration(id: string): Promise<EventRegistration | null> {
  return exclusive(async () => {
    const store = await readStore();
    const idx = store.rows.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    store.rows[idx] = { ...store.rows[idx], deleted: false, updatedAt: new Date().toISOString() };
    await writeStore(store);
    return store.rows[idx];
  });
}

export function bulkUpdateStatus(ids: string[], status: EventRegistrationStatus): Promise<number> {
  return exclusive(async () => {
    const set = new Set(ids);
    const store = await readStore();
    const now = new Date().toISOString();
    let count = 0;
    for (let i = 0; i < store.rows.length; i += 1) {
      if (!set.has(store.rows[i].id)) continue;
      const cur = store.rows[i];
      let checkedInAt = cur.checkedInAt || null;
      if (status === 'attended' && !checkedInAt) checkedInAt = now;
      if (status !== 'attended' && cur.status === 'attended') checkedInAt = null;
      store.rows[i] = { ...cur, status, checkedInAt, updatedAt: now };
      count += 1;
    }
    if (count > 0) await writeStore(store);
    return count;
  });
}

export function bulkDelete(ids: string[], hard = false): Promise<number> {
  return exclusive(async () => {
    const set = new Set(ids);
    const store = await readStore();
    const now = new Date().toISOString();
    let count = 0;
    if (hard) {
      const before = store.rows.length;
      store.rows = store.rows.filter((r) => !set.has(r.id));
      count = before - store.rows.length;
    } else {
      for (let i = 0; i < store.rows.length; i += 1) {
        if (!set.has(store.rows[i].id)) continue;
        store.rows[i] = { ...store.rows[i], deleted: true, updatedAt: now };
        count += 1;
      }
    }
    if (count > 0) await writeStore(store);
    return count;
  });
}

export function bulkRestore(ids: string[]): Promise<number> {
  return exclusive(async () => {
    const set = new Set(ids);
    const store = await readStore();
    const now = new Date().toISOString();
    let count = 0;
    for (let i = 0; i < store.rows.length; i += 1) {
      if (!set.has(store.rows[i].id)) continue;
      store.rows[i] = { ...store.rows[i], deleted: false, updatedAt: now };
      count += 1;
    }
    if (count > 0) await writeStore(store);
    return count;
  });
}

/**
 * Associe toutes les candidatures d'une adresse e-mail à un profil client.
 * Retourne le nombre de fiches mises à jour.
 */
export function linkClientByEmail(email: string, clientUserId: string): Promise<number> {
  return exclusive(async () => {
    const clean = normalizeEmail(email);
    const uid = String(clientUserId || '').trim();
    if (!clean || !uid) return 0;
    const store = await readStore();
    const now = new Date().toISOString();
    let updated = 0;
    for (let i = 0; i < store.rows.length; i += 1) {
      const r = store.rows[i];
      if (normalizeEmail(r.email) !== clean) continue;
      if (r.clientUserId === uid) continue;
      store.rows[i] = {
        ...r,
        clientUserId: uid,
        clientLinkedAt: r.clientLinkedAt || now,
        clientEmail: clean,
        updatedAt: now,
      };
      updated += 1;
    }
    if (updated > 0) await writeStore(store);
    return updated;
  });
}

export interface EventRegistrationStats {
  total: number;
  pending: number;
  confirmed: number;
  attended: number;
  waitlist: number;
  rejected: number;
  cancelled: number;
  linkedClients: number;
  unlinkedClients: number;
  trash: number;
  byEvent: Record<string, { eventId: string; eventTitle: string; total: number; pending: number; confirmed: number; attended: number }>;
}

export async function registrationStats(eventId?: string): Promise<EventRegistrationStats> {
  const store = await readStore();
  const stats: EventRegistrationStats = {
    total: 0,
    pending: 0,
    confirmed: 0,
    attended: 0,
    waitlist: 0,
    rejected: 0,
    cancelled: 0,
    linkedClients: 0,
    unlinkedClients: 0,
    trash: 0,
    byEvent: {},
  };

  for (const row of store.rows) {
    if (eventId && !matchesSameEvent(row, eventId)) continue;
    if (row.deleted) {
      stats.trash += 1;
      continue;
    }
    stats.total += 1;
    if (row.status === 'pending') stats.pending += 1;
    else if (row.status === 'confirmed') stats.confirmed += 1;
    else if (row.status === 'attended') stats.attended += 1;
    else if (row.status === 'waitlist') stats.waitlist += 1;
    else if (row.status === 'rejected') stats.rejected += 1;
    else if (row.status === 'cancelled') stats.cancelled += 1;

    if (row.clientUserId) stats.linkedClients += 1;
    else stats.unlinkedClients += 1;

    const key = row.eventLegacyId || row.eventId;
    if (!stats.byEvent[key]) {
      stats.byEvent[key] = {
        eventId: row.eventId,
        eventTitle: row.eventTitle,
        total: 0,
        pending: 0,
        confirmed: 0,
        attended: 0,
      };
    }
    stats.byEvent[key].total += 1;
    if (row.status === 'pending') stats.byEvent[key].pending += 1;
    if (row.status === 'confirmed') stats.byEvent[key].confirmed += 1;
    if (row.status === 'attended') stats.byEvent[key].attended += 1;
  }

  return stats;
}

/** Protection contre l'injection de formules CSV (Excel / LibreOffice). */
function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function registrationsToCsv(rows: EventRegistration[]): string {
  const headers = [
    'ID',
    'Événement',
    'Date événement',
    'Lieu',
    'Prénom',
    'Nom',
    'Email',
    'Téléphone',
    'Entreprise',
    'Fonction',
    'Statut',
    'Présent le',
    'Profil client ID',
    'Source',
    'Notes',
    'Notes admin',
    'Inscrit le',
  ];
  const lines = [headers.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.eventTitle,
        r.eventDate || '',
        r.eventLocation || '',
        r.firstName,
        r.lastName,
        r.email,
        r.phone,
        r.company || '',
        r.position || '',
        r.status,
        r.checkedInAt || '',
        r.clientUserId || '',
        r.source,
        r.notes || '',
        r.adminNotes || '',
        r.createdAt,
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
}
