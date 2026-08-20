import {
  Package, Wrench, Briefcase, Newspaper, Calendar, MessageCircle, Handshake,
  Layers, Image as ImageIcon, FileText, Images, Mail, FolderOpen, Scale, Menu,
} from 'lucide-react';

export type FieldKind =
  | 'text' | 'textarea' | 'html' | 'slug' | 'email' | 'phone' | 'url'
  | 'price' | 'number' | 'select' | 'radio' | 'toggle' | 'tags'
  | 'image' | 'gallery' | 'file' | 'faq' | 'list' | 'specs' | 'options' | 'agenda'
  | 'slides' | 'sections' | 'rating' | 'icon' | 'process';

export type ListLayout = 'catalog' | 'magazine' | 'timeline' | 'mosaic' | 'quotes' | 'people' | 'slides' | 'docs';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  prefix?: string;
  suffix?: string;
  options?: Array<{ value: string; label: string }>;
  taxonomy?: string;
  slugFrom?: string;
  wide?: boolean;
  group?: string;
  i18n?: boolean;
}

export interface CmsModule {
  key: string;
  resource: string;
  path: string;
  label: string;
  singular: string;
  icon: typeof Package;
  layout: ListLayout;
  titleKey: string;
  imageKey?: string;
  subtitleKey?: string;
  badgeKey?: string;
  searchKeys: string[];
  filterKeys: Array<{ key: string; label: string; options?: string[] }>;
  fields: FieldSpec[];
  defaults: Record<string, unknown>;
  filter?: Record<string, string>;
  orderField?: string;
}

const STATUS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'published', label: 'Publié' },
  { value: 'archived', label: 'Archivé' },
];

const LOCALES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const CATEGORIES = ['Diagnostic', 'Cardiologie', 'Imagerie', 'Chirurgie', 'Pédiatrie', 'Urgence', 'Laboratoire', 'Consommables'].map((v) => ({ value: v, label: v }));
const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Intérim'].map((v) => ({ value: v, label: v }));
const EVENT_TYPES = ['Salon', 'Formation', 'Conférence', 'Webinar', 'Atelier', 'Lancement', 'Portes Ouvertes'].map((v) => ({ value: v, label: v }));
const ICONS = ['package', 'heart-pulse', 'stethoscope', 'wrench', 'users', 'shopping-cart', 'briefcase', 'activity', 'hospital', 'syringe', 'microscope'].map((v) => ({ value: v, label: v }));

