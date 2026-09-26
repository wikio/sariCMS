/**
 * /api/admin/verification — réglages et catalogue du système de vérification.
 *
 * `GET` renvoie tout (l'onglet « Vérification des documents » des paramètres lit
 * l'API, l'écran « Codes de vérification » lit le catalogue). `PUT` accepte les
 * deux sections séparément — `{api}` ou `{codes}` — pour que enregistrer un
 * libellé n'écrase jamais une clé d'API, et l'inverse.
 *
 * La clé d'API est masquée dans `GET` (***MASKED***) pour éviter l'exposition ;
 * `PUT` conserve la clé existante si le champ revient masqué ou vide — l'admin
 * laisse le champ vide pour « conserver » (placeholder du formulaire).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  VerificationError,
  readVerificationStore,
  sanitizeApiSettings,
  sanitizeCodes,
  writeVerificationStore,
} from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await readVerificationStore();
  // Masquer la clé API dans la réponse GET (sécurité)
  const safeStore = {
    ...store,
    api: {
      ...store.api,
      apiKey: store.api.apiKey ? '***MASKED***' : '',
    },
  };
  return NextResponse.json(safeStore, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Le corps attendu est un JSON {api} ou {codes}.', code: 'PARAMETRES' }, { status: 400 });
  }
  try {
    const store = await readVerificationStore();
    if (body.api !== undefined) {
      const incoming = body.api as Record<string, unknown>;
      const prevKey = store.api.apiKey;
      // Partiel supporté : le toggle depuis /admin/verification-codes n'envoie que {showDemoCodes}
      // On merge avec le store existant pour ne pas réinitialiser url/auth/etc.
      const merged: Record<string, unknown> = {
        ...store.api,
        ...incoming,
        response: {
          ...store.api.response,
          ...((incoming.response as Record<string, unknown> | undefined) || {}),
        },
      };
      const sanitized = sanitizeApiSettings(merged);
      // Laisser vide ou ***MASKED*** = conserver la clé existante (évite d'écraser par le masque du GET)
      // Si l'appel est partiel sans apiKey, on garde aussi prevKey (déjà dans merged).
      const rawKey = typeof incoming.apiKey === 'string' ? incoming.apiKey.trim() : undefined;
      if (rawKey === '' || rawKey === '***MASKED***') {
        sanitized.apiKey = prevKey;
      }
      store.api = sanitized;
    }
    if (body.codes !== undefined) store.codes = sanitizeCodes(body.codes);
    await writeVerificationStore(store);
    return NextResponse.json({ ok: true, ...store });
  } catch (error) {
    if (error instanceof VerificationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[verification] enregistrement impossible:', error);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
