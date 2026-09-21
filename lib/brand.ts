/**
 * lib/brand.ts — identité de l'administration, en un seul endroit.
 *
 * Avant ce module, le nom était écrit en trois exemplaires (`AdminLayout`,
 * l'en-tête du tableau de bord, la page de connexion) et l'icône en deux. Les
 * renommer demandait de reprendre quatre fichiers, et rien n'empêchait les
 * copies de diverger — une barre latérale disant « SARI OS » pendant que l'onglet
 * du navigateur disait autre chose.
 *
 * La valeur vient du serveur (`GET /public/brand`), pas du `localStorage` : la
 * marque doit être la même sur tous les postes et lisible avant authentification,
 * sur l'écran de connexion. Un réglage par navigateur rendrait le logo invisible
 * chez les autres — le défaut qu'on vient de corriger pour les coupons.
 *
 * Trois niveaux, comme la maintenance : ligne `settings` en base, variables
 * d'environnement (`SARI_BRAND_TITLE`, `SARI_BRAND_SUBTITLE`, `SARI_BRAND_LOGO`),
 * puis les défauts de ce fichier. Le backend applique cet ordre ; ici on ne fait
 * que lire le résultat.
 */
import { cmsAdminFetch } from '@/lib/cms-admin';
import { cmsFetch } from '@/lib/cms';

export interface AdminBrand {
  /** Nom affiché dans la barre latérale, l'onglet et la page de connexion. */
  title: string;
  /** Seconde ligne sous le nom. Vide = la ligne n'est pas rendue. */
  subtitle: string;
  /** Image du logo. Vide = icône par défaut (bouclier). */
  logo: string;
}

export type BrandSource = 'db' | 'env' | 'default';

export interface BrandStatus extends AdminBrand {
  source: BrandSource;
}

/**
 * Défauts appliqués quand le serveur ne répond pas. Doit rester aligné sur
 * `BRAND_DEFAULTS` de `backend/src/modules/settings/brand-settings.service.ts` :
 * une divergence ici signifierait que l'interface annonce une marque que le
 * serveur ne connaît pas.
 */
export const BRAND_DEFAULTS: AdminBrand = {
  title: 'SARI CMS',
  subtitle: 'Administration',
  logo: '',
};

/**
 * Mêmes règles que le serveur, appliquées au retour : la valeur est affichée
 * telle quelle dans la barre latérale, et un champ absent du JSON ne doit pas
 * produire `undefined` dans le titre de l'onglet.
 */
export function normalizeBrand(raw: unknown): AdminBrand {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';
  return {
    title: str(o.title, 40) || BRAND_DEFAULTS.title,
    subtitle: str(o.subtitle, 60),
    logo: safeLogo(str(o.logo, 400)),
  };
}

/**
 * Le logo se retrouve dans un `<img src>` et dans `<link rel="icon">`, sur un
 * écran accessible sans session. On ne fait confiance qu'aux trois formes que
 * l'interface produit : chemin relatif du dépôt, URL absolue, image embarquée.
 * Le reste (un `javascript:` déguisé, un `//tiers/…` relative-protocol) est
 * vidé plutôt que conservé — afficher l'icône par défaut vaut mieux que charger
 * une ressource qu'on n'a pas choisie.
 */
export function safeLogo(value: string): string {
  if (!value) return '';
  return /^(\/|https?:\/\/|data:image\/)/i.test(value) ? value : '';
}

/**
 * Cache mémoire côté serveur uniquement. La barre latérale est rendue sur chaque
 * page d'administration ; sans ce garde-fou, chaque navigation d'un utilisateur
 * produirait un appel HTTP au backend pour récupérer trois champs qui changent
 * une fois par an.
 *
 * Volontairement par processus : un poste déjà chargé garde sa marque jusqu'au
 * rechargement, ce qui est le comportement attendu d'un renommage.
 */
const TTL_MS = 30_000;
let cached: { at: number; value: AdminBrand } | null = null;

/**
 * Lecture brute, qui lève si le serveur ne répond pas.
 *
 * Séparée de `loadBrand` exprès : l'appelant qui recharge la marque après un
 * enregistrement doit pouvoir **garder** ce qu'il affiche en cas d'échec.
 * Réutiliser ici le repli sur les défauts effacerait le logo que l'on vient
 * d'enregistrer, en silence, à la seule condition que la requête de relecture
 * ait échoué.
 */
export async function fetchBrand(): Promise<AdminBrand> {
  return normalizeBrand(await cmsFetch<unknown>('/public/brand', { timeoutMs: 2500 }));
}

/** Marque effective, lue du côté serveur. Ne lève jamais. */
export async function loadBrand(force = false): Promise<AdminBrand> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const value = await fetchBrand();
    cached = { at: Date.now(), value };
    return value;
  } catch {
    // Backend joignable ou non, base non migrée : l'administration doit
    // s'afficher. Les défauts sont la marque du dépôt.
    return BRAND_DEFAULTS;
  }
}

/** Marque vue par l'écran de réglage, avec la provenance à afficher. */
export async function loadBrandStatus(): Promise<BrandStatus> {
  const status = await cmsAdminFetch<BrandStatus>('/settings/brand', { timeoutMs: 8000 });
  return { ...normalizeBrand(status), source: status?.source ?? 'default' };
}

export async function saveBrand(form: AdminBrand): Promise<BrandStatus> {
  const status = await cmsAdminFetch<BrandStatus>('/settings/brand', {
    method: 'PUT',
    json: form,
    timeoutMs: 12000,
  });
  return { ...normalizeBrand(status), source: status?.source ?? 'db' };
}

/** Retire la ligne en base : retour aux variables d'environnement, puis aux défauts. */
export async function resetBrand(): Promise<BrandStatus> {
  const status = await cmsAdminFetch<BrandStatus>('/settings/brand', {
    method: 'DELETE',
    timeoutMs: 12000,
  });
  return { ...normalizeBrand(status), source: status?.source ?? 'default' };
}

/**
 * Titre complet d'un écran : « Tableau de bord · SARI CMS ».
 *
 * Le séparateur est choisi à la main plutôt que par le modèle Next du layout
 * racine, parce que ce modèle est celui de la vitrine (`%s | SARI Système`) et
 * qu'il hériterait ici — l'administration porterait alors le nom commercial du
 * site public dans l'onglet, ce que la centralisation vient corriger.
 */
export function brandDocumentTitle(brand: AdminBrand, page?: string): string {
  const base = brand.title || BRAND_DEFAULTS.title;
  const trimmed = (page || '').trim();
  return trimmed ? `${trimmed} · ${base}` : base;
}
