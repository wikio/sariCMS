/**
 * /api/applications/notify — les emails d'une candidature.
 *
 * Cette route **n'enregistre rien**. Le dépôt d'une candidature reste
 * volontairement local d'abord (`contexts/ApplicationsContext.tsx` →
 * localStorage), puis synchronisé en arrière-plan par `lib/crm-sync.ts` : c'est
 * ce qui permet à un candidat de postuler hors connexion sans perdre sa ligne —
 * l'ancienne version perdait la candidature entière dès que `POST /applications`
 * répondait 500. Déplacer l'enregistrement ici casserait ce comportement.
 *
 * Elle ne fait donc qu'une chose, que le navigateur ne peut pas faire seul :
 * appliquer la politique du centre de courrier et passer par le transport unique
 * du backend. Deux emails, tous deux désactivables dans Paramètres → Emails :
 *
 * 1. `application_received` — accusé de réception au candidat ;
 * 2. `application_alert` — alerte au recruteur (adresse publiée de l'entreprise).
 *
 * Comme tout point d'entrée public capable de déclencher un envoi, il est gardé
 * par un piège à pourriels, une limite de débit par IP et un captcha vérifié
 * **ici**, à usage unique — sinon un robot pourrait épuiser le plafond d'envoi
 * quotidien et bloquer les emails légitimes.
 *
 * Les envois sont décrochés de la réponse : le candidat n'attend pas le serveur
 * SMTP, et chaque tentative est journalisée dans `data/mail/sent-log.json`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { forwardedIp } from '@/lib/server/cms-or';
import { rateLimited, verifyCaptcha } from '@/lib/contact-captcha';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;
const MAX_TEXT = 2_000;

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
  const phone = String(body.phone || '').trim().slice(0, 40);
  const jobTitle = String(body.jobTitle || '').trim().slice(0, MAX_TEXT);
  const reference = String(body.reference || '').trim().slice(0, 80);
  const locale = String(body.locale || 'fr');

  if (name.length < 2 || !EMAIL_RE.test(email) || !jobTitle || !reference) {
    return NextResponse.json(
      { ok: false, error: 'Nom, adresse e-mail, offre et référence sont requis.' },
      { status: 400 },
    );
  }

  // Captcha vérifié côté serveur, une seule fois. Le formulaire passe
  // `autoVerify={false}` pour que le code ne soit pas consommé avant l'envoi.
  const captchaId = String(body.captchaId || '').trim();
  const captchaAnswer = String(body.captchaAnswer ?? '').trim();
  if (!captchaId || !verifyCaptcha(captchaId, captchaAnswer)) {
    return NextResponse.json(
      { ok: false, error: 'Vérification anti-spam manquante ou incorrecte.' },
      { status: 400 },
    );
  }

  const origin = requestOrigin(req);
  const vars: Record<string, string> = {
    ...(await companyVars(locale, origin)),
    nom_client: name,
    email_client: email,
    telephone_client: phone,
    reference_candidature: reference,
    offre_emploi: jobTitle,
    date_document: new Date().toLocaleDateString(
      locale === 'ar' ? 'ar-DZ' : locale === 'en' ? 'en-GB' : 'fr-FR',
    ),
  };

  const companyEmail = vars.email_societe;
  void (async () => {
    await sendMailCenterEvent({
      event: 'application_received',
      to: email,
      toName: name,
      dedupeKey: `application-${email}-${reference}-application_received`,
      vars,
    });
    // Sans adresse publiée pour l'entreprise, il n'y a personne à prévenir :
    // mieux vaut le journaliser que d'envoyer à une devinette.
    if (companyEmail && EMAIL_RE.test(companyEmail)) {
      await sendMailCenterEvent({
        event: 'application_alert',
        to: companyEmail,
        toName: vars.nom_societe,
        dedupeKey: `application-${reference}-${Date.now()}-application_alert`,
        vars,
    });
    }
  })().catch(() => undefined);

  return NextResponse.json({ ok: true });
}
