/**
 * Fiches proposées aux sélecteurs du studio (slides, produits, témoignages,
 * événements, actualités, partenaires).
 *
 * Elles viennent du CMS quand il répond — l'administrateur voit alors aussi les
 * brouillons, ce qui lui permet de préparer une page avant publication. Sinon,
 * elles viennent des fichiers de données livrés avec la vitrine.
 */
import { NextRequest, NextResponse } from 'next/server';
import { bearer } from '@/lib/server/cms-or';
import { homeOptions, type HomeOptionResource } from '@/lib/home/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED: HomeOptionResource[] = ['hero', 'products', 'testimonials', 'events', 'news', 'partners', 'pages'];

export async function GET(req: NextRequest) {
  const resource = String(req.nextUrl.searchParams.get('resource') || 'products') as HomeOptionResource;
  const locale = req.nextUrl.searchParams.get('locale') || 'fr';
  if (!ALLOWED.includes(resource)) {
    return NextResponse.json({ ok: false, options: [], message: 'Ressource inconnue' }, { status: 400 });
  }
  const options = await homeOptions(resource, locale, bearer(req));
  return NextResponse.json({ ok: true, resource, locale, options });
}
