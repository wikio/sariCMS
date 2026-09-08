/**
 * Le plugin GrapesJS de l'atelier graphique.
 *
 * Il fait trois choses, et rien d'autre :
 *
 * 1. il enregistre le type de composant `sari-canvas` — un `image` enriché, donc tout
 *    ce que l'éditeur sait déjà faire d'une image (redimensionner, remplacer la source,
 *    alt, styles) reste disponible sans réécrire une ligne du code existant ;
 * 2. il remplace le sélecteur d'actifs natif par la GED (`assetManager.custom`), en
 *    rendant la main à GrapesJS si personne n'écoute (page chargée sans l'hôte React) ;
 * 3. il branche le double-clic et les boutons de traits sur l'atelier, via le pont.
 *
 * Pourquoi un type et pas un composant React dans la frame : la page publiée est rendue
 * côté serveur et doit afficher la planche sans JavaScript. Un `<img class="sari-canvas"
 * src="/uploads/…">` traverse `sanitizeBuilderHtml` (les attributs `data-*` y survivent),
 * se met en cache, et se réédite parce que `data-sari-canvas` porte la référence de
 * l'asset. Le JSON de l'atelier, lui, ne vit PAS dans la page : il est dans la GED, à
 * côté du PNG. Une page qui embarquerait son canvas pèserait le poids de ses calques.
 *
 * Le module n'importe ni React ni Fabric : GrapesJS est chargé dynamiquement dans la
 * page d'admin, et un `import` statique d'un composant React ici ferait redescendre
 * `react-dom` dans le bundle de l'éditeur.
 */

import { canvasBridge, type AssetBridgeRequest, type StudioReply } from './sari-canvas-bridge';

export const SARI_CANVAS_TYPE = 'sari-canvas';
/** L'attribut qui porte `module/fichier` de l'asset dans le HTML publié. */
export const SARI_REF_ATTR = 'data-sari-canvas';
/** Le fichier affiché avant la première planche : un gabarit vide, pas une image cassée. */
export const SARI_CANVAS_PLACEHOLDER = '/canvas/placeholder.svg';

/** La partie de GrapesJS que ce plugin touche — le paquet n'exporte pas de types. */
interface GrapesTrait {
  component: {
    getId: () => string;
    getAttributes: () => Record<string, string | number>;
    addAttributes: (attributes: Record<string, string | number>) => unknown;
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => unknown;
    is: (type: string) => boolean;
  };
}

interface GrapesLike {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  getConfig: () => Record<string, unknown>;
  getSelected: () => GrapesTrait['component'] | null;
  AssetManager: {
    getConfig: () => Record<string, unknown>;
    getAll: () => { reset: (list: unknown[]) => unknown; models: unknown[] };
    open: (options: Record<string, unknown>) => unknown;
  };
  Commands: { add: (id: string, def: Record<string, unknown>) => unknown; run: (id: string, options?: Record<string, unknown>) => unknown };
  ComponentManager: { addType: (id: string, def: Record<string, unknown>) => unknown };
  DomComponents: { addType: (id: string, def: Record<string, unknown>) => unknown; getType: (id: string) => unknown };
}

export interface SariCanvasOptions {
  /** Le module GED où écrire les planches créées depuis cette page. */
  module?: string;
  /** Le contexte de la page courante, noté dans la fiche de l'asset. */
  pageId?: string;
  pageSlug?: string;
  /** Ce que l'hôte doit afficher comme titre de fenêtre. */
  locale?: string;
  /** Ferme la personnalisation de l'Asset Manager (retour à la fenêtre native). */
  withoutAssets?: boolean;
  /** Les préfixes activés, transmis tels quels à la GED. Vide = table par défaut. */
  kinds?: string[];
}

/** Le contexte de la page, rafraîchi à chaque ouverture : une page peut changer sans recharger l'éditeur. */
let liveOptions: SariCanvasOptions = {};

export function setSariCanvasOptions(options: SariCanvasOptions) {
  liveOptions = { ...liveOptions, ...options };
}

/** La référence GED lue sur un composant, ou `null` pour une image ordinaire. */
export function readCanvasReference(component: GrapesTrait['component'] | null | undefined) {
  if (!component) return null;
  const attributes = component.getAttributes?.() || {};
  const file = String(attributes[SARI_REF_ATTR] || '').trim();
  if (!file) return null;
  return {
    file,
    url: String(attributes.src || ''),
    alt: String(attributes.alt || ''),
    width: Number(attributes.width || 0) || 0,
    height: Number(attributes.height || 0) || 0,
  };
}

