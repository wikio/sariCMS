import { NextRequest, NextResponse } from 'next/server';
import { gedStore, toAssetRef } from '@/lib/ged/store.mjs';
import { MAX_ASSET_BYTES } from '@/lib/ged/store.mjs';
import { failure, numberField, readState, sourceFrom, splitList, textField } from '@/lib/ged/http';

/**
 * GET /api/admin/ged/assets — la liste de la GED, paginée et filtrable.
 *
 * C'est ce que lisent l'Asset Manager de GrapesJS et la galerie de l'atelier :
 * recherche par nom/légende/tag, filtre par module, par type (`canvas`, `image`,
 * `svg`, `doc`, ou `visual` pour tous les rasters et SVG confondus), par préfixe
 * (`CANVA_`, `IMG_`) et par tag. Les filtres portent tous sur le nom du fichier ou
 * sur sa fiche — aucun index à maintenir, donc rien à resynchroniser.
 *
 * La réponse porte des facettes (`kinds`, `modules`, `tags`) parce qu'un sélecteur
 * qui doit proposer des filtres ne peut pas les deviner, et que deux allers-retours
 * pour les construire coûteraient plus cher que ce champ.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  try {
    const result = await gedStore.listAssets({
      module: searchParams.get('module') || undefined,
      kind: searchParams.get('kind') || undefined,
      prefix: searchParams.get('prefix') || undefined,
      tag: searchParams.get('tag') || undefined,
      search: searchParams.get('search') || undefined,
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 30),
    });
    return NextResponse.json(result);
  } catch (error) {
    return failure(error, 'Lecture de la GED impossible');
  }
}

/**
 * POST /api/admin/ged/assets — écrire un asset dans la GED (`multipart/form-data`).
 *
 * La porte d'entrée de la retouche : le back-office envoie un Blob déjà encodé
 * (PNG recadré, JPEG compressé, WebP) et la GED le range sous le préfixe du type
 * demandé — `IMG_` pour une image retravaillée, `CANVA_` pour une planche, `SVG_`
 * pour du vectoriel — dans le module indiqué.
 *
 * Deux champs portent l'intention et ne se recoupent pas :
 * - `file` : le nom exact à écrire, pour un appelant qui sait où il va ;
 * - `overwrite` : la référence à remplacer. L'ancien contenu part en version
 *   archivée et, si `file` est absent, le nouvel asset reprend ce nom.
 *
 * `state` (JSON en texte) attache l'état éditable dans le même mouvement : un visuel
 * et sa source rejouable ne doivent jamais avoir deux versions différentes.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : multipart/form-data.' }, { status: 400 });
  }
  const upload = form.get('file');
  if (!(upload instanceof Blob)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }
  // `file` est la PARTIE binaire du formulaire : elle ne doit en aucun cas être lue
  // comme une destination. Transformée en chaîne elle valait « [object File] », et
  // l'asset était écrit sous ce nom — importé, mais introuvable et inrouvrable.
  // La destination s'écrit dans `target` (nom exact) ou `overwrite` (remplacement).
  if (upload.size > MAX_ASSET_BYTES) {
    return NextResponse.json({ error: `Fichier trop lourd (${upload.size} octets).` }, { status: 413 });
  }
  const pick = (key: string) => form.get(key) ?? undefined;
  const name = textField(pick('name'), 120) || (upload instanceof File ? upload.name : '') || 'visuel';
  const state = readState(pick('state'));

  try {
    const asset = await gedStore.saveAsset({
      kind: textField(pick('kind'), 20, 'image'),
      module: form.has('module') ? String(form.get('module')) : undefined,
      prefix: form.has('prefix') ? String(form.get('prefix')) : undefined,
      file: form.get('target') ? toAssetRef(String(form.get('target'))) : undefined,
      overwrite: form.get('overwrite') ? toAssetRef(String(form.get('overwrite'))) : undefined,
      name,
      extension: String(form.get('extension') || ''),
      buffer: Buffer.from(await upload.arrayBuffer()),
      manifest: {
        title: textField(pick('title'), 200, name),
        alt: textField(pick('alt'), 500),
        tags: splitList(pick('tags')),
        width: numberField(pick('width')),
        height: numberField(pick('height')),
        source: sourceFrom(pick),
        ...(state ? { editable: { format: 'fabric' as const, inline: state } } : {}),
      },
    });
    return NextResponse.json(
      { asset, url: asset.url, file: asset.file, version: asset.version, written: [asset.file] },
      { status: 201 },
    );
  } catch (error) {
    return failure(error, 'Écriture dans la GED impossible');
  }
}
