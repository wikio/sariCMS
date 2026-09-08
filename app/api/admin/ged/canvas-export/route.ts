import { NextRequest, NextResponse } from 'next/server';
import { gedStore, toAssetRef } from '@/lib/ged/store.mjs';
import { MAX_ASSET_BYTES } from '@/lib/ged/store.mjs';
import { bufferFromDataUrl, failure, numberField, readState, sourceFrom, splitList, textField } from '@/lib/ged/http';

/**
 * POST /api/admin/ged/canvas-export — l'export de l'atelier graphique dans la GED.
 *
 * C'est le `POST /ged/canvas-export` du besoin. Il reçoit, en une seule requête, ce
 * que produit un enregistrement depuis l'éditeur : le rendu (PNG, et SVG quand le
 * document est entièrement vectoriel), l'état Fabric rejouable, et les métadonnées
 * (préfixe, nom, dimensions, page ou composant d'où l'on est parti). Une seule
 * requête et non trois, pour que le visuel publié et le JSON qui permet de le rouvrir
 * ne puissent pas se retrouver dans deux versions différentes — le bug classique du
 * « l'image a été remplacée, sa source non ».
 *
 * Le préfixe suit la table `lib/ged/prefix.mjs` : `CANVA_` pour une planche sortie de
 * l'atelier, `IMG_` pour une image retouchée, `SVG_` pour du vectoriel. Une valeur
 * inconnue n'est pas refusée mais devient le préfixe du module (`BROCHURE_…`), ce qui
 * est exactement la forme d'extension demandée — aucun schéma à faire évoluer.
 *
 * Le versionnage se joue sur `file` (alias `target`) : passer la référence de l'asset qu'on est en
 * train de ré-éditer garde le même nom de fichier (donc aucun lien déjà posé dans une
 * page ne casse) et archive l'ancien contenu à côté, dans `history` de la fiche. Voir
 * la décision commentée dans `lib/ged/store.mjs`.
 *
 * Corps accepté :
 * ```json
 * {
 *   "kind": "canvas", "prefix": "CANVA_", "name": "Post campagne",
 *   "title": "…", "alt": "…", "tags": ["été"], "width": 1080, "height": 1080,
 *   "png": "data:image/png;base64,…", "svg": "<svg …>…</svg>",
 *   "state": { "objects": [] }, "file": "canvas/CANVA_x_post.png",
 *   "origin": "builder", "pageId": "12", "pageSlug": "offre-irm", "componentId": "c42"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }

  // Les rendus reçus, dans l'ordre de préférence : le premier écrit l'asset actif
  // (celui que la page affichera), les suivants viennent se coller à côté sous le
  // même nom. Un export « PNG + SVG » produit donc `x.png` et `x.svg`, et la fiche
  // dit lequel est lequel.
  const renders = [
    { key: 'png' as const, buffer: await decode(body.png), extension: 'png' },
    { key: 'svg' as const, buffer: await decode(body.svg, true), extension: 'svg' },
    { key: 'webp' as const, buffer: await decode(body.webp), extension: 'webp' },
    { key: 'jpg' as const, buffer: await decode(body.jpeg || body.jpg), extension: 'jpg' },
  ].filter((entry) => entry.buffer && entry.buffer.length);

  const primary = renders[0];
  if (!primary) {
    return NextResponse.json({ error: 'Rendu manquant : png (base64) ou svg attendu.' }, { status: 400 });
  }

  const state = readState(body.state);
  const kind = textField(body.kind, 20, 'canvas');
  const written: string[] = [];

  try {
    // Le champ de la cible s'appelle `file` côté atelier et côté Nest (`target` est
    // l'ancien nom de la route) : les deux se lisent, sinon une réédition écrit une
    // planche NEUVE à côté de l'ancienne — et les pages continuent d'afficher la
    // version d'avant, sans que rien ne le signale.
    const target = toAssetRef(String(body.target || body.file || body.overwrite || ''));
    const name = textField(body.name, 120) || textField(body.title, 120) || 'planche';
    const manifest = {
      title: textField(body.title, 200, name),
      alt: textField(body.alt, 500),
      tags: splitList(body.tags),
      width: numberField(body.width),
      height: numberField(body.height),
      source: sourceFrom((key) => body[key]),
      ...(state ? { editable: { format: 'fabric' as const, inline: state } } : {}),
    };

    const main = await gedStore.saveAsset({
      kind,
      prefix: body.prefix ? String(body.prefix) : undefined,
      module: body.module ? String(body.module) : undefined,
      file: target || undefined,
      overwrite: target || undefined,
      name,
      extension: primary.extension,
      buffer: primary.buffer as Buffer,
      manifest,
    });
    written.push(main.file);

    const render: Record<string, string> = { [primary.key]: main.file };
    for (const extra of renders.slice(1)) {
      const stem = main.file.replace(/\.[^.]+$/, '');
      const companion = await gedStore.saveAsset({
        kind,
        file: `${stem}.${extra.extension}`,
        extension: extra.extension,
        buffer: extra.buffer as Buffer,
        manifest: { title: manifest.title, alt: manifest.alt, width: manifest.width, height: manifest.height },
      });
      written.push(companion.file);
      render[extra.key] = companion.file;
    }

    const asset = await gedStore.patchAsset({ file: main.file, render } as never);
    return NextResponse.json(
      {
        asset,
        file: main.file,
        url: asset.url,
        version: asset.version,
        written,
        /** Ce que la page stocke : la référence GED, pas seulement l'URL. */
        reference: { file: main.file, url: asset.url, kind, prefix: main.prefix, width: asset.width, height: asset.height, version: asset.version },
      },
      { status: 201 },
    );
  } catch (error) {
    // Un accompagnant qui échoue ne doit pas laisser un rendu orphelin sans réponse :
    // la GED garde ce qui est écrit, et l'appelant sait ce qui a manqué.
    if (written.length) {
      return NextResponse.json({ error: 'Export partiel.', written, partial: true }, { status: 207 });
    }
    return failure(error, 'Export vers la GED impossible');
  }
}

