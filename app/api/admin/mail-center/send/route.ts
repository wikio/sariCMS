/**
 * /api/admin/mail-center/send — envoyer un message d'un module depuis l'admin.
 *
 * Route fine : elle lit le jeton de l'administrateur dans son cookie et délègue
 * tout le travail à `sendMailCenterEvent()` — garde-fous, rendu, transport,
 * journal. C'est la même fonction qu'appellent les flux publics (contact,
 * newsletter), donc une seule politique d'envoi pour tout le CMS.
 *
 * Le navigateur ne peut pas contourner les plafonds : ils sont évalués ici,
 * côté serveur, à partir de `data/mail/sent-log.json`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  event?: string;
  to?: string;
  toName?: string;
  vars?: Record<string, string | number>;
  dedupeKey?: string;
  test?: boolean;
  override?: { subject?: string; body?: string; layoutId?: string };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps JSON attendu.', code: 'PARAMETRES' }, { status: 400 });
  }
  if (!body.event) {
    return NextResponse.json(
      { sent: false, reason: 'unknown_event', detail: 'Aucun événement demandé.' },
      { status: 400 },
    );
  }

  const result = await sendMailCenterEvent({
    event: String(body.event),
    to: String(body.to || ''),
    toName: body.toName ? String(body.toName) : undefined,
    vars: body.vars && typeof body.vars === 'object' ? body.vars : {},
    dedupeKey: body.dedupeKey ? String(body.dedupeKey) : undefined,
    test: body.test === true,
    override: body.override,
    // Le middleware a déjà exigé ce cookie pour /api/admin/* : c'est le jeton
    // que le transport présentera au backend.
    bearer: req.cookies.get('sari_admin_access')?.value,
  });

  return NextResponse.json(result);
}
