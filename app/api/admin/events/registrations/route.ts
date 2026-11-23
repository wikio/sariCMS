/**
 * /api/admin/events/registrations — gestion back-office des candidatures et
 * participants aux événements, avec association et création de profil client
 * par adresse e-mail.
 *
 *   GET    /api/admin/events/registrations                 liste filtrée (+ stats optionnelles)
 *   GET    /api/admin/events/registrations?action=stats    compteurs globaux et par événement
 *   GET    /api/admin/events/registrations?action=export   export CSV UTF-8 BOM
 *   GET    /api/admin/events/registrations?email=…         participations d'un client par e-mail
 *   POST   /api/admin/events/registrations                 ajout manuel d'un participant
 *   POST   /api/admin/events/registrations?action=bulk     actions groupées (statut, corbeille, promote_client)
 *   POST   /api/admin/events/registrations?action=promote-client  ajoute/associe comme profil client (via e-mail)
 *   POST   /api/admin/events/registrations?action=sync-clients    synchronise les profils clients existants par e-mail
 *   PATCH  /api/admin/events/registrations?id=…            mise à jour (statut, notes, coordonnées, restauration)
 *   DELETE /api/admin/events/registrations?id=…            mise en corbeille (&hard=1 : suppression définitive)
 */
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch, CmsError, unwrapList } from '@/lib/cms';
import { bearer } from '@/lib/server/cms-or';
import {
  bulkDelete,
  bulkRestore,
  bulkUpdateStatus,
  createRegistration,
  deleteRegistration,
  getRegistration,
  isValidStatus,
  linkClientByEmail,
  listRegistrations,
  normalizeEmail,
  normalizePhone,
  registrationStats,
  registrationsToCsv,
  restoreRegistration,
  splitFullName,
  updateRegistration,
  type EventRegistration,
  type EventRegistrationStatus,
} from '@/lib/event-registrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;

type CmsUser = Record<string, unknown> & {
  id?: string | number;
  email?: string;
  firstName?: string;
  lastName?: string;
  type?: string;
  status?: string;
};

function generateClientPassword(): string {
  // Respecte CreateUserDto (>= 10 car., majuscule, minuscule, chiffre)
  return `SariEv${randomBytes(4).toString('hex')}!9A`;
}

async function findCmsUserByEmail(email: string, token: string | null): Promise<CmsUser | null> {
  if (!token) return null;
  const target = normalizeEmail(email);
  if (!target) return null;
  try {
    const payload = await cmsFetch<unknown>(
      `/users?view=block&limit=100&search=${encodeURIComponent(target)}`,
      { token, timeoutMs: 6000 },
    );
    const list = unwrapList<CmsUser>(payload);
    return list.find((u) => normalizeEmail(String(u.email || '')) === target) || null;
  } catch {
    return null;
  }
}

async function fetchAllCmsUsersMap(token: string | null): Promise<Map<string, CmsUser>> {
  const map = new Map<string, CmsUser>();
  if (!token) return map;
  try {
    for (let page = 1; page <= 10; page += 1) {
      const payload = await cmsFetch<unknown>(
        `/users?view=block&limit=100&page=${page}`,
        { token, timeoutMs: 6000 },
      );
      const list = unwrapList<CmsUser>(payload);
      for (const u of list) {
        const em = normalizeEmail(String(u.email || ''));
        if (em) map.set(em, u);
      }
      if (list.length < 100) break;
    }
  } catch {
    // Backend indisponible : on renvoie la carte partielle/vide sans bloquer
  }
  return map;
}

async function promoteOrLinkClient(
  reg: EventRegistration,
  token: string | null,
  customPassword?: string,
): Promise<
  | { ok: true; mode: 'linked' | 'created'; client: CmsUser; linkedCount: number; tempPassword?: string }
  | { ok: false; status: number; error: string }
