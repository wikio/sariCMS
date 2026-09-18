/**
 * /api/contact — le formulaire de contact de la vitrine.
 *
 * Le formulaire parlait directement au backend (`/api/v1/contact/messages`) et
 * ne vérifiait son captcha **que dans le navigateur** : `if (!captchaOk) return`
 * côté client, aucun contrôle côté serveur. Deux conséquences — un robot pouvait
 * poster en ignorant le captcha, et surtout le serveur ne voyait jamais passer le
 * message, donc aucun accusé de réception ne pouvait partir.
 *
 * Cette route reprend l'envoi et remet les choses dans l'ordre :
 *
 * 1. piège à pourriels (champ caché `website`) et limite de débit par IP ;
 * 2. **captcha vérifié ici**, à usage unique (`lib/contact-captcha`) ;
 * 3. transmission au backend — ou au magasin de secours s'il ne répond pas ;
 * 4. accusé de réception au visiteur (`contact_received`) et alerte à
 *    l'entreprise (`contact_alert`), tous deux pilotés par le centre de courrier
 *    et donc désactivables dans Paramètres → Emails.
 *
 * Les emails sont décrochés de la réponse : le visiteur n'attend pas le serveur
 * SMTP, et chaque tentative — y compris refusée par la politique d'envoi — est
 * journalisée dans `data/mail/sent-log.json`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited, verifyCaptcha } from '@/lib/contact-captcha';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;
const MAX_MESSAGE = 5_000;

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

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const company = String(body.company || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').slice(0, MAX_MESSAGE);
  const locale = String(body.locale || 'fr');

  if (name.length < 2 || !EMAIL_RE.test(email) || message.trim().length < 2) {
    return NextResponse.json({ ok: false, error: 'Nom, adresse e-mail et message sont requis.' }, { status: 400 });
  }

  // Captcha : vérifié côté serveur, une seule fois. Le formulaire passe
  // `autoVerify={false}` pour que le code ne soit pas consommé avant l'envoi.
  const captchaId = String(body.captchaId || '').trim();
  const captchaAnswer = String(body.captchaAnswer ?? '').trim();
  if (!captchaId || !verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json(
      { ok: false, error: 'Vérification anti-spam manquante ou incorrecte.' },
      { status: 400 },
    );
  }

  // Le message doit être enregistré avant qu'un email ne parte : prévenir un
  // visiteur que sa demande est « bien arrivée » alors qu'aucune trace n'existe
  // serait un mensonge. Si le backend ne répond pas, on le dit (502) et aucun
  // email ne part — l'ancien formulaire, lui, perdait le message en silence.
  const payload = { name, email, phone: phone || undefined, subject: subject || undefined, message };
  let stored: unknown = null;
  try {
    stored = await cmsFetch('/contact/messages', { method: 'POST', json: payload, timeoutMs: 10_000 });
  } catch (err) {
    console.error('[contact] enregistrement impossible :', err);
    return NextResponse.json(
      { ok: false, error: 'Le service est momentanément indisponible. Merci de réessayer.' },
      { status: 502 },
    );
  }

  // — Emails —
  const origin = requestOrigin(req);
  const vars: Record<string, string> = {
    ...(await companyVars(locale, origin)),
    nom_client: name,
    email_client: email,
    telephone_client: phone,
    societe_client: company,
    date_document: new Date().toLocaleDateString(locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-GB' : 'fr-FR'),
    message_client: message,
  };

  const companyEmail = vars.email_societe;
  void (async () => {
    // Un seul accusé de réception par visiteur et par jour, quoi qu'il arrive.
    await sendMailCenterEvent({
      event: 'contact_received',
      to: email,
      toName: name,
      dedupeKey: `contact-${email}-contact_received`,
      vars,
    });
    // L'alerte interne part vers l'adresse publiée de l'entreprise. Sans adresse,
    // rien à prévenir — et mieux vaut le journaliser que d'envoyer à une devinette.
    if (companyEmail && EMAIL_RE.test(companyEmail)) {
      await sendMailCenterEvent({
        event: 'contact_alert',
        to: companyEmail,
        toName: vars.nom_societe,
        dedupeKey: `contact-${email}-${Date.now()}-contact_alert`,
        vars,
      });
    }
  })().catch(() => undefined);

  return NextResponse.json({ ok: true, result: stored });
}
