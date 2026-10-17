import { NextRequest, NextResponse } from 'next/server';
import { gedStore, toAssetRef } from '@/lib/ged/store.mjs';
import { failure, numberField, splitList, textField } from '@/lib/ged/http';

/**
 * /api/admin/ged/asset — la fiche d'un asset, son état éditable, son nom.
 *
 * Pourquoi une route séparée de `/api/admin/upload` : cet endpoint historique sait
 * lister, écrire, renommer et supprimer, mais son `PATCH` ne fait que renommer —
 * d'où l'écran « Médiathèque » qui laisse saisir une légende sans jamais la
 * retrouver. Ici, `PATCH` écrit la fiche `.sari.json` (titre, alternative textuelle,
 * tags, dimensions), `GET` renvoie la fiche et le JSON rejouable, `PUT` renomme en
 * déplaçant la fiche avec le fichier, et `DELETE` nettoie les deux.
 *
 * Les anciennes routes restent telles quelles : la médiathèque, `GedPicker` et
 * l'upload des fiches métier continuent de marcher comme avant.
 */

function fileParam(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('file') || '';
  return raw ? toAssetRef(raw) : '';
}

/** `GET ?file=canvas/x.png` → la fiche complète, état éditable rechargé. */
export async function GET(request: NextRequest) {
  const file = fileParam(request);
  if (!file) return NextResponse.json({ error: 'Paramètre manquant : file.' }, { status: 400 });
  try {
    const manifest = await gedStore.readAssetManifest(file);
    const asset = await gedStore.decorate(file);
    const withState = request.nextUrl.searchParams.get('state') === '0' ? manifest : manifest;
    return NextResponse.json({ asset, manifest: withState, found: Boolean(manifest), state: manifest?.editable?.inline ?? null });
  } catch (error) {
    return failure(error, 'Lecture de la fiche impossible');
  }
}

/** `PATCH { file, title, alt, tags, width, height }` — ce que le PATCH historique ne savait pas faire. */
export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }
  const file = toAssetRef(String(body.file || ''));
  if (!file) return NextResponse.json({ error: 'Paramètre manquant : file.' }, { status: 400 });
  try {
    const asset = await gedStore.patchAsset({
      file,
      title: body.title !== undefined ? textField(body.title, 200) : undefined,
      alt: body.alt !== undefined ? textField(body.alt, 500) : undefined,
      tags: body.tags !== undefined ? splitList(body.tags) : undefined,
      width: body.width !== undefined ? numberField(body.width) : undefined,
      height: body.height !== undefined ? numberField(body.height) : undefined,
      // Les clés d'un autre module (un `crop`, un `frame`) traversent la route sans
      // être connues d'elle : la fiche les range dans `extra` et les rend au prochain
      // appelant. C'est ce qui évite de repasser par ici pour chaque fonctionnalité.
      ...unknownKeys(body),
    } as never);
    return NextResponse.json({ asset, file: asset.file, url: asset.url, version: asset.version, written: [asset.file] });
  } catch (error) {
    return failure(error, 'Mise à jour de la fiche impossible');
  }
}

/** `PUT { file, newName }` — renommer, en gardant la fiche et l'état éditables alignés. */
export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }
  const file = toAssetRef(String(body.file || ''));
  if (!file) return NextResponse.json({ error: 'Paramètre manquant : file.' }, { status: 400 });
  try {
    const result = await gedStore.renameAsset(file, String(body.newName || ''));
    return NextResponse.json(result);
  } catch (error) {
    return failure(error, 'Renommage impossible');
  }
}

/** `DELETE ?file=…&history=1` — supprimer l'asset, la fiche, l'état, et les versions si demandé. */
export async function DELETE(request: NextRequest) {
  const file = fileParam(request);
  if (!file) return NextResponse.json({ error: 'Paramètre manquant : file.' }, { status: 400 });
  try {
    const result = await gedStore.deleteAsset(file, { purgeHistory: request.nextUrl.searchParams.get('history') === '1' });
    return NextResponse.json({ ...result, success: true });
  } catch (error) {
    return failure(error, 'Suppression impossible');
  }
}

const KNOWN = new Set(['file', 'title', 'alt', 'tags', 'width', 'height']);

/** Ce que la route ne connaît pas appartient à un autre module : on le transmet, on ne le jette pas. */
function unknownKeys(body: Record<string, unknown>) {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!KNOWN.has(key)) extra[key] = value;
  }
  return Object.keys(extra).length ? { extra } : {};
}
