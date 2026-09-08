/**
 * lib/canvas/engine.ts — le moteur de l'atelier graphique, posé sur Fabric.js.
 *
 * Pourquoi Fabric, et pas Konva, Paper.js ou une réécriture sur Canvas 2D :
 *
 * - Fabric est le seul des trois à penser son contenu comme un **document sérialisable
 *   dans les deux sens** (`toJSON` / `loadFromJSON`). C'est exactement ce que demande le
 *   besoin : rouvrir dans l'atelier un visuel déjà enregistré. Konva n'a ni texte sur
 *   tracé ni filtres d'image, et son export SVG est sommaire ; Paper.js est centré sur
 *   le tracé, sans modèle de document.
 * - Fabric 6 est distribué en ESM avec de vrais types, sans `window.fabric` ni dépendance
 *   globale. Il n'a donc rien à savoir de React, du mode strict, ni du fait que le builder
 *   GrapesJS tourne dans une iframe : le composant qui l'héberge reste un composant React
 *   normal, sans `use client` contorsionnéni de provider.
 * - Ce qui coûte le plus cher à écrire est livré avec lui : poignées de transformation,
 *   sélection multiple, brosses, filtres d'image, import SVG, et `initAligningGuidelines`
 *   dans `fabric/extensions` pour les guides d'alignement.
 *
 * Ce module ne dessine aucune interface et ne connaît pas les panneaux React : il expose
 * un objet impératif (`Engine`) que l'UI appelle. Les règles calculables sans canvas —
 * alignements, dégradés, géométrie des graphiques, historique — vivent à côté
 * (`document.ts`, `history.ts`), parce que ce sont elles qui doivent rester exactes et
 * qu'elles sont testables sans navigateur.
 *
 * Trois choix méritent d'être signalés ici plutôt que perdus dans le code :
 *
 * - la **gomme** est un tracé portant `globalCompositeOperation: 'destination-out'`, pas
 *   une brosse couleur-fond : elle creuse vraiment, à l'écran comme au PNG ;
 * - le **détourage** remplace la source par une copie à alpha, et non `setElement` d'un
 *   canvas : un objet dont l'élément n'a pas de `src` ne se sérialise plus, donc ne se
 *   ré-édite plus ;
 * - les **poignées d'ancrage** et autres aides sont marquées `sari-helper` : exclues du
 *   document comme de l'export, pour que l'état du canvas reste l'état du visuel.
 */

import {
  ActiveSelection,
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricObject,
  FabricText,
  Gradient,
  Group,
  Line,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Path,
  Textbox,
  Triangle,
  filters as fabricFilters,
  loadSVGFromString,
  util,
} from 'fabric';
import {
  alignBoxes,
  buildChartSvg,
  describeFill,
  distributeBoxes,
  fitScale,
  gradientToFabric,
  fabricGradientToSpec,
  moveIndex,
  normalizeColor,
  sanitizeSide,
  type AlignMode,
} from '@/lib/canvas/document';
import { createHistory } from '@/lib/canvas/history';
import { ensureFonts, fontStackOf, waitForFont } from '@/lib/canvas/fonts';
import { crossOriginFor, normalizeDocumentCrossOrigin, withoutImages } from '@/lib/canvas/image-load';
import type {
  BackgroundSpec,
  ChartSpec,
  LayerInfo,
  ObjectProps,
  PaintValue,
  StudioEvent,
  ToolId,
} from '@/lib/canvas/types';

/** Une commande de tracé, telle que Fabric la stocke : `[lettre, ...nombres]`. */
type PathCommand = (string | number)[];
type PathData = PathCommand[];

/**
 * La vue « dicttaire » qu'on garde sur un objet Fabric.
 *
 * Un objet porte chez nous quelques propriétés qui ne sont pas dans le typage de Fabric
 * (`slotId`, `locked`, `sariCurve`) — les lire passe par un `Record`. Ce n'est pas un
 * `any` : la forme est déclarée, et un champ que j'aurais mal nommé échoue au
 * compilateur au lieu de donner `undefined` en silence.
 */
type LooseObject = Record<string, unknown> & {
  type?: string;
  name?: string;
  slotId?: string;
  slotLabel?: string;
  locked?: boolean;
  sariCurve?: { d?: string; offset?: number; radius?: number; side?: 'left' | 'right'; align?: string };
  shadow?: { color?: unknown; blur?: unknown; offsetX?: unknown; offsetY?: unknown };
  clipPath?: { type?: unknown };
  globalCompositeOperation?: string;
};

/** Les propriétés maison qui doivent survivre à un aller-retour sur le disque. */
const EXTRA_PROPS = ['slotId', 'slotLabel', 'sariRole', 'sariCurve', 'locked', 'name'];