/** Écrit la réponse de l'atelier sur le composant : c'est le seul endroit qui connaisse l'attribut de référence. */
export function applyCanvasReference(component: GrapesTrait['component'], reply: StudioReply) {
  component.addAttributes({
    [SARI_REF_ATTR]: reply.file,
    src: reply.url,
    width: reply.width || component.getAttributes().width || 0,
    height: reply.height || component.getAttributes().height || 0,
    ...(reply.alt ? { alt: reply.alt } : {}),
  });
  component.set('sariCanvas', { file: reply.file, version: reply.version ?? 1 });
}

function openStudio(component: GrapesTrait['component'] | null, purpose: 'edit' | 'new' | 'retouch' | 'replace') {
  const reference = readCanvasReference(component);
  const attributes = component?.getAttributes?.() || {};
  return canvasBridge.openStudio({
    purpose,
    componentId: component?.getId?.(),
    pageId: liveOptions.pageId,
    pageSlug: liveOptions.pageSlug,
    file: reference?.file,
    url: reference?.url || String(attributes.src || ''),
    alt: String(attributes.alt || ''),
    width: Number(attributes.width || 0) || undefined,
    height: Number(attributes.height || 0) || undefined,
  });
}

/**
 * Enregistre le type, le bloc, les commandes et le sélecteur d'actifs.
 *
 * Appeler deux fois ne casse rien : GrapesJS remplace un type existant par sa nouvelle
 * définition (`compType.model = methods.model`), et l'attribution d'un gestionnaire
 * d'événements se fait avec `off` devant pour que le remontage d'une page ne double pas
 * les écouteurs.
 */
export function registerSariCanvas(editor: GrapesLike, options: SariCanvasOptions = {}) {
  setSariCanvasOptions(options);
  const components = editor.DomComponents || editor.ComponentManager;

  components.addType(SARI_CANVAS_TYPE, {
    // Hériter de `image` est le coeur du contrat « aucune régression » : le panneau de
    // style, le redimensionnement, le remplacement de source et le `getSrc` des traits
    // natifs restent ceux de l'éditeur.
    extend: 'image',
    isComponent: (element: unknown) => {
      const node = element as HTMLElement;
      return node?.classList?.contains('sari-canvas') ? { type: SARI_CANVAS_TYPE } : 0;
    },
    model: {
      defaults: {
        tagName: 'img',
        class: 'sari-canvas',
        alt: 'Planche graphique',
        // Une planche est une image : elle doit rester redimensionnable et
        // remplaçable, mais pas un conteneur.
        droppable: false,
        resizable: true,
        badgable: false,
        highlightable: true,
        copyable: true,
        layerable: true,
        // La largeur/hauteur s'écrivent en attributs et non en style : c'est ce qui
        // évite un saut de mise en page (CLS) à la livraison, et `loading="lazy"` va
        // avec.
        traits: [
          {
            type: 'file',
            attribute: 'src',
            label: 'Source',
            // `assets: true` laisse GrapesJS remplir la liste depuis AssetManager ;
            // notre sélecteur personnalisé répond à `open`.
          },
          { type: 'text', attribute: 'alt', label: 'Texte alternatif' },
          { type: 'text', attribute: 'width', label: 'Largeur', pattern: '[0-9]*' },
          { type: 'text', attribute: 'height', label: 'Hauteur', pattern: '[0-9]*' },
          {
            type: 'button',
            id: 'sari-edit',
            label: 'Ouvrir la planche dans l’atelier',
            labelButton: 'Éditer la planche',
            command: (_editor: unknown, trait: GrapesTrait) => {
              void openStudio(trait.component, 'edit');
            },
          },
          {
            type: 'button',
            id: 'sari-retouch',
            label: 'Recadrer, retoucher, détourer',
            labelButton: 'Retoucher',
            command: (_editor: unknown, trait: GrapesTrait) => {
              void openStudio(trait.component, 'retouch');
            },
          },
          {
            type: 'button',
            id: 'sari-replace',
            label: 'Choisir un autre visuel dans la GED',
            labelButton: 'Remplacer',
            command: (editorRef: unknown, trait: GrapesTrait) => {
              pickAsset(editorRef as GrapesLike, trait.component);
            },
          },
          {
            type: 'button',
            id: 'sari-detach',
            label: 'Garder l’image mais couper le lien avec l’atelier',
            labelButton: 'Détacher de la GED',
            command: (_editor: unknown, trait: GrapesTrait) => {
              trait.component.addAttributes({ [SARI_REF_ATTR]: '' });
              trait.component.set('sariCanvas', undefined);
            },
          },
        ],
      },
    },
    block: {
      id: 'sari-canvas',
      label: 'Planche graphique',
      category: 'Médias',
      media: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 15l3-4 2.5 3L15 11l2 4z"/></svg>',
      content: {
        type: SARI_CANVAS_TYPE,
        attributes: {
          class: 'sari-canvas',
          src: SARI_CANVAS_PLACEHOLDER,
          alt: 'Planche graphique — double-cliquez pour l’ouvrir dans l’atelier',
          loading: 'lazy',
          decoding: 'async',
        },
      },
    },
  });

  editor.Commands.add('sari-canvas-open', {
    run: (editorRef: GrapesLike) => {
      void openStudio(editorRef.getSelected(), liveOptions.pageId ? 'edit' : 'new');
    },
  });

  editor.Commands.add('sari-canvas-new', {
    run: (editorRef: GrapesLike) => {
      void openStudio(editorRef.getSelected(), 'new').then((reply) => {
        const component = editorRef.getSelected();
        if (reply && component && component.is(SARI_CANVAS_TYPE)) applyCanvasReference(component, reply);
      });
    },
  });

  if (!options.withoutAssets) {
    const config = editor.AssetManager.getConfig();
    // Le contrat vérifié dans `grapes.mjs` : quand `config.custom.open` existe, la
    // commande `open-assets` rend un conteneur vide et nous le passe, SANS ouvrir la
    // fenêtre modale native. Nous n'avons donc qu'à monter notre panneau dedans.
    config.custom = {
      open: (data: AssetBridgeRequest) => {
        const accepted = canvasBridge.openAssets(bridgeRequest(data));
        if (!accepted) data.close();
      },
      close: () => {
        canvasBridge.closeAssets();
      },
    };
  }

  // Le double-clic sur une image de la page, qu'elle soit une planche ou non : c'est le
  // raccourci demandé (« ouvrir l'éditeur graphique au double-clic »). GrapesJS émet
  // bien `component:dblclick`, y compris sur le type image.
  // L'écouteur est unique par éditeur : la page d'admin se remonte à chaque changement
  // de page, et deux écouteurs sur le même événement ouvriraient deux fenêtres.
  if (wired.has(editor)) return;
  wired.add(editor);
  editor.on('component:dblclick', (raw: unknown) => {
    const component = raw as GrapesTrait['component'];
    if (!component) return;
    const isCanvas = component.is(SARI_CANVAS_TYPE);
    const isImage = component.getAttributes?.().src !== undefined || component.get?.('tagName') === 'IMG';
    if (!isCanvas && !isImage) return;
    void openStudio(component, isCanvas ? 'edit' : 'retouch').then((reply) => {
      if (!reply || !isCanvas) return;
      applyCanvasReference(component, reply);
    });
  });
}

