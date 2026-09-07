/**
 * Liste d'abonnement de secours, sans base de données.
 *
 * Le CMS garde les abonnements dans sa table `newsletter_subscribers`. Ce
 * fichier n'intervient que quand l'API n'est pas joignable (développement sans
 * backend, mutualisation sans MySQL) : le formulaire du site ne doit jamais
 * faire perdre une inscription.
 *
 * Une adresse par ligne, en minuscules, et une suppression douce : se
 * désinscrire ne détruit pas l'historique (date de retrait, origine), et la
 * réinscription remet la fiche à jour au lieu de créer un doublon.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type SubscriberStatus = 'pending' | 'subscribed' | 'unsubscribed' | 'bounced' | 'blocked';

export interface SubscriberRow {
  id: string;
  email: string;
  name?: string | null;
  locale: string;
  status: SubscriberStatus | string;
  source?: string | null;
  consent?: boolean;
  topics?: string[];
  notes?: string | null;
  token?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  subscribedAt?: string | null;
  unsubscribedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

interface Store {
  version: number;
  rows: SubscriberRow[];
}

const FILE = path.join(process.cwd(), 'data', 'newsletter.json');

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    if (parsed && Array.isArray(parsed.rows)) return parsed;
  } catch {
    /* fichier absent : liste vide */
  }
  return { version: 1, rows: [] };
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmp, FILE);
}

const ACTIVE_STATUSES = new Set<SubscriberStatus>(['pending', 'subscribed']);

/** Inscription / réinscription. Une adresse connue est réactivée, pas dupliquée. */
/**
 * Inscription / réinscription. Une adresse connue est réactivée, pas dupliquée.
 *
 * `duplicate` signale que l'adresse était déjà active (le formulaire doit le
 * dire plutôt qu'annoncer une nouvelle inscription), `reactivated` qu'elle avait
 * été retirée et revient.
 */
