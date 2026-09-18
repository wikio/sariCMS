/**
 * /api/admin/mail-center — configuration du centre de courrier.
 *
 * `GET` renvoie l'état complet : politique d'envoi, réglages par événement,
 * gabarits, présence des fichiers sur le disque, compteurs d'envoi et le
 * catalogue des modules (ce que le CMS sait envoyer). L'écran
 * Paramètres → « Emails & notifications » lit cette route.
 *
 * `PUT` accepte les sections séparément — `{policy}`, `{modules}`, `{layouts}`
 * — pour qu'enregistrer un objet de message n'écrive jamais sur les gabarits, et
 * inversement. Chaque section est bornée par `lib/mail-center-store.ts`.
 *
 * Persistance : `data/mail/*.json` (fichiers, pas de base de données).
 */
import { NextRequest, NextResponse } from 'next/server';
import { MAIL_CATALOG, MAIL_VARS } from '@/lib/mail-center';
import {
  MailCenterError,
  readMailCenter,
  sanitizeLayouts,
  sanitizeModules,
  sanitizePolicy,
  writeLayouts,
  writeModules,
  writePolicy,
} from '@/lib/mail-center-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const snapshot = await readMailCenter();
  return NextResponse.json(
    {
      ...snapshot,
      catalog: MAIL_CATALOG,
      vars: MAIL_VARS,
      directory: 'data/mail',
    },
    { headers: NO_STORE },
  );
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Le corps attendu est un JSON {policy}, {modules} ou {layouts}.', code: 'PARAMETRES' },
      { status: 400 },
    );
  }
  try {
    if (body.policy !== undefined) await writePolicy(sanitizePolicy(body.policy));
    if (body.modules !== undefined) await writeModules(sanitizeModules(body.modules));
    if (body.layouts !== undefined) await writeLayouts(sanitizeLayouts(body.layouts));
    const snapshot = await readMailCenter();
    return NextResponse.json({ ok: true, ...snapshot }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof MailCenterError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[mail-center] enregistrement impossible :', error);
    return NextResponse.json(
      { error: 'Enregistrement impossible — vérifiez les droits en écriture sur data/mail.', code: 'ECRITURE' },
      { status: 500 },
    );
  }
}
