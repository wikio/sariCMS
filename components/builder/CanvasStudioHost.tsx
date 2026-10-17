'use client';

/**
 * L'hôte React du pont GrapesJS ↔ atelier.
 *
 * Monté par la page de construction, il ne rend rien lui-même — il tient trois
 * fenêtres :
 *
 * - l'atelier (`CanvasStudio`), pour créer ou réouvrir une planche ;
 * - la retouche (`ImageEditor`), pour une image posée dans la page qui n'a pas de
 *   planche derrière — le double-clic demandait une retouche, pas un redraw ;
 * - le sélecteur d'actifs, rendu DANS le conteneur que GrapesJS nous prête
 *   (`assetManager.custom`), pour que le panneau de propriétés « Source » d'une image
 *   natif liste la GED sans qu'on touche au composant d'image.
 *
 * Une seule règle de repli : si la résolution échoue, on ne casse pas le composant de
 * page. `applyCanvasReference` n'est appelé qu'avec une réponse complète.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ImageEditor from '@/components/admin/ImageEditor';
import { CanvasStudio } from '@/components/canvas/CanvasStudio';
import { GedAssetBrowser } from '@/components/canvas/GedAssetBrowser';
import { canvasBridge, type AssetBridgeRequest, type StudioRequest, type StudioReply } from '@/lib/builder/sari-canvas-bridge';
import { applyCanvasReference, SARI_CANVAS_TYPE } from '@/lib/builder/sari-canvas';
import { patchGedAsset } from '@/lib/ged/client';
import type { CanvasReference } from '@/lib/canvas/types';
import type { GedAssetSummary } from '@/lib/ged/types';

interface EditorLike {
  getSelected: () => unknown;
}

export function CanvasStudioHost({
  getEditor,
  pageId,
  pageSlug,
  className,
}: {
  /** La main sur l'éditeur au moment où la réponse arrive — l'éditeur peut avoir été remonté entre-temps. */
  getEditor?: () => EditorLike | null;
  pageId?: string;
  pageSlug?: string;
  /** Une classe pour le conteneur du sélecteur, quand il est rendu hors modale. */
  className?: string;
}) {
  const [request, setRequest] = useState<(StudioRequest & { open: boolean }) | null>(null);
  const [retouch, setRetouch] = useState<{ id: string; src: string; file?: string } | null>(null);
  const [assets, setAssets] = useState<AssetBridgeRequest | null>(null);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = canvasBridge.onStudio((next) => {
    if (next.purpose === 'retouch' && !next.file && next.url) {
      // Une image simple : la retouche suffit, l'atelier serait un détournement.
      setRetouch({ id: next.id, src: next.url, file: next.file });
      return;
    }
    setRequest({ ...next, open: true });
    });
    return off;
  }, []);

  useEffect(() => {
    const off = canvasBridge.onAssets((event) => {
      if (event.type === 'close') {
        setAssets(null);
        return;
      }
      setAssets(event.request);
    });
    return off;
  }, []);

  const finish = useCallback((id: string, reply: StudioReply | null) => {
    const component = getEditor?.()?.getSelected?.() as Parameters<typeof applyCanvasReference>[0] | null;
    if (reply && component && typeof component.addAttributes === 'function' && component.is?.(SARI_CANVAS_TYPE)) {
      applyCanvasReference(component, reply);
    }
    canvasBridge.resolveStudio(id, reply);
    setRequest(null);
  }, [getEditor]);

  const onAssetPicked = useCallback(
    (asset: GedAssetSummary) => {
      // `select(asset, true)` est le geste « je prends » de GrapesJS : il écrit la
      // valeur du trait et ferme. `false` ne fait que la préparer.
      // La forme attendue est celle d'un `Asset` GrapesJS (`src`), pas celle de la
      // fiche GED (`url`) : c'est ici que les deux vocabulaires se recousent.
      assets?.select({ src: asset.url, name: asset.name || asset.title, type: asset.kind, preview: asset.url }, true);
      assets?.close();
    },
    [assets],
  );

  const onRetouchSaved = useCallback(
    async (url: string) => {
      const current = retouch;
      setRetouch(null);
      if (!current) return;
      const component = getEditor?.()?.getSelected?.() as Parameters<typeof applyCanvasReference>[0] | null;
      component?.addAttributes?.({ src: url });
      // Une retouche depuis la page produit un asset rangé, pas un fichier orphelin :
      // la fiche porte la page d'origine, et `IMG_` dit qu'il s'agit d'une reprise.
      const reference = toReference(url);
      if (reference) {
        await patchGedAsset({ file: reference.file, title: reference.file.split('/').pop() || 'Visuel retouché' }).catch(() => undefined);
      }
      canvasBridge.resolveStudio(current.id, {
        file: reference?.file || url,
        url,
        kind: 'image',
        prefix: 'IMG_',
        width: Number(component?.getAttributes?.().width || 0) || 0,
        height: Number(component?.getAttributes?.().height || 0) || 0,
      });
    },
    [getEditor, retouch],
  );

  return (
    <>
      {request?.open ? (
        <CanvasStudio
          open={request.open}
          asset={request.file || null}
          context={{ pageId: pageId || request.pageId, pageSlug: pageSlug || request.pageSlug, componentId: request.componentId }}
          onClose={() => finish(request.id, null)}
          onInsert={(reference: CanvasReference) => {
            finish(request.id, {
              file: reference.file,
              url: reference.url,
              kind: reference.kind,
              prefix: reference.prefix,
              width: reference.width || 0,
              height: reference.height || 0,
              version: reference.version,
            });
          }}
        />
      ) : null}

      {retouch ? (
        <ImageEditor
          src={retouch.src}
          // Le dossier d'origine, si la source est déjà une image de la GED : la
          // retouche reste dans la collection du visuel qu'elle reprend.
          folder={folderOf(retouch.src)}
          onClose={() => (canvasBridge.resolveStudio(retouch.id, null), setRetouch(null))}
          onSaved={(url) => void onRetouchSaved(url)}
        />
      ) : null}

      {assets?.container && typeof document !== 'undefined'
        ? createPortal(
            <div ref={holder} className={className} style={{ padding: 10, background: 'var(--ad-bg, #0b1424)', color: 'var(--ad-text, #e2e8f0)' }}>
              <GedAssetBrowser
                height={420}
                types={assets.types.length ? (assets.types as ('image' | 'svg' | 'canvas')[]) : ['image', 'svg', 'canvas']}
                onSelect={onAssetPicked}
                allowOpenInStudio
                allowImport
                // « Ouvrir dans l'atelier » doit faire quelque chose ici aussi : dans la
                // page, le composant sélectionné est le demandeur, donc la planche rééditée
                // lui revient à l'enregistrement.
                onOpenInStudio={(asset) => {
                  canvasBridge.openStudio({
                    purpose: 'edit',
                    file: asset.file,
                    url: asset.url,
                    pageId,
                    pageSlug,
                    componentId: (getEditor?.()?.getSelected?.() as { getId?: () => string } | null)?.getId?.(),
                  });
                  assets?.close();
                }}
              />
            </div>,
            assets.container,
          )
        : null}
    </>
  );
}

/** Le dossier GED d'une URL `/uploads/module/fichier.png` (vide si racine ou hors GED). */
function folderOf(url: string): string | undefined {
  const match = /^\/uploads\/([^/]+)\//.exec(url || '');
  return match ? match[1] : undefined;
}

/** Une URL de la GED (`/uploads/module/fichier.png`) → sa référence interne. */
function toReference(url: string): { file: string; url: string } | null {
  const match = /^\/uploads\/([^"']+)$/.exec(url || '');
  if (!match) return null;
  return { file: match[1], url };
}

