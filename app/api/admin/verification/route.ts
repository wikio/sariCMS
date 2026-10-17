/**
 * /api/admin/verification — réglages et catalogue du système de vérification.
 *
 * `GET` renvoie tout (l'onglet « Vérification des documents » des paramètres lit
 * l'API, l'écran « Codes de vérification » lit le catalogue). `PUT` accepte les
 * deux sections séparément — `{api}` ou `{codes}` — pour que enregistrer un
 * libellé n'écrase jamais une clé d'API, et l'inverse.
 *
 * La clé d'API repart en clair dans `GET` : c'est le convention du reste des
 * paramètres de ce back-office (SMTP et ERP se relisent de la même façon pour
 * pouvoir être corrigés) ; l'écran est derrière l'accès administrateur.
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
  return NextResponse.json(store, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Le corps attendu est un JSON {api} ou {codes}.', code: 'PARAMETRES' }, { status: 400 });
  }
  try {
    const store = await readVerificationStore();
    if (body.api !== undefined) store.api = sanitizeApiSettings(body.api as Record<string, unknown>);
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
