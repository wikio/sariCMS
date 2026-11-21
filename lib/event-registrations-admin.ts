/**
 * Client navigateur des candidatures / participants aux événements (back-office).
 */
import { getClientCsrfToken } from '@/lib/csrf';
import type {
  EventRegistration,
  EventRegistrationStats,
  EventRegistrationStatus,
} from '@/lib/event-registrations';

export type { EventRegistration, EventRegistrationStats, EventRegistrationStatus };

export interface EventRegistrationFilters {
  eventId?: string;
  status?: string;
  search?: string;
  email?: string;
  clientLinked?: 'linked' | 'unlinked' | '';
  trash?: boolean;
}

function buildParams(filters: EventRegistrationFilters = {}, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  if (filters.eventId) qs.set('eventId', filters.eventId);
  if (filters.status) qs.set('status', filters.status);
  if (filters.search) qs.set('search', filters.search);
  if (filters.email) qs.set('email', filters.email);
  if (filters.clientLinked) qs.set('clientLinked', filters.clientLinked);
  if (filters.trash) qs.set('trash', '1');
  for (const [k, v] of Object.entries(extra)) {
    if (v) qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

async function adminCall<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('x-csrf-token')) {
    const tok = getClientCsrfToken();
    if (tok) headers.set('x-csrf-token', tok);
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return (data || {}) as T;
}

export function listEventRegistrations(
  filters: EventRegistrationFilters = {},
): Promise<{ ok: boolean; rows: EventRegistration[]; stats: EventRegistrationStats }> {
  return adminCall(`/api/admin/events/registrations${buildParams(filters)}`);
}

export function getEventRegistrationStats(
  eventId?: string,
): Promise<{ ok: boolean; stats: EventRegistrationStats }> {
  return adminCall(`/api/admin/events/registrations${buildParams({ eventId }, { action: 'stats' })}`);
}

export function createEventRegistrationAdmin(payload: {
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
  status?: EventRegistrationStatus;
  locale?: string;
  addAsClient?: boolean;
}): Promise<{
  ok: boolean;
  registration: EventRegistration;
  promoted?: { mode: 'linked' | 'created'; tempPassword?: string };
}> {
  return adminCall('/api/admin/events/registrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEventRegistrationAdmin(
  id: string,
  patch: Partial<EventRegistration> & { restore?: boolean },
): Promise<{ ok: boolean; registration: EventRegistration }> {
  return adminCall(`/api/admin/events/registrations?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteEventRegistrationAdmin(id: string, hard = false): Promise<{ ok: boolean }> {
  return adminCall(
    `/api/admin/events/registrations?id=${encodeURIComponent(id)}${hard ? '&hard=1' : ''}`,
    { method: 'DELETE' },
  );
}

export function bulkEventRegistrations(
  op: 'status' | 'delete' | 'restore' | 'promote_client',
  ids: string[],
  extra: { status?: EventRegistrationStatus; hard?: boolean } = {},
): Promise<{ ok: boolean; count?: number; created?: number; linked?: number; failed?: number }> {
  return adminCall('/api/admin/events/registrations?action=bulk', {
    method: 'POST',
    body: JSON.stringify({ op, ids, ...extra }),
  });
}

export function promoteRegistrationToClient(
  id: string,
  password?: string,
): Promise<{
  ok: boolean;
  mode: 'linked' | 'created';
  client: Record<string, unknown>;
  linkedCount: number;
  tempPassword?: string;
  registration?: EventRegistration;
}> {
  return adminCall('/api/admin/events/registrations?action=promote-client', {
    method: 'POST',
    body: JSON.stringify({ id, ...(password ? { password } : {}) }),
  });
}

export function syncRegistrationClients(): Promise<{
  ok: boolean;
  linkedRows: number;
  matchedClients: number;
  scannedUsers: number;
}> {
  return adminCall('/api/admin/events/registrations?action=sync-clients', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function eventRegistrationsCsvUrl(
  filters: EventRegistrationFilters = {},
  ids?: string[],
): string {
  return `/api/admin/events/registrations${buildParams(filters, {
    action: 'export',
    ...(ids && ids.length ? { ids: ids.join(',') } : {}),
  })}`;
}
