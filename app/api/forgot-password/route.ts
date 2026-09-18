/**
 * POST /api/forgot-password — demande de réinitialisation de mot de passe.
 *
 * Deux étapes, et l'ordre compte :
 *  1. on demande un jeton au backend (`POST /auth/forgot-password`, fermé par la
 *     clé interne — le jeton ne doit pas être obtenable depuis un navigateur) ;
 *  2. s'il existe un compte actif, on envoie `user_password_reset` avec le lien.
 *
 * La réponse est **identique** que le compte existe ou non : répondre « adresse
 * inconnue » reviendrait à offrir un annuaire des comptes du site.
 */
import { NextRequest, NextResponse } from 'next/server';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited, verifyCaptcha } from '@/lib/contact-captcha';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';
import { internalPost } from '@/lib/server/internal-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s@]+[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;
/** Le jeton reste valable 30 minutes côté backend (`AuthService.RESET_TTL_MS`). */
const MESSAGE =
  'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé. Il est valable une seule fois, pendant 30 minutes.';

interface ForgotResponse {
  found?: boolean;
  token?: string;
  name?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400 });
  }

  // Piège à pourriels : un champ que l'interface ne montre pas.
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

  const email = String(body.email || '').trim().toLowerCase();
  const locale = String(body.locale || 'fr');
  if (!EMAIL_RE.test(email) || email.length > 180) {
    return NextResponse.json({ ok: false, error: 'Adresse e-mail invalide.' }, { status: 400 });
  }

  // Captcha vérifié côté serveur, une seule fois. Ici il compte vraiment : sans
  // lui, un script pourrait faire partir un email de réinitialisation à chaque
  // adresse d'une liste, ce qui est à la fois du harcèlement et un gaspillage du
  // plafond d'envoi quotidien.
  const captchaId = String(body.captchaId || '').trim();
  const captchaAnswer = String(body.captchaAnswer ?? '').trim();
  if (!captchaId || !verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json(
      { ok: false, error: 'Vérification anti-spam manquante ou incorrecte.' },
      { status: 400 },
    );
  }

  const issued = await internalPost<ForgotResponse>('/auth/forgot-password', { email });
  if (!issued.ok) {
    console.warn('[forgot-password] backend indisponible :', issued.error);
    return NextResponse.json(
      { ok: false, error: 'Le service est momentanément indisponible. Merci de réessayer.' },
      { status: 502 },
    );
  }

  // Pas de compte, ou compte inactif : aucun envoi, et surtout la même réponse.
  if (!issued.data?.found || !issued.data.token) {
    return NextResponse.json({ ok: true, message: MESSAGE });
  }

  const origin = requestOrigin(req);
  const lien = `${origin}/${locale}/mot-de-passe-oublie?token=${encodeURIComponent(issued.data.token)}`;

  const vars: Record<string, string> = {
    ...(await companyVars(locale, origin)),
    // Le gabarit s'ouvre sur {{nom_client}} : sans lui, l'email partirait avec
    // un bonjour vide. À défaut de nom, on retombe sur la partie locale.
    nom_client: (issued.data.name || '').trim() || email.split('@')[0],
    email_client: email,
    lien_document: lien,
  };

  // Attendu, contrairement aux accusés de réception des autres formulaires :
  // l'envoi EST le résultat demandé. Une panne SMTP laisse donc une trace dans
  // le journal des envois plutôt qu'un visiteur qui attend un email qui ne
  // viendra jamais sans le savoir.
  const res = await sendMailCenterEvent({
    event: 'user_password_reset',
    to: email,
    dedupeKey: `password-reset-${email}`,
    vars,
  });
  if (!res.sent) {
    console.warn('[forgot-password] envoi non effectué :', res.reason, res.detail);
  }

  return NextResponse.json({ ok: true, message: MESSAGE });
}
