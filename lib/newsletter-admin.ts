/**
 * Accès à la liste d'abonnement depuis le back-office et depuis les
 * formulaires de la vitrine.
 *
 * Le même écran fonctionne avec ou sans CMS : la passerelle
 * `/api/admin/newsletter` choisit le stockage et le renvoie avec `stored`.
 */
'use client';

import { readAdminAccess } from '@/lib/admin-session';

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  locale: string;
  status: string;
  source?: string;
  consent?: boolean;
  topics?: string[];
  notes?: string;
  ip?: string;
  userAgent?: string;
  subscribedAt?: string | null;
  unsubscribedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface SubscriberFilters {
  search?: string;
  status?: string;
  locale?: string;
  source?: string;
  trash?: boolean;
}

function headers(): HeadersInit {
  const token = readAdminAccess();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((payload as { message?: string; error?: string } | null)?.message
      || (payload as { error?: string } | null)?.error
      || `Erreur ${res.status}`);
  }
  return payload as T;
}

export function queryFrom(filters: SubscriberFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue;
    params.set(key, value === true ? '1' : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listSubscribers(filters: SubscriberFilters = {}) {
  return send<{ rows: Subscriber[]; stored: 'api' | 'local' }>(`/api/admin/newsletter${queryFrom(filters)}`, {
    headers: headers(),
  });
}

export async function subscriberStats() {
  return send<{ stats: Record<string, number>; stored: 'api' | 'local' }>(
    '/api/admin/newsletter?action=stats',
    { headers: headers() },
  );
}

export async function createSubscriber(payload: Partial<Subscriber> & { email: string }) {
  return send<{ row: Subscriber; stored: 'api' | 'local' }>('/api/admin/newsletter', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
}

export async function updateSubscriber(id: string, patch: Partial<Subscriber>) {
  return send<{ row: Subscriber; stored: 'api' | 'local' }>(
    `/api/admin/newsletter?id=${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) },
  );
}

export async function deleteSubscriber(id: string, hard = false) {
  return send<{ ok: boolean }>(
    `/api/admin/newsletter?id=${encodeURIComponent(id)}${hard ? '&hard=1' : ''}`,
    { method: 'DELETE', headers: headers() },
  );
}

export async function restoreSubscriber(id: string) {
  return send<{ ok: boolean }>(`/api/admin/newsletter?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: headers(),
  });
}

export async function bulkSubscribers(ids: string[], status: string) {
  return send<{ ok: boolean; result: unknown }>('/api/admin/newsletter?action=bulk', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ids, status }),
  });
}

/** Téléchargement du CSV dans le navigateur, jeton d'administration en en-tête. */
export async function downloadSubscribersCsv(filters: SubscriberFilters = {}) {
  const token = readAdminAccess();
  const res = await fetch(`/api/admin/newsletter?action=export${queryFrom(filters).replace(/^\?/, '&')}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('Export impossible');
  const csv = await res.text();
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ côté vitrine */

/** Ce que la passerelle publique dit de CE qui vient de se passer pour l'adresse. */
export type NewsletterStatus =
  | 'created'
  | 'already-subscribed'
  | 'reactivated'
  | 'pending-confirmation'
  | 'captcha-failed'
  | 'invalid-email'
  | 'rate-limited';

export interface SubscribePayload {
  email: string;
  name?: string;
  locale?: string;
  /** Bloc d'origine : `home.newsletter`, `news.detail`, `contact`… */
  source?: string;
  consent?: boolean;
  topics?: string[];
  /** Mot laissé par le visiteur à l'étape de confirmation. */
  notes?: string;
  /** Question anti-spam délivrée par `GET /api/newsletter?action=captcha`. */
  captchaId?: string;
  captchaAnswer?: string;
}

/**
 * Question anti-spam pour le formulaire : l'énoncé et un identifiant, rien de
 * plus. La réponse est comparée côté serveur et le jeton ne sert qu'une fois.
 */
export async function fetchNewsletterCaptcha(): Promise<{ id: string; question: string } | null> {
  const res = await fetch('/api/newsletter?action=captcha', { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { id?: string; question?: string } | null;
  if (!body?.id || !body.question) return null;
  return { id: String(body.id), question: String(body.question) };
}

/**
 * Inscription depuis un bloc de la vitrine.
 *
 * Pas de jeton ici : la route publique n'écrit qu'une adresse consentie. Le
 * message renvoyé distingue la nouvelle inscription de la réactivation d'une
 * adresse déjà connue, ce que le formulaire affiche tel quel.
 */
export async function subscribeToNewsletter(
  payload: SubscribePayload,
): Promise<{ ok: boolean; created: boolean; status?: NewsletterStatus; message?: string }> {
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
    status?: NewsletterStatus;
    result?: { created?: boolean };
  } | null;
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      created: false,
      status: body?.status,
      message: body?.message || 'Inscription impossible. Réessayez.',
    };
  }
  return { ok: true, created: Boolean(body.result?.created), status: body.status };
}

export async function unsubscribeFromNewsletter(payload: { email?: string; token?: string; locale?: string }) {
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, action: 'unsubscribe' }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  return { ok: Boolean(body?.ok) };
}