const wired = new WeakSet<GrapesLike>();

/** L'API publique de `data` est large et non typée ; voici le minimum que nos écrans utilisent. */
interface RawAssetBridge {
  container: HTMLElement | null;
  types?: string[];
  options?: Record<string, unknown>;
  close: () => void;
  select: (asset: unknown, complete: boolean) => void;
}

function bridgeRequest(data: unknown): AssetBridgeRequest {
  const raw = data as RawAssetBridge;
  return {
    container: raw.container ?? null,
    types: raw.types || [],
    options: raw.options || {},
    close: () => raw.close(),
    select: (asset, complete) => {
      // GrapesJS attend une entité de sa collection ; lui passer l'objet brut est le
      // chemin qu'emprunte déjà son propre `Asset` (il normalise `src`/`name`/`type`).
      raw.select(asset, complete);
    },
  };
}

/**
 * Ouvre la GED et écrit le choix dans le composant — le « remplacer » des traits.
 *
 * On passe par `AssetManager.open` et pas par le pont directement : c'est l'API
 * publique, donc la commande garde la main sur `close`, sur le type attendu et sur le
 * fait qu'un simple clic prépare la valeur tandis qu'un double-clic la valide.
 */
export function pickAsset(editor: GrapesLike, component: GrapesTrait['component']) {
  editor.AssetManager.open({
    types: ['image'],
    accept: 'image/png,image/jpeg,image/webp,image/avif,image/svg+xml',
    modalTitle: 'Choisir un visuel dans la GED',
    select: (asset: { get?: (key: string) => unknown; src?: string }) => {
      const src = String(asset?.get?.('src') ?? asset?.src ?? '');
      if (src) component.addAttributes({ src });
    },
  });
}

/** La forme `plugins: [sariCanvasPlugin]` de GrapesJS, pour un branchement sans page hôte. */
export const sariCanvasPlugin = {
  type: 'plugin',
  name: 'sari-canvas',
  init(editor: GrapesLike) {
    registerSariCanvas(editor, liveOptions);
  },
};

export default sariCanvasPlugin;