> {
  if (!token) {
    return { ok: false, status: 401, error: 'Session administrateur requise pour créer ou associer un profil client.' };
  }
  const email = normalizeEmail(reg.email);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: 'Adresse e-mail invalide sur cette candidature.' };
  }

  // 1. Chercher un profil existant par e-mail
  const existing = await findCmsUserByEmail(email, token);
  if (existing && existing.id !== undefined) {
    const linkedCount = await linkClientByEmail(email, String(existing.id));
    return { ok: true, mode: 'linked', client: existing, linkedCount };
  }

  // 2. Créer un profil client (type: 'client') dans le CMS
  const password = customPassword && customPassword.length >= 10 ? customPassword : generateClientPassword();
  const firstName = (reg.firstName || reg.fullName || 'Participant').trim().slice(0, 80);
  const lastName = (reg.lastName || firstName || 'Client').trim().slice(0, 80);

  try {
    const created = await cmsFetch<CmsUser>('/users', {
      method: 'POST',
      token,
      timeoutMs: 8000,
      json: {
        email,
        password,
        firstName,
        lastName,
        phone: reg.phone || undefined,
        company: reg.company || undefined,
        position: reg.position || undefined,
        type: 'client',
        status: 'active',
        locale: reg.locale || 'fr',
      },
    });
    const uid = created?.id !== undefined ? String(created.id) : '';
    const linkedCount = uid ? await linkClientByEmail(email, uid) : 0;
    return {
      ok: true,
      mode: 'created',
      client: created,
      linkedCount,
      tempPassword: customPassword ? undefined : password,
    };
  } catch (err) {
    // Si le backend renvoie 409 (création concurrente), tenter de rattacher le profil existant
    if (err instanceof CmsError && err.status === 409) {
      const retryExisting = await findCmsUserByEmail(email, token);
      if (retryExisting && retryExisting.id !== undefined) {
        const linkedCount = await linkClientByEmail(email, String(retryExisting.id));
        return { ok: true, mode: 'linked', client: retryExisting, linkedCount };
      }
    }
    const msg = err instanceof CmsError ? err.message : 'Impossible de créer le profil client dans le CMS.';
    const status = err instanceof CmsError && err.status >= 400 && err.status < 500 ? err.status : 502;
    return { ok: false, status, error: msg };
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const action = url.searchParams.get('action') || '';
  const eventId = url.searchParams.get('eventId') || undefined;

  if (action === 'stats') {
    const stats = await registrationStats(eventId);
    return NextResponse.json({ ok: true, stats }, { headers: NO_STORE });
  }

  const filters = {
    eventId,
    status: url.searchParams.get('status') || undefined,
    search: url.searchParams.get('search') || undefined,
    email: url.searchParams.get('email') || undefined,
    clientLinked: (url.searchParams.get('clientLinked') || '') as 'linked' | 'unlinked' | '',
    includeDeleted: url.searchParams.get('trash') === '1',
  };

  let rows = await listRegistrations(filters);

  if (action === 'export') {
    const idsParam = url.searchParams.get('ids');
    if (idsParam) {
      const idSet = new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean));
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const csv = registrationsToCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="participants-evenements-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const stats = await registrationStats(eventId);
  return NextResponse.json({ ok: true, rows, stats }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || '';
  const token = bearer(req);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // 1. Synchronisation automatique avec les profils clients existants (par e-mail)
  if (action === 'sync-clients') {
    const usersMap = await fetchAllCmsUsersMap(token);
    const all = await listRegistrations({ includeDeleted: false });
    let linkedRows = 0;
    const matchedEmails = new Set<string>();
    for (const r of all) {
      if (r.clientUserId) continue;
      const u = usersMap.get(normalizeEmail(r.email));
      if (u && u.id !== undefined) {
        const n = await linkClientByEmail(r.email, String(u.id));
        linkedRows += n;
        matchedEmails.add(normalizeEmail(r.email));
      }
    }
    return NextResponse.json(
      { ok: true, linkedRows, matchedClients: matchedEmails.size, scannedUsers: usersMap.size },
      { headers: NO_STORE },
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400, headers: NO_STORE });
  }

  // 2. Promouvoir / associer une candidature en tant que profil client (par e-mail)
  if (action === 'promote-client') {
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Identifiant requis.' }, { status: 400, headers: NO_STORE });
    }
    const reg = await getRegistration(id);
    if (!reg || reg.deleted) {
      return NextResponse.json({ ok: false, error: 'Candidature introuvable.' }, { status: 404, headers: NO_STORE });
    }
    const customPassword = typeof body.password === 'string' ? body.password.trim() : undefined;
    const outcome = await promoteOrLinkClient(reg, token, customPassword);
    if (!outcome.ok) {
      return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status, headers: NO_STORE });
    }
    const fresh = await getRegistration(id);
    return NextResponse.json(
      {
        ok: true,
        mode: outcome.mode,
        client: outcome.client,
        linkedCount: outcome.linkedCount,
        tempPassword: outcome.tempPassword,
        registration: fresh,
      },
      { headers: NO_STORE },
    );
  }

  // 3. Actions groupées
  if (action === 'bulk') {
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
    const op = String(body.op || '').trim();
    if (!ids.length) {
      return NextResponse.json({ ok: false, error: 'Aucune ligne sélectionnée.' }, { status: 400, headers: NO_STORE });
    }

    if (op === 'status') {
      const status = body.status;
      if (!isValidStatus(status)) {
        return NextResponse.json({ ok: false, error: 'Statut invalide.' }, { status: 400, headers: NO_STORE });
      }
      const count = await bulkUpdateStatus(ids, status);
      return NextResponse.json({ ok: true, count }, { headers: NO_STORE });
    }

    if (op === 'delete') {
      const count = await bulkDelete(ids, Boolean(body.hard));
      return NextResponse.json({ ok: true, count }, { headers: NO_STORE });
    }

    if (op === 'restore') {
      const count = await bulkRestore(ids);
      return NextResponse.json({ ok: true, count }, { headers: NO_STORE });
    }

    if (op === 'promote_client') {
      let created = 0;
      let linked = 0;
      let failed = 0;
      const seenEmails = new Set<string>();
      for (const id of ids) {
        const reg = await getRegistration(id);
        if (!reg || reg.deleted) continue;
        const em = normalizeEmail(reg.email);
        if (seenEmails.has(em)) continue;
        seenEmails.add(em);
        const res = await promoteOrLinkClient(reg, token);
        if (res.ok) {
          if (res.mode === 'created') created += 1;
          else linked += 1;
        } else {
          failed += 1;
        }
      }
      return NextResponse.json({ ok: true, created, linked, failed }, { headers: NO_STORE });
    }

    return NextResponse.json({ ok: false, error: 'Action groupée inconnue.' }, { status: 400, headers: NO_STORE });
  }

  // 4. Ajout manuel d'un participant par l'administrateur
  const eventId = String(body.eventId || '').trim();
  const eventTitle = String(body.eventTitle || '').trim();
  const email = normalizeEmail(String(body.email || ''));
  const phone = String(body.phone || '').trim();
  const rawFirst = String(body.firstName || '').trim();
  const rawLast = String(body.lastName || '').trim();
  const parsed = rawFirst
    ? { firstName: rawFirst, lastName: rawLast, fullName: [rawFirst, rawLast].filter(Boolean).join(' ') }
    : splitFullName(String(body.fullName || body.name || ''));

  if (!eventId || !parsed.fullName || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Événement, nom et adresse e-mail valide sont requis.' },
      { status: 400, headers: NO_STORE },
    );
  }
  if (phone && normalizePhone(phone).length < 7) {
    return NextResponse.json(
      { ok: false, error: 'Numéro de téléphone invalide.' },
      { status: 400, headers: NO_STORE },
    );
  }

  // Associer automatiquement si un profil client existe déjà pour cet e-mail
  const existingUser = await findCmsUserByEmail(email, token);
  const status: EventRegistrationStatus = isValidStatus(body.status) ? body.status : 'confirmed';

  const result = await createRegistration({
    eventId,
    eventLegacyId: body.eventLegacyId ? String(body.eventLegacyId).trim() : undefined,
    eventSlug: body.eventSlug ? String(body.eventSlug).trim() : undefined,
    eventTitle: eventTitle || `Événement #${eventId}`,
    eventDate: body.eventDate ? String(body.eventDate).trim() : undefined,
    eventLocation: body.eventLocation ? String(body.eventLocation).trim() : undefined,
    eventType: body.eventType ? String(body.eventType).trim() : undefined,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    fullName: parsed.fullName,
    email,
    phone,
    company: body.company ? String(body.company) : '',
    position: body.position ? String(body.position) : '',
    notes: body.notes ? String(body.notes) : '',
    adminNotes: body.adminNotes ? String(body.adminNotes) : '',
    locale: body.locale ? String(body.locale) : 'fr',
    status,
    clientUserId: existingUser?.id !== undefined ? String(existingUser.id) : null,
    source: 'admin',
  });

  if (!result.ok) {
    const error =
      result.duplicate === 'both'
        ? 'Un participant est déjà inscrit à cet événement avec cet e-mail et ce téléphone.'
        : result.duplicate === 'email'
          ? 'Un participant est déjà inscrit à cet événement avec cet e-mail.'
          : 'Un participant est déjà inscrit à cet événement avec ce téléphone.';
    return NextResponse.json(
      { ok: false, code: 'DUPLICATE', field: result.duplicate, error },
      { status: 409, headers: NO_STORE },
    );
  }

  // Optionnel : créer immédiatement le profil client si demandé
  let promoted: { mode: 'linked' | 'created'; tempPassword?: string } | undefined;
  if (body.addAsClient && !result.registration.clientUserId) {
    const p = await promoteOrLinkClient(result.registration, token);
    if (p.ok) promoted = { mode: p.mode, tempPassword: p.tempPassword };
  }

  const fresh = (await getRegistration(result.registration.id)) || result.registration;
  return NextResponse.json(
    { ok: true, registration: fresh, promoted },
    { status: 201, headers: NO_STORE },
  );
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Paramètre id requis.' }, { status: 400, headers: NO_STORE });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400, headers: NO_STORE });
  }

  if (body.restore === true) {
    const restored = await restoreRegistration(id);
    if (!restored) {
      return NextResponse.json({ ok: false, error: 'Inscription introuvable.' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, registration: restored }, { headers: NO_STORE });
  }

  if (body.email !== undefined && !EMAIL_RE.test(normalizeEmail(String(body.email)))) {
    return NextResponse.json({ ok: false, error: 'Adresse e-mail invalide.' }, { status: 400, headers: NO_STORE });
  }
  if (body.phone !== undefined && String(body.phone).trim() && normalizePhone(String(body.phone)).length < 7) {
    return NextResponse.json({ ok: false, error: 'Numéro de téléphone invalide.' }, { status: 400, headers: NO_STORE });
  }

  const res = await updateRegistration(id, {
    firstName: body.firstName !== undefined ? String(body.firstName) : undefined,
    lastName: body.lastName !== undefined ? String(body.lastName) : undefined,
    fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
    email: body.email !== undefined ? String(body.email) : undefined,
    phone: body.phone !== undefined ? String(body.phone) : undefined,
    company: body.company !== undefined ? String(body.company) : undefined,
    position: body.position !== undefined ? String(body.position) : undefined,
    notes: body.notes !== undefined ? String(body.notes) : undefined,
    adminNotes: body.adminNotes !== undefined ? String(body.adminNotes) : undefined,
    status: isValidStatus(body.status) ? body.status : undefined,
  });

  if (!res.ok) {
    if ('notFound' in res) {
      return NextResponse.json({ ok: false, error: 'Inscription introuvable.' }, { status: 404, headers: NO_STORE });
    }
    const error =
      res.duplicate === 'both'
        ? 'Un autre participant utilise déjà cet e-mail et ce téléphone pour cet événement.'
        : res.duplicate === 'email'
          ? 'Un autre participant utilise déjà cet e-mail pour cet événement.'
          : 'Un autre participant utilise déjà ce numéro de téléphone pour cet événement.';
    return NextResponse.json({ ok: false, code: 'DUPLICATE', field: res.duplicate, error }, { status: 409, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, registration: res.registration }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Paramètre id requis.' }, { status: 400, headers: NO_STORE });
  }
  const hard = req.nextUrl.searchParams.get('hard') === '1';
  const ok = await deleteRegistration(id, hard);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Inscription introuvable.' }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
