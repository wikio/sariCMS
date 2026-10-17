/**
 * /api/verification/check — le contrôle public d'un document.
 *
 * Le parcours, dans l'ordre, parce que chaque garde protège quelque chose :
 *
 *   1. débit par adresse (les robots d'abord, avant toute cryptographie) ;
 *   2. le captcha anti-robot, à usage unique — un code mal recopié reste
 *      réessayable tant qu'il vit, un code juste est brûlé ;
 *   3. la forme des deux champs ;
 *   4. l'API externe configurée dans l'administration (Paramètres → Vérification
 *      des documents) ; si elle est injoignable et que l'administrateur a laissé
 *      le repli actif, le registre local prend le relais et la réponse le dit
 *      (`notice: 'api_injoignable'`) ;
 *   5. la traduction du code de retour par le catalogue (admin → Codes de
 *      vérification) : un code que personne n'a configuré n'est pas un résultat,
 *      c'est une anomalie — elle répond 502, jamais un faux vert.
 *
 * Les erreurs portent `{error, code}` en français, comme le reste du back-office
 * (GED) : la page traduit les codes qu'elle connaît, affiche le message sinon.
 */
import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, verifyCaptcha } from '@/lib/newsletter-captcha';
import {
  VerificationError,
  callVerificationApi,
  findCodeDef,
  outcomeFromDef,
  readVerificationStore,
  verificationStatus,
  verifyLocally,
  type VerificationOutcome,
} from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'inconnu';
}

/** Le code de document est alphanumérique avec des tirets ; la clé, une suite encodée. */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9._:/-]{2,63}$/i;
const KEY_SHAPE = /^[A-Za-z0-9+/=._:-]{4,128}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail('Le corps de la requête doit être du JSON.', 'PARAMETRES', 400);

  // Un captcha raté ne doit pas devenir un pistolet à mitraille vers l'API externe.
  if (rateLimited(`verification:${clientIp(req)}`, 12, 5 * 60 * 1000)) {
    return fail('Trop de vérifications depuis cette adresse. Patientez quelques minutes et réessayez.', 'TROP_DE_TENTATIVES', 429);
  }

  const captchaId = String(body.captchaId || '');
  const captchaAnswer = String(body.captchaAnswer || '');
  if (!captchaId || !verifyCaptcha(captchaId, captchaAnswer)) {
    return fail("Le code anti-robot est manquant, expiré ou incorrect. Un nouveau code vous est proposé.", 'CAPTCHA', 400);
  }

  const code = String(body.code || '').trim();
  const hash = String(body.hash ?? body.key ?? '').trim();
  const locale = body.locale === 'en' || body.locale === 'ar' ? body.locale : 'fr';
  if (!code || !hash) return fail('Deux informations sont nécessaires : le code du document et sa clé de vérification.', 'PARAMETRES', 400);
  if (!CODE_SHAPE.test(code)) return fail('Le format du code du document est invalide.', 'FORMAT_CODE', 400);
  if (!KEY_SHAPE.test(hash)) return fail('Le format de la clé de vérification est invalide.', 'FORMAT_KEY', 400);

  const store = await readVerificationStore();
  const apiEnabled = store.api.enabled && /^https?:\/\//i.test(store.api.url);

  let outcome: VerificationOutcome | null = null;
  let document: { type?: string; issuer?: string; message?: string } = {};
  let source: 'api' | 'local' = 'local';
  let notice: string | undefined;

  if (apiEnabled) {
    try {
      const answer = await callVerificationApi(store.api, code, hash);
      const def = findCodeDef(store.codes, answer.codeValue);
      if (!def) {
        return fail(
          `Le service de vérification a répondu « ${answer.codeValue} », une valeur absente du catalogue des codes. Configurez-la dans l'administration (Codes de vérification).`,
          'REPONSE_API',
          502,
        );
      }
      outcome = outcomeFromDef(def, locale);
      document = { type: answer.type, issuer: answer.issuer, message: answer.message };
      source = 'api';
    } catch (error) {
      const handled = error instanceof VerificationError;
      if (!handled || (error.code !== 'API_INJOIGNABLE' && error.code !== 'REPONSE_API') || !store.api.fallbackToLocal) {
        const code2 = handled ? error.code : 'REPONSE_API';
        return fail(handled ? error.message : 'Le service de vérification a renvoyé une réponse inattendue.', code2, verificationStatus(code2));
      }
      notice = 'api_injoignable';
    }
  }

  if (!outcome) {
    const local = await verifyLocally(locale, code, hash, store.codes);
    if (!local) {
      return fail(
        'Aucun document ne correspond à ce couple code / clé. Vérifiez la saisie — un QR lu en entier évite ce genre d\'erreur.',
        'INTROUVABLE',
        404,
      );
    }
    outcome = local.outcome;
    document = { ...local.document, ...document };
    if (!apiEnabled) source = 'local';
  }

  return NextResponse.json(
    {
      ok: true,
      source,
      notice,
      outcome,
      document,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