export async function subscribe(input: {
  email: string;
  name?: string;
  locale?: string;
  source?: string;
  consent?: boolean;
  topics?: string[];
  notes?: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ created: boolean; duplicate: boolean; reactivated: boolean; row: SubscriberRow }> {
  const store = await readStore();
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const existing = store.rows.find((row) => row.email === email);
  const fields = {
    email,
    name: input.name?.trim() || existing?.name || null,
    locale: input.locale || existing?.locale || 'fr',
    status: 'subscribed' as SubscriberStatus,
    source: input.source || existing?.source || 'form',
    consent: input.consent ?? existing?.consent ?? true,
    topics: input.topics?.length ? input.topics : existing?.topics,
    notes: input.notes?.trim() || existing?.notes || null,
    ip: input.ip ?? existing?.ip ?? null,
    userAgent: input.userAgent ?? existing?.userAgent ?? null,
    subscribedAt: now,
    unsubscribedAt: null,
    updatedAt: now,
  };

  if (existing) {
    const wasActive = existing.status === 'subscribed' || existing.status === 'pending';
    Object.assign(existing, fields, { deleted: false });
    await writeStore(store);
    return { created: false, duplicate: wasActive, reactivated: !wasActive, row: existing };
  }

  const row: SubscriberRow = {
    id: randomUUID(),
    token: randomUUID(),
    createdAt: now,
    ...fields,
    subscribedAt: now,
  } as SubscriberRow;
  store.rows.unshift(row);
  await writeStore(store);
  return { created: true, duplicate: false, reactivated: false, row };
}

export async function unsubscribe(input: { email?: string; token?: string }) {
  const store = await readStore();
  const email = input.email ? normalizeEmail(input.email) : '';
  const row = store.rows.find(
    (item) => (input.token && item.token === input.token) || (email && item.email === email),
  );
  if (!row) return { done: false as const };
  const now = new Date().toISOString();
  row.status = 'unsubscribed';
  row.unsubscribedAt = now;
  row.updatedAt = now;
  await writeStore(store);
  return { done: true as const, row };
}

/** Confirmation d'une inscription (double opt-in). */
export async function confirmSubscriber(token: string): Promise<SubscriberRow | null> {
  if (!token) return null;
  const store = await readStore();
  const row = store.rows.find((item) => item.token === token);
  if (!row) return null;
  if (row.status !== 'subscribed') {
    const now = new Date().toISOString();
    Object.assign(row, { status: 'subscribed', subscribedAt: now, unsubscribedAt: null, updatedAt: now, deleted: false });
    await writeStore(store);
  }
  return row;
}

export async function listSubscribers(query: {
  search?: string;
  status?: string;
  locale?: string;
  source?: string;
  includeDeleted?: boolean;
} = {}): Promise<SubscriberRow[]> {
  const store = await readStore();
  let rows = store.rows.filter((row) => (query.includeDeleted ? true : !row.deleted));
  if (query.status) rows = rows.filter((row) => row.status === query.status);
  if (query.locale) rows = rows.filter((row) => row.locale === query.locale);
  if (query.source) rows = rows.filter((row) => row.source === query.source);
  const needle = (query.search || '').trim().toLowerCase();
  if (needle) {
    rows = rows.filter((row) =>
      [row.email, row.name, row.notes, row.source].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function createSubscriber(input: Partial<SubscriberRow> & { email: string }): Promise<SubscriberRow> {
  const store = await readStore();
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    token: randomUUID(),
    email,
    name: input.name || null,
    locale: input.locale || 'fr',
    status: ACTIVE_STATUSES.has((input.status || 'subscribed') as SubscriberStatus)
      ? (input.status || 'subscribed')
      : 'subscribed',
    source: input.source || 'admin',
    consent: input.consent ?? true,
    topics: input.topics || [],
    notes: input.notes || null,
    subscribedAt: input.subscribedAt || now,
    unsubscribedAt: input.status === 'unsubscribed' ? now : null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  } as SubscriberRow;
  store.rows.unshift(row);
  await writeStore(store);
  return row;
}

export async function updateSubscriber(id: string, patch: Partial<SubscriberRow>): Promise<SubscriberRow | null> {
  const store = await readStore();
  const row = store.rows.find((item) => item.id === id);
  if (!row) return null;
  if (patch.email) patch = { ...patch, email: normalizeEmail(patch.email) };
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  await writeStore(store);
  return row;
}

/** Corbeille (flag) puis purge définitive sur demande. */
export async function deleteSubscriber(id: string, hard = false): Promise<boolean> {
  const store = await readStore();
  const idx = store.rows.findIndex((item) => item.id === id);
  if (idx < 0) return false;
  if (hard) store.rows.splice(idx, 1);
  else store.rows[idx] = { ...store.rows[idx], deleted: true, updatedAt: new Date().toISOString() };
  await writeStore(store);
  return true;
}

export async function restoreSubscriber(id: string): Promise<boolean> {
  const store = await readStore();
  const row = store.rows.find((item) => item.id === id);
  if (!row) return false;
  row.deleted = false;
  row.updatedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}

export async function bulkStatus(ids: string[], status: string): Promise<number> {
  const store = await readStore();
  const now = new Date().toISOString();
  let done = 0;
  for (const row of store.rows) {
    if (!ids.includes(row.id)) continue;
    if (status === 'delete') {
      row.deleted = true;
    } else {
      row.status = status;
      if (status === 'subscribed') row.subscribedAt = now;
      if (status === 'unsubscribed') row.unsubscribedAt = now;
    }
    row.updatedAt = now;
    done += 1;
  }
  await writeStore(store);
  return done;
}

export async function subscriberStats() {
  const rows = await listSubscribers();
  const out: Record<string, number> = { total: rows.length };
  for (const row of rows) out[row.status] = (out[row.status] || 0) + 1;
  return out;
}

export function toCsv(rows: SubscriberRow[]): string {
  const head = ['email', 'name', 'locale', 'status', 'source', 'consent', 'topics', 'subscribedAt', 'unsubscribedAt', 'notes'];
  const esc = (v: unknown) => {
    const text = Array.isArray(v) ? v.join('|') : v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    head.join(','),
    ...rows.map((row) => head.map((k) => esc((row as unknown as Record<string, unknown>)[k])).join(',')),
  ].join('\n');
}
