/**
 * Sous-menus générés depuis le contenu (« sous-catégories automatiques »).
 *
 * Un lien de menu peut porter une règle `auto` au lieu d'une liste figée de
 * sous-liens. La liste est alors résolue à l'affichage, ce qui garantit trois
 * choses qu'un sous-menu saisi à la main ne donne pas :
 *
 *   - une fiche publiée après coup apparaît sans repasser par l'administration ;
 *   - une fiche archivée (ou en brouillon) disparaît du menu ;
 *   - les URLs suivent `entityUrl`, donc restent valides même si le slug change.
 *
 * La règle est volontairement minimale — source, mode, sélection, limite — pour
 * rester lisible dans le JSON du menu et diffable en base.
 */

import { entityUrl } from '@/lib/entity-url';

/** Modules pouvant alimenter un sous-menu. */
export type AutoSource = 'solutions' | 'services' | 'products' | 'news' | 'events';

export type AutoRule = {
  source: AutoSource;
  /** `all` : tout le contenu publié. `pick` : uniquement `ids`, dans cet ordre. */
  mode: 'all' | 'pick';
  /** Identifiants retenus en mode `pick` (ordre d'affichage). */
  ids?: Array<string | number>;
  /** Nombre maximal d'entrées affichées (0 ou absent = pas de limite). */
  limit?: number;
  /**
   * Afficher la description courte de la fiche sous son titre.
   *
   * Absent = `true` : c'était le comportement avant que l'option existe, et le
   * changer silencieusement viderait les menus déjà en base de leurs
   * descriptions.
   */
  showDesc?: boolean;
  /**
   * Afficher l'icône de la fiche devant son titre.
   *
   * Absent = `false` : aucune icône n'était rendue auparavant, l'activer par
   * défaut modifierait l'apparence des menus existants sans qu'on l'ait
   * demandé. Sans effet sur les modules qui n'ont pas de champ `icon`.
   */
  showIcon?: boolean;
};

/** Entrée de menu, manuelle ou générée. */
export type MenuNode = {
  id?: string;
  label: string;
  href: string;
  desc?: string;
  icon?: string;
  submenu?: MenuNode[];
  /** Règle de génération ; `submenu` est alors calculé et non enregistré. */
  auto?: AutoRule | null;
};

/** Fiche minimale exploitable comme sous-lien. */
export type AutoEntity = {
  id?: string | number;
  slug?: string;
  legacyId?: string | number;
  title?: string;
  name?: string;
  status?: string;
  shortDesc?: string;
  /** Nom d'icône Lucide ; seuls Solutions et Services en possèdent une. */
  icon?: string;
  sortOrder?: number;
};

/** Modules dont les fiches portent un champ `icon` exploitable dans un menu. */
export const SOURCES_WITH_ICON: readonly AutoSource[] = ['solutions', 'services'];

/**
 * Segment d'URL de chaque module.
 *
 * Les solutions se distinguent : leur page de détail est `[categoryKey]`, et
 * non `[id]`. `entityUrl` produit la clé attendue dans les deux cas, mais le
 * chemin de base doit être exact.
 */
export const AUTO_SOURCES: Record<AutoSource, { basePath: string; labelKey: 'title' | 'name' }> = {
  solutions: { basePath: 'solutions', labelKey: 'title' },
  services: { basePath: 'services', labelKey: 'title' },
  products: { basePath: 'products', labelKey: 'name' },
  news: { basePath: 'news', labelKey: 'title' },
  events: { basePath: 'events', labelKey: 'title' },
};

export function isAutoSource(value: unknown): value is AutoSource {
  return typeof value === 'string' && value in AUTO_SOURCES;
}

/** Libellé affichable d'une fiche, quel que soit le module. */
export function entityLabel(entity: AutoEntity, source: AutoSource): string {
  const key = AUTO_SOURCES[source].labelKey;
  const value = entity[key] ?? entity.title ?? entity.name ?? '';
  return String(value).trim();
}

