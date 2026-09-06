/**
 * Inscription à la newsletter, depuis n'importe quel bloc du site.
 *
 * Le formulaire appelle cette route plutôt que l'API directement : c'est ce
 * qui permet au même composant de fonctionner avec ou sans backend, et de
 * renseigner l'origine de l'inscription (bloc d'accueil, bas d'article, page
 * contact, bandeau construit dans le constructeur de page…).
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { cmsOr, forwardedIp, userAgent } from '@/lib/server/cms-or';
import { confirmSubscriber, subscribe, unsubscribe } from '@/lib/newsletter-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

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

  // Piège à pourriels : un champ caché rempli = robot, on répond « ok » sans rien enregistrer.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true, created: false, silenced: true });
  }

  const topics = Array.isArray(body.topics)
    ? (body.topics as unknown[]).map((t) => String(t))
    : typeof body.topics === 'string' && body.topics.trim()
      ? String(body.topics).split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  const payload = {
    email,
    name: body.name ? String(body.name) : undefined,
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
    return NextResponse.json({ ok: false, message: 'Adresse e-mail invalide' }, { status: 400 });
  }

  const result = await cmsOr(
    () => cmsFetch('/public/newsletter', {
      method: 'POST',
      json: { ...payload, ip: forwardedIp(req), userAgent: userAgent(req) },
      timeoutMs: 8000,
    }),
    () => subscribe({ ...payload, ip: forwardedIp(req), userAgent: userAgent(req) }),
  );

  return NextResponse.json({ ok: true, stored: result.via, result: result.value });
}

/** Lien de confirmation (double opt-in) : `GET /api/newsletter?action=confirm&token=…` */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const locale = req.nextUrl.searchParams.get('locale') || 'fr';
  if (req.nextUrl.searchParams.get('action') !== 'confirm') {
    return NextResponse.json({ ok: false, message: 'Action inconnue' }, { status: 400 });
  }
  await cmsOr(
    () => cmsFetch(`/public/newsletter/confirm?token=${encodeURIComponent(token)}`, { timeoutMs: 8000 }),
    () => confirmSubscriber(token),
  ).catch(() => null);
  return NextResponse.redirect(new URL(`/${locale}`, req.url));
}
