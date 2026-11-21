import { NextRequest, NextResponse } from 'next/server';
import { adminIdentity, authError, authStatus, getAccessToken, getRefreshToken } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  try {
    const user = await adminIdentity(getAccessToken(req));
    return NextResponse.json({ ok: true, authenticated: true, user }, { headers: NO_STORE });
  } catch (error) {
    if ([401, 403].includes(authStatus(error)) && req.nextUrl.searchParams.get('optional') === '1') {
      return NextResponse.json({ ok: false, authenticated: false, user: null, canRefresh: authStatus(error) === 401 && Boolean(getRefreshToken(req)) }, { headers: NO_STORE });
    }
    return authError(error);
  }
}
