/**
 * lib/canvas/types.ts — les formes que l'atelier échange.
 *
 * Un seul fichier, parce que ces types sont le contrat entre trois mondes qui ne se
 * voient jamais directement : le moteur Fabric (`engine.ts`), les panneaux React
 * (`components/canvas/`), et la GED (`lib/ged/`) qui stocke le JSON. Ce qui est écrit
 * ici survit donc à un enregistrement, à un rechargement, et à l'ajout d'un outil.
 */

import type { FabricObject } from 'fabric';

/** Les outils de la barre latérale. `crop` et `path` sont des modes, pas des fabrications. */
export type ToolId =
  | 'select'
  | 'hand'
  | 'text'
  | 'brush'
  | 'eraser'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'arrow'
  | 'crop'
  | 'path';

/** Un arrêt de dégradé, en pourcentage du parcours. */
export interface ColorStop {
  offset: number;
  color: string;
}

/**
 * Un dégradé, décrit en pourcentages et en degrés — pas en coordonnées Fabric.
 *
 * Cette indirection sert deux choses : le panneau peut afficher et modifier un
 * dégradé sans connaître `Gradient`, et l'état écrit sur le disque reste lisible par
 * un autre outil plus tard (un export, un gabarit édité à la main).
 */
export interface GradientSpec {
  type: 'linear' | 'radial';
  stops: ColorStop[];
  /** Dégradé linéaire : direction, en degrés (0 = vers le haut). */
  angle?: number;
  /** Dégradé radial : centre, en pourcentage de la boîte englobante. */
  radialX?: number;
  radialY?: number;
  radialR?: number;
}

/** Une couleur unie ou un dégradé, telle que la propose le sélecteur. */
export type PaintValue = { kind: 'solid'; color: string } | { kind: 'gradient'; gradient: GradientSpec } | { kind: 'none' };

/** Le fond du plan de travail. */
export type BackgroundSpec =
  | { mode: 'solid'; color: string }
  | { mode: 'gradient'; gradient: GradientSpec }
  | { mode: 'image'; src: string; fit: 'cover' | 'contain' | 'stretch'; opacity?: number };

/** Un type de graphique, et les données qu'il accepte. */
export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSpec {
  type: ChartType;
  series: { label: string; value: number }[];
  title?: string;
  palette?: 'lime' | 'ocean' | 'sunset' | 'ink';
  showGrid?: boolean;
  strokeWidth?: number;
  /** L'anneau, pour un camembert troué (0 = plein). */
  innerRadius?: number;
  textColor?: string;
  backgroundColor?: string;
}

/** Comment un graphique entre dans le canvas : en formes éditable, ou en image. */
export type ChartInsertMode = 'objects' | 'image';

/** Une valeur d'une zone de gabarit. */
export type SlotValue = string | number;

/** Une zone modifiable, résolue depuis le JSON du gabarit. */
export interface TemplateSlot {
  id: string;
  type: 'text' | 'image' | 'color';
  label: string;
  current: string;
  maxLength?: number;
}

/** Une ligne du panneau Calques. */
export interface LayerInfo {
  index: number;
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  selected: boolean;
}

/** L'état de la sélection, tel que les panneaux l'affichent. */
export interface SelectionState {
  count: number;
  /** L'objet actif, quand il est unique. */
  object: FabricObject | null;
  kinds: string[];
  hasText: boolean;
  hasImage: boolean;
  hasPath: boolean;
  locked: boolean;
}

/** Ce qu'un panneau demande à lire d'un objet, sans connaître Fabric. */
export interface ObjectProps {
  name: string;
  id: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  angle: number;
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: PaintValue;
  stroke: PaintValue;
  strokeWidth: number;
  strokeDash?: string;
  rx: number;
  shadow: { color: string; blur: number; offsetX: number; offsetY: number; enabled: boolean };
  blendMode: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  charSpacing?: number;
  lineHeight?: number;
  align?: string;
  curve?: { enabled: boolean; radius: number; offset: number; side: 'left' | 'right'; align: 'start' | 'center' | 'end' };
  filters?: Record<string, number>;
  slotId?: string;
  slotLabel?: string;
  clipShape?: string;
  src?: string;
}

/** Un export, sous la forme que l'appelant va consommer. */
export interface ExportResult {
  format: 'png' | 'jpeg' | 'webp' | 'svg' | 'json' | 'html';
  /** `data:` URL pour une image, texte pour les autres. */
  value: string;
  width: number;
  height: number;
  /** Le poids réel, affiché dans la confirmation. */
  bytes: number;
  /** Un SVG n'est fidèle que s'il est entièrement vectoriel : on le dit. */
  lossy?: string | null;
}

/** Une demande d'enregistrement dans la GED, produite par l'atelier. */
export interface StudioSavePayload {
  file?: string;
  kind: 'canvas' | 'image' | 'svg';
  prefix?: string;
  name: string;
  title: string;
  alt: string;
  tags: string[];
  width: number;
  height: number;
  png: string | null;
  svg: string | null;
  state: unknown;
  background: BackgroundSpec | null;
  source: { origin: 'builder' | 'atelier' | 'media' | 'import'; pageId?: string; pageSlug?: string; componentId?: string; field?: string };
}

/** Ce que l'atelier signale à l'appelant (barre d'état, autosauvegarde, GrapesJS). */
export type StudioEvent =
  | { type: 'dirty'; value: boolean }
  | { type: 'history'; canUndo: boolean; canRedo: boolean }
  | { type: 'selection'; state: SelectionState }
  | { type: 'tool'; tool: ToolId }
  | { type: 'zoom'; value: number }
  | { type: 'saved'; file: string; url: string; version: number }
  | { type: 'error'; message: string };

/** La référence d'un asset de la GED, telle que la page la conserve. */
export interface CanvasReference {
  file: string;
  url: string;
  kind?: string;
  prefix?: string;
  width?: number;
  height?: number;
  version?: number;
}

/** Une entrée d'historique, sérialisée (le JSON Fabric est petit, et c'est ce qui reste exact). */
export interface HistorySnapshot {
  label: string;
  at: number;
  json: string;
}
