'use client';

/**
 * Messagerie interne (Admin ↔ Clients / Candidats / Partenaires).
 * Chaque « fil » (conversation) est rattaché à un contact (email) et,
 * optionnellement, à un devis ou une commande. Les statuts de lecture
 * sont suivis séparément côté utilisateur et côté admin afin d'afficher
 * les alertes « non lu ».
 */

export type MessageRole = 'admin' | 'user';
export type PersonType = 'client' | 'candidate' | 'partner' | 'other';

export interface ThreadContext {
  kind: 'quote' | 'order' | 'general';
  id?: number;
  ref?: string;
}

export interface ThreadMessage {
  id: string;
  role: MessageRole;
  body: string;
  at: string; // ISO
  readByUser: boolean;
  readByAdmin: boolean;
}

export interface Thread {
  id: string;
  email: string;
  name: string;
  type: PersonType;
  subject: string;
  context: ThreadContext;
  messages: ThreadMessage[];
  createdAt: string;
  updatedAt: string;
}

const KEY = 'sari_threads';

export const THREAD_EVENT = 'sari-threads-changed';

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THREAD_EVENT));
  }
}

export function contextKey(ctx?: ThreadContext): string {
  if (!ctx || ctx.kind === 'general') return 'general';
  return `${ctx.kind}:${ctx.id ?? ctx.ref ?? '?'}`;
}

export function threadIdFor(email: string, ctx?: ThreadContext): string {
  return `${String(email).toLowerCase().trim()}::${contextKey(ctx)}`;
}

export function loadThreads(): Thread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Thread[];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  localStorage.setItem(KEY, JSON.stringify(threads));
  emitChange();
}

export function findThread(email: string, ctx?: ThreadContext): Thread | undefined {
  const id = threadIdFor(email, ctx);
  return loadThreads().find((t) => t.id === id);
}

export function ensureThread(input: {
  email: string;
  name?: string;
  type?: PersonType;
  subject?: string;
  context?: ThreadContext;
}): Thread {
  const threads = loadThreads();
  const id = threadIdFor(input.email, input.context);
  const existing = threads.find((t) => t.id === id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const thread: Thread = {
    id,
    email: String(input.email).toLowerCase().trim(),
    name: input.name || String(input.email),
    type: input.type || 'other',
    subject: input.subject || 'Conversation',
    context: input.context || { kind: 'general' },
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  saveThreads([thread, ...threads]);
  return thread;
}

/** Fils concernant un utilisateur (client, candidat, partenaire…), triés par activité. */
export function threadsForUser(email: string): Thread[] {
  return loadThreads()
    .filter((t) => t.email === String(email).toLowerCase().trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Nombre de messages non lus par l'utilisateur (envoyés par l'admin). */
export function unreadForUser(email: string): number {
  return threadsForUser(email).reduce(
    (sum, t) => sum + t.messages.filter((m) => m.role === 'admin' && !m.readByUser).length,
    0,
  );
}

/** Nombre de messages non lus par l'admin (envoyés par les utilisateurs). */
export function unreadForAdmin(): number {
  return loadThreads().reduce(
    (sum, t) => sum + t.messages.filter((m) => m.role === 'user' && !m.readByAdmin).length,
    0,
  );
}

export function unreadForThread(thread: Thread, role: MessageRole): number {
  return thread.messages.filter(
    (m) => m.role !== role && (role === 'admin' ? !m.readByAdmin : !m.readByUser),
  ).length;
}

export function sendMessage(threadId: string, role: MessageRole, body: string): Thread | undefined {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const message: ThreadMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    body,
    at: now,
    readByUser: role === 'user',
    readByAdmin: role === 'admin',
  };
  const next: Thread = {
    ...threads[idx],
    messages: [...threads[idx].messages, message],
    updatedAt: now,
  };
  saveThreads(threads.map((t) => (t.id === threadId ? next : t)));
  return next;
}

export function markThreadRead(threadId: string, role: MessageRole) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) return;
  const thread = threads[idx];
  const changed = thread.messages.some(
    (m) => m.role !== role && (role === 'admin' ? !m.readByAdmin : !m.readByUser),
  );
  if (!changed) return;
  const messages = thread.messages.map((m) =>
    m.role !== role
      ? { ...m, ...(role === 'admin' ? { readByAdmin: true } : { readByUser: true }) }
      : m,
  );
  saveThreads(threads.map((t) => (t.id === threadId ? { ...t, messages } : t)));
}

export function deleteThread(threadId: string) {
  saveThreads(loadThreads().filter((t) => t.id !== threadId));
}

export function threadLabel(t: Thread): string {
  if (t.context.kind === 'quote') return t.context.ref || `Devis #${t.context.id ?? ''}`;
  if (t.context.kind === 'order') return `Commande #${t.context.id ?? ''}`;
  return '';
}
