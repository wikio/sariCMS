import { NextRequest, NextResponse } from 'next/server';
import { gedStore, toAssetRef } from '@/lib/ged/store.mjs';
import { failure, readState } from '@/lib/ged/http';

/**
 * /api/admin/ged/asset/state — le JSON qui permet de rouvrir un asset dans l'atelier.
 *
 * Séparé de la fiche, parce que les deux ne se lisent pas pour les mêmes raisons : la
 * liste de la GED charge les fiches de centaines de fichiers pour afficher titres et
 * légendes, et ne doit surtout pas trainer des mégaoctets de JSON de canvas ;
 * l'atelier, lui, n'en charge qu'un à la fois, mais en entier.
 *
 * `GET ?file=` renvoie l'état — inline ou depuis son fichier `.sari.canvas.json`, la
 * route ne connaît pas cette distinction, le magasin la fait. `POST { file, state }`
 * l'écrase : c'est « Enregistrer l'état » sans régénérer le rendu, quand on veut garder
 * un brouillon entre deux exports.
 */
export async function GET(request: NextRequest) {
  const file = toAssetRef(request.nextUrl.searchParams.get('file') || '');
  if (!file) return NextResponse.json({ error: 'Paramètre manquant : file.' }, { status: 400 });
  try {
    return NextResponse.json({ file, state: await gedStore.readEditableState(file) });
  } catch (error) {
    return failure(error, 'Lecture de l\'état éditable impossible');
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }
  const file = toAssetRef(String(body.file || ''));
  const state = readState(body.state);
  if (!file || state === null) {
    return NextResponse.json({ error: 'Paramètres attendus : file, state.' }, { status: 400 });
  }
  try {
    const result = await gedStore.writeEditableState(file, state, body.format === 'svg' ? 'svg' : 'fabric');
    const asset = await gedStore.decorate(file);
    return NextResponse.json({ ...result, asset, url: asset.url, version: asset.version, written: [file] });
  } catch (error) {
    return failure(error, 'Écriture de l\'état éditable impossible');
  }
}
