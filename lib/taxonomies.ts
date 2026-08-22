export const TAXONOMY_LOCALES = ['fr', 'en', 'ar'] as const;
export type TaxonomyLocale = (typeof TAXONOMY_LOCALES)[number];

export interface TaxonomyTerm {
  value: string;
  label: string;
  /** Traductions du libellé par langue (fr / en / ar). */
  translations?: Partial<Record<TaxonomyLocale, string>>;
}

export interface TaxonomyDef {
  key: string;
  label: string;
  hint: string;
  defaults: TaxonomyTerm[];
}

/** Libellé d'un terme pour une langue donnée (fallback sur le libellé source). */
export function termLabel(term: TaxonomyTerm, locale?: string): string {
  const l = locale as TaxonomyLocale | undefined;
  return (l && term.translations?.[l]) || term.label;
}

const STORAGE_KEY = 'sari_taxonomies';

export const TAXONOMY_DEFS: TaxonomyDef[] = [
  {
    key: 'products.category',
    label: 'Catégories produits',
    hint: 'Rubriques du catalogue boutique.',
    defaults: ['Diagnostic', 'Cardiologie', 'Imagerie', 'Chirurgie', 'Pédiatrie', 'Urgence', 'Laboratoire', 'Consommables']
      .map((v) => ({ value: v, label: v })),
  },
  {
    key: 'news.category',
    label: 'Rubriques actualités',
    hint: 'Classement des articles.',
    defaults: ['Innovation', 'Produits', 'Santé', 'Formation', 'Corporate'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'careers.type',
    label: 'Types de contrat',
    hint: 'CDI, stage, etc.',
    defaults: ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Intérim'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'events.type',
    label: 'Types d’événements',
    hint: 'Salon, formation, webinar…',
    defaults: ['Salon', 'Formation', 'Conférence', 'Webinar', 'Atelier', 'Lancement', 'Portes Ouvertes']
      .map((v) => ({ value: v, label: v })),
  },
  {
    key: 'products.type',
    label: 'Types de produits',
    hint: 'Familles techniques du catalogue.',
    defaults: ['Équipement', 'Consommable', 'Accessoire', 'Logiciel'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'products.spec',
    label: 'Clés de spécifications',
    hint: 'Libellés réutilisables des fiches techniques.',
    defaults: ['Poids', 'Dimensions', 'Alimentation', 'Classe'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'products.attribute',
    label: 'Attributs produits',
    hint: 'Attributs filtrables (marque, classe, etc.).',
    defaults: ['Marque', 'Classe', 'Garantie'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'products.unit',
    label: 'Unités',
    hint: 'Unités de vente et de stock.',
    defaults: ['pièce', 'boîte', 'carton', 'litre', 'kit'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'products.label',
    label: 'Labels produits',
    hint: 'Badges vitrine (nouveau, promo…).',
    defaults: ['Nouveau', 'Promo', 'Best-seller', 'Sur commande'].map((v) => ({ value: v, label: v })),
  },
  {
    key: 'partners.category',
    label: 'Catégories partenaires',
    hint: 'Familles de partenaires.',
    defaults: ['Diagnostic', 'Cardiologie', 'Imagerie', 'Chirurgie', 'Laboratoire'].map((v) => ({ value: v, label: v })),
  },
];

type Store = Record<string, TaxonomyTerm[]>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('sari-taxonomies'));
}

export function listTaxonomy(key: string, locale?: string): TaxonomyTerm[] {
  const def = TAXONOMY_DEFS.find((d) => d.key === key);
  const stored = readStore()[key];
  const terms = stored?.length ? stored : def?.defaults ? [...def.defaults] : [];
  if (!locale) return terms;
  // Résout le libellé affiché selon la langue demandée (la valeur reste la clé).
  return terms.map((t) => ({ ...t, label: termLabel(t, locale) }));
}

export function saveTaxonomy(key: string, terms: TaxonomyTerm[]) {
  const store = readStore();
  store[key] = terms.filter((t) => t.value.trim());
  writeStore(store);
}

export function addTaxonomyTerm(key: string, term: TaxonomyTerm): TaxonomyTerm[] {
  const next = listTaxonomy(key);
  const value = term.value.trim();
  if (!value) return next;
  if (!next.some((t) => t.value.toLowerCase() === value.toLowerCase())) {
    next.push({ value, label: term.label.trim() || value });
    saveTaxonomy(key, next);
  }
  return listTaxonomy(key);
}

export function removeTaxonomyTerm(key: string, value: string) {
  saveTaxonomy(key, listTaxonomy(key).filter((t) => t.value !== value));
}

export function renameTaxonomyTerm(key: string, value: string, label: string) {
  saveTaxonomy(key, listTaxonomy(key).map((t) => (t.value === value ? { ...t, label } : t)));
}

export function allTaxonomies(): Array<TaxonomyDef & { terms: TaxonomyTerm[] }> {
  return TAXONOMY_DEFS.map((def) => ({ ...def, terms: listTaxonomy(def.key) }));
}