export const CMS_MODULES: CmsModule[] = [
  {
    key: 'products', resource: 'products', path: 'products', label: 'Produits', singular: 'produit',
    icon: Package, layout: 'catalog', titleKey: 'name', imageKey: 'image', subtitleKey: 'category', badgeKey: 'status',
    searchKeys: ['name', 'category', 'sku', 'shortDesc'],
    filterKeys: [
      { key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) },
      { key: 'category', label: 'Catégorie' },
      { key: 'locale', label: 'Langue', options: ['fr', 'en', 'ar'] },
      { key: 'inStock', label: 'Stock', options: ['true', 'false'] },
    ],
    orderField: 'sortOrder',
    defaults: { name: 'Nouveau produit', status: 'draft', inStock: true, stockQty: 10, stockFinal: false, locale: 'fr', gallery: [], features: [], specs: {}, options: [] },
    fields: [
      { key: 'name', label: 'Nom commercial', kind: 'text', required: true, placeholder: 'Ex. Échographe Portable Pro X1', hint: 'Nom affiché sur la vitrine.', maxLength: 120, group: 'Identité', i18n: true },
      { key: 'slug', label: 'Slug URL', kind: 'slug', slugFrom: 'name', hint: 'Généré depuis le titre, modifiable.', group: 'Identité' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Identité' },
      { key: 'status', label: 'Publication', kind: 'radio', options: STATUS, group: 'Identité' },
      { key: 'category', label: 'Catégorie', kind: 'select', taxonomy: 'products.category', options: CATEGORIES, hint: 'Gérée dans Taxonomies. Vous pouvez en créer une ici.', group: 'Catalogue' },
      { key: 'sku', label: 'Code produit', kind: 'text', prefix: 'SKU', placeholder: 'Laissé vide → PRO-00001', hint: 'Généré automatiquement si vide. Une saisie manuelle est conservée.', group: 'Catalogue' },
      { key: 'price', label: 'Prix', kind: 'price', wide: true, hint: 'Montant et devise sont deux champs distincts. Ajoutez une devise manquante via « Ajouter ».', group: 'Catalogue' },
      { key: 'inStock', label: 'En stock', kind: 'toggle', group: 'Catalogue' },
      { key: 'deliveryTime', label: 'Délai de livraison', kind: 'text', group: 'Catalogue' },
      { key: 'image', label: 'Visuel principal', kind: 'image', group: 'Médias' },
      { key: 'gallery', label: 'Galerie', kind: 'gallery', wide: true, group: 'Médias' },
      { key: 'catalogPdf', label: 'Fiche technique PDF', kind: 'file', hint: 'Upload, GED, consultation et téléchargement.', group: 'Médias' },
      { key: 'shortDesc', label: 'Accroche', kind: 'textarea', wide: true, maxLength: 280, placeholder: 'Résumé court pour les cartes…', hint: 'Max 280 caractères.', group: 'Contenu', i18n: true },
      { key: 'fullDesc', label: 'Description détaillée', kind: 'html', wide: true, hint: 'Éditeur riche — section pleine largeur.', group: 'Contenu', i18n: true },
      { key: 'features', label: 'Points forts', kind: 'list', wide: true, group: 'Technique' },
      { key: 'specs', label: 'Spécifications', kind: 'specs', wide: true, group: 'Technique' },
      { key: 'options', label: 'Options / variantes', kind: 'options', wide: true, group: 'Technique' },
    ],
  },
  {
    key: 'services', resource: 'services', path: 'services', label: 'Services', singular: 'service',
    icon: Wrench, layout: 'mosaic', titleKey: 'title', subtitleKey: 'icon', badgeKey: 'status',
    searchKeys: ['title', 'shortDesc'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    orderField: 'sortOrder',
    defaults: { title: 'Nouveau service', status: 'draft', locale: 'fr', features: [], faq: [] },
    fields: [
      { key: 'title', label: 'Intitulé', kind: 'text', required: true, group: 'Identité', i18n: true },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Identité' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Identité' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Identité' },
      { key: 'icon', label: 'Icône Lucide', kind: 'icon', options: ICONS, hint: 'Recherchez le nom Lucide, l’icône s’affiche à côté.', group: 'Identité' },
      { key: 'shortDesc', label: 'Accroche', kind: 'textarea', wide: true, group: 'Contenu', i18n: true },
      { key: 'fullDesc', label: 'Présentation', kind: 'html', wide: true, group: 'Contenu', i18n: true },
      { key: 'features', label: 'Engagements', kind: 'list', wide: true, group: 'Détails' },
      { key: 'faq', label: 'FAQ', kind: 'faq', wide: true, group: 'Détails' },
    ],
  },
  {
    key: 'careers', resource: 'careers', path: 'careers', label: 'Offres d’emploi', singular: 'offre',
    icon: Briefcase, layout: 'docs', titleKey: 'title', imageKey: 'image', subtitleKey: 'location', badgeKey: 'type',
    searchKeys: ['title', 'location', 'type'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }, { key: 'type', label: 'Contrat' }],
    defaults: { title: 'Nouvelle offre', status: 'draft', locale: 'fr', type: 'CDI', objectifs: [], prerequis: [], workflow: [], benefits: [] },
    fields: [
      { key: 'title', label: 'Intitulé du poste', kind: 'text', required: true, placeholder: 'Ex. Ingénieur biomédical', maxLength: 140, group: 'Poste', i18n: true },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Poste' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Poste' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Poste' },
      { key: 'type', label: 'Contrat', kind: 'select', taxonomy: 'careers.type', options: CONTRACTS, hint: 'Ajoutez un type à côté du sélecteur.', group: 'Poste' },
      { key: 'location', label: 'Lieu', kind: 'text', placeholder: 'Alger, hybride…', group: 'Poste' },
      { key: 'salary', label: 'Rémunération', kind: 'price', placeholder: '80000', group: 'Poste' },
      { key: 'typeTravail', label: 'Rythme', kind: 'text', placeholder: 'Temps plein', group: 'Poste' },
      { key: 'contact', label: 'Contact RH', kind: 'email', placeholder: 'rh@sarisysteme.com', group: 'Poste' },
      { key: 'image', label: 'Visuel', kind: 'image', group: 'Média' },
      { key: 'shortDesc', label: 'Accroche', kind: 'textarea', wide: true, group: 'Mission', i18n: true },
      { key: 'mission', label: 'Mission', kind: 'textarea', wide: true, group: 'Mission', i18n: true },
      { key: 'fullDesc', label: 'Description', kind: 'html', wide: true, group: 'Mission', i18n: true },
      { key: 'objectifs', label: 'Objectifs', kind: 'list', wide: true, group: 'Profil' },
      { key: 'prerequis', label: 'Prérequis', kind: 'list', wide: true, group: 'Profil' },
      { key: 'experience', label: 'Expérience', kind: 'text', group: 'Profil' },
      { key: 'workflow', label: 'Processus de recrutement', kind: 'process', wide: true, group: 'Profil' },
      { key: 'benefits', label: 'Avantages', kind: 'list', wide: true, group: 'Profil' },
    ],
  },
  {
    key: 'news', resource: 'news', path: 'news', label: 'Actualités', singular: 'article',
    icon: Newspaper, layout: 'magazine', titleKey: 'title', imageKey: 'image', subtitleKey: 'category', badgeKey: 'status',
    searchKeys: ['title', 'authorName', 'sujet', 'category'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }, { key: 'category', label: 'Rubrique' }],
    defaults: { title: 'Nouvel article', status: 'draft', locale: 'fr', tags: [] },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true, placeholder: 'Ex. Nouvelle sonde cardiaque', maxLength: 160, group: 'Article', i18n: true },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Article' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Article' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Article' },
      { key: 'category', label: 'Rubrique', kind: 'select', taxonomy: 'news.category', options: ['Innovation', 'Produits', 'Santé', 'Formation', 'Corporate'].map((v) => ({ value: v, label: v })), hint: 'Gérée dans Taxonomies.', group: 'Article' },
      { key: 'classification', label: 'Classification', kind: 'text', group: 'Article' },
      { key: 'sujet', label: 'Sujet', kind: 'text', group: 'Article' },
      { key: 'authorName', label: 'Auteur', kind: 'text', group: 'Article' },
      { key: 'date', label: 'Date', kind: 'text', group: 'Article' },
      { key: 'readTime', label: 'Temps de lecture', kind: 'text', suffix: 'min', group: 'Article' },
      { key: 'image', label: 'Une', kind: 'image', group: 'Média' },
      { key: 'tags', label: 'Tags', kind: 'tags', wide: true, group: 'Média' },
      { key: 'shortDesc', label: 'Chapô', kind: 'textarea', wide: true, maxLength: 280, placeholder: 'Accroche de l’article…', group: 'Texte', i18n: true },
      { key: 'fullContent', label: 'Corps de l’article', kind: 'html', wide: true, hint: 'Éditeur riche — pleine largeur.', group: 'Texte', i18n: true },
    ],
  },
  {
    key: 'events', resource: 'events', path: 'events', label: 'Événements', singular: 'événement',
    icon: Calendar, layout: 'timeline', titleKey: 'title', imageKey: 'image', subtitleKey: 'date', badgeKey: 'type',
    searchKeys: ['title', 'location', 'type'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }, { key: 'type', label: 'Type' }],
    defaults: { title: 'Nouvel événement', status: 'draft', locale: 'fr', agenda: [] },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true, placeholder: 'Ex. Salon médical Alger', maxLength: 140, group: 'Événement', i18n: true },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Événement' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Événement' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Événement' },
      { key: 'type', label: 'Type', kind: 'select', taxonomy: 'events.type', options: EVENT_TYPES, hint: 'Ajoutez un type si besoin.', group: 'Événement' },
      { key: 'date', label: 'Date / période', kind: 'text', placeholder: '12–14 octobre 2026', group: 'Événement' },
      { key: 'location', label: 'Lieu', kind: 'text', placeholder: 'Hôtel El Aurassi, Alger', group: 'Événement' },
      { key: 'image', label: 'Visuel', kind: 'image', group: 'Média' },
      { key: 'shortDesc', label: 'Accroche', kind: 'textarea', wide: true, group: 'Contenu', i18n: true },
      { key: 'fullContent', label: 'Présentation', kind: 'html', wide: true, group: 'Contenu', i18n: true },
      { key: 'agenda', label: 'Programme', kind: 'agenda', wide: true, group: 'Programme' },
    ],
  },
  {
    key: 'testimonials', resource: 'testimonials', path: 'testimonials', label: 'Témoignages', singular: 'témoignage',
    icon: MessageCircle, layout: 'quotes', titleKey: 'name', imageKey: 'image', subtitleKey: 'clinic', badgeKey: 'rating',
    searchKeys: ['name', 'clinic', 'text'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    orderField: 'sortOrder',
    defaults: { name: 'Nouveau témoignage', text: '', rating: 5, status: 'published', locale: 'fr' },
    fields: [
      { key: 'name', label: 'Nom', kind: 'text', required: true, placeholder: 'Dr. …', group: 'Auteur' },
      { key: 'role', label: 'Fonction', kind: 'text', group: 'Auteur' },
      { key: 'clinic', label: 'Établissement', kind: 'text', group: 'Auteur' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Auteur' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Auteur' },
      { key: 'rating', label: 'Note', kind: 'rating', group: 'Auteur' },
      { key: 'image', label: 'Portrait', kind: 'image', group: 'Média' },
      { key: 'text', label: 'Citation', kind: 'textarea', wide: true, group: 'Citation' },
    ],
  },
  {
    key: 'partners', resource: 'partners', path: 'partners', label: 'Partenaires', singular: 'partenaire',
    icon: Handshake, layout: 'mosaic', titleKey: 'name', imageKey: 'logo', subtitleKey: 'category', badgeKey: 'status',
    searchKeys: ['name', 'category'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    orderField: 'sortOrder',
    defaults: { name: 'Nouveau partenaire', status: 'published', locale: 'fr' },
    fields: [
      { key: 'name', label: 'Nom', kind: 'text', group: 'Fiche' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Fiche' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Fiche' },
      { key: 'category', label: 'Catégorie', kind: 'select', taxonomy: 'partners.category', options: CATEGORIES, group: 'Fiche' },
      { key: 'website', label: 'Site web', kind: 'url', prefix: 'https', group: 'Fiche' },
      { key: 'logo', label: 'Logo', kind: 'image', group: 'Média' },
    ],
  },
  {
    key: 'solutions', resource: 'solutions', path: 'solutions', label: 'Solutions', singular: 'solution',
    icon: Layers, layout: 'catalog', titleKey: 'title', imageKey: 'image', subtitleKey: 'slug', badgeKey: 'status',
    searchKeys: ['title', 'slug'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    orderField: 'sortOrder',
    defaults: { title: 'Nouvelle solution', status: 'draft', locale: 'fr', features: [], faq: [], productIds: [] },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true, placeholder: 'Ex. Bloc opératoire connecté', maxLength: 140, group: 'Identité' },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Identité' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Identité' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Identité' },
      { key: 'icon', label: 'Icône', kind: 'icon', options: ICONS, group: 'Identité' },
      { key: 'color', label: 'Couleur', kind: 'text', group: 'Identité' },
      { key: 'image', label: 'Visuel', kind: 'image', group: 'Média' },
      { key: 'shortDesc', label: 'Accroche', kind: 'textarea', wide: true, group: 'Contenu' },
      { key: 'fullDesc', label: 'Présentation', kind: 'html', wide: true, group: 'Contenu' },
      { key: 'features', label: 'Atouts', kind: 'list', wide: true, group: 'Détails' },
      { key: 'faq', label: 'FAQ', kind: 'faq', wide: true, group: 'Détails' },
    ],
  },
  {
    key: 'hero', resource: 'hero', path: 'hero', label: 'Hero / Bannière', singular: 'slide',
    icon: ImageIcon, layout: 'slides', titleKey: 'title', imageKey: 'image', subtitleKey: 'cta', badgeKey: 'status',
    searchKeys: ['title', 'cta'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    orderField: 'sortOrder',
    defaults: { title: 'Nouveau slide', status: 'draft', locale: 'fr' },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', required: true, placeholder: 'Titre du slide', maxLength: 80, group: 'Slide' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Slide' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Slide' },
      { key: 'subtitle', label: 'Sous-titre', kind: 'text', group: 'Slide' },
      { key: 'cta', label: 'Libellé CTA', kind: 'text', group: 'Slide' },
      { key: 'ctaLink', label: 'Lien CTA', kind: 'text', prefix: '/', group: 'Slide' },
      { key: 'image', label: 'Visuel plein écran', kind: 'image', group: 'Média' },
      { key: 'description', label: 'Texte', kind: 'textarea', wide: true, group: 'Contenu' },
    ],
  },
  {
    key: 'pages', resource: 'pages', path: 'pages', label: 'Pages CMS', singular: 'page',
    icon: FileText, layout: 'docs', titleKey: 'title', subtitleKey: 'kind', badgeKey: 'status',
    searchKeys: ['title', 'slug', 'kind'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }, { key: 'kind', label: 'Type' }],
    defaults: { title: 'Nouvelle page', slug: 'nouvelle-page', kind: 'generic', subtype: 'simple', status: 'draft', locale: 'fr', slides: [], sections: [] },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', group: 'Page' },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Page' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Page' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Page' },
      { key: 'kind', label: 'Famille', kind: 'select', options: [{ value: 'generic', label: 'Générique' }, { value: 'legal', label: 'Légal' }, { value: 'about', label: 'À propos' }], group: 'Page' },
      { key: 'subtype', label: 'Mise en page', kind: 'select', options: ['simple', 'gallery', 'flyer', 'slide', 'scroll', 'full'].map((v) => ({ value: v, label: v })), group: 'Page' },
      { key: 'subtitle', label: 'Sous-titre', kind: 'text', group: 'Page' },
      { key: 'category', label: 'Catégorie', kind: 'text', group: 'Page' },
      { key: 'media', label: 'Médias', kind: 'gallery', wide: true, group: 'Média' },
      { key: 'content', label: 'Contenu HTML', kind: 'html', wide: true, group: 'Contenu' },
      { key: 'slides', label: 'Slides', kind: 'slides', wide: true, group: 'Blocs' },
      { key: 'sections', label: 'Sections scroll', kind: 'sections', wide: true, group: 'Blocs' },
    ],
  },
  {
    key: 'legal', resource: 'pages', path: 'legal', label: 'Pages légales', singular: 'page légale',
    icon: Scale, layout: 'docs', titleKey: 'title', subtitleKey: 'slug', badgeKey: 'status',
    searchKeys: ['title', 'slug'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    filter: { kind: 'legal' },
    defaults: { title: 'Page légale', slug: 'mentions', kind: 'legal', subtype: 'simple', status: 'draft', locale: 'fr' },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', group: 'Légal' },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Légal' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Légal' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Légal' },
      { key: 'content', label: 'Texte juridique', kind: 'html', wide: true, group: 'Contenu' },
    ],
  },
  {
    key: 'galleries', resource: 'pages', path: 'galleries', label: 'Galeries', singular: 'galerie',
    icon: Images, layout: 'mosaic', titleKey: 'title', subtitleKey: 'subtype', badgeKey: 'status',
    searchKeys: ['title'],
    filterKeys: [{ key: 'status', label: 'Statut', options: STATUS.map((s) => s.value) }],
    filter: { subtype: 'gallery' },
    defaults: { title: 'Nouvelle galerie', slug: 'galerie', kind: 'generic', subtype: 'gallery', status: 'draft', locale: 'fr', media: [] },
    fields: [
      { key: 'title', label: 'Titre', kind: 'text', group: 'Galerie' },
      { key: 'slug', label: 'Slug', kind: 'slug', slugFrom: 'title', group: 'Galerie' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Galerie' },
      { key: 'status', label: 'Statut', kind: 'radio', options: STATUS, group: 'Galerie' },
      { key: 'media', label: 'Images', kind: 'gallery', wide: true, group: 'Médias' },
      { key: 'content', label: 'Légende / texte', kind: 'html', wide: true, group: 'Contenu' },
    ],
  },
  {
    key: 'menus', resource: 'menus', path: 'menus', label: 'Menus', singular: 'menu',
    icon: Menu, layout: 'docs', titleKey: 'name', subtitleKey: 'location', badgeKey: 'status',
    searchKeys: ['name', 'location'],
    filterKeys: [{ key: 'status', label: 'Statut', options: ['draft', 'published'] }],
    defaults: { name: 'Menu', location: 'main', items: [], status: 'published', locale: 'fr' },
    fields: [
      { key: 'name', label: 'Nom', kind: 'text', group: 'Menu' },
      { key: 'location', label: 'Emplacement', kind: 'select', options: [
        { value: 'main', label: 'Principal' },
        { value: 'footer-nav', label: 'Pied navigation' },
        { value: 'footer-legal', label: 'Pied légal' },
        { value: 'social', label: 'Réseaux' },
      ], group: 'Menu' },
      { key: 'locale', label: 'Langue', kind: 'radio', options: LOCALES, group: 'Menu' },
      { key: 'status', label: 'Statut', kind: 'radio', options: [{ value: 'draft', label: 'Brouillon' }, { value: 'published', label: 'Publié' }], group: 'Menu' },
    ],
  },
];

export function getModule(key: string) {
  return CMS_MODULES.find((m) => m.key === key);
}
