/**
 * /api/verification/status — ce que la page publique a le droit de savoir sans
 * secrets : l'API externe est-elle active, et le repli local est-il autorisé ?
 *
 * La page s'en sert pour annoncer son mode (« API externe » vs « démonstration
 * locale ») et pour décider si les codes de démonstration doivent être cliquables.
 */
import { NextResponse } from 'next/server';
import { publicVerificationStatus } from '@/lib/verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await publicVerificationStatus();
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
