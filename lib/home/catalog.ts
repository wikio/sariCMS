/**
 * Catalogue des blocs de la page d'accueil : ce que l'administration doit
 * montrer pour chaque bloc (libellés, champs de texte, réglages, sélecteur de
 * fiches, blocs répétables, constructeur de page).
 *
 * Tout le studio est piloté par ce fichier : un bloc = une entrée, et les
 * écrans (liste des blocs, éditeur, aperçu) se construisent à partir des
 * descripteurs déclarés ici. Ajouter un bloc à la page d'accueil veut donc dire
 * une entrée de catalogue + un composant de vitrine, pas un écran de plus.
 */
import type { HomeSectionKey } from './config';

export type HomeFieldKind =
  | 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'color' | 'image' | 'range' | 'html';

/** Où le champ est enregistré : un texte traduit, un réglage, ou le style. */
export type HomeFieldScope = 'texts' | 'settings' | 'style';

export interface HomeField {
  key: string;
  label: string;
  /** Clé de traduction (admin.home.<labelKey>) ; à défaut le libellé français sert d'interface. */
  labelKey?: string;
  kind: HomeFieldKind;
  scope: HomeFieldScope;
  hint?: string;
  placeholder?: string;
  /** Champs qui se traduisent : texte uniquement. */
  i18n?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  wide?: boolean;
  options?: Array<{ value: string; label: string }>;
  /** Le champ n'apparaît que si un autre réglage a telle valeur. */
  showIf?: { key: string; equals?: unknown; truthy?: boolean };
}

export interface HomeRepeaterField {
  key: string;
  label: string;
  labelKey?: string;
  kind: HomeFieldKind;
  i18n?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  wide?: boolean;
}

export interface HomeRepeater {
  /** Libellé de la liste (ex. « Blocs en alternance »). */
  label: string;
  labelKey?: string;
  /** Un seul champ marque l'élément dans la liste (titre du bloc). */
  titleKey: string;
  fields: HomeRepeaterField[];
  defaults: Record<string, unknown>;
}

/** Ressources que le panneau de sélection sait parcourir. */
export type HomePickerResource = 'hero' | 'products' | 'testimonials' | 'events' | 'news' | 'partners' | 'careers' | 'pages';

export interface HomePicker {
  /** Ressource du CMS à parcourir pour choisir les fiches. */
  resource: HomePickerResource;
  /**
   * Touche de réglage qui choisit la ressource parcourue (bandeau défilant : le
   * module à afficher est une config du bloc, pas une entrée de catalogue par module).
   */
  resourceFrom?: string;
  /** Ressources proposées quand le réglage vaut `mixed`. */
  resourceList?: HomePickerResource[];
  /** Valeur du réglage qui retire toute liste de fiches (le bloc ne vit plus que de ses blocs libres). */
  resourceHide?: string;
  label: string;
  labelKey?: string;
  /** Ce qui identifie une fiche dans la liste (champ de la ressource). */
  titleField: string;
  imageField?: string;
  metaField?: string;
  /** Le choix se trie à la main (glisser-déposer). */
  sortable: boolean;
  /** Le mode « automatique » est proposé en plus de la sélection manuelle. */
  allowAuto: boolean;
  /** Champs de tri proposés en mode auto. */
  sorts: Array<{ value: string; label: string }>;
  defaultLimit: number;
  /**
   * Champs de réglage par fiche sélectionnée (ex. texte d'un slide qui ne doit
   * pas imposer de modifier la fiche `hero` pour la page d'accueil). Enregistrés
   * dans `items`, indexés sur l'identifiant de la fiche.
   */
  overrideFields?: HomeRepeaterField[];
  /** Libellé du panneau de réglage par fiche. */
  overrideLabel?: string;
  overrideLabelKey?: string;
}

/**
 * Ce que le panneau de sélection doit parcourir : la ressource prévue au
 * catalogue, ou celle que le réglage du bloc est en train de viser.
 */
export function pickerResources(
  picker: HomePicker,
  config: { settings?: Record<string, unknown> } | undefined,
): { current: HomePickerResource | null; browse: HomePickerResource[] } {
  if (!picker.resourceFrom) return { current: picker.resource, browse: [] };
  const value = String(config?.settings?.[picker.resourceFrom] ?? '');
  if (picker.resourceHide && value === picker.resourceHide) return { current: null, browse: [] };
  if (value === 'mixed') {
    const list = picker.resourceList || [];
    return { current: list[0] ?? null, browse: list };
  }
  return { current: (value || picker.resource) as HomePickerResource, browse: [] };
}

export interface HomeCatalogEntry {
  key: HomeSectionKey;
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
  /** Nom d'icône Lucide, résolu côté composant. */
  icon: string;
  visibilityKey: string;
  fields: HomeField[];
  picker?: HomePicker;
  repeater?: HomeRepeater;
  /** Le constructeur de page (GrapesJS) est proposé sur ce bloc. */
  builder?: boolean;
  /** Le bloc possède une image de fond (mission, bandeaux). */
  hasBackground?: boolean;
}

const LANG_NOTE = 'Saisi dans la langue en cours ; vide = traduction du site conservée.';

