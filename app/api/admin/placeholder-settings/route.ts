/**
 * /api/admin/placeholder-settings — configuration back-office du générateur
 * d'images et de logos (`/api/placeholder` + atelier Canvas).
 *
 * Protégé par `proxy.ts` (session admin + CSRF).
 */
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PLACEHOLDER_CONFIG } from '@/lib/placeholder-engine';
import { readPlaceholderConfig, writePlaceholderConfig } from '@/lib/placeholder-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const config = await readPlaceholderConfig();
  return NextResponse.json({ ok: true, config }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400, headers: NO_STORE });
  }

  try {
    if (body.reset === true) {
      const config = await writePlaceholderConfig(DEFAULT_PLACEHOLDER_CONFIG);
      return NextResponse.json({ ok: true, config }, { headers: NO_STORE });
    }
    const incoming = (body.config && typeof body.config === 'object' ? body.config : body) as Record<string, unknown>;
    const config = await writePlaceholderConfig(incoming);
    return NextResponse.json({ ok: true, config }, { headers: NO_STORE });
  } catch (err) {
    console.error('[placeholder-settings] sauvegarde impossible:', err);
    return NextResponse.json({ ok: false, error: 'Enregistrement impossible.' }, { status: 500, headers: NO_STORE });
  }
}