/** Étiquette commune aux objets d'aide : poignées d'ancrage, cadre de recadrage. */
const HELPER = 'sari-helper';

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ExportOptions {
  scale?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

export interface Engine {
  canvas: Canvas;
  destroy(): void;

  setArtboard(width: number, height: number): void;
  getArtboard(): { width: number; height: number };
  setBackground(spec: BackgroundSpec): Promise<void>;
  getBackground(): BackgroundSpec;
  fitTo(box: { width: number; height: number }): number;
  setZoom(value: number): void;
  getZoom(): number;

  serialize(): string;
  load(state: unknown): Promise<void>;
  /** Rejoue un document en tolérant les images manquantes (voir `loadResilient`). */
  loadResilient(state: unknown): Promise<{ ok: boolean; partial: boolean; dropped: string[] }>;
  isDirty(): boolean;
  markSaved(): void;
  undo(): void;
  redo(): void;
  historyStats(): { past: number; future: number; bytes: number };
  commit(label: string): void;

  setTool(tool: ToolId): ToolId;
  getTool(): ToolId;
  setBrush(options: { size?: number; color?: string; smoothing?: number }): void;
  getBrush(): { size: number; color: string; smoothing: number };
  setGrid(options: { show?: boolean; size?: number; snap?: boolean }): void;
  getGrid(): { show: boolean; size: number; snap: boolean };

  addText(text?: string, at?: { x: number; y: number }): FabricObject;
  addShape(kind: 'rect' | 'ellipse' | 'line' | 'triangle' | 'polygon' | 'star' | 'arrow', at?: { x: number; y: number }): FabricObject;
  addImage(src: string, options?: { fit?: 'contain' | 'cover'; slotId?: string; at?: { x: number; y: number }; insetSize?: boolean }): Promise<FabricObject>;
  addSvg(svg: string, options?: { as?: 'objects' | 'image'; width?: number; height?: number; at?: { x: number; y: number } }): Promise<FabricObject | null>;
  addChart(spec: ChartSpec, mode?: 'objects' | 'image'): Promise<FabricObject | null>;

  selected(): FabricObject[];
  selectedProps(): ObjectProps | null;
  update(patch: Record<string, unknown>, label?: string): void;
  setPaint(part: 'fill' | 'stroke', value: PaintValue): void;
  setText(patch: Record<string, unknown>): void;
  setCurve(options: { enabled: boolean; radius?: number; offset?: number; side?: 'left' | 'right'; align?: 'start' | 'center' | 'end' }): Promise<void>;
  align(mode: AlignMode): void;
  distribute(axis: 'x' | 'y'): void;
  zOrder(mode: 'haut' | 'bas' | 'avant' | 'après'): void;
  group(): void;
  ungroup(): void;
  duplicate(): Promise<void>;
  remove(): void;
  nudge(dx: number, dy: number): void;
  rotateStep(degrees: number): void;
  flip(axis: 'x' | 'y'): void;
  scaleBy(factor: number): void;
  setLocked(locked: boolean): void;
  setVisible(visible: boolean): void;
  rename(name: string, slotId?: string, slotLabel?: string): void;
  layers(): LayerInfo[];
  selectIndex(index: number): void;
  /** Tous les calques sélectionnés, sauf les aides et les verrous : `Ctrl+A`. */
  selectAll(): void;
  /** Le pointeur, en coordonnées du plan de travail — là où poser un objet importé. */
  pointer(): { x: number; y: number };
  /** Verrouille ou déverrouille toute la planche, et dit si des calques sont figés. */
  setLockedAll(locked: boolean): void;
  anyLocked(): boolean;
  setOpacityFor(index: number, opacity: number): void;

  applyFilter(name: string, value: number): Promise<void>;
  resetFilters(): void;
  filtersOf(): Record<string, number>;
  bakeCrop(rect: CropRect): Promise<void>;
  setMask(shape: 'none' | 'rect' | 'circle' | 'ellipse' | 'triangle' | 'hexagon' | 'star'): void;
  replaceImage(src: string): Promise<void>;
  extractBackground(tolerance?: number): Promise<void>;

  beginPathEdit(): { points: number; editable: boolean };
  moveAnchor(index: number, x: number, y: number): void;
  insertAnchor(afterIndex: number): void;
  removeAnchor(index: number): void;
  endPathEdit(): void;
  pathAnchorCount(): number;

  toPngDataUrl(options?: ExportOptions): Promise<string>;
  toSvgString(): Promise<{ svg: string; vectorOnly: boolean; note: string | null }>;
  previewDataUrl(maxWidth?: number): Promise<string>;
  render(): Promise<void>;
  /** Les filtres connus du panneau, pour que la valeur affichée vienne du document. */
  knownFilters(): string[];
}

/**
 * La gomme : un PencilBrush dont le tracé porte `destination-out`.
 *
 * Le pinceau dessine d'abord sur la couche d'aperçu (`contextTop`), puis Fabric
 * matérialise le tracé en objet. C'est à ce moment-là que la composition est posée,
 * pour que le geste reste réversible — un objet du document, pas une peinture sur
 * les pixels — et survive à l'export PNG.
 */
class EraserBrush extends PencilBrush {
  createPath(pathData: PathData) {
    const path = super.createPath(pathData as never);
    path.set({
      globalCompositeOperation: 'destination-out' as GlobalCompositeOperation,
      objectCaching: false,
      opacity: 1,
    });
    return path;
  }
}

export interface EngineOptions {
  element: HTMLCanvasElement;
  width: number;
  height: number;
  background?: BackgroundSpec;
  /** Un état Fabric déjà sérialisé, à rejouer (réédition d'un asset, gabarit). */
  state?: unknown;
  onEvent?: (event: StudioEvent) => void;
}

/**
 * Ouvre un atelier. Les panneaux n'ont pas à connaître Fabric : ils appellent ces méthodes.
 */
/** Un état peut venir d'un fichier écrit à la main : on ne laisse pas un JSON cassé fermer l'atelier. */
function parseState(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function createEngine(options: EngineOptions): Promise<Engine> {
  const emit = options.onEvent || (() => undefined);
  const width = sanitizeSide(options.width);
  const height = sanitizeSide(options.height);

  const canvas = new Canvas(options.element, {
    width,
    height,
    backgroundColor: '#ffffff',
    // Un objet posé au-dessus d'un autre doit rester au-dessus : sans cette ligne,
    // Fabric remonte la sélection, et le z-order affiché n'est plus celui qui sera écrit.
    preserveObjectStacking: true,
    selection: true,
    // Les rendus sont déclenchés à la main (voir `render`) : pendant un glisser, cela
    // fait la différence entre 60 images/seconde et un onglet qui s'accroche.
    renderOnAddRemove: false,
    enableRetinaScaling: true,
    selectionColor: 'rgba(163, 230, 53, 0.14)',
    selectionBorderColor: 'rgba(163, 230, 53, 0.9)',
    centeredRotation: true,
    centeredScaling: false,
    uniScaleKey: 'shiftKey',
    altActionKey: 'ctrlKey',
  });

  let tool: ToolId = 'select';
  let background: BackgroundSpec = options.background || { mode: 'solid', color: '#ffffff' };
  let grid = { show: false, size: 24, snap: false };
  let dirty = false;
  let disposing = false;
  let anchors: { object: FabricObject | null; circles: Circle[] } = { object: null, circles: [] };
  // Le dernier pointeur connu, en coordonnées du plan : c'est là qu'un objet importé
  // depuis une liste ou une boîte de dialogue doit atterrir, et non immuablement au centre.
  let lastScenePoint: { x: number; y: number } | null = null;
  let draggedAnchor = -1;

  const history = createHistory('');
  const pencil = new PencilBrush(canvas);
  const eraser = new EraserBrush(canvas);

  /* ------------------------------------------------------------------- rendu, état */

  let queued = false;
  function render() {
    if (queued || disposing) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      if (!disposing) canvas.requestRenderAll();
    });
  }

  // `toObject(propertiesToInclude)` est la seule forme qui accepte nos propriétés maison :
  // `toJSON()` ne prend aucun argument, et sans cette liste `slotId`, `sariCurve` et
  // `locked` disparaîtraient de l'enregistrement — donc de la réédition.
  function state(): Record<string, unknown> {
    const json = canvas.toObject(EXTRA_PROPS) as unknown as Record<string, unknown>;
    // L'enveloppe maison. `toObject` ne dit pas la taille du plan de travail, et ne dit
    // le fond que si c'est une couleur : sans elle, une story 1080×1920 se réouvrirait
    // en carré 1080 et un fond en dégradé ou en image redeviendrait blanc. Le PNG de la
    // page viendrait donc d'une autre époque que le JSON dont il est censé renaître.
    json.sariStudio = { width: canvas.getWidth(), height: canvas.getHeight(), background };
    // À la sortie comme à l'entrée : un document enregistré ne doit pas emporter une
    // exigence de CORS pour un fichier que le même serveur sert.
    return normalizeDocumentCrossOrigin(json);
  }

  function commit(label: string) {
    dirty = true;
    history.commit(label, JSON.stringify(state()));
    emit({ type: 'dirty', value: true });
    emit({ type: 'history', canUndo: history.canUndo(), canRedo: history.canRedo() });
  }

  function markSaved() {
    dirty = false;
    emit({ type: 'dirty', value: false });
  }

  /**
   * Rejoue un état du document.
   *
   * Le réveil explicite n'est pas un ornement : Fabric **sérialise** le texte sur tracé
   * (`Text.toObject` écrit `path: path.toObject()`) mais ne le **réveille** pas — au
   * rechargement, l'objet perd sa courbe et s'étale sur une ligne droite. Sans ce
   * réveil, « réouvrir un visuel enregistré » marcherait à l'air et casserait à
   * l'écran. La fiche garde donc aussi `sariCurve` (la description du tracé), et c'est
   * elle qui reconstruit l'objet `Path`.
   */
  async function load(stateValue: unknown, options: { strict?: boolean } = {}) {
    const source = typeof stateValue === 'string' ? parseState(stateValue) : ((stateValue ?? {}) as Record<string, unknown>);
    const envelope = source.sariStudio as { width?: number; height?: number; background?: BackgroundSpec } | undefined;
    if (envelope?.width && envelope?.height) {
      canvas.setDimensions({ width: sanitizeSide(envelope.width), height: sanitizeSide(envelope.height) });
    }
    if (envelope?.background) background = envelope.background;
    // Les images servies par le même serveur n'ont rien à négocier en CORS : la clé
    // héritée d'un ancien enregistrement ferait échouer `loadFromJSON` tout entier.
    const json = JSON.stringify(normalizeDocumentCrossOrigin(source));
    endPathEdit();
    canvas.discardActiveObject();
    await canvas.loadFromJSON(json, (serialized: Record<string, unknown>, object: unknown) => {
      const instance = object as FabricObject & { sariCurve?: CurveData; path?: unknown };
      if (!instance) return;
      if ((serialized as Record<string, unknown>)[HELPER]) {
        instance.set({ visible: false, selectable: false, evented: false, enterDelay: 0 } as never);
        (instance as unknown as Record<string, unknown>)[HELPER] = 'loaded';
      }
      const curveHolder = instance as unknown as { sariCurve?: CurveData };
      if (instance instanceof FabricText && !isFabricPath(instance.path)) {
        const curve = curveHolder.sariCurve;
        if (curve?.d) {
          instance.set({
            path: new Path(curve.d, { visible: false }),
            pathStartOffset: curve.offset ?? 0,
            pathSide: curve.side || 'left',
            pathAlign: (curve.align || 'center') as 'center',
          } as never);
        } else if (instance.path && typeof instance.path === 'object') {
          const raw = instance.path as { path?: PathData };
          if (Array.isArray(raw.path)) instance.set('path', new Path(raw.path as never, { visible: false } as never));
          else instance.set('path', undefined as never);
        }
      }
    });
    applyTool();
    render();
    await applyBackground(background, options.strict);
    const snapshot = JSON.stringify(state());
    history.reset(snapshot);
    dirty = false;
    emit({ type: 'dirty', value: false });
    emit({ type: 'history', canUndo: false, canRedo: false });
    emitSelection();
  }

  function isFabricPath(value: unknown): value is Path {
    return value instanceof Path;
  }

  /**
   * Rejoue un document sans jamais le laisser vide.
   *
   * Un seul objet image illisible fait rejeter `loadFromJSON` **en entier** : avant ce
   * repli, un plan dont un média avait été nettoyé du disque ouvrait une fenêtre blanche
   * et muette — le pire des diagnostics. On retente donc sans les images (ni le fond en
   * image), ce qui conserve le format, les textes, les masques et l'ordre des calques,
   * et on nomme ce qui a sauté.
   */
  async function loadResilient(stateValue: unknown): Promise<{ ok: boolean; partial: boolean; dropped: string[] }> {
    try {
      await load(stateValue, { strict: true });
      return { ok: true, partial: false, dropped: [] };
    } catch (firstError) {
      const stripped = withoutImages((typeof stateValue === 'string' ? parseState(stateValue) : (stateValue ?? {})) as Record<string, unknown>);
      if (!stripped.dropped.length) throw firstError instanceof Error ? firstError : new Error(String(firstError));
      try {
        await load(stripped.document);
      } catch (secondError) {
        // Deux échecs : le document lui-même est illisible, pas seulement une image.
        throw secondError instanceof Error ? secondError : new Error(String(secondError));
      }
      emit({
        type: 'error',
        message: `${stripped.dropped.length} visuel${stripped.dropped.length > 1 ? 's' : ''} inaccessible${stripped.dropped.length > 1 ? 's' : ''} : ${stripped.dropped.slice(0, 3).join(', ')}${stripped.dropped.length > 3 ? ', …' : ''}. Le plan reste éditable, mais ces images ne reviendront pas — repassez par « Importer » pour les reposer.`,
      });
      return { ok: true, partial: true, dropped: stripped.dropped };
    }
  }

  /* ------------------------------------------------------------------------ le fond */

  async function applyBackground(spec: BackgroundSpec, strict = false) {
    canvas.backgroundColor = undefined as never;
    canvas.backgroundImage = undefined as never;
    if (spec.mode === 'solid') {
      canvas.backgroundColor = (normalizeColor(spec.color) || '#ffffff') as never;
    } else if (spec.mode === 'gradient') {
      const built = gradientToFabric(spec.gradient);
      if (built) canvas.backgroundColor = new Gradient(built as never) as never;
    } else {
      try {
        const image = await FabricImage.fromURL(spec.src, { crossOrigin: crossOriginFor(spec.src) });
        const scale = fitScale(
          { width: image.width || 1, height: image.height || 1 },
          { width: canvas.getWidth(), height: canvas.getHeight() },
          spec.fit === 'contain' ? 'contain' : spec.fit === 'stretch' ? 'contain' : 'cover',
        );
        image.set({
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          scaleX: spec.fit === 'stretch' ? canvas.getWidth() / (image.width || 1) : scale,
          scaleY: spec.fit === 'stretch' ? canvas.getHeight() / (image.height || 1) : scale,
          opacity: spec.opacity ?? 1,
          selectable: false,
          evented: false,
        });
        canvas.backgroundImage = image as never;
      } catch (cause) {
        // `strict` = on remonte : c'est `loadResilient` qui décide du repli, et sans
        // exception ici il ne saurait pas qu'il faut alléger le document.
        if (strict) throw cause instanceof Error ? cause : new Error(String(cause));
        // Ailleurs, une image de fond inaccessible ne doit pas empêcher d'éditer le
        // reste : on garde un fond blanc, et c'est le panneau qui le dit à l'utilisateur.
        canvas.backgroundColor = '#ffffff' as never;
        emit({ type: 'error', message: `Image de fond illisible ou protégée : le fond est resté blanc (${spec.src || '(source absente)'}).` });
      }
    }
    render();
  }

  /* -------------------------------------------------------------------------- outils */

  function applyTool() {
    const drawing = tool === 'brush' || tool === 'eraser';
    canvas.isDrawingMode = drawing;
    if (drawing) canvas.freeDrawingBrush = tool === 'eraser' ? eraser : pencil;
    canvas.selection = tool === 'select';
    canvas.defaultCursor = tool === 'hand' ? 'grab' : drawing ? 'crosshair' : tool === 'text' ? 'text' : 'default';
    canvas.forEachObject((object) => {
      if ((object as unknown as Record<string, unknown>)[HELPER]) return;
      const locked = Boolean((object as unknown as Record<string, unknown>).locked);
      object.selectable = !locked && tool === 'select';
      object.evented = !locked && tool !== 'hand';
      object.lockMovementX = tool === 'hand';
      object.lockMovementY = tool === 'hand';
    });
    emit({ type: 'tool', tool });
    render();
  }

  /* ----------------------------------------------------------------- la sélection */

  /**
   * Une sélection multiple, construite comme Fabric la construit lui-même.
   *
   * `new ActiveSelection(objets)` parait plus court et ne marche pas : le groupe doit
   * connaître le canvas *avant* de recevoir ses objets (`multiSelectAdd` s'appuie sur
   * `isInFrontOf`, qui lit cette référence). C'est le sens du commentaire que Fabric
   * laisse dans `Canvas._handleGrouping`, et la seule façon d'obtenir un groupe dont les
   * coordonnées enfants restent justes.
   */
  function selectionOf(objects: FabricObject[]) {
    const selection = new ActiveSelection([], { canvas });
    selection.multiSelectAdd(...objects);
    return selection;
  }

  function selected(): FabricObject[] {
    const active = canvas.getActiveObject();
    if (!active) return [];
    if (active instanceof ActiveSelection) return active.getObjects().filter((object) => !(object as unknown as Record<string, unknown>)[HELPER]);
    return (active as unknown as Record<string, unknown>)[HELPER] ? [] : [active];
  }

  function target(): FabricObject | null {
    return selected()[0] || null;
  }

  /**
   * Applique une modification, en gérant le cas qui casse tout : la sélection multiple.
   *
   * Tant que plusieurs objets sont sélectionnés, Fabric les a **remontés** dans un
   * `ActiveSelection` : leurs `left`/`top` sont relatifs au groupe, et écrire dessus
   * directement produit un décalage qui dépend de la position du groupe. On sort donc
   * les objets du groupe, on modifie, on re-sélectionne — dans cet ordre, et pas un
   * autre. C'est la recette documentée de `getActiveObjects`, et c'est ce qui fait
   * qu'aligner quatre objets ne les envoie pas dans le décor.
   */
  function withSelectionUnlocked(run: (objects: FabricObject[]) => void, label: string) {
    const active = canvas.getActiveObject();
    if (!active) return;
    if (!(active instanceof ActiveSelection)) {
      run([active]);
      active.setCoords();
      render();
      commit(label);
      emitSelection();
      return;
    }
    const objects = active.getObjects().slice();
    canvas.discardActiveObject();
    run(objects);
    objects.forEach((object) => object.setCoords());
    if (objects.length > 1) canvas.setActiveObject(selectionOf(objects));
    else if (objects.length === 1) canvas.setActiveObject(objects[0]);
    render();
    commit(label);
    emitSelection();
  }

  function applyToSelected(patch: Record<string, unknown>, label: string) {
    withSelectionUnlocked((objects) => objects.forEach((object) => object.set(patch as never)), label);
  }

  function emitSelection() {
    const objects = selected();
    const first = objects[0] || null;
    emit({
      type: 'selection',
      state: {
        count: objects.length,
        object: first,
        kinds: objects.map((object) => String(object.type)),
        hasText: objects.some((object) => object instanceof FabricText),
        hasImage: objects.some((object) => object instanceof FabricImage),
        hasPath: objects.some((object) => object instanceof Path || Array.isArray((object as unknown as { path?: unknown }).path)),
        locked: Boolean(first && (first as unknown as Record<string, unknown>).locked),
      },
    });
  }

  /* ------------------------------------------------------------------- créations */

  /**
   * Ramène l'atelier en mode sélection quand un objet vient d'être posé.
   *
   * Hors outil « Sélection », `applyTool()` rend les objets non sélectionnables : un
   * visuel importé pendant que le pinceau ou la main était actif se trouvait donc posé,
   * encadré une demi-seconde, puis ingouvernable — « il n'y a pas de possibilité de
   * déplacer l'image ». La fabrication d'un objet est toujours un geste d'édition : elle
   * reprend la main.
   */
  function ensureSelectTool() {
    if (tool === 'select') return;
    tool = 'select';
    applyTool();
  }

  function place(object: FabricObject, at?: { x: number; y: number }) {
    const point = at ? new Point(at.x, at.y) : new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    ensureSelectTool();
    object.set({ originX: 'center', originY: 'center', left: point.x, top: point.y });
    canvas.add(object as never);
    canvas.setActiveObject(object);
    object.setCoords();
    emitSelection();
    render();
    return object;
  }

  function addText(text = 'Votre texte', at?: { x: number; y: number }) {
    const box = new Textbox(text, {
      width: Math.max(180, Math.round(canvas.getWidth() * 0.6)),
      fontFamily: fontStackOf('Inter'),
      fontSize: Math.max(20, Math.round(Math.min(canvas.getWidth(), canvas.getHeight()) / 14)),
      fontWeight: '600',
      fill: '#0f172a',
      textAlign: 'left',
      lineHeight: 1.24,
      charSpacing: 0,
      editable: true,
      slotLabel: 'Texte',
    } as never);
    place(box, at);
    commit('texte');
    return box;
  }

  /** Une forme à la taille du plan de travail : pas un rectangle de 100 px perdu sur une affiche A3. */
  function addShape(kind: Parameters<Engine['addShape']>[0], at?: { x: number; y: number }) {
    const base = Math.round(Math.min(canvas.getWidth(), canvas.getHeight()) * 0.36);
    const gradient = new Gradient({
      type: 'linear',
      gradientUnits: 'percentage',
      coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
      colorStops: [
        { offset: 0, color: '#a3e635' },
        { offset: 1, color: '#0ea5e9' },
      ],
    } as never);
    const common = { fill: gradient as never, stroke: '', strokeWidth: 0, opacity: 1, slotLabel: labelForShape(kind) };
    let object: FabricObject;
    switch (kind) {
      case 'ellipse':
        object = new Ellipse({ rx: base / 2, ry: base / 2.6, ...common } as never);
        break;
      case 'line':
        object = new Line([-base / 2, 0, base / 2, 0], { stroke: '#0f172a', strokeWidth: Math.max(2, Math.round(base * 0.04)), slotLabel: 'Ligne' } as never);
        break;
      case 'triangle':
        object = new Triangle({ width: base, height: base, ...common } as never);
        break;
      case 'polygon':
        object = new Polygon(hexagonPoints(base / 2), { ...common } as never);
        break;
      case 'star':
        object = new Polygon(starPoints(base / 2, 5), { ...common } as never);
        break;
      case 'arrow':
        object = new Path(arrowPath(base), { ...common } as never);
        break;
      default:
        object = new Rect({ width: Math.round(base * 1.4), height: base, rx: Math.round(base * 0.06), ...common } as never);
    }
    place(object, at);
    commit('forme');
    return object;
  }

  function labelForShape(kind: string) {
    return (
      {
        rect: 'Rectangle',
        ellipse: 'Cercle',
        line: 'Ligne',
        triangle: 'Triangle',
        polygon: 'Polygone',
        star: 'Étoile',
        arrow: 'Flèche',
      } as Record<string, string>
    )[kind] || 'Forme';
  }

  function hexagonPoints(radius: number) {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index - Math.PI / 2;
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
  }

  function starPoints(radius: number, points = 5) {
    const inner = radius * 0.44;
    const out: { x: number; y: number }[] = [];
    for (let index = 0; index < points * 2; index++) {
      const angle = (Math.PI / points) * index - Math.PI / 2;
      const length = index % 2 === 0 ? radius : inner;
      out.push({ x: length * Math.cos(angle), y: length * Math.sin(angle) });
    }
    return out;
  }

  function arrowPath(size: number) {
    const half = size / 2;
    const shaft = size * 0.16;
    return `M ${-half} ${-shaft / 2} L ${half * 0.3} ${-shaft / 2} L ${half * 0.3} ${-shaft * 1.7} L ${half} 0 L ${half * 0.3} ${shaft * 1.7} L ${half * 0.3} ${shaft / 2} L ${-half} ${shaft / 2} Z`;
  }

  async function addImage(src: string, imageOptions: { fit?: 'contain' | 'cover'; slotId?: string; at?: { x: number; y: number }; insetSize?: boolean } = {}) {
    let image: FabricImage;
    try {
      image = await FabricImage.fromURL(src, { crossOrigin: crossOriginFor(src) });
    } catch (cause) {
      // Un « image non chargeable » muet est le plantage le plus dur à débugger de
      // l'atelier : la cause est presque toujours une URL de GED reconstruite de
      // travers (le fichier n'est pas dans le dossier que l'URL annonce). On la nomme.
      const message = `Image non chargeable : ${src}${cause instanceof Error && cause.message ? ` (${cause.message})` : ''}`;
      emit({ type: 'error', message });
      throw new Error(message);
    }
    // Un posé « par défaut » ne doit pas avaler le plan de travail : sans marge, une
    // image importée remplissait 1080×1080 au pixel près, et le premier geste du
    // nouvel arrivant était « je ne peux pas la déplacer » — il n'y avait plus où
    // attraper. `insetSize` laisse la marge ; une case d'image (gabarit) s'en passe.
    const frame = imageOptions.insetSize
      ? { width: Math.round(canvas.getWidth() * 0.8), height: Math.round(canvas.getHeight() * 0.8) }
      : { width: canvas.getWidth(), height: canvas.getHeight() };
    const scale = fitScale({ width: image.width || 1, height: image.height || 1 }, frame, imageOptions.fit || 'contain');
    image.set({ scaleX: scale, scaleY: scale, opacity: 1, ...(imageOptions.slotId ? { slotId: imageOptions.slotId, slotLabel: imageOptions.slotId } : {}) } as never);
    place(image, imageOptions.at);
    commit('image');
    return image;
  }

  /**
   * Un SVG importé, en objets ou en image.
   *
   * « Editable » est le mot du besoin : par défaut on garde les formes (dégrouper,
   * changer une couleur, déplacer une barre d'un graphique), et `as: 'image'` n'existe
   * que pour les SVG au tracé démesuré, où entretenir cinq cents chemins coûterait plus
   * qu'il ne vaut.
   */
  async function addSvg(svg: string, svgOptions: { as?: 'objects' | 'image'; width?: number; height?: number; at?: { x: number; y: number } } = {}) {
    const text = String(svg || '').trim();
    if (!text.startsWith('<svg')) return null;
    const frame = { width: Math.round(svgOptions.width || canvas.getWidth() * 0.6), height: Math.round(svgOptions.height || canvas.getHeight() * 0.45) };
    if (svgOptions.as === 'image') {
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      return addImage(url, { fit: 'contain', insetSize: true, at: svgOptions.at });
    }
    const parsed = await loadSVGFromString(text);
    const objects = (parsed.objects || []).filter(Boolean);
    if (!objects.length) return null;
    const group = new Group(objects as never, { subTargetCheck: true, interactive: true, slotLabel: 'Import SVG' } as never);
    const box = group.getBoundingRect();
    const scale = fitScale({ width: box.width || 1, height: box.height || 1 }, frame, 'contain');
    group.set({ scaleX: scale, scaleY: scale });
    place(group, svgOptions.at);
    commit('svg');
    return group;
  }

  async function addChart(spec: ChartSpec, mode: 'objects' | 'image' = 'objects') {
    const frame = { width: Math.round(canvas.getWidth() * 0.62), height: Math.round(canvas.getHeight() * 0.44) };
    const svg = buildChartSvg(spec, frame);
    const object = await addSvg(svg, { as: mode === 'image' ? 'image' : 'objects', width: frame.width, height: frame.height });
    if (object) object.set('slotLabel', 'Graphique') as never;
    return object;
  }

  /* ------------------------------------------------------------- lecture des objets */

  function describePaint(value: unknown): PaintValue {
    if (value == null || value === '') return { kind: 'none' };
    const gradient = fabricGradientToSpec(value);
    if (gradient) return { kind: 'gradient', gradient };
    const color = normalizeColor(value);
    return color ? { kind: 'solid', color } : { kind: 'none' };
  }

  interface CurveData {
    d?: string;
    offset?: number;
    side?: 'left' | 'right';
    align?: 'baseline' | 'center' | 'ascender' | 'descender';
  }

  /**
   * L'alignement vertical du texte sur son tracé.
   *
   * Le panneau raisonne en « début / centre / fin » (ce que veut dire un utilisateur :
   * le texte est-il posé sur la courbe, ou suspendu dessous), Fabric en
   * `baseline | center | ascender | descender`. La traduction est au seul endroit où
   * elle a le droit d'exister — sinon elle se répète dans chaque panneau, et un des
   * trois finit par diverger.
   */
  function pathAlignToUi(value: string): 'start' | 'center' | 'end' {
    return value === 'baseline' || value === 'ascender' ? 'start' : value === 'descender' ? 'end' : 'center';
  }

  function alignFromUi(value: 'start' | 'center' | 'end' | undefined): 'baseline' | 'center' | 'descender' {
    return value === 'start' ? 'baseline' : value === 'end' ? 'descender' : 'center';
  }

  function curveOf(object: FabricObject): CurveData | null {
    return ((object as unknown as { sariCurve?: CurveData }).sariCurve) || null;
  }

  function selectedProps(): ObjectProps | null {
    const object = target();
    if (!object) return null;
    const raw = object as unknown as LooseObject;
    const box = object.getBoundingRect();
    const isText = object instanceof FabricText;
    const isImage = object instanceof FabricImage;
    const curve = isText ? curveOf(object) : null;
    return {
      name: String(raw.name || ''),
      id: String(raw.slotId || ''),
      opacity: object.opacity ?? 1,
      visible: object.visible !== false,
      locked: Boolean(raw.locked),
      angle: Math.round((object.angle || 0) * 10) / 10,
      scaleX: object.scaleX || 1,
      scaleY: object.scaleY || 1,
      flipX: Boolean(object.flipX),
      flipY: Boolean(object.flipY),
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height),
      fill: describePaint(raw.fill),
      stroke: describePaint(raw.stroke),
      strokeWidth: Number(raw.strokeWidth || 0),
      strokeDash: Array.isArray(raw.strokeDashArray) ? raw.strokeDashArray.join(' ') : '',
      rx: Number(raw.rx || 0),
      shadow: raw.shadow
        ? {
            color: normalizeColor(raw.shadow.color) || '#000000',
            blur: Number(raw.shadow.blur || 0),
            offsetX: Number(raw.shadow.offsetX || 0),
            offsetY: Number(raw.shadow.offsetY || 0),
            enabled: true,
          }
        : { color: 'rgba(15,23,42,0.45)', blur: 12, offsetX: 0, offsetY: 6, enabled: false },
      blendMode: String(raw.globalCompositeOperation || 'source-over'),
      text: isText ? String((object as FabricText).text ?? '') : undefined,
      fontFamily: isText ? familyOf(String((object as FabricText).fontFamily || 'Inter')) : undefined,
      fontSize: isText ? Number((object as FabricText).fontSize || 16) : undefined,
      fontWeight: isText ? (object as FabricText).fontWeight : undefined,
      fontStyle: isText ? (object as FabricText).fontStyle : undefined,
      underline: isText ? Boolean((object as FabricText).underline) : undefined,
      charSpacing: isText ? Number((object as FabricText).charSpacing || 0) : undefined,
      lineHeight: isText ? Number((object as FabricText).lineHeight || 1.16) : undefined,
      align: isText ? String((object as FabricText).textAlign || 'left') : undefined,
      curve: isText
        ? {
            enabled: Boolean((object as FabricText & { path?: unknown }).path || curve?.d),
            radius: 180,
            offset: Number((object as FabricText).pathStartOffset ?? curve?.offset ?? 0),
            side: (object as FabricText).pathSide === 'right' ? 'right' : 'left',
            align: pathAlignToUi((object as FabricText).pathAlign),
          }
        : undefined,
      filters: isImage ? filtersOf() : undefined,
      slotId: raw.slotId ? String(raw.slotId) : undefined,
      slotLabel: raw.slotLabel ? String(raw.slotLabel) : undefined,
      clipShape: raw.clipPath ? String(raw.clipPath.type ?? 'forme') : undefined,
      src: isImage ? String((object as FabricImage).getSrc() || '') : undefined,
    };
  }

  /** La famille sans le groupe générique : le sélecteur montre « Lora », le canvas stocke « Lora, Georgia, serif ». */
  function familyOf(value: string) {
    return value.split(',')[0].replace(/["']/g, '').trim();
  }

  function layers(): LayerInfo[] {
    const active = selected();
    return canvas
      .getObjects()
      .filter((object) => !(object as unknown as Record<string, unknown>)[HELPER])
      .map((object, index) => {
        const raw = object as unknown as LooseObject;
        return {
          index,
          id: String(raw.slotId || `calque-${index}`),
          name: String(raw.name || raw.slotLabel || object.type || 'objet'),
          type: String(object.type || 'objet'),
          visible: object.visible !== false,
          locked: Boolean(raw.locked),
          opacity: Math.round((object.opacity ?? 1) * 100),
          selected: active.includes(object),
        };
      })
      // Le panneau affiche le calque du haut en premier : c'est l'ordre visuel, pas
      // l'ordre du tableau Fabric, et l'écart entre les deux est une source de bug classique.
      .reverse();
  }

  /* --------------------------------------------------------- transformations, ordre */

  function align(mode: AlignMode) {
    withSelectionUnlocked((objects) => {
      const frame = { left: 0, top: 0, width: canvas.getWidth(), height: canvas.getHeight() };
      const moves = alignBoxes(
        mode,
        objects.map((object) => object.getBoundingRect()),
        frame,
      );
      moves.forEach(({ index, left, top }) => {
        const object = objects[index];
        if (!object) return;
        const box = object.getBoundingRect();
        const center = object.getCenterPoint();
        object.setPositionByOrigin(new Point(center.x + (left - box.left), center.y + (top - box.top)), 'center', 'center');
      });
    }, 'alignement');
  }

  function distribute(axis: 'x' | 'y') {
    withSelectionUnlocked((objects) => {
      if (objects.length < 3) return;
      const moves = distributeBoxes(
        axis,
        objects.map((object) => object.getBoundingRect()),
      );
      moves.forEach(({ index, left, top }) => {
        const object = objects[index];
        if (!object) return;
        const box = object.getBoundingRect();
        const center = object.getCenterPoint();
        object.setPositionByOrigin(new Point(center.x + (left - box.left), center.y + (top - box.top)), 'center', 'center');
      });
    }, 'répartition');
  }

  function zOrder(mode: 'haut' | 'bas' | 'avant' | 'après') {
    const object = target();
    if (!object) return;
    const list = canvas.getObjects();
    const from = list.indexOf(object);
    const { to } = moveIndex(from, 0, list.length, mode);
    if (from === to) return;
    canvas.moveObjectTo(object, to);
    render();
    commit('calque');
  }

  function group() {
    const objects = selected();
    if (objects.length < 2) return;
    const active = canvas.getActiveObject();
    if (active instanceof ActiveSelection) canvas.discardActiveObject();
    const group = new Group(objects as never, { subTargetCheck: true, interactive: true } as never);
    canvas.add(group as never);
    canvas.setActiveObject(group);
    render();
    commit('grouper');
  }

  function ungroup() {
    const object = target();
    if (!(object instanceof Group) || object instanceof ActiveSelection) return;
    const children = object.getObjects().slice();
    const matrix = object.calcTransformMatrix();
    canvas.remove(object as never);
    children.forEach((child) => {
      const point = util.transformPoint(child.getCenterPoint(), matrix as unknown as [number, number, number, number, number, number]);
      child.set({
        originX: 'center',
        originY: 'center',
        left: point.x,
        top: point.y,
        scaleX: (child.scaleX || 1) * (object.scaleX || 1),
        scaleY: (child.scaleY || 1) * (object.scaleY || 1),
        angle: (child.angle || 0) + (object.angle || 0),
        flipX: Boolean(child.flipX) !== Boolean(object.flipX),
        flipY: Boolean(child.flipY) !== Boolean(object.flipY),
      } as never);
      child.setCoords();
      canvas.add(child as never);
    });
    if (children.length > 1) canvas.setActiveObject(selectionOf(children));
    else if (children.length === 1) canvas.setActiveObject(children[0]);
    render();
    commit('dégrouper');
  }

  async function duplicate() {
    const objects = selected();
    if (!objects.length) return;
    const clones = (await Promise.all(objects.map((object) => object.clone(EXTRA_PROPS)))).filter(Boolean) as FabricObject[];
    clones.forEach((clone) => {
      clone.set({ left: (clone.left || 0) + 24, top: (clone.top || 0) + 24 });
      clone.setCoords();
      canvas.add(clone as never);
    });
    canvas.setActiveObject(clones.length > 1 ? selectionOf(clones) : clones[0]);
    render();
    commit('dupliquer');
  }

  function remove() {
    const objects = selected();
    if (!objects.length) return;
    canvas.discardActiveObject();
    objects.forEach((object) => canvas.remove(object as never));
    render();
    commit('supprimer');
    emitSelection();
  }

  function nudge(dx: number, dy: number) {
    withSelectionUnlocked((objects) => {
      objects.forEach((object) => {
        object.set({ left: (object.left || 0) + dx, top: (object.top || 0) + dy } as never);
      });
    }, 'déplacement fin');
  }

  /* ------------------------------------------------------------------------ images */

  const FILTERS: Record<string, new (options: never) => unknown> = {
    brightness: fabricFilters.Brightness as never,
    contrast: fabricFilters.Contrast as never,
    saturation: fabricFilters.Saturation as never,
    grayscale: fabricFilters.Grayscale as never,
    blur: fabricFilters.Blur as never,
    noise: fabricFilters.Noise as never,
    pixelate: fabricFilters.Pixelate as never,
    huerotation: fabricFilters.HueRotation as never,
    invert: fabricFilters.Invert as never,
  };

  function filterParams(name: string, value: number) {
    switch (String(name).toLowerCase()) {
      case 'brightness':
        return { brightness: value / 100 };
      case 'contrast':
        return { contrast: value / 100 };
      case 'saturation':
        return { saturation: value };
      case 'blur':
        return { blur: Math.max(0, value) };
      case 'noise':
        return { noise: Math.abs(value) };
      case 'pixelate':
        return { blocksize: Math.max(1, Math.round(value)) };
      case 'huerotation':
        return { rotation: (value * Math.PI) / 180 };
      case 'grayscale':
        return { mode: value >= 50 ? 'blackWhite' : 'luminosity' };
      default:
        return {};
    }
  }

  function eachImage(run: (image: FabricImage) => void, label: string) {
    const objects = selected().filter((object): object is FabricImage => object instanceof FabricImage);
    if (!objects.length) return;
    objects.forEach(run);
    objects.forEach((image) => {
      image.dirty = true;
    });
    render();
    commit(label);
    emitSelection();
  }

  /**
   * Filtres appliqués en place, jamais reconstruits de zéro.
   *
   * Un filtre Fabric recopie l'image dans une texture à chaque changement : créer une
   * instance par curseur d'ascenseur pendant qu'on glisse rendrait la retouche saccadée.
   * On modifie donc l'instance existante quand elle est du bon type, et on ne la
   * remplace que si le type change.
   */
  async function applyFilter(name: string, value: number) {
    const Ctor = FILTERS[String(name).toLowerCase()];
    if (!Ctor) return;
    await waitForFont('Inter');
    eachImage((image) => {
      const filters = (image.filters || []).slice();
      const index = filters.findIndex((filter) => filter && filter.constructor === Ctor);
      const params = filterParams(name, value) as never;
      if (index >= 0) {
        Object.assign(filters[index] as object, params);
      } else {
        filters.push(new Ctor(params) as never);
      }
      image.filters = filters;
    }, 'retouche');
  }

  function resetFilters() {
    eachImage((image) => {
      image.filters = [];
    }, 'filtres remis');
  }

  function filtersOf(): Record<string, number> {
    const image = target();
    const out: Record<string, number> = {};
    if (!(image instanceof FabricImage)) return out;
    for (const name of Object.keys(FILTERS)) {
      const Ctor = FILTERS[name];
      const filter = (image.filters || []).find((candidate) => candidate && candidate.constructor === Ctor) as Record<string, number | string> | undefined;
      if (!filter) continue;
      out[name] = unfilterParams(name, filter);
    }
    return out;
  }

  function unfilterParams(name: string, filter: Record<string, number | string>) {
    switch (name) {
      case 'brightness':
        return Math.round(Number(filter.brightness || 0) * 100);
      case 'contrast':
        return Math.round(Number(filter.contrast || 0) * 100);
      case 'saturation':
        return Math.round(Number(filter.saturation || 0));
      case 'blur':
        return Math.round(Number(filter.blur || 0));
      case 'noise':
        return Math.round(Number(filter.noise || 0));
      case 'pixelate':
        return Math.round(Number(filter.blocksize || 0));
      case 'huerotation':
        return Math.round((Number(filter.rotation || 0) * 180) / Math.PI);
      case 'grayscale':
        return filter.mode === 'blackWhite' ? 100 : 50;
      default:
        return 0;
    }
  }

  /**
   * Le recadrage franc : la zone gardée devient la nouvelle source.
   *
   * Fabric sait cacher une partie d'une image (`cropX`/`cropY`), mais ce n'est pas un
   * recadrage au sens de la GED : l'asset resterait gros comme l'original, avec tout ce
   * qui dépense du poids pour rien à l'export comme au chargement. Ici les pixels sont
   * réellement repris dans un PNG neuf — et comme l'état du document est un `src`, le
   * résultat voyage, s'exporte et se réédite sans pièce jointe.
   */
  async function bakeCrop(rect: CropRect) {
    const image = target();
    if (!(image instanceof FabricImage)) return;
    const element = image.getElement() as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!element || !rect.width || !rect.height) return;
    const natural = { width: element.width || image.width, height: element.height || image.height };
    const local = toImageSpace(image, rect);
    const sourceWidth = Math.max(8, Math.min(local.width, natural.width));
    const sourceHeight = Math.max(8, Math.min(local.height, natural.height));
    const sourceLeft = bound(local.left, 0, Math.max(0, natural.width - sourceWidth));
    const sourceTop = bound(local.top, 0, Math.max(0, natural.height - sourceHeight));
    const output = document.createElement('canvas');
    output.width = Math.round(sourceWidth);
    output.height = Math.round(sourceHeight);
    const context = output.getContext('2d');
    if (!context) return;
    context.drawImage(element, Math.round(sourceLeft), Math.round(sourceTop), Math.round(sourceWidth), Math.round(sourceHeight), 0, 0, output.width, output.height);
    const url = output.toDataURL('image/png');
    const kept = { box: image.getBoundingRect(), angle: image.angle || 0, opacity: image.opacity ?? 1, filters: image.filters, clipPath: image.clipPath };
    const next = await FabricImage.fromURL(url, { crossOrigin: crossOriginFor(url) });
    const scale = Math.min(kept.box.width / next.width, kept.box.height / next.height);
    next.set({ scaleX: scale, scaleY: scale, angle: kept.angle, opacity: kept.opacity, filters: kept.filters, clipPath: kept.clipPath } as never);
    const previous = image;
    canvas.remove(previous as never);
    canvas.add(next as never);
    next.setPositionByOrigin(previous.getCenterPoint(), 'center', 'center');
    next.setCoords();
    canvas.setActiveObject(next);
    render();
    commit('recadrer');
    emitSelection();
  }

  /** Un rectangle d'écran (relatif à l'objet) → des pixels de l'image source, rotation comprise. */
  function toImageSpace(image: FabricObject, rect: CropRect) {
    const matrix = util.invertTransform(image.calcTransformMatrix());
    const zoom = canvas.getZoom() || 1;
    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.left + rect.width, y: rect.top },
      { x: rect.left, y: rect.top + rect.height },
      { x: rect.left + rect.width, y: rect.top + rect.height },
    ].map((corner) => util.transformPoint(new Point(corner.x * zoom, corner.y * zoom), matrix as unknown as [number, number, number, number, number, number]));
    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    // Les coordonnées locales d'un objet Fabric sont centrées sur l'objet ; l'image, elle,
    // se mesure depuis son coin haut gauche.
    return {
      left: Math.min(...xs) + (image.width || 0) / 2,
      top: Math.min(...ys) + (image.height || 0) / 2,
      width,
      height,
    };
  }

  /**
   * Masque de forme : un `clipPath`, donc réversible, et exporté tel quel en SVG.
   *
   * `inverted` est mis à `false` explicitement — hérité d'une gomme ou d'un ancien
   * masque, il laisserait un trou à la place de la forme.
   */
  function setMask(shape: Parameters<Engine['setMask']>[0]) {
    withSelectionUnlocked((objects) => {
      objects.forEach((object) => {
        if (!shape || shape === 'none') {
          object.clipPath = undefined;
          object.set('sariMask' as never, undefined as never);
          return;
        }
        const width = object.width || 100;
        const height = object.height || 100;
        const clip =
          shape === 'circle'
            ? new Circle({ radius: Math.min(width, height) / 2 })
            : shape === 'ellipse'
              ? new Ellipse({ rx: width / 2, ry: height / 2 })
              : shape === 'triangle'
                ? new Triangle({ width, height })
                : shape === 'hexagon'
                  ? new Polygon(hexagonPoints(Math.min(width, height) / 2))
                  : shape === 'star'
                    ? new Polygon(starPoints(Math.min(width, height) / 2, 5))
                    : new Rect({ width, height, rx: Math.min(width, height) * 0.08 });
        clip.set({ originX: 'center', originY: 'center', inverted: false } as never);
        object.clipPath = clip as never;
        object.set('sariMask', shape) as never;
        object.dirty = true;
      });
    }, 'masque');
  }

  async function replaceImage(src: string) {
    const image = target();
    if (!(image instanceof FabricImage)) return;
    const next = await FabricImage.fromURL(src, { crossOrigin: crossOriginFor(src) });
    const box = image.getBoundingRect();
    const scale = fitScale({ width: next.width || 1, height: next.height || 1 }, { width: box.width, height: box.height }, 'contain');
    next.set(
      {
        originX: image.originX,
        originY: image.originY,
        scaleX: scale,
        scaleY: scale,
        opacity: image.opacity,
        angle: image.angle,
        filters: image.filters,
        clipPath: image.clipPath,
        name: (image as unknown as Record<string, unknown>).name,
        slotId: (image as unknown as Record<string, unknown>).slotId,
        slotLabel: (image as unknown as Record<string, unknown>).slotLabel,
      } as never,
    );
    next.setPositionByOrigin(image.getCenterPoint(), 'center', 'center');
    canvas.remove(image as never);
    canvas.add(next as never);
    next.setCoords();
    canvas.setActiveObject(next);
    render();
    commit('remplacer');
    emitSelection();
  }

  /**
   * Détourage par fond uni : les pixels proches de la couleur du coin deviennent
   * transparents.
   *
   * La copie porte un alpha ; l'objet, lui, est remplacé (et non « peint ») pour rester
   * un `FabricImage` sérialisable. Un fond non uni produit un résultat médiocre, et
   * c'est assumé : l'atelier n'est pas un logiciel de détourage induit par apprentissage,
   * et le dire dans l'interface vaut mieux qu'un bouton qui promet trop.
   */
  async function extractBackground(tolerance = 26) {
    const image = target();
    if (!(image instanceof FabricImage)) return;
    const element = image.getElement() as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!element) return;
    const natural = { width: element.width || image.width, height: element.height || image.height };
    const source = document.createElement('canvas');
    source.width = Math.max(1, Math.round(natural.width));
    source.height = Math.max(1, Math.round(natural.height));
    const context = source.getContext('2d');
    if (!context) return;
    try {
      context.drawImage(element, 0, 0, source.width, source.height);
      const data = context.getImageData(0, 0, source.width, source.height);
      floodTransparent(data, tolerance);
      context.putImageData(data, 0, 0);
    } catch {
      emit({ type: 'error', message: 'Ses pixels ne sont pas lisibles (image d’un autre domaine sans CORS). Passez par la retouche après téléchargement.' });
      return;
    }
    await replaceImage(source.toDataURL('image/png'));
    commit('détourage');
  }

  /* ---------------------------------------------------------------------- les tracés */

  /**
   * Édition des points d'un tracé.
   *
   * Fabric sait dessiner un `Path` mais n'a pas d'éditeur d'ancrage. On en pose le
   * strict utile — déplacer, insérer, supprimer — avec des poignées qui sont des objets
   * marqués `sari-helper`, exclus du document comme de l'export : l'état enregistré reste
   * exactement le visuel, sans objet de service qui survivrait à un enregistrement.
   */
  function beginPathEdit() {
    const object = target();
    endPathEdit();
    if (!object || !isPathLike(object)) return { points: 0, editable: false };
    const data = pathDataOf(object);
    const circles: Circle[] = [];
    data.forEach((command, index) => {
      const point = anchorOf(command);
      if (!point) return;
      const circle = new Circle({
        originX: 'center',
        originY: 'center',
        radius: Math.max(4, 7 / Math.max(canvas.getZoom(), 0.25)),
        left: point.x,
        top: point.y,
        fill: '#0f172a',
        stroke: '#a3e635',
        strokeWidth: 2,
        selectable: false,
        evented: true,
        hasBorders: false,
        hasControls: false,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'move',
      } as never);
      circle.set(HELPER, 'anchor') as never;
      circle.set('sariAnchor', index) as never;
      circles.push(circle);
      canvas.add(circle as never);
      circle.setCoords();
    });
    anchors = { object, circles };
    render();
    return { points: circles.length, editable: circles.length > 0 };
  }

  function isPathLike(object: FabricObject) {
    return object instanceof Path || Array.isArray(pathDataOf(object));
  }

  function pathDataOf(object: FabricObject): PathData {
    const raw = (object as unknown as { path?: unknown }).path;
    return Array.isArray(raw) ? (raw as PathData) : [];
  }

  function anchorOf(command: PathCommand | undefined): { x: number; y: number } | null {
    if (!Array.isArray(command) || command.length < 3) return null;
    const numbers = command.slice(1).filter((value) => typeof value === 'number') as number[];
    if (numbers.length < 2) return null;
    return { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] };
  }

  function moveAnchor(index: number, x: number, y: number) {
    const object = anchors.object as (FabricObject & { path?: PathData }) | null;
    if (!object || !Array.isArray(object.path)) return;
    object.path = object.path.map((command, at) => {
      if (at !== index) return command;
      const next = command.slice();
      next[next.length - 2] = x;
      next[next.length - 1] = y;
      return next;
    });
    object.dirty = true;
    const circle = anchors.circles[index];
    circle?.set({ left: x, top: y });
    render();
  }

  function insertAnchor(afterIndex: number) {
    const object = anchors.object as (FabricObject & { path?: PathData }) | null;
    if (!object || !Array.isArray(object.path)) return;
    const first = anchorOf(object.path[afterIndex]);
    const second = anchorOf(object.path[afterIndex + 1] || object.path[afterIndex]);
    if (!first || !second) return;
    object.path = [
      ...object.path.slice(0, afterIndex + 1),
      ['L', (first.x + second.x) / 2, (first.y + second.y) / 2],
      ...object.path.slice(afterIndex + 1),
    ];
    object.dirty = true;
    commit('point ajouté');
    beginPathEdit();
  }

  function removeAnchor(index: number) {
    const object = anchors.object as (FabricObject & { path?: PathData }) | null;
    if (!object || !Array.isArray(object.path) || object.path.length <= 2) return;
    object.path = object.path.filter((_, at) => at !== index);
    object.dirty = true;
    commit('point retiré');
    beginPathEdit();
  }

  function endPathEdit() {
    if (anchors.object) commit('tracé édité');
    anchors.circles.forEach((circle) => canvas.remove(circle as never));
    anchors = { object: null, circles: [] };
    draggedAnchor = -1;
    render();
  }

  /* -------------------------------------------------------------------------- export */

  /**
   * Un export ne prend jamais les aides en photo.
   *
   * Poignées d'ancrage et cadre de recadrage sont de vrais objets du canvas — c'est ce
   * qui les rend déplaçables et snappables — donc il faut les retirer le temps de la
   * capture, y compris pour `toDataURL`, qui lit le canvas et non le document.
   */
  async function withHelpersHidden<T>(run: () => T | Promise<T>): Promise<T> {
    const hidden: FabricObject[] = [];
    canvas.forEachObject((object) => {
      if ((object as unknown as Record<string, unknown>)[HELPER] && object.visible) {
        hidden.push(object);
        object.visible = false;
      }
    });
    canvas.renderAll();
    try {
      return await run();
    } finally {
      hidden.forEach((object) => {
        object.visible = true;
      });
      render();
    }
  }

  /**
   * Le rendu, à l'échelle demandée.
   *
   * `multiplier` est passé à Fabric plutôt qu'un redimensionnement après coup : c'est le
   * moteur qui compose les textes et les traits à la résolution finale, donc un PNG ×3
   * est réellement net. Retirer l'image d'un canvas ×1 puis l'agrandir l'étalerait.
   * `enableRetinaScaling: false` à la capture évite que la densité de l'écran de
   * l'auteur ne se retrouve dans le fichier livré.
   */
  async function toPngDataUrl(exportOptions: ExportOptions = {}) {
    const scale = Math.max(1, Math.min(6, Number(exportOptions.scale) || 1));
    const format = exportOptions.format === 'jpeg' ? 'jpeg' : exportOptions.format === 'webp' ? 'webp' : 'png';
    return withHelpersHidden(() =>
      canvas.toDataURL({
        format,
        quality: exportOptions.quality ?? (format === 'png' ? 1 : 0.92),
        multiplier: scale,
        enableRetinaScaling: false,
        left: 0,
        top: 0,
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      } as never),
    );
  }

  /**
   * Le SVG, et surtout le verdict « entièrement vectoriel, ou pas ».
   *
   * Trois choses rendent l'export SVG trompeur, et il vaut mieux les annoncer que
   * livrer un fichier qui ne ressemble pas à l'écran : une image matrice collée dans le
   * document, un texte sur tracé (Fabric ne l'écrit pas dans son SVG), et un coup de
   * gomme (`destination-out` n'a pas d'équivalent SVG direct). Dans ces cas-là, le PNG
   * reste la copie fidèle — c'est ce que dit la note.
   */
  async function toSvgString() {
    const offenders: string[] = [];
    canvas.forEachObject((object) => {
      if ((object as unknown as Record<string, unknown>)[HELPER]) return;
      if (object instanceof FabricImage) offenders.push('image matrice');
      if (object instanceof FabricText && (object as FabricText & { path?: unknown }).path) offenders.push('texte sur tracé');
      if ((object as unknown as Record<string, unknown>).globalCompositeOperation === 'destination-out') offenders.push('gomme');
    });
    const vectorOnly = offenders.length === 0;
    const svg = await withHelpersHidden(() =>
      canvas.toSVG({ suppressPreamble: false, viewBox: { x: 0, y: 0, width: canvas.getWidth(), height: canvas.getHeight() } } as never),
    );
    return { svg, vectorOnly, note: vectorOnly ? null : `SVG incomplet : ${[...new Set(offenders)].join(', ')} — le PNG reste la copie fidèle.` };
  }

  async function previewDataUrl(maxWidth = 480) {
    const scale = Math.max(0.2, Math.min(1, maxWidth / Math.max(1, canvas.getWidth())));
    return withHelpersHidden(() =>
      canvas.toDataURL({ format: 'png', multiplier: scale, enableRetinaScaling: false, left: 0, top: 0, width: canvas.getWidth(), height: canvas.getHeight() } as never),
    );
  }

  /* ------------------------------------------------------------------- evenements */

  function wireEvents() {
    canvas.on('selection:created', emitSelection);
    canvas.on('selection:updated', emitSelection);
    canvas.on('selection:cleared', emitSelection);
    canvas.on('object:modified', () => {
      commit('déplacement');
      emitSelection();
    });
    canvas.on('object:scaling', () => render());
    canvas.on('text:changed', () => {
      const object = canvas.getActiveObject() as FabricText | undefined;
      if (object) syncCurve(object);
      commit('texte');
    });

    // Le tracé sort du pinceau : on le note dans l'historique. Fabric l'a déjà ajouté,
    // il ne faut surtout pas le rajouter une deuxième fois ici.
    canvas.on('path:created', () => {
      render();
      commit('tracé');
      emitSelection();
    });

    // Grille : le seul recadrage fait ici, pour ne pas lutter avec les guides de
    // l'extension Fabric (qui, elle, s'occupe des alignements entre objets).
    canvas.on('object:moving', (event: { target?: FabricObject }) => {
      const object = event.target;
      if (!object || !grid.snap || anchors.object) return;
      object.set({
        left: Math.round((object.left || 0) / grid.size) * grid.size,
        top: Math.round((object.top || 0) / grid.size) * grid.size,
      } as never);
    });

    canvas.on('mouse:down', (event: { e?: MouseEvent | TouchEvent | PointerEvent; target?: FabricObject }) => {
      if (!anchors.circles.length) return;
      const hit = event.target && (event.target as unknown as Record<string, unknown>)[HELPER] === 'anchor' ? event.target : null;
      draggedAnchor = hit ? Number((hit as unknown as Record<string, number>).sariAnchor) : -1;
      if (draggedAnchor >= 0) canvas.discardActiveObject();
    });
    canvas.on('mouse:move', (event: { e?: MouseEvent | TouchEvent | PointerEvent; scenePoint?: Point }) => {
      if (event.scenePoint) lastScenePoint = { x: event.scenePoint.x, y: event.scenePoint.y };
      if (draggedAnchor < 0 || !event.scenePoint) return;
      const object = anchors.object;
      if (!object) return;
      const local = toObjectSpace(object, event.scenePoint);
      moveAnchor(draggedAnchor, local.x, local.y);
    });
    const endAnchorDrag = () => {
      if (draggedAnchor < 0) return;
      draggedAnchor = -1;
      commit('point déplacé');
    };
    canvas.on('mouse:up', endAnchorDrag);
    canvas.on('mouse:out', endAnchorDrag);
  }

  /**
   * Un point de la scène vers le repère interne de l'objet.
   *
   * Indispensable : les coordonnées d'un `Path` sont celles de son tracé, avant
   * translation, rotation et échelle. Projeter le curseur sans l'inverse de la matrice
   * ferait déplacer l'ancre à l'opposé dès que l'objet tourne.
   */
  function toObjectSpace(object: FabricObject, scene: Point) {
    const matrix = util.invertTransform(object.calcTransformMatrix());
    const point = util.transformPoint(scene, matrix as unknown as [number, number, number, number, number, number]);
    return { x: point.x + (object.width || 0) / 2, y: point.y + (object.height || 0) / 2 };
  }

  /**
   * Le tracé d'un texte courbe est recalculé quand le texte change.
   *
   * Fabric aligne les glyphes sur le `Path` tel qu'il est au moment de la mise en
   * page : un rayon figé à la création fait déborder ou flotter le texte dès qu'on
   * ajoute trois lettres. Le rayon suit donc la longueur réelle du texte, et
   * `sariCurve` garde la préférence de l'utilisateur (côté et rayon choisis).
   */
  function syncCurve(text: FabricText) {
    const curve = curveOf(text);
    if (!curve?.d) return;
    const length = Math.max(120, (String(text.text || '').length * (text.fontSize || 24) * 0.62) / Math.PI);
    const radius = Math.round(Math.max(60, length * (curve.side === 'right' ? -1 : 1) || 60));
    const d = arcPath(Math.abs(radius), curve.side || 'left');
    text.set({ sariCurve: { ...curve, d, radius }, path: new Path(d, { visible: false }) } as never);
    text.dirty = true;
  }

  function arcPath(radius: number, side: 'left' | 'right') {
    const sweep = side === 'right' ? 1 : 0;
    return `M ${-radius} 0 A ${radius} ${radius} 0 0 ${sweep} ${radius} 0`;
  }

  /* ------------------------------------------------------------- construction, fin */

  wireEvents();
  if (options.state) {
    await load(options.state);
  } else {
    history.reset(JSON.stringify(state()));
    await applyBackground(background);
  }
  ensureFonts();
  try {
    // Les guides d'alignement viennent de l'extension officielle de Fabric. Si elle
    // manque (build allégé), l'atelier reste pleinement utilisable sans elle.
    const extensions = (await import('fabric/extensions')) as unknown as { initAligningGuidelines?: (c: Canvas, o?: Record<string, unknown>) => void };
    extensions.initAligningGuidelines?.(canvas, { color: '#a3e635', lineWidth: 1, density: 12 });
  } catch {
    /* un confort, pas une fonction */
  }
  applyTool();
  render();

  return {
    canvas,
    destroy() {
      disposing = true;
      endPathEdit();
      canvas.dispose();
    },
    setArtboard(nextWidth, nextHeight) {
      canvas.setDimensions({ width: sanitizeSide(nextWidth), height: sanitizeSide(nextHeight) });
      render();
      commit('plan de travail');
    },
    getArtboard: () => ({ width: canvas.getWidth(), height: canvas.getHeight() }),
    async setBackground(spec) {
      background = spec;
      await applyBackground(spec);
      commit('fond');
    },
    getBackground: () => background,
    fitTo(box) {
      const scale = fitScale({ width: canvas.getWidth(), height: canvas.getHeight() }, box, 'contain');
      const zoom = Math.max(0.1, Math.min(4, scale));
      canvas.setViewportTransform([zoom, 0, 0, zoom, (box.width - canvas.getWidth() * zoom) / 2, (box.height - canvas.getHeight() * zoom) / 2]);
      emit({ type: 'zoom', value: zoom });
      render();
      return zoom;
    },
    setZoom(value) {
      const zoom = Math.max(0.1, Math.min(6, value));
      const center = canvas.getVpCenter();
      canvas.zoomToPoint(center, zoom);
      emit({ type: 'zoom', value: zoom });
      render();
    },
    getZoom: () => canvas.getZoom(),
    selectAll() {
      const objects = canvas
        .getObjects()
        .filter((object) => {
          const raw = object as unknown as LooseObject;
          return !raw[HELPER] && !raw.locked && object.visible !== false && object.selectable !== false;
        });
      canvas.discardActiveObject();
      if (objects.length > 1) canvas.setActiveObject(selectionOf(objects));
      else if (objects.length === 1) canvas.setActiveObject(objects[0]);
      canvas.requestRenderAll();
    },
    serialize: () => JSON.stringify(state()),
    load,
    isDirty: () => dirty,
    markSaved,
    undo() {
      const restored = history.undo(JSON.stringify(state()));
      if (!restored) return;
      void load(restored);
      dirty = true;
      emit({ type: 'dirty', value: true });
    },
    redo() {
      const restored = history.redo(JSON.stringify(state()));
      if (!restored) return;
      void load(restored);
      emit({ type: 'history', canUndo: history.canUndo(), canRedo: history.canRedo() });
    },
    historyStats: () => history.stats(),
    commit,
    setTool(next) {
      if (next !== 'path') endPathEdit();
      tool = next;
      applyTool();
      return tool;
    },
    getTool: () => tool,
    setBrush(next) {
      if (next.size) {
        pencil.width = Math.max(1, next.size);
        eraser.width = Math.max(2, next.size * 1.6);
      }
      if (next.color) pencil.color = next.color;
      if (next.smoothing !== undefined) {
        // `decimate` est le vrai réglage de lissage de Fabric : il jette les points
        // trop proches. 0 = tracé fidèle au geste, 1 = tracé très lissé.
        const value = bound(Number(next.smoothing) / 100, 0, 0.9);
        pencil.decimate = value;
        eraser.decimate = value;
      }
      render();
    },
    getBrush: () => ({ size: pencil.width, color: pencil.color, smoothing: Math.round(pencil.decimate * 100) }),
    setGrid(next) {
      grid = { ...grid, ...next };
      render();
    },
    getGrid: () => ({ ...grid }),
    addText,
    addShape,
    addImage: (src, imageOptions) => addImage(src, imageOptions),
    addSvg: (svg, svgOptions) => addSvg(svg, svgOptions),
    addChart: (spec, mode) => addChart(spec, mode),
    selected,
    selectedProps,
    update(patch, label = 'propriété') {
      applyToSelected(patch, label);
    },
    setPaint(part, value) {
      const patch: Record<string, unknown> = {};
      if (value.kind === 'none') patch[part] = part === 'fill' ? '' : 'transparent';
      else if (value.kind === 'solid') patch[part] = normalizeColor(value.color) || '#000000';
      else patch[part] = new Gradient(gradientToFabric(value.gradient) as never);
      applyToSelected(patch, part === 'fill' ? 'remplissage' : 'contour');
    },
    setText(patch) {
      const object = target();
      if (object && object instanceof FabricText) {
        const next = { ...patch };
        if (next.fontFamily) next.fontFamily = fontStackOf(String(next.fontFamily));
        object.set(next as never);
        syncCurve(object as FabricText);
        object.dirty = true;
        object.setCoords();
        render();
        commit(next.text !== undefined ? 'texte' : 'typographie');
        emitSelection();
        void waitForFont(String(next.fontFamily || (object as FabricText).fontFamily || 'Inter'));
      }
    },
    async setCurve(next) {
      const object = target();
      if (!(object instanceof FabricText)) return;
      if (!next.enabled) {
        object.set({ path: undefined, sariCurve: null } as never);
        object.setCoords();
        render();
        commit('texte plat');
        return;
      }
      const radius = Math.max(60, next.radius || 180);
      const d = arcPath(radius, next.side || 'left');
      object.set(
        {
          sariCurve: { d, offset: next.offset ?? 0, side: next.side || 'left', align: 'center', radius },
          path: new Path(d, { visible: false }),
          pathStartOffset: next.offset ?? 0,
          pathSide: next.side || 'left',
          pathAlign: alignFromUi(next.align),
        } as never,
      );
      await waitForFont(familyOf(String(object.fontFamily || 'Inter')), Number(object.fontSize) || 24, String(object.fontWeight || '400'));
      object.dirty = true;
      object.setCoords();
      render();
      commit('texte courbe');
      emitSelection();
    },
    align,
    distribute,
    zOrder,
    group,
    ungroup,
    duplicate,
    remove,
    nudge,
    rotateStep(degrees) {
      const object = target();
      if (!object) return;
      applyToSelected({ angle: Math.round((((object.angle || 0) + degrees) % 360 + 360) % 360) }, 'rotation');
    },
    flip(axis) {
      const object = target();
      if (!object) return;
      applyToSelected(axis === 'x' ? { flipX: !object.flipX } : { flipY: !object.flipY }, 'miroir');
    },
    scaleBy(factor) {
      const object = target();
      if (!object) return;
      applyToSelected({ scaleX: Math.max(0.02, (object.scaleX || 1) * factor), scaleY: Math.max(0.02, (object.scaleY || 1) * factor) }, 'échelle');
    },
    /** Déverrouille (ou verrouille) toute la planche : le geste de rattrapage d'un calque figé. */
    setLockedAll(locked: boolean) {
      let touched = 0;
      canvas.forEachObject((object) => {
        if ((object as unknown as Record<string, unknown>)[HELPER]) return;
        if (Boolean((object as unknown as Record<string, unknown>).locked) === locked) return;
        object.set({ locked, selectable: !locked, evented: !locked } as never);
        touched += 1;
      });
      if (!touched) return;
      render();
      commit(locked ? 'tout verrouiller' : 'tout déverrouiller');
      emitSelection();
    },
    anyLocked() {
      return canvas.getObjects().some((object) => Boolean((object as unknown as Record<string, unknown>).locked));
    },
    setLocked(locked) {
      selected().forEach((object) => {
        object.set({ locked, selectable: !locked, evented: !locked } as never);
      });
      render();
      commit('verrou');
      emitSelection();
    },
    setVisible(visible) {
      selected().forEach((object) => object.set({ visible } as never));
      render();
      commit('visibilité');
    },
    rename(name, slotId, slotLabel) {
      applyToSelected({ name, ...(slotId ? { slotId, slotLabel: slotLabel || name } : {}) }, 'nommer');
    },
    layers,
    loadResilient,
    selectIndex(index) {
      const object = canvas.getObjects()[index];
      if (!object) return;
      canvas.setActiveObject(object);
      emitSelection();
      render();
    },
    pointer() {
      const at = lastScenePoint || { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
      return { x: Math.round(at.x), y: Math.round(at.y) };
    },
    setOpacityFor(index, opacity) {
      const object = canvas.getObjects()[index];
      if (!object) return;
      object.set({ opacity: bound(opacity, 0, 100) / 100 } as never);
      render();
      commit('opacité');
    },
    applyFilter,
    resetFilters,
    filtersOf,
    knownFilters: () => Object.keys(FILTERS),
    bakeCrop,
    setMask,
    replaceImage,
    extractBackground,
    beginPathEdit,
    moveAnchor,
    insertAnchor,
    removeAnchor,
    endPathEdit,
    pathAnchorCount: () => anchors.circles.length,
    toPngDataUrl,
    toSvgString,
    previewDataUrl,
    render: () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())),
  };
}