const headerFields = (extra: HomeField[] = []): HomeField[] => [
  { key: 'subtitle', label: 'Surtitre', kind: 'text', scope: 'texts', i18n: true, hint: LANG_NOTE, max: 80 },
  { key: 'title', label: 'Titre', kind: 'text', scope: 'texts', i18n: true, hint: LANG_NOTE, max: 160, wide: true },
  { key: 'description', label: 'Description', kind: 'textarea', scope: 'texts', i18n: true, hint: LANG_NOTE, max: 400, wide: true },
  ...extra,
];

const layoutFields: HomeField[] = [
  { key: 'showHeader', label: 'Afficher le titre du bloc', kind: 'toggle', scope: 'style' },
  { key: 'background', label: 'Fond', kind: 'select', scope: 'style', options: [
    { value: 'white', label: 'Blanc' },
    { value: 'gray', label: 'Gris clair' },
    { value: 'sariGray', label: 'Gris du fond de page' },
    { value: 'blue', label: 'Bleu SARI' },
    { value: 'dark', label: 'Sombre' },
    { value: 'lime', label: 'Vert SARI' },
    { value: 'custom', label: 'Couleur libre' },
    { value: 'inherit', label: 'Hérité de la page' },
  ] },
  { key: 'backgroundColor', label: 'Couleur de fond', kind: 'color', scope: 'style', showIf: { key: 'background', equals: 'custom' } },
  { key: 'paddingY', label: 'Hauteur verticale', kind: 'number', scope: 'style', min: 0, max: 240, step: 8, suffix: 'px' },
  { key: 'columns', label: 'Colonnes', kind: 'number', scope: 'style', min: 1, max: 8 },
  { key: 'gap', label: 'Espacement entre les cartes', kind: 'number', scope: 'style', min: 0, max: 96, step: 4, suffix: 'px', hint: 'Air laissé entre deux cartes, en lignes comme en colonnes.' },
  { key: 'radius', label: 'Arrondi des cartes', kind: 'number', scope: 'style', min: 0, max: 40, step: 2, suffix: 'px' },
  { key: 'align', label: 'Alignement', kind: 'select', scope: 'style', options: [
    { value: 'start', label: 'Gauche' },
    { value: 'center', label: 'Centré' },
    { value: 'end', label: 'Droite' },
  ] },
  { key: 'titleSize', label: 'Taille du titre', kind: 'select', scope: 'style', options: [
    { value: 'sm', label: 'S' },
    { value: 'md', label: 'M' },
    { value: 'lg', label: 'L' },
    { value: 'xl', label: 'XL' },
  ] },
  { key: 'invert', label: 'Texte clair (fond sombre)', kind: 'toggle', scope: 'style' },
  { key: 'shadow', label: 'Ombre portée', kind: 'toggle', scope: 'style' },
  { key: 'pattern', label: 'Motif quadrillé en filigrane', kind: 'toggle', scope: 'style' },
];

const ctaField = (hrefHint: string): HomeField[] => [
  { key: 'ctaLabel', label: 'Texte du bouton', kind: 'text', scope: 'texts', i18n: true, max: 60, hint: LANG_NOTE },
  { key: 'ctaHref', label: 'Lien du bouton', kind: 'text', scope: 'settings', placeholder: '/contact', hint: hrefHint },
];

