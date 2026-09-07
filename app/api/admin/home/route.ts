/**
 * Écran « Page d'accueil » du back-office : lire et écrire la configuration des
 * blocs.
 *
 *   GET  /api/admin/home?locale=fr        configuration fusionnée pour la langue
 *   PUT  /api/admin/home                  enregistre un bloc { key, locale, config }
 *   POST /api/admin/home                  { action: "reorder" | "copy" | "reset" | "import" }
 *
 * L'écran n'a pas à savoir où vit la donnée : la passerelle choisit le CMS ou
 * le fichier de secours et renvoie `stored` pour qu'on l'affiche.
 */
import { NextRequest, NextResponse } from 'next/server';
import { bearer, cmsOr } from '@/lib/server/cms-or';
import {
  copyHomeStructure,
  importHomeLegacy,
  loadHome,
  reorderHome,
  resetHomeSection,
  saveHomeSection,
} from '@/lib/home/store';
import type { HomeSectionConfig, HomeSectionKey } from '@/lib/home/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'fr';
  const token = bearer(req);
  const home = await loadHome(locale, token);
  return NextResponse.json({
    ...home,
    stored: home.api ? 'api' : 'local',
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { key?: HomeSectionKey; locale?: string; config?: HomeSectionConfig }
    | null;
  if (!body?.key || !body?.config) {
    return NextResponse.json({ ok: false, message: 'Bloc et configuration attendus' }, { status: 400 });
  }
  const result = await saveHomeSection({
    key: body.key,
    locale: body.locale || 'fr',
    config: body.config,
    token: bearer(req),
  });
  return NextResponse.json({ ok: true, stored: result.stored, section: result.section });
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    locale?: string;
    order?: HomeSectionKey[];
    from?: string;
    to?: string[];
    key?: HomeSectionKey;
    keys?: HomeSectionKey[];
    force?: boolean;
    withTexts?: boolean;
  };

  switch (body.action) {
    case 'reorder': {
      const order = Array.isArray(body.order) ? body.order : [];
      const result = await reorderHome({ locale: body.locale || 'fr', order, token });
      return NextResponse.json({ ok: true, stored: result.stored });
    }
    case 'copy': {
      const result = await cmsOr(
        () => copyHomeStructure({
          from: body.from || 'fr',
          to: body.to || [],
          key: body.key,
          withTexts: body.withTexts,
          token,
        }),
        () => copyHomeStructure({ from: body.from || 'fr', to: body.to || [], key: body.key, withTexts: body.withTexts }),
      );
      return NextResponse.json({ ok: true, stored: result.value.stored, result: result.value.result });
    }
    // « Importer les données actuelles du site » : le contenu qui vit dans
    // `data/{langue}/*.json` et les traductions devient une configuration
    // enregistrée, donc modifiable et supprimable comme les autres.
    case 'import': {
      const result = await importHomeLegacy({
        locale: body.locale || 'fr',
        keys: body.keys,
        force: body.force,
        token,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    case 'reset': {
      if (!body.key) return NextResponse.json({ ok: false, message: 'Bloc manquant' }, { status: 400 });
      const result = await resetHomeSection({ key: body.key, locale: body.locale || 'fr', token });
      return NextResponse.json({ ok: true, ...result });
    }
    default:
      return NextResponse.json({ ok: false, message: `Action inconnue : ${body.action}` }, { status: 400 });
  }
}
