/**
 * /api/events/register — candidature publique pour « Participer à cet événement ».
 *
 * Chaîne de contrôle côté serveur :
 * 1. Piège à pourriels (`website`) et limite de débit par IP ;
 * 2. Validation des champs obligatoires (événement, nom, e-mail, téléphone) ;
 * 3. Vérification anti-robot côté serveur (`lib/event-captcha`, code à usage unique) ;
 * 4. Unicité garantie par événement sur l'e-mail normalisé OU le téléphone normalisé
 *    (`409 Conflict` avec code précis `DUPLICATE_EMAIL`, `DUPLICATE_PHONE`, `DUPLICATE_EMAIL_AND_PHONE`) ;
 * 5. Association automatique au profil client si le visiteur est connecté avec la
 *    même adresse e-mail (jeton Bearer vérifié auprès de `/auth/me`) ;
 * 6. Enregistrement atomique dans `data/event-registrations.json`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited, verifyCaptcha } from '@/lib/event-captcha';
import {
  createRegistration,
  normalizeEmail,
  normalizePhone,
  splitFullName,
} from '@/lib/event-registrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;

async function resolveAuthenticatedUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  if (!token) return null;

  try {
    const me = await cmsFetch<Record<string, unknown>>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 3000,
    });
    const u = (me as { user?: Record<string, unknown> })?.user || me;
    if (u && u.id && u.email) {
      return { id: String(u.id), email: normalizeEmail(String(u.email)) };
    }
  } catch {
    // Ne jamais rattacher un dossier privé sans identité confirmée par le CMS.
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, code: 'INVALID_BODY', error: 'Corps JSON attendu.' },
      { status: 400 },
    );
  }

  // 1. Piège à pourriels (champ caché)
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true, silenced: true });
  }

  // 2. Limite de débit par IP
  const ip = forwardedIp(req);
  if (rateLimited(ip, 8, 5 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  // 3. Validation des données
  const eventId = String(body.eventId || '').trim();
  const eventLegacyId = body.eventLegacyId ? String(body.eventLegacyId).trim() : undefined;
  const eventSlug = body.eventSlug ? String(body.eventSlug).trim() : undefined;
  const eventTitle = String(body.eventTitle || '').trim();
  const eventDate = body.eventDate ? String(body.eventDate).trim() : undefined;
  const eventLocation = body.eventLocation ? String(body.eventLocation).trim() : undefined;
  const eventType = body.eventType ? String(body.eventType).trim() : undefined;

  const rawFirstName = String(body.firstName || '').trim();
  const rawLastName = String(body.lastName || '').trim();
  const rawName = String(body.name || body.fullName || '').trim();
  const parsed = rawFirstName
    ? {
        firstName: rawFirstName,
        lastName: rawLastName,
        fullName: [rawFirstName, rawLastName].filter(Boolean).join(' '),
      }
    : splitFullName(rawName);

  const email = normalizeEmail(String(body.email || ''));
  const phone = String(body.phone || '').trim();
  const phoneNormalized = normalizePhone(phone);
  const company = String(body.company || '').trim();
  const position = String(body.position || '').trim();
  const notes = String(body.notes || '').trim();
  const locale = String(body.locale || 'fr').slice(0, 8);

  if (!eventId) {
    return NextResponse.json(
      { ok: false, code: 'EVENT_REQUIRED', error: 'Événement manquant.' },
      { status: 400 },
    );
  }
  if (parsed.fullName.length < 2) {
    return NextResponse.json(
      { ok: false, code: 'NAME_REQUIRED', error: 'Veuillez renseigner votre nom complet.' },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, code: 'EMAIL_INVALID', error: 'Veuillez saisir une adresse e-mail valide.' },
      { status: 400 },
    );
  }
  if (phoneNormalized.length < 7) {
    return NextResponse.json(
      { ok: false, code: 'PHONE_INVALID', error: 'Veuillez saisir un numéro de téléphone valide.' },
      { status: 400 },
    );
  }

  // 4. Vérification anti-robot (captcha serveur obligatoire)
  const captchaId = String(body.captchaId || '').trim();
  const captchaAnswer = String(body.captchaAnswer || '').trim();
  if (!captchaId || !captchaAnswer || !verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'CAPTCHA_INVALID',
        error: 'Code de vérification anti-robot manquant, incorrect ou expiré.',
      },
      { status: 400 },
    );
  }

  // 5. Si le visiteur est connecté avec le même e-mail, associer immédiatement le profil client
  const authUser = await resolveAuthenticatedUser(req);
  const clientUserId = authUser && authUser.email === email ? authUser.id : null;

  // 6. Enregistrement avec contrôle d'unicité par e-mail OU téléphone
  const result = await createRegistration({
    eventId,
    eventLegacyId,
    eventSlug,
    eventTitle: eventTitle || `Événement #${eventId}`,
    eventDate,
    eventLocation,
    eventType,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    fullName: parsed.fullName,
    email,
    phone,
    company,
    position,
    notes,
    locale,
    status: 'pending',
    clientUserId,
    source: 'frontend',
    ip,
    userAgent: req.headers.get('user-agent') || null,
  });

  if (!result.ok) {
    const code =
      result.duplicate === 'both'
        ? 'DUPLICATE_EMAIL_AND_PHONE'
        : result.duplicate === 'email'
          ? 'DUPLICATE_EMAIL'
          : 'DUPLICATE_PHONE';
    const error =
      result.duplicate === 'both'
        ? 'Une candidature existe déjà pour cet événement avec cette adresse e-mail et ce numéro de téléphone.'
        : result.duplicate === 'email'
          ? 'Une candidature existe déjà pour cet événement avec cette adresse e-mail.'
          : 'Une candidature existe déjà pour cet événement avec ce numéro de téléphone.';

    return NextResponse.json(
      {
        ok: false,
        code,
        field: result.duplicate,
        error,
        existingStatus: result.existing.status,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      registration: {
        id: result.registration.id,
        eventId: result.registration.eventId,
        eventTitle: result.registration.eventTitle,
        fullName: result.registration.fullName,
        email: result.registration.email,
        phone: result.registration.phone,
        status: result.registration.status,
        clientUserId: result.registration.clientUserId,
        createdAt: result.registration.createdAt,
      },
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