export const HOME_CATALOG: HomeCatalogEntry[] = [
  {
    key: 'hero',
    label: 'Slider (bannière)',
    labelKey: 'hero',
    description: 'Choisissez les slides à afficher, leur ordre et le comportement du diaporama.',
    descriptionKey: 'heroDesc',
    icon: 'Images',
    visibilityKey: 'section.hero',
    builder: true,
    picker: {
      resource: 'hero', label: 'Slides', labelKey: 'slides', titleField: 'title', imageField: 'image',
      metaField: 'cta', sortable: true, allowAuto: true, defaultLimit: 4,
      sorts: [
        { value: 'manual', label: 'Ordre du module' },
        { value: 'title-asc', label: 'Titre (A→Z)' },
      ],
      overrideLabel: 'Régler ce slide pour la page d’accueil',
      overrideLabelKey: 'tuneSlide',
      overrideFields: [
        { key: 'title', label: 'Titre du slide', kind: 'text', i18n: true, wide: true, hint: 'Vide = titre de la fiche slide.' },
        { key: 'subtitle', label: 'Sur-titre', kind: 'text', i18n: true },
        { key: 'description', label: 'Texte', kind: 'textarea', i18n: true, wide: true },
        { key: 'cta', label: 'Texte du bouton', kind: 'text', i18n: true },
        { key: 'ctaLink', label: 'Lien du bouton', kind: 'text', placeholder: '/solutions' },
        { key: 'image', label: 'Image (remplace celle de la fiche)', kind: 'image', wide: true },
        { key: 'enabled', label: 'Afficher ce slide', kind: 'toggle' },
      ],
    },
    fields: [
      { key: 'badge', label: 'Étiquette au-dessus du titre', kind: 'text', scope: 'texts', i18n: true, max: 60, hint: LANG_NOTE },
      { key: 'ctaLabel', label: 'Texte du bouton (par défaut des slides)', kind: 'text', scope: 'texts', i18n: true, max: 60 },
      { key: 'autoplay', label: 'Défilement automatique', kind: 'toggle', scope: 'settings' },
      { key: 'interval', label: 'Durée d’un slide', kind: 'number', scope: 'settings', min: 1500, max: 20000, step: 500, suffix: 'ms', showIf: { key: 'autoplay', equals: true } },
      { key: 'showDots', label: 'Pastilles de navigation', kind: 'toggle', scope: 'settings' },
      { key: 'showArrows', label: 'Flèches précédent / suivant', kind: 'toggle', scope: 'settings' },
      { key: 'height', label: 'Hauteur du slider', kind: 'select', scope: 'settings', options: [
        { value: 'screen', label: 'Plein écran' },
        { value: 'tall', label: 'Haute (80vh)' },
        { value: 'medium', label: 'Moyenne (60vh)' },
        { value: 'short', label: 'Compacte (48vh)' },
      ] },
      { key: 'overlay', label: 'Assombrissement de l’image', kind: 'range', scope: 'settings', min: 0, max: 100, step: 5, suffix: '%' },
      { key: 'align', label: 'Alignement du texte', kind: 'select', scope: 'settings', options: [
        { value: 'start', label: 'Gauche' },
        { value: 'center', label: 'Centré' },
        { value: 'end', label: 'Droite' },
      ] },
      { key: 'vertical', label: 'Position verticale', kind: 'select', scope: 'settings', options: [
        { value: 'top', label: 'En haut' },
        { value: 'middle', label: 'Au centre' },
        { value: 'bottom', label: 'En bas' },
      ], hint: 'Le menu principal survole la page : « Au centre » ne le touche jamais.' },
      { key: 'topGap', label: 'Marge sous le menu', kind: 'number', scope: 'settings', min: 0, max: 200, step: 4, suffix: 'px', showIf: { key: 'vertical', equals: 'top' }, hint: 'En plus de la hauteur du bandeau, déjà déduite.' },
    ],
  },
  {
    key: 'partners-marquee',
    label: 'Bandeau défilant (marques, actualités, blocs libres)',
    labelKey: 'marquee',
    description:
      "Ce qui défile se choisit ici : logos de partenaires, actualités, événements, offres d'emploi, produits, un mélange de ces modules, ou les blocs saisis dans le studio (texte, image, texte + image). Titre facultatif, marges, hauteur des éléments et largeur automatique.",
    descriptionKey: 'marqueeDesc',
    icon: 'MoveRight',
    visibilityKey: 'section.marquee',
    hasBackground: true,
    fields: [
      { key: 'label', label: 'Accroche au-dessus du bandeau', kind: 'text', scope: 'texts', i18n: true, max: 120, hint: LANG_NOTE },
      {
        key: 'source',
        label: "Ce qui défile",
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'partners', label: 'Les partenaires' },
          { value: 'news', label: 'Les actualités' },
          { value: 'events', label: 'Les événements' },
          { value: 'careers', label: "Les offres d'emploi" },
          { value: 'products', label: 'Les produits' },
          { value: 'mixed', label: 'Un mélange de ces modules' },
          { value: 'custom', label: 'Seulement les blocs du studio' },
        ],
        hint: "Les fiches ne sont pas recopiées dans le bloc : le bandeau lit le module choisi au moment d'afficher la page.",
      },
      {
        key: 'mixedSources',
        label: 'Modules du mélange',
        kind: 'text',
        scope: 'settings',
        showIf: { key: 'source', equals: 'mixed' },
        hint: 'Liste séparée par des virgules — partners, news, events, careers, products.',
      },
      {
        key: 'itemKind',
        label: "Type d'élément",
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'auto', label: 'Automatique (selon ce que la fiche contient)' },
          { value: 'image-text', label: 'Texte + image' },
          { value: 'image', label: 'Image seule' },
          { value: 'text', label: 'Texte seul' },
        ],
        hint: "Le réglage d'un bloc saisi dans le studio passe devant celui-ci.",
      },
      { key: 'appendFree', label: 'Blocs du studio après la liste', kind: 'toggle', scope: 'settings' },
      {
        key: 'showImage',
        label: "Afficher l'image",
        kind: 'toggle',
        scope: 'settings',
        hint: "Sans fichier image lisible, le titre de l'élément prend sa place (ou les initiales de la marque).",
      },
      { key: 'showTitle', label: 'Afficher le titre', kind: 'toggle', scope: 'settings' },
      { key: 'showText', label: 'Afficher le texte', kind: 'toggle', scope: 'settings' },
      {
        key: 'itemHeight',
        label: "Hauteur d'un élément",
        kind: 'number',
        scope: 'settings',
        min: 16,
        max: 240,
        step: 4,
        suffix: 'px',
        hint: "Le bandeau prend cette hauteur, augmentée de la marge intérieure. Les images se règlent dessus.",
      },
      {
        key: 'mediaWidth',
        label: "Largeur de l'image",
        kind: 'number',
        scope: 'settings',
        min: 0,
        max: 480,
        step: 8,
        suffix: 'px',
        hint: "0 = largeur automatique : l'image garde son ratio à la hauteur choisie. Une valeur fixe impose une boîte identique pour tous les éléments.",
      },
      {
        key: 'mediaFit',
        label: 'Cadrage dans la boîte',
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'contain', label: 'Image entière' },
          { value: 'cover', label: 'Remplir la boîte' },
        ],
        showIf: { key: 'mediaWidth', truthy: true },
      },
      { key: 'mediaRadius', label: "Arrondi de l'image", kind: 'number', scope: 'settings', min: 0, max: 48, step: 2, suffix: 'px' },
      { key: 'mediaGap', label: 'Espace image / texte', kind: 'number', scope: 'settings', min: 0, max: 64, step: 2, suffix: 'px' },
      {
        key: 'textSize',
        label: 'Taille du texte',
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'xs', label: 'Très petit' },
          { value: 'sm', label: 'Petit' },
          { value: 'base', label: 'Normal' },
          { value: 'lg', label: 'Grand' },
          { value: 'xl', label: 'Très grand' },
        ],
      },
      {
        key: 'textLines',
        label: 'Lignes de texte conservées',
        kind: 'number',
        scope: 'settings',
        min: 0,
        max: 4,
        step: 1,
        hint: '0 = sans borne ; au-delà, le texte est tronqué sur les lignes indiquées.',
      },
      { key: 'itemGap', label: 'Espace entre les éléments', kind: 'number', scope: 'settings', min: 0, max: 128, step: 4, suffix: 'px' },
      { key: 'itemPadding', label: "Marge intérieure d'un élément", kind: 'number', scope: 'settings', min: 0, max: 48, step: 2, suffix: 'px' },
      { key: 'marginTop', label: 'Marge au-dessus du bandeau', kind: 'number', scope: 'settings', min: 0, max: 160, step: 4, suffix: 'px' },
      { key: 'marginBottom', label: 'Marge sous le bandeau', kind: 'number', scope: 'settings', min: 0, max: 160, step: 4, suffix: 'px' },
      {
        key: 'valign',
        label: 'Alignement vertical',
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'top', label: 'En haut' },
          { value: 'middle', label: 'Au milieu' },
          { value: 'bottom', label: 'En bas' },
        ],
      },
      {
        key: 'cardStyle',
        label: "Présentation d'un élément",
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'plain', label: 'À plat' },
          { value: 'chip', label: 'Pastille' },
          { value: 'card', label: 'Carte' },
        ],
      },
      { key: 'edgeFade', label: 'Fondu sur les bords', kind: 'toggle', scope: 'settings' },
      {
        key: 'linkItems',
        label: 'Éléments cliquables',
        kind: 'toggle',
        scope: 'settings',
        hint: "Une fiche pointe vers sa page ; un bloc libre vers son lien.",
      },
      { key: 'showSeparator', label: 'Séparateur entre les éléments', kind: 'toggle', scope: 'settings' },
      { key: 'separator', label: 'Caractère du séparateur', kind: 'text', scope: 'settings', max: 3, showIf: { key: 'showSeparator', truthy: true } },
      { key: 'speed', label: 'Vitesse de défilement', kind: 'number', scope: 'settings', min: 5, max: 120, step: 5, suffix: 's', hint: 'Durée d\'un tour complet.' },
      {
        key: 'direction',
        label: 'Sens',
        kind: 'select',
        scope: 'settings',
        options: [
          { value: 'left', label: 'Vers la gauche' },
          { value: 'right', label: 'Vers la droite' },
        ],
        hint: 'Par défaut, le sens suit la langue de la page.',
      },
      { key: 'pauseOnHover', label: 'Pause au survol', kind: 'toggle', scope: 'settings' },
    ],
    picker: {
      resource: 'partners',
      label: 'Fiches affichées par le bandeau',
      labelKey: 'marqueePick',
      titleField: 'name',
      imageField: 'logo',
      metaField: 'category',
      sortable: true,
      allowAuto: true,
      defaultLimit: 12,
      // La ressource parcourue suit le réglage « Ce qui défile » : une seule
      // entrée de catalogue pour tous les cas, au lieu d'un bloc par module.
      resourceFrom: 'source',
      resourceList: ['news', 'events', 'products', 'partners', 'careers'],
      resourceHide: 'custom',
      sorts: [
        { value: 'manual', label: 'Ordre du module' },
        { value: 'byDate', label: "Plus anciennes d'abord" },
        { value: 'byDateDesc', label: "Plus récentes d'abord" },
        { value: 'title-asc', label: 'Titre (A→Z)' },
      ],
      overrideLabel: "Régler cet élément pour la page d'accueil",
      overrideFields: [
        {
          key: 'kind',
          label: "Type d'élément",
          kind: 'select',
          options: [
            { value: 'auto', label: 'Automatique' },
            { value: 'image-text', label: 'Texte + image' },
            { value: 'image', label: 'Image seule' },
            { value: 'text', label: 'Texte seul' },
          ],
        },
        { key: 'title', label: 'Titre affiché', kind: 'text', i18n: true, wide: true, hint: 'Vide = titre de la fiche.' },
        { key: 'text', label: 'Texte affiché', kind: 'textarea', i18n: true, wide: true },
        { key: 'image', label: 'Image (remplace celle de la fiche)', kind: 'image', wide: true },
        { key: 'enabled', label: 'Afficher cet élément', kind: 'toggle' },
      ],
    },
    // Les blocs saisis ici, seuls ou en plus d'un module.
    repeater: {
      label: 'Blocs du studio',
      labelKey: 'marqueeItems',
      titleKey: 'title',
      defaults: { from: 'free', kind: 'image-text', enabled: true },
      fields: [
        {
          key: 'kind',
          label: "Type d'élément",
          kind: 'select',
          options: [
            { value: 'image-text', label: 'Texte + image' },
            { value: 'image', label: 'Image seule' },
            { value: 'text', label: 'Texte seul' },
          ],
        },
        { key: 'title', label: 'Titre', kind: 'text', i18n: true, wide: true },
        { key: 'text', label: 'Texte', kind: 'textarea', i18n: true, wide: true },
        { key: 'image', label: 'Image', kind: 'image', wide: true },
        { key: 'href', label: 'Lien', kind: 'text', placeholder: '/about' },
        { key: 'enabled', label: 'Afficher ce bloc', kind: 'toggle' },
      ],
    },
  },

  {
    key: 'navigation',
    label: 'Grille des univers',
    labelKey: 'navigation',
    description: 'Tuiles de navigation (solutions, services, produits, événements, actualités, carrières).',
    descriptionKey: 'navigationDesc',
    icon: 'LayoutGrid',
    visibilityKey: 'section.navigation',
    hasBackground: true,
    repeater: {
      label: 'Tuiles', labelKey: 'tiles', titleKey: 'label',
      defaults: { enabled: true, icon: 'package' },
      fields: [
        { key: 'label', label: 'Libellé', kind: 'text', i18n: true },
        { key: 'desc', label: 'Description', kind: 'text', i18n: true, wide: true },
        { key: 'href', label: 'Lien', kind: 'text', placeholder: '/solutions' },
        { key: 'icon', label: 'Icône Lucide', kind: 'text', placeholder: 'layout-grid' },
        { key: 'image', label: 'Vignette', kind: 'image' },
        { key: 'enabled', label: 'Affichée', kind: 'toggle' },
      ],
    },
    fields: [...headerFields(), { key: 'columns', label: 'Colonnes', kind: 'number', scope: 'style', min: 2, max: 6 }],
  },
  {
    key: 'mission',
    label: 'Notre mission',
    labelKey: 'mission',
    description: 'Bandeau texte sur image de fond, avec un bouton d’appel à l’action. Textes et style modifiables, y compris au constructeur de page.',
    descriptionKey: 'missionDesc',
    icon: 'Compass',
    visibilityKey: 'section.mission',
    builder: true,
    hasBackground: true,
    fields: [
      { key: 'subtitle', label: 'Surtitre', kind: 'text', scope: 'texts', i18n: true, max: 80, hint: LANG_NOTE },
      { key: 'title', label: 'Titre', kind: 'text', scope: 'texts', i18n: true, max: 160, wide: true },
      { key: 'description', label: 'Texte', kind: 'textarea', scope: 'texts', i18n: true, max: 800, wide: true },
      ...ctaField('Chemin interne (/about) ou URL complète.'),
      { key: 'image', label: 'Image de fond', kind: 'image', scope: 'style', wide: true },
      { key: 'overlay', label: 'Voile sombre', kind: 'range', scope: 'style', min: 0, max: 100, step: 5, suffix: '%' },
      { key: 'height', label: 'Hauteur du bandeau', kind: 'number', scope: 'settings', min: 200, max: 900, step: 20, suffix: 'px' },
      { key: 'parallax', label: 'Effet parallaxe', kind: 'toggle', scope: 'settings' },
      { key: 'align', label: 'Alignement', kind: 'select', scope: 'style', options: [
        { value: 'start', label: 'Gauche' },
        { value: 'center', label: 'Centré' },
      ] },
      { key: 'titleSize', label: 'Taille du titre', kind: 'select', scope: 'style', options: [
        { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' },
      ] },
      { key: 'customCss', label: 'CSS libre', kind: 'html', scope: 'style', wide: true, hint: 'Appliqué à ce bloc uniquement (le sélecteur racine est facultatif).' },
    ],
  },
  {
    key: 'products',
    label: 'Produits phares',
    labelKey: 'products',
    description: 'Titre, description, nombre de produits et sélection des fiches à mettre en avant.',
    descriptionKey: 'productsDesc',
    icon: 'Package',
    visibilityKey: 'section.products',
    builder: true,
    hasBackground: true,
    picker: {
      resource: 'products', label: 'Produits mis en avant', labelKey: 'productsPick', titleField: 'name',
      imageField: 'image', metaField: 'category', sortable: true, allowAuto: true, defaultLimit: 4,
      sorts: [
        { value: 'manual', label: 'Ordre du catalogue' },
        { value: 'title-asc', label: 'Nom (A→Z)' },
        { value: 'date-desc', label: 'Ajoutés récemment' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'viewAllLabel', label: 'Texte du lien « voir tout »', kind: 'text', scope: 'texts', i18n: true, max: 60 },
      { key: 'limit', label: 'Nombre de produits affichés', kind: 'number', scope: 'settings', min: 1, max: 12 },
      { key: 'ctaHref', label: 'Lien « voir tout »', kind: 'text', scope: 'settings', placeholder: '/products' },
      { key: 'showPrice', label: 'Afficher le prix', kind: 'toggle', scope: 'settings' },
      { key: 'showStock', label: 'Afficher la disponibilité', kind: 'toggle', scope: 'settings' },
      { key: 'cardVariant', label: 'Format des cartes', kind: 'select', scope: 'settings', options: [
        { value: 'featured', label: 'Vitrine (image large)' },
        { value: 'standard', label: 'Classique' },
        { value: 'compact', label: 'Compact' },
      ] },
      ...layoutFields,
    ],
  },
  {
    key: 'blocks',
    label: 'Blocs en alternance',
    labelKey: 'blocks',
    description: 'Blocs image / texte alternés : ajoutez-en, modifiez-les, ou reprenez le tout au constructeur de page.',
    descriptionKey: 'blocksDesc',
    icon: 'Columns2',
    visibilityKey: 'section.solutions',
    builder: true,
    hasBackground: true,
    repeater: {
      label: 'Blocs', labelKey: 'blocksList', titleKey: 'title',
      defaults: { position: 'left', enabled: true },
      fields: [
        { key: 'badge', label: 'Surtitre', kind: 'text', i18n: true },
        { key: 'title', label: 'Titre', kind: 'text', i18n: true, wide: true },
        { key: 'description', label: 'Texte', kind: 'textarea', i18n: true, wide: true },
        { key: 'ctaLabel', label: 'Texte du bouton', kind: 'text', i18n: true },
        { key: 'ctaHref', label: 'Lien du bouton', kind: 'text', placeholder: '/solutions' },
        { key: 'image', label: 'Image', kind: 'image', wide: true },
        { key: 'position', label: 'Image à', kind: 'select', options: [
          { value: 'left', label: 'Gauche' }, { value: 'right', label: 'Droite' },
        ] },
        { key: 'enabled', label: 'Affiché', kind: 'toggle' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'imageHeight', label: 'Hauteur des images', kind: 'number', scope: 'settings', min: 160, max: 720, step: 20, suffix: 'px' },
      { key: 'animate', label: 'Animation d’apparition', kind: 'toggle', scope: 'settings' },
      { key: 'startWith', label: 'Première image à', kind: 'select', scope: 'settings', options: [
        { value: 'image', label: 'Gauche' }, { value: 'text', label: 'Droite' },
      ] },
      ...layoutFields,
    ],
  },
  {
    key: 'stats',
    label: 'Chiffres clés',
    labelKey: 'stats',
    description: 'Valeurs et libellés modifiables directement dans le bloc, sans passer par un autre écran.',
    descriptionKey: 'statsDesc',
    icon: 'BarChart3',
    visibilityKey: 'section.stats',
    hasBackground: true,
    repeater: {
      label: 'Chiffres', labelKey: 'statsList', titleKey: 'label',
      defaults: { value: '0', suffix: '', icon: 'activity' },
      fields: [
        { key: 'value', label: 'Valeur', kind: 'text', placeholder: '500' },
        { key: 'suffix', label: 'Suffixe', kind: 'text', placeholder: '+ / % / 24/7', max: 6 },
        { key: 'label', label: 'Libellé', kind: 'text', i18n: true, wide: true },
        { key: 'icon', label: 'Icône Lucide', kind: 'text', placeholder: 'users' },
      ],
    },
    fields: [
      { key: 'subtitle', label: 'Surtitre', kind: 'text', scope: 'texts', i18n: true },
      { key: 'title', label: 'Titre', kind: 'text', scope: 'texts', i18n: true, wide: true },
      { key: 'fromConfig', label: 'Reprendre les chiffres du site (config)', kind: 'toggle', scope: 'settings', hint: 'Tant que la liste ci-dessus est vide, les chiffres viennent des réglages généraux.' },
      { key: 'animate', label: 'Compteur animé', kind: 'toggle', scope: 'settings' },
      { key: 'columns', label: 'Chiffres par ligne', kind: 'number', scope: 'settings', min: 2, max: 6 },
      ...layoutFields,
    ],
  },
  {
    key: 'testimonials',
    label: 'Témoignages',
    labelKey: 'testimonials',
    description: 'Choisissez les témoignages, triez-les et réglez le diaporama.',
    descriptionKey: 'testimonialsDesc',
    icon: 'MessageCircle',
    visibilityKey: 'section.testimonials',
    hasBackground: true,
    picker: {
      resource: 'testimonials', label: 'Témoignages', labelKey: 'testimonialsPick', titleField: 'name',
      imageField: 'image', metaField: 'clinic', sortable: true, allowAuto: true, defaultLimit: 5,
      sorts: [
        { value: 'manual', label: 'Ordre choisi' },
        { value: 'rating-desc', label: 'Les mieux notés' },
        { value: 'date-desc', label: 'Les plus récents' },
        { value: 'random', label: 'Aléatoire' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'layout', label: 'Présentation', kind: 'select', scope: 'settings', options: [
        { value: 'slider', label: 'Diaporama' },
        { value: 'grid', label: 'Grille' },
      ] },
      { key: 'limit', label: 'Nombre affiché', kind: 'number', scope: 'settings', min: 1, max: 12 },
      { key: 'autoplay', label: 'Défilement automatique', kind: 'toggle', scope: 'settings', showIf: { key: 'layout', equals: 'slider' } },
      { key: 'interval', label: 'Durée d’un témoignage', kind: 'number', scope: 'settings', min: 2000, max: 20000, step: 500, suffix: 'ms', showIf: { key: 'autoplay', equals: true } },
      { key: 'showRating', label: 'Afficher la note', kind: 'toggle', scope: 'settings' },
      { key: 'showAvatar', label: 'Afficher le portrait', kind: 'toggle', scope: 'settings' },
      { key: 'showClinic', label: 'Afficher l’établissement', kind: 'toggle', scope: 'settings' },
      ...layoutFields,
    ],
  },
  {
    key: 'events',
    label: 'Événements',
    labelKey: 'events',
    description: 'Sélection des événements à mettre sur la page d’accueil, avec leur ordre.',
    descriptionKey: 'eventsDesc',
    icon: 'Calendar',
    visibilityKey: 'section.events',
    hasBackground: true,
    picker: {
      resource: 'events', label: 'Événements', labelKey: 'eventsPick', titleField: 'title',
      imageField: 'image', metaField: 'location', sortable: true, allowAuto: true, defaultLimit: 3,
      sorts: [
        { value: 'date-asc', label: 'Les prochains d’abord' },
        { value: 'date-desc', label: 'Les plus récents' },
        { value: 'title-asc', label: 'Titre (A→Z)' },
        { value: 'manual', label: 'Ordre choisi' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'viewAllLabel', label: 'Texte du lien « voir tout »', kind: 'text', scope: 'texts', i18n: true, max: 60 },
      { key: 'limit', label: 'Nombre d’événements', kind: 'number', scope: 'settings', min: 1, max: 9 },
      { key: 'ctaHref', label: 'Lien « voir tout »', kind: 'text', scope: 'settings', placeholder: '/events' },
      { key: 'showDate', label: 'Afficher les dates', kind: 'toggle', scope: 'settings' },
      { key: 'upcomingOnly', label: 'Seulement les événements à venir', kind: 'toggle', scope: 'settings' },
      ...layoutFields,
    ],
  },
  {
    key: 'news',
    label: 'Dernières actualités',
    labelKey: 'news',
    description: 'Sélection des articles à mettre sur la page d’accueil, avec leur ordre.',
    descriptionKey: 'newsDesc',
    icon: 'Newspaper',
    visibilityKey: 'section.news',
    hasBackground: true,
    picker: {
      resource: 'news', label: 'Actualités', labelKey: 'newsPick', titleField: 'title',
      imageField: 'image', metaField: 'category', sortable: true, allowAuto: true, defaultLimit: 3,
      sorts: [
        { value: 'date-desc', label: 'Les plus récentes' },
        { value: 'date-asc', label: 'Les plus anciennes' },
        { value: 'title-asc', label: 'Titre (A→Z)' },
        { value: 'manual', label: 'Ordre choisi' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'viewAllLabel', label: 'Texte du lien « voir tout »', kind: 'text', scope: 'texts', i18n: true, max: 60 },
      { key: 'limit', label: 'Nombre d’articles', kind: 'number', scope: 'settings', min: 1, max: 9 },
      { key: 'ctaHref', label: 'Lien « voir tout »', kind: 'text', scope: 'settings', placeholder: '/news' },
      { key: 'showAuthor', label: 'Afficher l’auteur', kind: 'toggle', scope: 'settings' },
      ...layoutFields,
    ],
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    labelKey: 'newsletter',
    description: 'Textes du bloc et inscription réelle des adresses (liste gérée dans Newsletter).',
    descriptionKey: 'newsletterDesc',
    icon: 'Mail',
    visibilityKey: 'section.newsletter',
    hasBackground: true,
    repeater: {
      label: 'Arguments affichés', labelKey: 'newsletterArgs', titleKey: 'title',
      defaults: { icon: 'newspaper' },
      fields: [
        { key: 'icon', label: 'Icône Lucide', kind: 'text', placeholder: 'gift' },
        { key: 'title', label: 'Titre', kind: 'text', i18n: true },
        { key: 'description', label: 'Texte', kind: 'text', i18n: true, wide: true },
      ],
    },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', scope: 'texts', i18n: true, wide: true },
      { key: 'description', label: 'Texte', kind: 'textarea', scope: 'texts', i18n: true, wide: true },
      { key: 'placeholder', label: 'Indication du champ email', kind: 'text', scope: 'texts', i18n: true },
      { key: 'submitLabel', label: 'Texte du bouton', kind: 'text', scope: 'texts', i18n: true },
      { key: 'legalText', label: 'Mention sous le formulaire', kind: 'textarea', scope: 'texts', i18n: true, wide: true },
      { key: 'successTitle', label: 'Titre après inscription', kind: 'text', scope: 'texts', i18n: true },
      { key: 'successDesc', label: 'Texte après inscription', kind: 'textarea', scope: 'texts', i18n: true, wide: true },
      { key: 'errorText', label: 'Message d’erreur', kind: 'text', scope: 'texts', i18n: true, wide: true },
      { key: 'showFeatures', label: 'Afficher les arguments', kind: 'toggle', scope: 'settings' },
      { key: 'consent', label: 'Case de consentement obligatoire', kind: 'toggle', scope: 'settings' },
      { key: 'topics', label: 'Thèmes proposés (séparés par des virgules)', kind: 'text', scope: 'settings', wide: true, placeholder: 'actualités, offres, événements' },
      ...layoutFields,
    ],
  },
  {
    key: 'partners',
    label: 'Partenaires en vedette',
    labelKey: 'partners',
    description: 'Sélection des partenaires mis en avant sur la page d’accueil.',
    descriptionKey: 'partnersDesc',
    icon: 'Handshake',
    visibilityKey: 'section.partners',
    hasBackground: true,
    picker: {
      resource: 'partners', label: 'Partenaires', labelKey: 'partnersPick', titleField: 'name',
      imageField: 'logo', metaField: 'category', sortable: true, allowAuto: true, defaultLimit: 12,
      sorts: [
        { value: 'manual', label: 'Ordre du module' },
        { value: 'title-asc', label: 'Nom (A→Z)' },
      ],
    },
    fields: [
      ...headerFields(),
      { key: 'limit', label: 'Nombre de partenaires', kind: 'number', scope: 'settings', min: 2, max: 24 },
      { key: 'showNames', label: 'Afficher le nom sous le logo', kind: 'toggle', scope: 'settings' },
      { key: 'grayscale', label: 'Logos en nuances de gris', kind: 'toggle', scope: 'settings' },
      { key: 'linkWebsite', label: 'Rendre les logos cliquables', kind: 'toggle', scope: 'settings' },
      ...layoutFields,
    ],
  },
  {
    key: 'cta',
    label: 'Bloc appel à l’action',
    labelKey: 'cta',
    description: 'Le bloc « Prêt à démarrer votre projet ? » : textes, boutons et couleurs, langue par langue.',
    descriptionKey: 'ctaDesc',
    icon: 'Megaphone',
    visibilityKey: 'section.cta',
    builder: true,
    hasBackground: true,
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', scope: 'texts', i18n: true, wide: true, hint: LANG_NOTE },
      { key: 'description', label: 'Texte', kind: 'textarea', scope: 'texts', i18n: true, wide: true, hint: LANG_NOTE },
      { key: 'primaryLabel', label: 'Texte du bouton principal', kind: 'text', scope: 'texts', i18n: true },
      { key: 'secondaryLabel', label: 'Texte du bouton secondaire', kind: 'text', scope: 'texts', i18n: true },
      { key: 'primaryHref', label: 'Lien du bouton principal', kind: 'text', scope: 'settings', placeholder: '/contact' },
      { key: 'secondaryHref', label: 'Lien du bouton secondaire', kind: 'text', scope: 'settings', placeholder: '/products' },
      { key: 'showSecondary', label: 'Afficher le second bouton', kind: 'toggle', scope: 'settings' },
      { key: 'pattern', label: 'Motif quadrillé en fond', kind: 'toggle', scope: 'style' },
      { key: 'accent', label: 'Couleur des boutons', kind: 'select', scope: 'settings', options: [
        { value: 'default', label: 'Du site (bleu et vert)' },
        { value: 'lime', label: 'Vert SARI' },
        { value: 'white', label: 'Blanc' },
        { value: 'blue', label: 'Bleu SARI' },
      ] },
      { key: 'background', label: 'Fond', kind: 'select', scope: 'style', options: [
        { value: 'dark', label: 'Sombre' },
        { value: 'blue', label: 'Bleu SARI' },
        { value: 'lime', label: 'Vert SARI' },
        { value: 'custom', label: 'Couleur libre' },
      ] },
      { key: 'backgroundColor', label: 'Couleur', kind: 'color', scope: 'style', showIf: { key: 'background', equals: 'custom' } },
      { key: 'backgroundImage', label: 'Image de fond', kind: 'image', scope: 'style', wide: true },
      { key: 'titleSize', label: 'Taille du titre', kind: 'select', scope: 'style', options: [
        { value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' },
      ] },
      { key: 'paddingY', label: 'Hauteur verticale', kind: 'number', scope: 'style', min: 40, max: 240, step: 8, suffix: 'px' },
      { key: 'customCss', label: 'CSS libre', kind: 'html', scope: 'style', wide: true },
    ],
  },
];

export function catalogEntry(key: string): HomeCatalogEntry | undefined {
  return HOME_CATALOG.find((entry) => entry.key === key);
}

/** Champs de style communs, proposés sur les blocs qui les acceptent. */
export const HOME_LAYOUT_FIELDS = layoutFields;

/** Un seul enregistrement par bloc et par langue : voici comment il est découpé. */
export const STRUCTURE_SCOPES: HomeFieldScope[] = ['settings', 'style'];

/** Le studio a-t-il un sélecteur de fiches pour ce bloc ? */
export function hasPicker(entry: HomeCatalogEntry | undefined): entry is HomeCatalogEntry & { picker: HomePicker } {
  return Boolean(entry?.picker);
}
