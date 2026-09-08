/**
 * POST /api/admin/verification/test — « Tester » de l'onglet Vérification.
 *
 * Le formulaire de réglages ne doit pas envoyer l'administrateur vérifier un
 * vrai document à l'aveugle : ce bouton appelle l'API externe telle qu'elle est
 * configurée (telle qu'elle est enregistrée ou telle qu'on est en train de la
 * saisir — le corps porte `api` pour tester avant d'enregistrer) et renvoie la
 * réponse brute, le code extrait, et l'entrée du catalogue qu'il déclenche.
 *
 * C'est aussi ce qui rend visible le piège classique : une API joignable qui
 * répond un code absent du catalogue. Le test le dit ; la page publique, elle,
 * refuserait de traduire.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  VerificationError,
  callVerificationApi,
  findCodeDef,
  outcomeFromDef,
  readVerificationStore,
  sanitizeApiSettings,
  verificationStatus,
} from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { api?: Record<string, unknown>; code?: string; key?: string } | null;
  const store = await readVerificationStore();
  // On teste la configuration soumise, complétée champ à champ par ce qui est
  // déjà enregistré : l'écran envoie son formulaire entier, et un champ laissé
  // vide retombe sur la valeur en base plutôt que d'effacer une clé d'API.
  const submitted: Record<string, unknown> = { ...(body?.api || {}) };
  for (const [key, value] of Object.entries(submitted)) if (value === '' || value == null) delete submitted[key];
  const api = sanitizeApiSettings({ ...store.api, ...submitted, enabled: true });
  const code = String(body?.code || 'SARI-FAC24-00001').trim();
  const hash = String(body?.key || '').trim();

  if (!/^(https?):\/\//i.test(api.url || '')) {
    return NextResponse.json({ error: "Renseignez d'abord une URL d'API commençant par http:// ou https://.", code: 'NON_CONFIGUREE' }, { status: 400 });
  }
  if (!hash) {
    return NextResponse.json({ error: 'Le test demande une clé de vérification — la réponse de l\'API en dépend.' , code: 'PARAMETRES' }, { status: 400 });
  }

  try {
    const answer = await callVerificationApi(api, code, hash);
    const def = findCodeDef(store.codes, answer.codeValue);
    return NextResponse.json({
      ok: true,
      raw: answer.raw,
      codeValue: answer.codeValue,
      mapped: def ? outcomeFromDef(def, 'fr') : null,
      warning: def ? undefined : `Code « ${answer.codeValue} » absent du catalogue : la page publique refuserait de l'afficher.`,
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: verificationStatus(error.code) });
    }
    return NextResponse.json({ error: 'Test impossible.', code: 'REPONSE_API' }, { status: 502 });
  }
}
