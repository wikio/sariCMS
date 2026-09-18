/**
 * /api/register — l'inscription, côté serveur.
 *
 * `contexts/AuthContext.tsx` appelait `POST /users` directement depuis le
 * navigateur, et la page d'inscription ne protégeait le formulaire qu'avec un
 * captcha **généré dans le navigateur** (`components/ImageCaptcha.tsx` tire son
 * code au hasard côté client) : rien n'empêchait un robot de créer des comptes,
 * et surtout le serveur ne voyait jamais passer l'inscription — aucun message de
 * bienvenue ne pouvait partir.
 *
 * Cette route reprend l'appel :
 *
 * 1. piège à pourriels (champ caché `website`) et limite de débit par IP ;
 * 2. captcha vérifié **ici**, à usage unique — mais seulement si le champ arrive,
 *    pour respecter le réglage « captcha du site » de Paramètres → Sécurité ;
 * 3. création du compte via `POST /auth/register` — le seul point d'entrée
 *    public d'inscription ; il force le type à `client`, ouvrir un compte
 *    administrateur ou partenaire reste réservé à `POST /users` ;
 * 4. `user_welcome`, piloté par le centre de courrier et donc désactivable dans
 *    Paramètres → Emails.
 *
 * Le relais ne touche pas à l'authentification : `POST /users` ne renvoie pas de
 * jeton, la connexion reste un geste distinct. Et si le backend ne répond pas,
 * l'erreur remonte telle quelle — `AuthContext` conserve son repli local, aucun
 * email de bienvenue ne part pour un compte qui n'existe pas.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited, verifyCaptcha } from '@/lib/contact-captcha';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;
const MIN_PASSWORD = 10;

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

  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const phone = String(body.phone || '').trim().slice(0, 40);
  const company = String(body.company || '').trim().slice(0, 200);
  const locale = String(body.locale || 'fr');

  if (name.length < 2 || !EMAIL_RE.test(email) || password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: 'Nom, adresse e-mail et mot de passe (10 caractères minimum) sont requis.' },
      { status: 400 },
    );
  }

  // Captcha vérifié côté serveur quand le site en demande un. Le formulaire passe
  // `autoVerify={false}` pour que le code ne soit pas consommé avant l'envoi.
  const captchaId = String(body.captchaId || '').trim();
  const captchaAnswer = String(body.captchaAnswer ?? '').trim();
  if (captchaId && !verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json(
      { ok: false, error: 'Vérification anti-spam manquante ou incorrecte.' },
      { status: 400 },
    );
  }

  const [firstName = '', ...rest] = name.split(' ');
  const payload = {
    email,
    password,
    firstName,
    lastName: rest.join(' '),
    phone: phone || undefined,
    company: company || undefined,
    locale,
  };

  let created: unknown = null;
  try {
    created = await cmsFetch('/auth/register', { method: 'POST', json: payload, timeoutMs: 12_000 });
  } catch (err) {
    // Adresse déjà prise, mot de passe refusé par le backend, service absent :
    // on ne devine pas, on transmet. Aucun email ne part dans ces cas.
    const status = (err as { status?: number })?.status;
    const message = (err as { message?: string })?.message;
    return NextResponse.json(
      { ok: false, error: message || 'Inscription impossible pour le moment.' },
      { status: status && status >= 400 && status < 600 ? status : 502 },
    );
  }

  const origin = requestOrigin(req);
  const vars: Record<string, string> = {
    ...(await companyVars(locale, origin)),
    nom_client: name,
    email_client: email,
    societe_client: company,
    lien_espace_client: origin ? `${origin}/${locale}/dashboard` : '',
  };

  void (async () => {
    await sendMailCenterEvent({
      event: 'user_welcome',
      to: email,
      toName: name,
      dedupeKey: `user-${email}-user_welcome`,
      vars,
    });
  })().catch(() => undefined);

  return NextResponse.json({ ok: true, result: created });
}
