/**
 * Inscription à la newsletter, depuis n'importe quel bloc du site.
 *
 * Le formulaire appelle cette route plutôt que l'API directement : c'est ce
 * qui permet au même composant de fonctionner avec ou sans backend, et de
 * renseigner l'origine de l'inscription (bloc d'accueil, bas d'article, page
 * contact, bandeau construit dans le constructeur de page…).
 *
 * Trois gardes, côté serveur uniquement : le piège à miel `website` (un champ
 * que l'interface ne montre pas), une limite de débit par adresse IP et une
 * question anti-spam à usage unique délivrée par `?action=captcha`. Le
 * formulaire du site passe par ces trois filtres ; un bandeau écrit à la main
 * dans le constructeur de page doit donc demander une question avant d'envoyer.
 *
 * La réponse porte un `status` — `created`, `already-subscribed`, `reactivated`
 * ou `pending-confirmation` — pour que le visiteur sache ce qui vient de se
 * passer pour SON adresse au lieu d'un message générique.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { cmsOr, forwardedIp, userAgent } from '@/lib/server/cms-or';
import { issueCaptcha, rateLimited, verifyCaptcha } from '@/lib/newsletter-captcha';
import { confirmSubscriber, subscribe, unsubscribe } from '@/lib/newsletter-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Formulaires qui ont déjà leur propre contrôle anti-spam côté page. */
const EXEMPT_SOURCES = new Set(['contact']);

/**
 * Corps de la requête, en JSON ou en formulaire.
 *
 * Le formulaire est accepté parce que le bandeau peut être posé dans un
 * `<form>` natif (page de remerciement, intégration). Le type de contenu fait
 * la décision : sur `Request.formData()`, une requête `application/json` ne
 * lève pas d'erreur mais rend un formulaire vide, ce qui perdrait l'adresse
 * saisie.
 */
async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const type = String(req.headers.get('content-type') || '');
  if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
    const raw = await req.formData().catch(() => null);
    if (raw) {
      const out: Record<string, unknown> = {};
      raw.forEach((value, key) => {
        out[key] = value;
      });
      return out;
    }
  }
  return ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const action = String(body.action || req.nextUrl.searchParams.get('action') || 'subscribe');
  const email = String(body.email || '').trim();
  const ip = forwardedIp(req);

  // Piège à pourriels : un champ caché rempli = robot, on répond « ok » sans rien enregistrer.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true, created: false, silenced: true });
  }

  if (action !== 'unsubscribe' && rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, status: 'rate-limited', message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  const topics = Array.isArray(body.topics)
    ? (body.topics as unknown[]).map((t) => String(t))
    : typeof body.topics === 'string' && body.topics.trim()
      ? String(body.topics).split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  const payload = {
    email,
    name: body.name ? String(body.name) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    locale: body.locale ? String(body.locale) : 'fr',
    source: body.source ? String(body.source) : 'form',
    consent: body.consent === undefined ? true : Boolean(body.consent),
    topics,
  };

  if (action === 'unsubscribe') {
    const result = await cmsOr(
      () => cmsFetch('/public/newsletter/unsubscribe', { method: 'POST', json: payload, timeoutMs: 8000 }),
      () => unsubscribe({ email, token: body.token ? String(body.token) : undefined }),
    );
    return NextResponse.json({ ok: true, action, stored: result.via, result: result.value });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, status: 'invalid-email', message: 'Adresse e-mail invalide' }, { status: 400 });
  }

  // Question anti-spam : vérifiée ici, jamais dans le navigateur. Une réponse
  // juste est consommée ; la suivante doit être redemandée.
  //
  // Quelques formulaires ont leur propre preuve d'humanité (la page contact
  // calcule sa question et son quota de tentatives) : ils sont listés ici pour
  // qu'on ne leur demande pas deux fois la même chose. Ils gardent le piège à
  // miel et la limite de débit, et `consent` doit rester explicitement vrai.
  const exemptSource = EXEMPT_SOURCES.has(String(payload.source || ''));
  if (!exemptSource) {
    const captchaId = String(body.captchaId || '').trim();
    const captchaAnswer = String(body.captchaAnswer ?? '').trim();
    if (!captchaId || !verifyCaptcha(captchaId, captchaAnswer)) {
      return NextResponse.json(
        { ok: false, status: 'captcha-failed', message: 'Vérification anti-spam manquante ou incorrecte.' },
        { status: 400 },
      );
    }
  } else if (body.consent !== true) {
    // Le contournement de question n'est valable qu'avec un consentement
    // explicitement posé par le visiteur, jamais supposé par le serveur.
    return NextResponse.json(
      { ok: false, status: 'consent-required', message: 'Consentez d’abord à recevoir ces courriels.' },
      { status: 400 },
    );
  }

  const result = await cmsOr(
    () => cmsFetch('/public/newsletter', {
      method: 'POST',
      json: { ...payload, ip, userAgent: userAgent(req) },
      timeoutMs: 8000,
    }),
    () => subscribe({ ...payload, ip, userAgent: userAgent(req) }),
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

  return NextResponse.json({
    ok: true,
    stored: result.via,
    status,
    result: {
      created: value.created === true,
      duplicate: value.duplicate === true || status === 'already-subscribed',
      reactivated: value.reactivated === true,
    },
  });
}

/** Lien de confirmation (double opt-in) : `GET /api/newsletter?action=confirm&token=…` */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const token = req.nextUrl.searchParams.get('token') || '';
  const locale = req.nextUrl.searchParams.get('locale') || 'fr';

  // Question anti-spam du formulaire : le navigateur ne reçoit que l'énoncé et
  // l'identifiant, jamais la réponse.
  if (action === 'captcha') {
    return NextResponse.json({ ok: true, ...issueCaptcha() });
  }

  if (action !== 'confirm') {
    return NextResponse.json({ ok: false, message: 'Action inconnue' }, { status: 400 });
  }
  await cmsOr(
    () => cmsFetch(`/public/newsletter/confirm?token=${encodeURIComponent(token)}`, { timeoutMs: 8000 }),
    () => confirmSubscriber(token),
  ).catch(() => null);
  return NextResponse.redirect(new URL(`/${locale}`, req.url));
}