/**
 * Une fiche est-elle affichable dans un menu public ?
 *
 * Les endpoints publics filtrent déjà sur `status: 'published'`, mais l'admin
 * travaille sur la liste complète : le même filtre doit donc être appliqué ici
 * pour que l'aperçu de l'administration corresponde à la vitrine. Un statut
 * absent est considéré comme publié — les jeux de données JSON hérités n'ont
 * pas toujours ce champ.
 */
export function isPublished(entity: AutoEntity): boolean {
  const status = entity.status == null ? '' : String(entity.status).trim().toLowerCase();
  return status === '' || status === 'published';
}

/**
 * Résout une règle en liste de sous-liens.
 *
 * `entities` est la liste complète du module (pas encore filtrée) : le tri par
 * `sortOrder` reproduit celui des pages de liste, pour que le menu présente les
 * fiches dans le même ordre que la vitrine.
 */
export function resolveAutoSubmenu(
  rule: AutoRule,
  entities: AutoEntity[],
  locale: string,
): MenuNode[] {
  if (!rule || !isAutoSource(rule.source) || !Array.isArray(entities)) return [];

  const { basePath } = AUTO_SOURCES[rule.source];
  const visible = entities.filter(isPublished);

  let selected: AutoEntity[];
  if (rule.mode === 'pick') {
    const wanted = (rule.ids || []).map((id) => String(id));
    // On parcourt `ids` et non `visible` : l'ordre choisi dans l'administration
    // prime. Une fiche entre-temps archivée n'est simplement pas retrouvée.
    selected = wanted
      .map((id) => visible.find((e) => String(e.id) === id || String(e.legacyId ?? '') === id))
      .filter((e): e is AutoEntity => Boolean(e));
  } else {
    selected = [...visible].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  const limit = Number(rule.limit) || 0;
  if (limit > 0) selected = selected.slice(0, limit);

  // Options d'affichage : la description était toujours reprise avant qu'elles
  // existent, l'icône jamais. On conserve ces valeurs par défaut pour ne pas
  // changer l'aspect des menus déjà enregistrés.
  const showDesc = rule.showDesc !== false;
  const showIcon = rule.showIcon === true;

  return selected.map((entity) => ({
    id: `auto-${rule.source}-${entity.id ?? entity.slug}`,
    label: entityLabel(entity, rule.source),
    href: entityUrl(locale, basePath, entity),
    desc: showDesc && entity.shortDesc ? String(entity.shortDesc) : undefined,
    icon: showIcon && entity.icon ? String(entity.icon) : undefined,
  }));
}

/**
 * Applique les règles `auto` d'un menu complet.
 *
 * `datasets` fournit, par module, la liste déjà chargée : la résolution reste
 * synchrone et sans requête réseau, donc utilisable aussi bien dans un rendu
 * serveur que dans l'aperçu de l'administration.
 *
 * Un lien dont la règle ne produit rien (module vide, tout archivé) conserve
 * `submenu: undefined` plutôt qu'un tableau vide : le Header n'affiche alors
 * ni chevron ni panneau déroulant vide.
 */
export function applyAutoMenus(
  items: MenuNode[],
  datasets: Partial<Record<AutoSource, AutoEntity[]>>,
  locale: string,
): MenuNode[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item?.auto || !isAutoSource(item.auto.source)) {
      // Lien manuel : on nettoie tout de même un sous-menu vide hérité.
      const submenu = Array.isArray(item?.submenu) && item.submenu.length ? item.submenu : undefined;
      return { ...item, submenu };
    }
    const resolved = resolveAutoSubmenu(item.auto, datasets[item.auto.source] || [], locale);
    return { ...item, submenu: resolved.length ? resolved : undefined };
  });
}

/** Modules réellement référencés par un menu, pour ne charger que ceux-là. */
export function usedAutoSources(items: MenuNode[]): AutoSource[] {
  const out = new Set<AutoSource>();
  for (const item of items || []) {
    if (item?.auto && isAutoSource(item.auto.source)) out.add(item.auto.source);
  }
  return [...out];
}
