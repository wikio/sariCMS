/**
 * lib/ged/types.d.ts — les formes échangées entre le disque, l'API et les écrans.
 *
 * Les règles sont écrites en JavaScript pur (`prefix.mjs`, `manifest.mjs`) pour
 * pouvoir être rejouées par `node scripts/test-ged.mjs` sans serveur ni base ;
 * les types TypeScript vivent ici, à côté, et ne décrivent que ce qui franchit
 * une frontière (le manifeste écrit sur le disque, les réponses d'API).
 */

/** D'où vient un asset de la GED. */
export interface GedSource {
  /** `builder` = posé dans une page, `atelier` = créé depuis l'éditeur graphique. */
  origin: 'builder' | 'atelier' | 'media' | 'import';
  pageId: string;
  pageSlug: string;
  /** L'identifiant GrapesJS du composant qui pointe sur l'asset. */
  componentId: string;
  /** Le champ d'un enregistrement quand l'asset vient d'un formulaire métier. */
  field: string;
}

/** Une version archivée d'un asset. */
export interface GedHistoryEntry {
  file: string;
  url: string;
  at: string;
  by: string;
  label: string;
  width: number;
  height: number;
  extension?: string;
}

/** L'état rejouable de l'asset : ce qui permet de le rouvrir dans l'atelier. */
export interface GedEditable {
  format: 'fabric' | 'svg';
  /** L'état lui-même, tant qu'il tient sous la borne d'écriture inline. */
  inline: unknown | null;
  /** Le fichier séparé `.sari.canvas.json` quand l'état est trop lourd. */
  file: string | null;
  size: number;
}

/** Le contenu d'un `x.sari.json` posé à côté d'un asset. */
export interface GedManifest {
  version: number;
  file: string;
  kind: string;
  prefix: string;
  title: string;
  alt: string;
  tags: string[];
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  source: GedSource;
  author: { id: number | string | null; email: string };
  editable: GedEditable;
  render: { png: string; svg: string; webp: string };
  history: GedHistoryEntry[];
  /** Les clés qu'un autre module a ajoutées, conservées telles quelles. */
  extra: Record<string, unknown>;
}

/** Ce que la liste de la GED renvoie par asset. */
export interface GedAssetSummary {
  file: string;
  name: string;
  title: string;
  alt: string;
  kind: string;
  prefix: string;
  module: string;
  tags: string[];
  width: number;
  height: number;
  bytes: number;
  size: number;
  mime: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  editable: boolean;
  editableFormat: 'fabric' | 'svg' | null;
  stateFile: string | null;
  render: { png: string; svg: string; webp: string } | null;
  source: GedSource | null;
  history: GedHistoryEntry[];
  isVisual: boolean;
  extra: Record<string, unknown>;
}

/** Une réponse de liste, avec ses facettes (le sélecteur les affiche en filtres). */
export interface GedListResult {
  items: GedAssetSummary[];
  total: number;
  page: number;
  limit: number;
  kinds: string[];
  modules: string[];
  tags: string[];
}

/** Un gabarit du catalogue `public/canvas/templates`. */
export interface GedTemplateSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  format: { width: number; height: number; name: string; orientation: 'paysage' | 'portrait' | 'carré' };
  palette: string[];
  preview: string | null;
  file: string;
  version: number;
  tags: string[];
  updatedAt: string;
  /** Les zones modifiables du gabarit, telles que déclarées dans son JSON. */
  slots?: GedSlot[];
}

/** Une zone qu'un utilisateur peut changer sans redessiner le gabarit. */
export interface GedSlot {
  id: string;
  type: 'text' | 'image' | 'color';
  label: string;
  /** L'identifiant posé sur l'objet Fabric (`slotId`) — pas un index d'array. */
  target: string;
  path?: string[];
  default?: string;
  maxLength?: number;
  placeholder?: string;
  group?: string;
}

/** La payload d'export envoyée par l'atelier au endpoint de sauvegarde. */
export interface GedCanvasExportPayload {
  /** La référence cible (`module/fichier`) pour réécrire une version existante. */
  file?: string;
  kind?: string;
  /** Le préfixe demandé ; la table GED fait foi s'il est vide ou inconnu. */
  prefix?: string;
  name?: string;
  title?: string;
  alt?: string;
  tags?: string[];
  width: number;
  height: number;
  /** PNG en base64 (sans data: URL) — le rendu fidèle, celui qu'on affiche. */
  png?: string;
  /** SVG, envoyé seulement quand le document est entièrement vectoriel. */
  svg?: string;
  /** L'état Fabric complet, pour réouvrir le fichier dans l'atelier. */
  state?: unknown;
  source?: Partial<GedSource>;
  /** Ne pas régénérer le PNG (sauvegarde de travail depuis l'API). */
  skipRender?: boolean;
}