/**
 * L'inondation du détourage : partir des quatre bords, s'arrêter sur un pixel qui
 * s'éloigne trop de la couleur d'origine.
 *
 * Un seuil quadratique est comparé aux trois canaux à la fois — comparer canal par
 * canal ferait passer un ciel laiteux pour un fond blanc. Le dernier passage adoucit
 * la frange : sur une photo compressée, un bord net laisse toujours un liseré, et un
 * liseré net se voit à l'écran.
 */
/** Une valeur bornée, écrite ici pour que les fonctions de module s'en servent sans dépendre du closure. */
function bound(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function floodTransparent(data: ImageData, tolerance: number) {
  const { width, height, data: pixels } = data;
  const sample = [pixels[0], pixels[1], pixels[2]];
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (seen[index]) return;
    seen[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  const limit = bound(Math.round(tolerance), 2, 180) ** 2 * 3;
  while (queue.length) {
    const index = queue.shift() as number;
    const at = index * 4;
    const delta = (pixels[at] - sample[0]) ** 2 + (pixels[at + 1] - sample[1]) ** 2 + (pixels[at + 2] - sample[2]) ** 2;
    if (delta > limit) continue;
    pixels[at + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let index = 0; index < width * height; index++) {
    if (pixels[index * 4 + 3] === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touching = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && pixels[((y + dy) * width + (x + dx)) * 4 + 3] === 0);
    if (touching) pixels[index * 4 + 3] = Math.min(pixels[index * 4 + 3], 140);
  }
}

/** Un dégradé converti en CSS, pour les pastilles du sélecteur de couleur. */
export function cssGradient(gradient: Parameters<typeof gradientToFabric>[0]) {
  if (!gradient) return 'transparent';
  const stops = gradient.stops.map((stop) => `${stop.color} ${stop.offset}%`).join(', ');
  return gradient.type === 'radial'
    ? `radial-gradient(circle at ${gradient.radialX ?? 50}% ${gradient.radialY ?? 50}%, ${stops})`
    : `linear-gradient(${Math.round(gradient.angle ?? 90) - 90}deg, ${stops})`;
}

export { normalizeColor, describeFill };
