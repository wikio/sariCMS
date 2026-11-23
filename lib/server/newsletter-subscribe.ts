/** Après validation du captcha newsletter, ou après acceptation du message de contact. */
import { after } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';
import { subscribe } from '@/lib/newsletter-store';
import { cmsOr, forwardedIp, userAgent } from './cms-or';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export async function subscribeFromForm(payload: Parameters<typeof subscribe>[0], req: Request) {
  const { email } = payload;
  const result = await cmsOr(
    () => cmsFetch('/public/newsletter', {
      method: 'POST',
      json: { ...payload, ip: forwardedIp(req), userAgent: userAgent(req) },
      timeoutMs: 8000,
    }),
    () => subscribe({ ...payload, ip: forwardedIp(req), userAgent: userAgent(req) }),
  );

  // `cmsFetch` rend la réponse de l'API, `subscribe` la sienne : les deux sont
  // réduites au même vocabulaire pour que le composant n'ait qu'un `status`.
  const value = (result.value || {}) as {
    created?: boolean;
    duplicate?: boolean;
    reactivated?: boolean;
    row?: { status?: string };
    subscriber?: { status?: string };
  };
  const rowStatus = String(value.subscriber?.status || value.row?.status || '');
  const status = rowStatus === 'pending'
    ? 'pending-confirmation'
    : value.duplicate
      ? 'already-subscribed'
      : value.reactivated
        ? 'reactivated'
        : value.created === false
          ? 'already-subscribed'
          : 'created';

  // — Accusé de réception : un seul email, à la première inscription —
  //
  // `created` uniquement : une réinscription ou une adresse déjà présente ne
  // redéclenche rien, et la clé `newsletter-<adresse>-newsletter_welcome` rend
  // l'envoi idempotent quoi qu'il arrive. Le consentement est vérifié ici, pas
  // supposé : sans lui, aucun email ne part. L'envoi est décroché de la réponse
  // (le visiteur n'attend pas le serveur SMTP) mais journalisé dans
  // `data/mail/sent-log.json`, succès comme échec.
  if (status === 'created' && payload.consent === true && EMAIL_RE.test(email)) {
    const origin = requestOrigin(req);
    const token = String((value.subscriber as { token?: string } | undefined)?.token || '');
    const locale = String(payload.locale || 'fr');
    const unsubscribe = token
      ? `${origin}/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
      : `${origin}/${locale}/newsletter`;
    after(async () => {
      const vars: Record<string, string> = {
        ...(await companyVars(locale, origin)),
        nom_client: payload.name || email,
        email_client: email,
        lien_desinscription: unsubscribe,
      };
      await sendMailCenterEvent({
        event: 'newsletter_welcome',
        to: email,
        toName: payload.name || undefined,
        dedupeKey: `newsletter-${email}-newsletter_welcome`,
        vars,
      });
    });
  }

  return {
    ok: true,
    stored: result.via,
    status,
    result: {
      created: value.created === true,
      duplicate: value.duplicate === true || status === 'already-subscribed',
      reactivated: value.reactivated === true,
    },
  };
}
