'use client';

/**
 * Le navigateur de GED, en un composant.
 *
 * Il sert trois écrans et un seul bouton « choisir » écrit trois fois serait trois
 * bugs différents :
 *
 * - l'atelier, pour importer une image ou une SVG sur la planche ;
 * - le sélecteur d'actifs de GrapesJS (`lib/builder/sari-canvas.ts`), où `onSelect`
 *   rend l'asset à l'éditeur de page ;
 * - la fiche média de l'admin, pour remplacer la source d'une image déjà posée.
 *
 * La liste vient de `lib/ged/client.ts`, donc exactement du même contrat que la
 * passerelle NestJS : pagination côté serveur, recherche par nom/légende/étiquette,
 * filtre par type. Rien n'est mis en cache ici — un dépôt fait depuis l'atelier doit
 * apparaître au coup suivant.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Layers, RefreshCw, Search, Star, Upload } from 'lucide-react';
import { listGedAssets, uploadGedAsset, type GedAssetSummary, type GedKindFilter } from '@/lib/ged/client';

const TYPE_OPTIONS: { value: GedKindFilter | ''; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'image', label: 'Images' },
  { value: 'svg', label: 'Dessins SVG' },
  { value: 'canvas', label: 'Planches de l’atelier' },
];

export function GedAssetBrowser({
  onSelect,
  types = ['image', 'svg', 'canvas'],
  title,
  allowImport = true,
  allowOpenInStudio,
  onOpenInStudio,
  onImportAsset,
  height = 320,
  selectedFile,
  initialSearch = '',
}: {
  /** Rend l'asset choisi. En l'absence de ce retour, le panneau est en lecture seule. */
  onSelect?: (asset: GedAssetSummary) => void;
  /** `types` reprend le paramètre `kind` de la route : liste blanche, pas un filtre maison. */
  types?: GedKindFilter | GedKindFilter[] | '';
  /** Un titre n'est pas obligatoire : dans GrapesJS, la barre de l'éditeur fait foi. */
  title?: string;
  allowImport?: boolean;
  onOpenInStudio?: (asset: GedAssetSummary) => void;
  allowOpenInStudio?: boolean;
  /**
   * Le double-clic : « pose-moi direct ». Un simple clic prépare l'asset (c'est le geste
   * du sélecteur de champ), le double-clic l'amène sur la planche sans autre dialogue.
   */
  onImportAsset?: (asset: GedAssetSummary) => void;
  height?: number;
  selectedFile?: string;
  initialSearch?: string;
}) {
  // Un hébergeant qui ne demande qu'un type (« image » pour le sélecteur d'actifs de
  // GrapesJS) verrouille le filtre : le type promis à l'éditeur ne peut pas être
  // contourné depuis la liste. Sinon la barre d'outils laisse choisir.
  const fixed = useMemo<GedKindFilter | ''>(() => {
    const list = Array.isArray(types) ? types : types ? types.split(',') : [];
    return list.length === 1 ? (list[0] as GedKindFilter) : '';
  }, [types]);
  const [picked, setPicked] = useState<GedKindFilter | ''>('');
  const kind = fixed || picked;
  const typeLocked = !!fixed;
  const [search, setSearch] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch);
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<GedAssetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{ kinds: string[]; tags: string[] }>({ kinds: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    setError('');
    try {
      const result = await listGedAssets({ search: debounced || undefined, kind, tag: tag || undefined, page, limit: 24 });
      if (token !== request.current) return;
      setItems(result.items);
      setTotal(result.total);
      setFacets({ kinds: result.kinds || [], tags: result.tags || [] });
    } catch (cause) {
      if (token !== request.current) return;
      setError(cause instanceof Error ? cause.message : 'Liste indisponible.');
      setItems([]);
      setTotal(0);
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [debounced, kind, tag, page]);

  useEffect(() => {
    // En `async` : `load` pose `loading` avant son premier `await`, et React 19
    // refuse un `setState` synchrono dans un effet (double rendu à l'ouverture).
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 24));

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const asset = await uploadGedAsset({
        file,
        kind: /\.svg$/i.test(file.name) ? 'svg' : 'image',
        title: file.name.replace(/\.[^.]+$/, ''),
        tags: ['import'],
      });
      await load();
      if (asset && onSelect) onSelect(asset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sc-browser" style={{ height }}>
      {title ? <div className="sc-card__title">{title}</div> : null}
      <div className="sc-browser__tools">
        <label className="sc-color" style={{ flex: '1 1 180px', paddingInline: 8, gap: 6 }}>
          <Search size={13} style={{ color: '#64748b' } as React.CSSProperties} />
          <input
            className="sc-input"
            style={{ border: 0, background: 'transparent', padding: 0 }}
            placeholder="Nom, légende, étiquette…"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </label>
        <select
          className="sc-select"
          style={{ width: 'auto' }}
          value={kind || ''}
          disabled={typeLocked}
          onChange={(event) => {
            setPage(1);
            setPicked(event.target.value as GedKindFilter | '');
          }}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" className="sc-btn sc-btn--icon" title="Rafraîchir" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} />
        </button>
        {allowImport ? (
          <label className="sc-btn" title="Importer depuis ce poste : le fichier est écrit dans la GED, puis posé là où l'hôte le demande" style={{ cursor: busy ? 'progress' : 'pointer' }}>
            <Upload size={14} />
            Importer
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml" hidden disabled={busy} onChange={(event) => void importFile(event.target.files?.[0])} />
          </label>
        ) : null}
      </div>

      {facets.tags.length ? (
        <div className="sc-row sc-row--wrap" style={{ gap: 4 }}>
          <button
            type="button"
            className={`sc-btn sc-btn--ghost${tag ? '' : ' sc-btn--on'}`}
            style={{ padding: '2px 7px', fontSize: 11 }}
            onClick={() => {
              setTag('');
              setPage(1);
            }}
          >
            tout
          </button>
          {facets.tags.slice(0, 14).map((facet) => (
            <button
              key={facet}
              type="button"
              className={`sc-btn sc-btn--ghost${tag === facet ? ' sc-btn--on' : ''}`}
              style={{ padding: '2px 7px', fontSize: 11 }}
              onClick={() => {
                setTag(tag === facet ? '' : facet);
                setPage(1);
              }}
            >
              #{facet}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="sc-browser__list"
        style={{ height: 'auto', outline: over ? '2px dashed rgba(163, 230, 53, 0.8)' : undefined, outlineOffset: -2 }}
        onDragOver={(event) => {
          if (!allowImport || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (!allowImport) return;
          const dropped = Array.from(event.dataTransfer?.files || [])[0];
          if (!dropped) return;
          event.preventDefault();
          setOver(false);
          void importFile(dropped);
        }}
      >
        {error ? (
          <div className="sc-empty">
            <span>{error}</span>
            <button type="button" className="sc-btn" onClick={() => void load()}>
              Réessayer
            </button>
          </div>
        ) : loading && !items.length ? (
          <div className="sc-empty">
            <Layers size={18} />
            Chargement de la GED…
          </div>
        ) : !items.length ? (
          <div className="sc-empty">
            <ImageIcon size={18} />
            <span>Rien à montrer ici.</span>
            <small style={{ color: '#64748b' }}>{debounced ? `Aucun résultat pour « ${debounced} ».` : 'Déposez une image, ou créez une planche dans l’atelier.'}</small>
          </div>
        ) : (
          <div className="sc-grid">
            {items.map((asset) => (
              <AssetTile
                key={asset.file}
                asset={asset}
                selected={selectedFile === asset.file}
                onOpen={onSelect ? () => onSelect(asset) : undefined}
                onImport={onImportAsset ? () => onImportAsset(asset) : undefined}
                onStudio={allowOpenInStudio && onOpenInStudio ? () => onOpenInStudio(asset) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sc-browser__foot">
        <span>
          {total} asset{total > 1 ? 's' : ''}
          {facets.kinds.length > 1 ? ` · ${facets.kinds.join(', ')}` : ''}
        </span>
        {pages > 1 ? (
          <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" className="sc-btn sc-btn--icon" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              ‹
            </button>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {page}/{pages}
            </span>
            <button type="button" className="sc-btn sc-btn--icon" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>
              ›
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );

}

function AssetTile({ asset, selected, onOpen, onImport, onStudio }: { asset: GedAssetSummary; selected?: boolean; onOpen?: () => void; onImport?: () => void; onStudio?: () => void }) {
  const isPlan = asset.kind === 'canvas';
  return (
    <div
      className={`sc-tile${onOpen ? '' : ' sc-tile--static'}`}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-selected={selected}
      onClick={onOpen}
      onDoubleClick={(event) => {
        // Les boutons posés sur la vignette (télécharger, ouvrir dans l'atelier) gardent
        // leur propre geste : sans ce filtre, un double-clic malchanceux poserait l'asset
        // ET déclencherait le bouton dessous.
        if ((event.target as HTMLElement | null)?.closest('a,button')) return;
        onImport?.();
      }}
      title={onImport ? 'Clic : préparer · double-clic : poser sur la planche' : undefined}
      onKeyDown={(event) => {
        if (onOpen && event.key === 'Enter') onOpen();
        // `Espace` = le même geste que le double-clic : poser. Un sélecteur de champ a
        // déjà « Entrée » pour valider, l'atelier a besoin des deux.
        if (event.key === ' ') {
          event.preventDefault();
          if (onImport) onImport();
          else onOpen?.();
        }
      }}
      draggable
      onDragStart={(event) => {
        // Le glisser-déposer vers la page se fait avec le geste natif du navigateur :
        // GrapesJS lit `text/html` dans son iframe et transforme ce que je lui donne.
        // Embarquer la classe et la référence GED ici suffit à faire du dépôt un bloc
        // d'atelier rééditable, sans câble côté frame.
        const html = isPlan
          ? `<img class="sari-canvas" data-sari-canvas="${asset.file}" src="${asset.url}" alt="${(asset.title || asset.name || '').replace(/"/g, '&quot;')}">`
          : `<img src="${asset.url}" alt="${(asset.title || asset.alt || '').replace(/"/g, '&quot;')}">`;
        event.dataTransfer.setData('text/html', html);
        event.dataTransfer.setData('text/plain', asset.url);
        // Le geste d'à côté : glisser une vignette sur le plan doit la POSER, et non
        // naviguer vers son URL. La clé est la référence GED, lue par l'atelier au dépôt.
        event.dataTransfer.setData('application/x-sari-ged', JSON.stringify({ file: asset.file, url: asset.url, kind: asset.kind }));
        event.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <span className="sc-tile__media">
        {asset.url ? (
          // Une SVG de la GED est du contenu importé : `<img>` l'affiche sans laisser un
          // `<script>` caché dans le dessin s'exécuter dans la page d'administration.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={isPlan ? asset.render?.png || asset.url : asset.url} alt="" loading="lazy" />
        ) : null}
      </span>
      <span className="sc-tile__caption">
        {asset.title || asset.name}
        <small>
          {isPlan ? 'planche' : asset.kind} · {asset.width}×{asset.height}
          {asset.version > 1 ? ` · v${asset.version}` : ''}
          {asset.editable ? ' · éditable' : ''}
        </small>
      </span>
      {onStudio ? (
        <span className="sc-row" style={{ padding: '0 5px 5px', gap: 3 }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="sc-btn sc-btn--ghost" style={{ padding: '2px 6px', fontSize: 11 }} title="Ouvrir dans l’atelier" onClick={onStudio}>
            <Star size={12} />
          </button>
          {asset.url ? (
            <a className="sc-btn sc-btn--ghost" style={{ padding: '2px 6px', fontSize: 11 }} title="Télécharger" href={asset.url} download>
              <Download size={12} />
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

