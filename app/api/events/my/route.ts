/**
 * /api/events/my — candidatures et participations aux événements de l'utilisateur connecté.
 *
 * Authentifié par jeton Bearer de la vitrine (`sari_front_access`), vérifié auprès
 * du backend `/auth/me` (avec repli vérification JWT locale si le backend est
 * momentanément indisponible). Les inscriptions sont rattachées par adresse e-mail :
 * un visiteur inscrit en tant qu'invité qui crée ensuite son compte client avec le
 * même e-mail retrouve immédiatement ses participations dans son espace personnel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { verifyAccessToken } from '@/lib/admin-auth';
import {
  findRegistrationsByEmail,
  getRegistration,
  linkClientByEmail,
  normalizeEmail,
  updateRegistration,
} from '@/lib/event-registrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function requireFrontUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  if (!token) return null;

  try {
    const me = await cmsFetch<Record<string, unknown>>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 4000,
    });
    const u = (me as { user?: Record<string, unknown> })?.user || me;
    if (u && u.email) {
      return { id: String(u.id || ''), email: normalizeEmail(String(u.email)) };
    }
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) return null;
  }

  const local = await verifyAccessToken(token);
  if (local?.email) {
    return { id: String(local.sub || ''), email: normalizeEmail(local.email) };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await requireFrontUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'NOT_AUTHENTICATED', error: 'Authentification requise.' },
      { status: 401, headers: NO_STORE },
    );
  }

  // Associer automatiquement en base toute candidature portant cet e-mail
  if (user.id) {
    await linkClientByEmail(user.email, user.id).catch(() => 0);
  }

  const registrations = await findRegistrationsByEmail(user.email);
  const rows = registrations.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    eventLegacyId: r.eventLegacyId,
    eventSlug: r.eventSlug,
    eventTitle: r.eventTitle,
    eventDate: r.eventDate,
    eventLocation: r.eventLocation,
    eventType: r.eventType,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    company: r.company,
    position: r.position,
    notes: r.notes,
    status: r.status,
    clientUserId: r.clientUserId ?? null,
    checkedInAt: r.checkedInAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return NextResponse.json(
    {
      ok: true,
      rows,
      registrations: rows,
    },
    { headers: NO_STORE },
  );
}

/** Permet au client connecté d'annuler sa propre participation en attente ou confirmée. */
export async function PATCH(req: NextRequest) {
  const user = await requireFrontUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'NOT_AUTHENTICATED', error: 'Authentification requise.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await req.json().catch(() => null)) as { id?: string; action?: string } | null;
  const id = String(body?.id || '').trim();
  if (!id || body?.action !== 'cancel') {
    return NextResponse.json({ ok: false, error: 'Action invalide.' }, { status: 400, headers: NO_STORE });
  }

  const existing = await getRegistration(id);
  if (!existing || existing.deleted || normalizeEmail(existing.email) !== user.email) {
    return NextResponse.json({ ok: false, error: 'Inscription introuvable.' }, { status: 404, headers: NO_STORE });
  }
  if (existing.status === 'attended') {
    return NextResponse.json(
      { ok: false, error: 'Une participation déjà pointée ne peut pas être annulée.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const updated = await updateRegistration(id, { status: 'cancelled' });
  if (!updated.ok) {
    return NextResponse.json({ ok: false, error: 'Mise à jour impossible.' }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, registration: updated.registration }, { headers: NO_STORE });
}
