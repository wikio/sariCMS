/**
 * POST /api/reset-password — pose le nouveau mot de passe.
 *
 * Relais du point d'entrée public `POST /auth/reset-password`. Aucun captcha
 * ici : le jeton reçu par email est une preuve bien plus forte qu'un captcha
 * (aléatoire, à usage unique, 30 minutes de validité), et en demander un en plus
 * n'ajouterait qu'une étape à quelqu'un qui vient de prouver qui il est. La
 * limite de débit d'ici et le `@Throttle` du backend couvrent la force brute.
 *
 * Contrairement à `/api/forgot-password`, cet appel n'a pas besoin de la clé
 * interne : il ne renvoie rien de sensible, seulement « accepté » ou « refusé ».
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsServerBase } from '@/lib/cms';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited } from '@/lib/contact-captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 15_000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400 });
  }

  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true, silenced: true });
  }

  const ip = forwardedIp(req);
  if (rateLimited(ip, 6)) {
    return NextResponse.json(
      { ok: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Jeton manquant.' }, { status: 400 });
  }

  // Mêmes exigences que `ResetPasswordDto` côté backend : on évite un
  // aller-retour pour un mot de passe que le serveur refusera de toute façon.
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Le mot de passe doit comporter au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.',
      },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cmsServerBase().replace(/\/$/, '')}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Jeton inconnu, déjà consommé ou expiré : même message dans les trois cas.
      // Dire lequel permettrait de sonder la table des jetons.
      return NextResponse.json(
        { ok: false, error: 'Lien invalide ou expiré. Demandez-en un nouveau.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Le service est momentanément indisponible. Merci de réessayer.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
