/**
 * GET /api/placeholder/{size}/{bg}/{fg}?text=SURGICARE&icon=heart-pulse&...
 *
 * Compatible avec la syntaxe historique `via.placeholder.com/150x80/169EC9/FFFFFF?text=SURGICARE`,
 * directement hébergé sur l'URL de la vitrine et enrichi (icônes, dégradés, motifs, sous-titre, badge, arrondi).
 */
import { NextRequest } from 'next/server';
import { handlePlaceholderGet } from '@/lib/placeholder-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ segments?: string[] }> },
) {
  const { segments = [] } = await context.params;
  return handlePlaceholderGet(req, segments);
}
