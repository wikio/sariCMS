/**
 * GET /api/placeholder?w=150&h=80&bg=169EC9&fg=FFFFFF&text=SURGICARE&icon=heart-pulse
 */
import { NextRequest } from 'next/server';
import { handlePlaceholderGet } from '@/lib/placeholder-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handlePlaceholderGet(req, []);
}