/**
 * Un rendu reçu, en Buffer.
 *
 * Trois écritures sont acceptées, parce que trois écrans appellent : une `data:` URL
 * (l'atelier Fabric, qui a le rendu sous la main), une chaîne brute pour le SVG (un
 * `<svg …>` se transfère mieux en texte qu'en base64), et un `Blob` (la retouche, qui
 * encode déjà son canvas en binaire).
 */
async function decode(value: unknown, rawText = false): Promise<Buffer | null> {
  if (value == null || value === '') return null;
  if (value instanceof Blob) {
    const buffer = Buffer.from(await value.arrayBuffer());
    return buffer.length > MAX_ASSET_BYTES ? null : buffer;
  }
  const text = String(value);
  if (rawText && !text.startsWith('data:')) {
    if (!/^<svg[\s>]/i.test(text.trim())) return null;
    return Buffer.from(text.slice(0, 8_000_000), 'utf8');
  }
  if (!text.startsWith('data:')) {
    // Le rendu de l'atelier est un base64 NU (Fabric retire l'en-tête) : sans cette
    // branche, `decode` renvoyait `null`, la route répondait « Rendu manquant », et
    // l'enregistrement échouait pour une raison que rien n'affichait.
    const body = text.trim();
    if (!/^[A-Za-z0-9+/\s]{32,}={0,2}$/.test(body)) return null;
    const buffer = Buffer.from(body.replace(/\s+/g, ''), 'base64');
    if (!buffer.length || buffer.length > MAX_ASSET_BYTES) return null;
    return buffer;
  }
  return bufferFromDataUrl(text, MAX_ASSET_BYTES);
}

/** Ce endpoint écrit sur le disque : rien à mettre en cache, ni ici ni au bord. */
export const dynamic = 'force-dynamic';

