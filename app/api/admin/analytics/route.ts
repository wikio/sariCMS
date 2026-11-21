/**
 * /api/admin/analytics — agrégateur analytique complet + préférences configurables.
 *
 * GET  /api/admin/analytics?range=30d&locale=all&granularity=day
 * PUT  /api/admin/analytics  { prefs: DashboardPrefs } ou { reset: true }
 *
 * Protégé par `middleware.ts` (session admin + CSRF pour PUT).
 */
import { NextRequest, NextResponse } from 'next/server';
import { bearer } from '@/lib/server/cms-or';
import {
  buildAnalyticsSnapshot,
  readDashboardPrefs,
  resolveFilters,
  writeDashboardPrefs,
} from '@/lib/analytics-engine';
import { DEFAULT_DASHBOARD_PREFS } from '@/lib/analytics-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  try {
    const filters = resolveFilters(req.nextUrl.searchParams);
    const token = bearer(req);
    const [snapshot, prefs] = await Promise.all([
      buildAnalyticsSnapshot(token, filters),
      readDashboardPrefs(),
    ]);
    return NextResponse.json({ ok: true, snapshot, prefs }, { headers: NO_STORE });
  } catch (err) {
    console.error('[analytics] erreur GET:', err);
    return NextResponse.json(
      { ok: false, error: 'Impossible de calculer les statistiques.' },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400, headers: NO_STORE });
  }
  try {
    const prefs =
      body.reset === true
        ? await writeDashboardPrefs(DEFAULT_DASHBOARD_PREFS)
        : await writeDashboardPrefs((body.prefs && typeof body.prefs === 'object' ? body.prefs : body) as Record<string, unknown>);
    return NextResponse.json({ ok: true, prefs }, { headers: NO_STORE });
  } catch (err) {
    console.error('[analytics] erreur PUT:', err);
    return NextResponse.json(
      { ok: false, error: 'Impossible d’enregistrer les préférences.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
