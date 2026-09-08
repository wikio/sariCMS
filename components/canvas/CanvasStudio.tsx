'use client';

/**
 * L'atelier graphique — la fenêtre qui s'ouvre au double-clic sur un bloc « Canvas
 * Editor », depuis le menu admin, ou depuis la fiche d'une image de la GED.
 *
 * Trois décisions structurelles :
 *
 * 1. Le canvas vit dans un `ref`, jamais dans l'état React. Un objet Fabric pèse
 *    plusieurs milliers de champs ; le confier à `useState` recréerait l'arbre à
 *    chaque glisser de souris. React n'est donc le spectateur que d'un instantané
 *    petit (`snap`), recalculé sur les événements du moteur.
 * 2. La fenêtre est rendue en `createPortal` sur `document.body` et se moque du
 *    conteneur qui l'appelle : GrapesJS pose des `transform` et des `overflow: hidden`
 *    qui casseraient un plein écran imbriqué.
 * 3. Enregistrer = une seule requête (`POST /ged/canvas-export`) qui écrit le rendu,
 *    la SVG si le document est entièrement vectoriel, et l'état rejouable. Le PNG est
 *    la vérité affichée ; l'état est la vérité rééditable. Les deux portent le même nom
 *    et la même version, sinon la page afficherait un aperçu d'une autre époque.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Brush,
  Check,
  Copy,
  Download,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Link2,
  Loader2,
  Maximize2,
  MousePointer2,
  MoveHorizontal,
  Package,
  Redo2,
  Save,
  Shapes,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { createEngine } from '@/lib/canvas/engine';
import type { Engine } from '@/lib/canvas/engine';
import { ensureFonts } from '@/lib/canvas/fonts';
import { resolveSlots } from '@/lib/canvas/document';
import type { BackgroundSpec, CanvasReference, LayerInfo, ObjectProps, SelectionState, ToolId } from '@/lib/canvas/types';
import { deleteGedAsset, exportCanvas, listGedTemplates, loadImageSize, readGedAsset, readGedAssetState, readGedTemplate, saveGedTemplate, uploadGedAsset, type GedAssetSummary, type GedTemplateSummary } from '@/lib/ged/client';
import { Card, ColorField, Field, Icon, Menu, MenuItem, MenuLabel, NumberField, Row, Segmented, SelectField, SliderField, TextField } from './widgets';
import { BackgroundPanel, ChartPanel, ImagePanel, LayerPanel, ObjectPanel, PathPanel, TextPanel } from './panels';
import { GedAssetBrowser } from './GedAssetBrowser';
import '@/components/canvas/canvas.css';

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Sélection', icon: <MousePointer2 size={16} /> },
  { id: 'hand', label: 'Déplacer le plan', icon: <MoveHorizontal size={16} /> },
  { id: 'text', label: 'Texte', icon: <Type size={16} /> },
  { id: 'brush', label: 'Pinceau', icon: <Brush size={16} /> },
  { id: 'eraser', label: 'Gomme', icon: <Copy size={16} /> },
];

const SHAPES: { id: ToolId; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Cercle' },
  { id: 'line', label: 'Ligne' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'polygon', label: 'Polygone' },
  { id: 'star', label: 'Étoile' },
  { id: 'arrow', label: 'Flèche' },
];

type Tab = 'objet' | 'calques' | 'fond' | 'graphique' | 'ged';

export function CanvasStudio({
  open,
  onClose,
  asset,
  templateId,
  context,
  onInsert,
  allowInsert = true,
  document: initialDocument,
  artboard,
}: {
  open: boolean;
  onClose: () => void;
  /** La planche de la GED à réouvrir (`module/fichier`) ; vide = planche neuve. */
  asset?: string | null;
  /** Un gabarit du catalogue, pour démarrer dessus. */
  templateId?: string | null;
  context?: { pageId?: string; pageSlug?: string; componentId?: string; field?: string };
  /** Appelé quand l'utilisateur rend la planche à la page (bouton « Insérer »). */
  onInsert?: (reference: CanvasReference) => void;
  allowInsert?: boolean;
  document?: unknown;
  artboard?: { width: number; height: number };
}) {
  const host = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState('');
  const [tab, setTab] = useState<Tab>('objet');
  const [sheet, setSheet] = useState<'' | 'gabarits' | 'ged' | 'stats' | 'calques'>('');
  /** Un cadre de gabarit en attente d'un média : le prochain choix de la GED le remplit. */
  const [slotPick, setSlotPick] = useState<{ id: string; type: 'text' | 'image' | 'color' } | null>(null);
  const [name, setName] = useState('Planche sans titre');
  const [saving, setSaving] = useState(false);
  /** La référence GED en cours : un état, pas une `ref` — l'en-tête l'affiche. */
  const [currentFile, setCurrentFile] = useState<string | null>(asset || null);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  /** Un fichier du poste survole le plan : on le marque avant le lâcher. */
  const [planOver, setPlanOver] = useState(false);
  const [snap, setSnap] = useState<{
    selection: SelectionState | null;
    props: ObjectProps | null;
    layers: LayerInfo[];
    tool: ToolId;
    zoom: number;
    artboard: { width: number; height: number };
    background: BackgroundSpec;
    brush: { size: number; color: string; smoothing: number };
    grid: { show: boolean; size: number; snap: boolean };
    history: { past: number; future: number; bytes: number };
    dirty: boolean;
    anchors: number;
  }>({
    selection: null,
    props: null,
    layers: [],
    tool: 'select',
    zoom: 1,
    artboard: artboard || { width: 1080, height: 1080 },
    background: { mode: 'solid', color: '#ffffff' },
    brush: { size: 6, color: '#0f172a', smoothing: 0.5 },
    grid: { show: false, size: 20, snap: true },
    history: { past: 0, future: 0, bytes: 0 },
    dirty: false,
    anchors: 0,
  });
  const lastArtboard = useRef({ width: 1080, height: 1080 });
  const [slots, setSlots] = useState<ReturnType<typeof resolveSlots>>([]);
  const [templates, setTemplates] = useState<GedTemplateSummary[]>([]);
  const refresh = useCallback(() => {
    const instance = engineRef.current;
    if (!instance) return;
    const selected = instance.selectedProps();
    setSnap((value) => ({
      ...value,
      props: selected,
      layers: instance.layers(),
      tool: instance.getTool(),
      zoom: instance.getZoom(),
      artboard: instance.getArtboard(),
      background: instance.getBackground(),
      brush: instance.getBrush(),
      grid: instance.getGrid(),
      history: instance.historyStats(),
      dirty: instance.isDirty(),
      anchors: instance.pathAnchorCount(),
    }));
  }, []);

  // La fenêtre est détruite à la fermeture : un canvas caché qui continue d'écouter
  // la souris et de rendre coûterait du cadre par seconde pour rien.
  useEffect(() => {
    if (!open || !host.current) return;
    let cancelled = false;
    let created: Engine | null = null;
    setFailed('');
    // La référence s'initialise ici et non dans un effet dédié : ouverte sur un asset,
    // la planche sait déjà où elle se réécrit.
    setCurrentFile(asset || null);
    void ensureFonts();

    (async () => {
      try {
        const rect = host.current!.getBoundingClientRect();
        const instance = await createEngine({
          element: ensureCanvas(host.current!),
          width: Math.max(320, Math.floor(rect.width || 900)),
          height: Math.max(240, Math.floor(rect.height || 620)),
          background: { mode: 'solid', color: '#ffffff' },
          onEvent: (event) => {
            if (event.type === 'selection') setSnap((value) => ({ ...value, selection: event.state }));
            if (event.type === 'error') setNotice({ kind: 'warn', text: event.message });
            refresh();
          },
        });
        if (cancelled) {
          instance.destroy();
          return;
        }
        created = instance;
        engineRef.current = instance;
        setEngine(instance);

        // À l'ouverture, le format vient de l'appelant (bloc de page, gabarit) ou du
        // dernier format utilisé en séance ; 1080 carré reste le défaut de l'atelier.
        const width = artboard?.width || lastArtboard.current.width;
        const height = artboard?.height || lastArtboard.current.height;
        instance.setArtboard(width, height);
        instance.fitTo({ width: rect.width || 900, height: rect.height || 620 });

        const loaded = await pickSource({ instance, asset, templateId, document: initialDocument });
        if (loaded) {
          setName(loaded.title);
          setSlots(loaded.slots);
          if (loaded.notice) setNotice({ kind: loaded.notice.kind, text: loaded.notice.text });
        }
        refresh();
      } catch (error) {
        if (!cancelled) setFailed(error instanceof Error ? error.message : "L'atelier n’a pas pu démarrer.");
      }
    })();

    return () => {
      cancelled = true;
      created?.destroy();
      engineRef.current = null;
      setEngine(null);
    };
    // Ouverture = une vie de moteur. Tout le reste (sélections, onglets) passe par
    // `refresh`, pour ne pas recréer le canvas pendant une édition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset, templateId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const instance = engineRef.current;
      if (!instance) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName || '') || (event.target as HTMLElement)?.isContentEditable;
      if (event.key === 'Escape' && !typing) {
        event.preventDefault();
        onClose();
        return;
      }
      if (typing) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) instance.redo();
        else instance.undo();
        refresh();
      } else if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        instance.redo();
        refresh();
      } else if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        void instance.duplicate();
      } else if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        // La sélection multiple se construit dans le moteur : un `ActiveSelection`
        // fabriqué ici même aurait des coordonnées relatives fausses.
        instance.selectAll();
        refresh();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        instance.remove();
      } else if (event.key.startsWith('Arrow')) {
        const step = event.shiftKey ? 10 : 1;
        event.preventDefault();
        instance.nudge(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, refresh]);

  // Redimensionnement de la fenêtre : le canvas suit, le plan garde sa place.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const instance = engineRef.current;
      const node = host.current;
      if (!instance || !node) return;
      const rect = node.getBoundingClientRect();
      instance.canvas.setDimensions({ width: Math.max(320, rect.width), height: Math.max(240, rect.height) });
      instance.fitTo({ width: rect.width, height: rect.height });
      void instance.render();
      refresh();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (observer && host.current) observer.observe(host.current);
    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [open, refresh]);

  const save = async (target: 'same' | 'new' | 'image') => {
    const instance = engineRef.current;
    if (!instance) return;
    setSaving(true);
    setNotice(null);
    try {
      const { svg, vectorOnly, note } = await instance.toSvgString();
      const state = JSON.parse(instance.serialize());
      const payload = {
        file: target === 'same' && currentFile ? currentFile : undefined,
        kind: target === 'image' ? 'image' : 'canvas',
        name: name || 'planche',
        title: name,
        alt: name,
        tags: ['atelier'],
        width: instance.getArtboard().width,
        height: instance.getArtboard().height,
        png: (await instance.toPngDataUrl({ scale: 1, format: 'png' })).replace(/^data:image\/png;base64,/, ''),
        svg: vectorOnly ? svg : undefined,
        state,
        source: { ...context, origin: 'atelier' as const },
      };
      const result = await exportCanvas(payload);
      setCurrentFile(result.asset.file);
      instance.markSaved();
      setNotice({
        kind: vectorOnly ? 'info' : 'warn',
        text: `${note || 'Planche enregistrée.'} (${result.asset.file}${result.version > 1 ? ` · v${result.version}` : ''})`,
      });
      const reference: CanvasReference = {
        file: result.asset.file,
        url: result.asset.url,
        kind: result.asset.kind,
        prefix: result.asset.prefix,
        width: result.asset.width,
        height: result.asset.height,
        version: result.version,
      };
      if (target !== 'new' && allowInsert && onInsert) onInsert(reference);
      refresh();
      return reference;
    } catch (error) {
      setNotice({ kind: 'warn', text: error instanceof Error ? error.message : 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
      return undefined;
    }
  };

  const download = async (what: 'png' | 'svg' | 'json') => {
    const instance = engineRef.current;
    if (!instance) return;
    if (what === 'json') {
      triggerDownload(new Blob([instance.serialize()], { type: 'application/json' }), `${slug(name)}.sari.canvas.json`);
      return;
    }
    if (what === 'png') {
      const url = await instance.toPngDataUrl({ scale: 2, format: 'png' });
      triggerDownload(dataUrlToBlob(url), `${slug(name)}@2x.png`);
      return;
    }
    const { svg, note } = await instance.toSvgString();
    setNotice(note ? { kind: 'warn', text: note } : null);
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), `${slug(name)}.svg`);
  };

  const copyHtml = async () => {
    const instance = engineRef.current;
    if (!instance) return;
    const url = currentFile ? (await readGedAsset(currentFile)).asset.url : await instance.toPngDataUrl({ scale: 2, format: 'png' });
    const html = `<figure class="sari-canvas"><img src="${url}" alt="${(name || '').replace(/"/g, '&quot;')}" width="${instance.getArtboard().width}" height="${instance.getArtboard().height}" loading="lazy" decoding="async"></figure>`;
    try {
      await navigator.clipboard.writeText(html);
      setNotice({ kind: 'info', text: 'Bloc HTML copié — collable dans un bloc code de l’éditeur de page.' });
    } catch {
      setNotice({ kind: 'warn', text: 'Le presse-papiers est refusé par le navigateur ; téléchargez le fichier à la place.' });
    }
  };

  /**
   * Le catalogue des gabarits. Une réponse vide est un état normal — les gabarits
   * vivent dans `public/canvas/templates/` et Next les sert en statique — donc on
   * relit le disque par ce chemin avant de dire « vide ».
   */
  const openTemplates = async () => {
    setSheet('gabarits');
    if (templates.length) return;
    try {
      const result = await listGedTemplates();
      if (result.templates.length) {
        setTemplates(result.templates);
        return;
      }
      throw new Error('vide');
    } catch {
      setNotice({ kind: 'warn', text: 'Catalogue injoignable : les gabarits sont relus un à un depuis public/canvas/templates.' });
      const guessed = await guessTemplates();
      if (guessed.length) setTemplates(guessed);
    }
  };

  const applyTemplate = async (id: string) => {
    const instance = engineRef.current;
    if (!instance) return;
    try {
      const { meta, template } = await readGedTemplate(id);
      instance.setArtboard(meta.format.width, meta.format.height);
      const result = await instance.loadResilient(template);
      setSlots(resolveSlots(template));
      setName(meta.title);
      setSheet('');
      setNotice({
        kind: result.partial ? 'warn' : 'info',
        text: result.partial
          ? `Gabarit « ${meta.title} » appliqué sans ses images (${result.dropped.length} visuel${result.dropped.length > 1 ? 's' : ''} introuvable${result.dropped.length > 1 ? 's' : ''}) — les calques, textes et formats sont là.`
          : `Gabarit « ${meta.title} » appliqué. Les zones modifiables sont dans le panneau de droite.`,
      });
      refresh();
    } catch (error) {
      const direct = await fetchJsonFromStatic(id);
      if (!direct) {
        setNotice({ kind: 'warn', text: `Gabarit « ${id} » non chargé : ${error instanceof Error ? error.message : 'lecture impossible'}.` });
        return;
      }
      const size = (direct as { sariStudio?: { width?: number; height?: number } }).sariStudio;
      if (size?.width && size?.height) instance.setArtboard(size.width, size.height);
      await instance.loadResilient(direct);
      setSlots(resolveSlots(direct));
      setSheet('');
      setName(String(id));
      setNotice({ kind: 'info', text: `Gabarit « ${id} » appliqué en lisant le fichier directement.` });
      refresh();
    }
  };

  const openGed = async (asset: GedAssetSummary) => {
    const instance = engineRef.current;
    if (!instance) return;
    if (slotPick) {
      // « Poser dans ce cadre » : le média rejoint la zone du gabarit, il ne s'ajoute
      // pas en vrac au-dessus de tout — c'est ce qui manquait pour remplir un cadre.
      const index = snap.layers.findIndex((layer) => layer.id === slotPick.id);
      setSlotPick(null);
      setSheet('');
      if (index >= 0) {
        instance.selectIndex(index);
        if (slotPick.type === 'color') instance.setPaint('fill', { kind: 'solid', color: asset.url });
        else if (slotPick.type === 'image') await instance.replaceImage(asset.url);
        else instance.setText({ text: asset.title || asset.name });
        setNotice({ kind: 'info', text: `« ${asset.title || asset.name} » posé dans le cadre « ${slotPick.id} ».` });
        refresh();
        return;
      }
      setNotice({ kind: 'warn', text: `Cadre « ${slotPick.id} » introuvable dans les calques : le visuel est posé sur la planche.` });
    }
    if (asset.kind === 'canvas') {
      await openAsset(asset.file);
      return;
    }
    try {
      // Un SVG de la GED devient des objets modifiables (dégroupables, repeignables)
      // et non une image rasterisée : c'est le « SVG importé éditable » du besoin.
      const at = instance.pointer();
      if (/\.svg$/i.test(asset.url)) await instance.addSvg(await fetchSvgText(asset.url), { at });
      else await instance.addImage(asset.url, { fit: 'contain', insetSize: true, at });
    } catch (error) {
      setNotice({ kind: 'warn', text: error instanceof Error ? error.message : `Visuel non chargeable : ${asset.url}` });
      return;
    }
    setSheet('');
    refresh();
  };

  const openAsset = async (file: string) => {
    const instance = engineRef.current;
    if (!instance) return;
    let asset: GedAssetSummary;
    try {
      asset = (await readGedAsset(file)).asset;
    } catch {
      asset = fallbackAsset(file);
    }
    let state: unknown = null;
    try {
      state = (await readGedAssetState(asset.file || file)).state;
    } catch {
      state = null;
    }
    if (state) {
      const result = await instance.loadResilient(state);
      setNotice({
        kind: result.partial ? 'warn' : 'info',
        text: result.partial
          ? `Réédition de ${asset.file} — ${result.dropped.length} image(s) du document étaient introuvables sur le disque et ont été retirées de la planche.`
          : `Réédition de ${asset.file}${asset.version > 1 ? ` (v${asset.version})` : ''} — l’état éditable est complet.`,
      });
      setCurrentFile(asset.file);
      setName(asset.title || asset.name);
      setSlots(resolveSlots(state));
      refresh();
      return;
    }
    const size = await loadImageSize(asset.url).catch(() => ({ width: asset.width, height: asset.height }));
    if (!size.width || !size.height) {
      // Le fichier n'est pas là où son URL le dit : mieux vaut le dire que poser un
      // fond blanc de 1080×1080 et laisser chercher l'utilisateur.
      setNotice({ kind: 'warn', text: `Visuel non chargeable : ${asset.url}. Le fichier est absent de public/uploads/${asset.file} (ou n’est pas une image) — le récupérer dans la GED, ou le re-poser depuis ce poste.` });
      return;
    }
    instance.setArtboard(size.width || 1080, size.height || 1080);
    try {
      if (/\.svg$/i.test(asset.url)) await instance.addSvg(await fetchSvgText(asset.url));
      else await instance.addImage(asset.url, { fit: 'contain', insetSize: true });
    } catch (error) {
      setNotice({ kind: 'warn', text: error instanceof Error ? error.message : `Visuel non chargeable : ${asset.url}` });
      return;
    }
    setNotice({ kind: 'warn', text: 'Aucun état éditable pour ce fichier : la planche repart du rendu, les calques d’origine sont perdus.' });
    setCurrentFile(asset.file);
    setName(asset.title || asset.name);
    setSlots([]);
    refresh();
  };

  /**
   * Importer depuis ce poste, sans passer par la liste : le fichier est écrit dans la
   * GED (donc réutilisable ailleurs) puis posé sur la planche. Un SVG est importé en
   * objets, comme depuis le navigateur.
   */
  const importFromDesk = async (file: File | undefined) => {
    const instance = engineRef.current;
    if (!instance || !file) return;
    setNotice({ kind: 'info', text: `Import de « ${file.name} » dans la GED…` });
    try {
      const asset = await uploadGedAsset({ file, kind: /\.svg$/i.test(file.name) ? 'svg' : 'image', title: file.name.replace(/\.[^.]+$/, ''), tags: ['import'] });
      if (/\.svg$/i.test(asset.url)) await instance.addSvg(await fetchSvgText(asset.url));
      else await instance.addImage(asset.url, { fit: 'contain', insetSize: true });
      setNotice({ kind: 'info', text: `« ${asset.title || asset.name} » importé et posé (${asset.file}) — il est sélectionné : glissez-le, ou servez-vous des poignées.` });
    } catch (error) {
      setNotice({ kind: 'warn', text: error instanceof Error ? error.message : 'Import impossible.' });
    } finally {
      setSheet('');
      setPlanOver(false);
      refresh();
    }
  };

  const publishTemplate = async () => {
    const instance = engineRef.current;
    if (!instance) return;
    const id = slug(name);
    await saveGedTemplate({
      id,
      meta: {
        id,
        title: name,
        description: 'Publié depuis l’atelier.',
        category: 'Atelier',
        format: { width: instance.getArtboard().width, height: instance.getArtboard().height, name: 'libre', orientation: instance.getArtboard().width === instance.getArtboard().height ? 'carré' : instance.getArtboard().width > instance.getArtboard().height ? 'paysage' : 'portrait' },
        palette: ['#0f172a', '#f8fafc'],
        preview: null,
        file: `${id}.json`,
        version: 1,
        tags: ['atelier'],
        updatedAt: new Date().toISOString(),
        slots: slots.length ? slots.map((slot) => ({ id: slot.id, type: slot.type, label: slot.label, target: slot.id, default: slot.current, maxLength: slot.maxLength })) : undefined,
      } as GedTemplateSummary,
      template: JSON.parse(instance.serialize()),
    });
    setNotice({ kind: 'info', text: `Gabarit « ${name} » publié dans public/canvas/templates/${id}.json.` });
  };

  if (!open) return null;

  const props = snap.props;
  const selection = snap.selection;

  const body = (
    <div className="sc-shell" role="dialog" aria-modal="true" aria-label="Atelier graphique">
      <header className="sc-bar">
        <button type="button" className="sc-btn sc-btn--ghost" title="Fermer (Échap)" onClick={onClose}>
          <ArrowLeft size={14} /> Fermer
        </button>
        <span className="sc-title">
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Nom de la planche" />
          <small>
            {snap.artboard.width}×{snap.artboard.height}
            {currentFile ? ` · ${currentFile}` : ''}
            {snap.dirty ? ' · non enregistré' : ''}
          </small>
        </span>
        <span className="sc-bar__spacer" />
        <Icon label="Annuler (Ctrl+Z)" disabled={!snap.history.past} onClick={() => (engineRef.current?.undo(), refresh())}>
          <Undo2 size={14} />
        </Icon>
        <Icon label="Rétablir (Ctrl+Maj+Z)" disabled={!snap.history.future} onClick={() => (engineRef.current?.redo(), refresh())}>
          <Redo2 size={14} />
        </Icon>
        <span className="sc-seg" role="group" aria-label="Zoom">
          <button type="button" title="Zoom arrière" onClick={() => engine?.setZoom(engine.getZoom() / 1.2)}>
            <ZoomOut size={13} />
          </button>
          <button type="button" title="Ajuster" onClick={() => engine?.fitTo({ width: host.current?.clientWidth || 900, height: host.current?.clientHeight || 600 })}>
            {Math.round(snap.zoom * 100)}%
          </button>
          <button type="button" title="Zoom avant" onClick={() => engine?.setZoom(engine.getZoom() * 1.2)}>
            <ZoomIn size={13} />
          </button>
        </span>
        <Menu label="Exporter" icon={<Download size={14} />}>
          <MenuLabel>Rendu</MenuLabel>
          <MenuItem onClick={() => void download('png')} hint="×2">
            PNG
          </MenuItem>
          <MenuItem onClick={() => void download('svg')} hint={selection ? undefined : 'si vectoriel'}>
            SVG
          </MenuItem>
          <MenuLabel>Reprise</MenuLabel>
          <MenuItem onClick={() => void download('json')}>État de l’atelier (JSON)</MenuItem>
          <div className="sc-menu__sep" />
          <MenuItem onClick={() => void copyHtml()}>Copier le bloc HTML</MenuItem>
          <MenuItem onClick={() => void publishTemplate()}>Publier comme gabarit</MenuItem>
        </Menu>
        <Menu label="Enregistrer" icon={<Save size={14} />} className="sc-menu">
          <MenuLabel>Dans la GED</MenuLabel>
          <MenuItem onClick={() => void save(currentFile ? 'same' : 'new')} hint={currentFile ? 'nouvelle version' : 'nouveaux fichiers'}>
            <Check size={13} /> Enregistrer la planche
          </MenuItem>
          <MenuItem onClick={() => void save('new')}>Enregistrer comme nouvelle planche</MenuItem>
          <MenuItem onClick={() => void save('image')} hint="IMG_">
            Enregistrer comme image
          </MenuItem>
          <div className="sc-menu__sep" />
          <MenuItem
            onClick={() => {
              if (currentFile) void deleteGedAsset(currentFile).then(() => onClose());
            }}
          >
            Supprimer de la GED
          </MenuItem>
        </Menu>
        {allowInsert && onInsert ? (
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            onClick={() => {
              void save('same').then((reference) => reference && onInsert(reference));
            }}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />} Insérer dans la page
          </button>
        ) : null}
      </header>

      <div className="sc-body">
        <nav className="sc-rail" aria-label="Outils">
          <div className="sc-rail__group">
            <span className="sc-rail__label">Outils</span>
            {TOOLS.map((tool) => (
              <button key={tool.id} type="button" className="sc-tool" aria-pressed={snap.tool === tool.id} title={tool.label} onClick={() => (engine?.setTool(tool.id), refresh())}>
                {tool.icon}
                <span>{tool.label.slice(0, 4)}</span>
              </button>
            ))}
            <Menu label="" icon={<Shapes size={16} />}>
              <MenuLabel>Formes</MenuLabel>
              {SHAPES.map((shape) => (
                <MenuItem
                  key={shape.id}
                  onClick={() => {
                    engine?.setTool(shape.id);
                    refresh();
                  }}
                >
                  {shape.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
          <div className="sc-rail__group">
            <span className="sc-rail__label">Poser</span>
            <button type="button" className="sc-tool" title="Image de la GED" onClick={() => setSheet(sheet === 'ged' ? '' : 'ged')}>
              <ImageIcon size={16} />
              <span>GED</span>
            </button>
            <button type="button" className="sc-tool" title="Gabarits" onClick={() => (sheet === 'gabarits' ? setSheet('') : void openTemplates())}>
              <LayoutTemplate size={16} />
              <span>Gabarit</span>
            </button>
          </div>
          <div className="sc-rail__group">
            <span className="sc-rail__label">Aide</span>
            <button type="button" className="sc-tool" aria-pressed={snap.grid.show} title="Grille et magnétisme" onClick={() => (engine?.setGrid({ show: !snap.grid.show, snap: !snap.grid.snap }), refresh())}>
              <Grid3x3 size={16} />
              <span>Grille</span>
            </button>
            <button type="button" className="sc-tool" aria-pressed={sheet === 'stats'} title="Statistiques de la planche" onClick={() => setSheet(sheet === 'stats' ? '' : 'stats')}>
              <Package size={16} />
              <span>États</span>
            </button>
          </div>
        </nav>

        <main className="sc-stage">
          <div className="sc-stage__head">
            {snap.tool === 'brush' || snap.tool === 'eraser' ? (
              <>
                <SliderField label="Taille" value={snap.brush.size} min={1} max={80} onChange={(size) => engine?.setBrush({ size })} onCommit={(size) => engine?.setBrush({ size })} unit="px" />
                <SliderField label="Fluidité" value={snap.brush.smoothing} min={0} max={1} step={0.05} onChange={(smoothing) => engine?.setBrush({ smoothing })} onCommit={(smoothing) => engine?.setBrush({ smoothing })} />
                <ColorField label="Couleur" value={snap.brush.color} onChange={(color) => engine?.setBrush({ color })} onCommit={(color) => engine?.setBrush({ color })} />
              </>
            ) : (
              <>
                <Segmented
                  value={tab}
                  onChange={(next) => setTab(next as Tab)}
                  options={[
                    { value: 'objet', label: 'Objet' },
                    { value: 'calques', label: 'Calques' },
                    { value: 'fond', label: 'Fond' },
                    { value: 'graphique', label: 'Graphique' },
                    { value: 'ged', label: 'GED' },
                  ]}
                />
                <Icon label="Grille" pressed={snap.grid.show} onClick={() => (engine?.setGrid({ show: !snap.grid.show, snap: !snap.grid.snap }), refresh())}>
                  <Grid3x3 size={14} />
                </Icon>
                <Icon label="Ajuster le zoom" onClick={() => engine?.fitTo({ width: host.current?.clientWidth || 900, height: host.current?.clientHeight || 600 })}>
                  <Maximize2 size={14} />
                </Icon>
              </>
            )}
          </div>
          <div
            className="sc-host"
            ref={host}
            // Un fichier du poste lâché sur le plan est importé puis posé : c'est le
            // même chemin que le bouton « Importer » du navigateur de GED, et le
            // réflexe naturel de n'importe qui vient de Canva.
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
              event.preventDefault();
              setPlanOver(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setPlanOver(false);
            }}
            onDrop={(event) => {
              const file = Array.from(event.dataTransfer?.files || [])[0];
              if (!file) return;
              event.preventDefault();
              setPlanOver(false);
              void importFromDesk(file);
            }}
            style={planOver ? { outline: '2px dashed rgba(163, 230, 53, 0.85)', outlineOffset: -4 } : undefined}
          >
            {failed ? <div className="sc-empty">Atelier indisponible : {failed}</div> : null}
            {!failed && !snap.layers.length ? (
              <div className="sc-host__empty">
                <LayoutTemplate size={22} />
                <span>Planche vide</span>
                <small style={{ color: '#64748b' }}>Un outil du rail de gauche, ou un gabarit, pour commencer.</small>
              </div>
            ) : null}
            <div className="sc-host__hint">{snap.layers.length ? `${snap.layers.length} calques · ${snap.history.past} étapes` : ''}</div>
          </div>
          {notice ? (
            <div className="sc-status">
              <span className={`sc-flag sc-flag--${notice.kind}`}>{notice.text}</span>
              <span className="sc-bar__spacer" />
              <button type="button" className="sc-btn sc-btn--ghost" onClick={() => setNotice(null)}>
                masquer
              </button>
            </div>
          ) : (
            <div className="sc-status">
              <span>
                {selection?.count ? `${selection.count} objet${selection.count > 1 ? 's' : ''} · poignées pour redimensionner, flèches pour ajuster` : 'aucune sélection · glissez un calque pour le déplacer, l’outil « Déplacer le plan » de la barre déplace la vue'} · zoom {Math.round(snap.zoom * 100)}% · grille {snap.grid.size}px{snap.grid.snap ? ' (magnétisme)' : ''}
              </span>
            </div>
          )}
        </main>

        <aside className="sc-panel">
          {tab === 'objet' && engine ? (
            <>
              <ObjectPanel engine={engine} props={props} canUngroup={!!selection && selection.count > 1} />
              {props?.text !== undefined && engine ? <TextPanel engine={engine} props={props} /> : null}
              {props?.src !== undefined ? <ImagePanel engine={engine} props={props} onPick={() => setSheet('ged')} /> : null}
              {selection?.hasPath ? <PathPanel engine={engine} count={snap.anchors} /> : null}
            </>
          ) : null}
          {tab === 'calques' && engine ? <LayerPanel engine={engine} layers={snap.layers} /> : null}
          {tab === 'fond' && engine ? <BackgroundPanel engine={engine} background={snap.background} /> : null}
          {tab === 'graphique' && engine ? <ChartPanel engine={engine} props={props} /> : null}
          {tab === 'ged' ? <GedAssetBrowser height={520} onSelect={(asset) => void openGed(asset)} types={['image', 'svg', 'canvas']} allowImport /> : null}
          {slots.length && engine ? (
            <Card title="Zones du gabarit" icon={<Layers size={12} />}>
              {slots.map((slot) => (
                <SlotField
                  key={slot.id}
                  slot={slot}
                  onPick={(picked) => {
                    setSlotPick(picked);
                    setSheet('ged');
                  }}
                  onText={(value) => {
                    const index = snap.layers.findIndex((layer) => layer.id === slot.id);
                    if (index < 0) return;
                    engine.selectIndex(index);
                    if (slot.type === 'color') engine.setPaint('fill', { kind: 'solid', color: value });
                    else if (slot.type === 'image') void engine.replaceImage(value);
                    else engine.setText({ text: value });
                    refresh();
                  }}
                />
              ))}
            </Card>
          ) : null}
        </aside>
      </div>

      {sheet === 'gabarits' ? (
        <div className="sc-sheet">
          <Card title="Gabarits" icon={<LayoutTemplate size={12} />} actions={<Icon label="Fermer" onClick={() => setSheet('')}>✕</Icon>}>
            <div className="sc-grid" style={{ maxHeight: '58vh', width: 520 }}>
              {templates.map((template) => (
                <button key={template.id} type="button" className="sc-tile" onClick={() => void applyTemplate(template.id)}>
                  <span className="sc-tile__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {template.preview ? <img src={template.preview} alt="" /> : <LayoutTemplate size={18} style={{ color: '#334155' }} />}
                </span>
                  <span className="sc-tile__caption">
                    {template.title}
                    <small>
                      {template.format.width}×{template.format.height} · {template.category}
                    </small>
                  </span>
                </button>
              ))}
              {!templates.length ? <div className="sc-empty">Catalogue vide — posez un JSON dans `public/canvas/templates`.</div> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {sheet === 'ged' ? (
        <div className="sc-sheet">
          <Card title="Importer depuis la GED" icon={<ImageIcon size={12} />} actions={<Icon label="Fermer" onClick={() => setSheet('')}>✕</Icon>}>
            <GedAssetBrowser
              height={440}
              types={['image', 'svg', 'canvas']}
              onSelect={(asset) => void openGed(asset)}
              allowOpenInStudio
              onOpenInStudio={(asset) => void openAsset(asset.file)}
              allowImport
            />
          </Card>
        </div>
      ) : null}

      {sheet === 'stats' ? (
        <div className="sc-sheet">
          <Card title="Cette planche" icon={<Package size={12} />} actions={<Icon label="Fermer" onClick={() => setSheet('')}>✕</Icon>}>
            <div className="sc-stats">
              <Stat label="Calques" value={snap.layers.length} />
              <Stat label="Sélection" value={selection?.count || 0} />
              <Stat label="Annulables" value={snap.history.past} />
              <Stat label="Poids" value={`${Math.round(snap.history.bytes / 1024)} Ko`} />
            </div>
            <Row wrap>
              <Field label="Format">
                <SelectField
                  value={''}
                  options={[]}
                  onChange={(value) => {
                    const [width, height] = value.split('x').map(Number);
                    if (width && height) engine?.setArtboard(width, height);
                    refresh();
                  }}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Largeur">
                <NumberField label="" value={snap.artboard.width} min={64} max={6000} onChange={(width) => engine?.setArtboard(width, snap.artboard.height)} />
              </Field>
              <Field label="Hauteur">
                <NumberField label="" value={snap.artboard.height} min={64} max={6000} onChange={(height) => engine?.setArtboard(snap.artboard.width, height)} />
              </Field>
            </Row>
          </Card>
        </div>
      ) : null}
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(body, document.body);
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="sc-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/**
 * Un champ de zone du gabarit.
 *
 * `onPick` vaut pour les zones d'image et de couleur : taper une URL `/uploads/...` à
 * la main n'est pas un geste imaginable pour un maquettiste, et c'est pour ça que ces
 * cadres paraissaient « non modifiables ». Le bouton ouvre le navigateur de la GED en
 * mode « ce cadre » — le média choisi y atterrit, à la place du calque.
 */
function SlotField({
  slot,
  onText,
  onPick,
}: {
  slot: { id: string; type: 'text' | 'image' | 'color'; label: string; current: string; maxLength?: string | number };
  onText: (value: string) => void;
  onPick?: (slot: { id: string; type: 'text' | 'image' | 'color' }) => void;
}) {
  if (slot.type === 'color') {
    return (
      <div className="sc-slot">
        <ColorField label={slot.label} value={slot.current || '#0f172a'} onChange={onText} onCommit={onText} />
        {onPick ? (
          <button type="button" className="sc-btn sc-btn--sm" onClick={() => onPick(slot)} title="Prendre une couleur depuis un visuel de la GED">
            Depuis un visuel
          </button>
        ) : null}
      </div>
    );
  }
  if (slot.type === 'image') {
    return (
      <div className="sc-slot">
        <TextField label={`${slot.label} (URL GED)`} value={slot.current || ''} onChange={onText} />
        {onPick ? (
          <button type="button" className="sc-btn sc-btn--sm" onClick={() => onPick(slot)} title="Poser une image de la GED dans ce cadre">
            Choisir dans la GED
          </button>
        ) : null}
      </div>
    );
  }
  return <TextField label={slot.label} value={slot.current || ''} onChange={onText} />;
}

/** L'élément sur lequel Fabric s'installe — créé à la demande, une seule fois. */
function ensureCanvas(host: HTMLDivElement): HTMLCanvasElement {
  const existing = host.querySelector('canvas');
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  return canvas;
}

async function pickSource({ instance, asset, templateId, document: initialDocument }: { instance: Engine; asset?: string | null; templateId?: string | null; document: unknown }) {
  if (asset) {
    // Un source introuvable ne doit PAS empêcher l'atelier de démarrer : on ouvre la
    // planche vide et on le dit. Avant, la 404 d'une fiche remontait jusqu'à l'effet
    // d'ouverture et l'écran afficher « L'atelier n'a pas pu démarrer » — pour un
    // fichier dont l'URL, elle, était simplement fausse.
    let summary: GedAssetSummary | null = null;
    let state: unknown = null;
    try {
      summary = (await readGedAsset(asset)).asset;
    } catch {
      summary = fallbackAsset(asset);
    }
    try {
      state = (await readGedAssetState(summary.file || asset)).state;
    } catch {
      state = null;
    }
    if (state) await instance.loadResilient(state);
    else if (summary.url) {
      try {
        if (/\.svg$/i.test(summary.url)) await instance.addSvg(await fetchSvgText(summary.url));
        else await instance.addImage(summary.url, { fit: 'contain', insetSize: true });
      } catch (error) {
        return {
          title: summary.title || summary.name,
          slots: [],
          notice: { kind: 'warn' as const, text: error instanceof Error ? error.message : `Image non chargeable : ${summary.url}` },
        };
      }
    }
    return {
      title: summary.title || summary.name,
      slots: resolveSlots(state || {}),
      notice: summary.file ? null : { kind: 'warn' as const, text: `Aucune fiche pour « ${asset} » : la planche repart du fichier tel qu'il est sur le disque.` },
    };
  }
  if (templateId) {
    try {
      const { meta, template } = await readGedTemplate(templateId);
      instance.setArtboard(meta.format.width, meta.format.height);
      const result = await instance.loadResilient(template);
      return {
        title: meta.title,
        slots: resolveSlots(template),
        notice: result.partial
          ? { kind: 'warn' as const, text: `Gabarit « ${meta.title} » chargé sans ses images (${result.dropped.length} visuel(s) introuvable(s) sur le disque).` }
          : { kind: 'info' as const, text: `Gabarit « ${meta.title} » chargé.` },
      };
    } catch {
      // Repli : `public/canvas` est servi en statique, donc le fichier se lit sans
      // API — c'est le chemin d'un gabarit posé à la main, sans entrée de catalogue.
      const direct = await fetchJsonFromStatic(templateId);
      if (!direct) {
        return { title: 'Nouvelle planche', slots: [], notice: { kind: 'warn' as const, text: `Gabarit « ${templateId} » illisible : ni le catalogue ni le fichier n'ont répondu.` } };
      }
      const size = (direct as { sariStudio?: { width?: number; height?: number } }).sariStudio;
      if (size?.width && size?.height) instance.setArtboard(size.width, size.height);
      await instance.loadResilient(direct);
      return { title: String(templateId), slots: resolveSlots(direct), notice: { kind: 'info' as const, text: 'Gabarit lu directement dans `public/canvas/templates` (catalogue muet).' } };
    }
  }
  if (initialDocument) {
    await instance.loadResilient(initialDocument);
    return { title: 'Nouvelle planche', slots: resolveSlots(initialDocument), notice: null };
  }
  return { title: 'Nouvelle planche', slots: [], notice: null };
}

/** Le catalogue, relu depuis l'espace statique quand l'API ne répond pas. */
async function guessTemplates(): Promise<GedTemplateSummary[]> {
  try {
    const response = await fetch('/canvas/templates/index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const body = (await response.json()) as { templates?: Record<string, never>[] };
    return (body.templates || []) as unknown as GedTemplateSummary[];
  } catch {
    return [];
  }
}

/** Une référence sans fiche : ce que l'atelier sait encore en tirer (l'URL sur le disque). */
function fallbackAsset(ref: string): GedAssetSummary {
  const clean = String(ref || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?uploads\//, '')
    .replace(/^\/+/, '');
  const name = clean.split('/').pop() || clean;
  const label = name.replace(/\.[^.]+$/, '');
  return {
    file: clean,
    name: label,
    title: label,
    alt: '',
    kind: /\.svg$/i.test(name) ? 'svg' : /\.(png|jpe?g|webp|avif|gif)$/i.test(name) ? 'image' : 'canvas',
    prefix: '',
    module: clean.includes('/') ? clean.split('/')[0] : 'ged',
    tags: [],
    width: 0,
    height: 0,
    size: 0,
    bytes: 0,
    mime: '',
    url: `/uploads/${clean}`,
    createdAt: '',
    updatedAt: '',
    version: 1,
    editable: false,
    editableFormat: null,
    stateFile: null,
    render: null,
    source: null,
    history: [],
    isVisual: true,
    extra: {},
  };
}

/** Un SVG de la GED, en texte : c'est ainsi qu'il devient modifiable et pas rasterisé. */
async function fetchSvgText(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`SVG non chargeable (${response.status}) : ${url}`);
  return response.text();
}

/** Un gabarit relu depuis l'espace statique, quand le catalogue ne répond pas. */
async function fetchJsonFromStatic(id: string): Promise<Record<string, unknown> | null> {
  const clean = String(id || '').replace(/[^a-z0-9-]/gi, '');
  if (!clean) return null;
  for (const url of [`/canvas/templates/${clean}.json`, `/uploads/canvas/${clean}.json`]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const body = (await response.json()) as Record<string, unknown>;
      if (body && (Array.isArray(body.objects) || body.sariStudio || body.background || body.version)) return body;
    } catch {
      /* fichier absent : on essaie l'adresse suivante */
    }
  }
  return null;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function dataUrlToBlob(url: string): Blob {
  const [head, body = ''] = url.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  if (head.includes('base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

function slug(value: string): string {
  const clean = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || 'planche';
}
