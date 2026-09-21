/**
 * lib/site-contact.ts — identité et coordonnées de la vitrine, dans `ContactInfo`.
 *
 * Deux écrans prétendaient régler le logo de la vitrine, et aucun ne le faisait
 * pour le visiteur :
 *
 * - Paramètres → « Logo du site vitrine » écrivait dans `sari_admin_settings`,
 *   donc le `localStorage` du poste ;
 * - Configuration du site écrivait dans `sari_config_<locale>`, idem — et relisait
 *   sa propre copie, sans jamais consulter la base.
 *
 * L'en-tête et le pied de page, eux, sont rendus **côté serveur** et lisent
 * `getConfig()` → `GET /public/contact` → la table `contact_info`. Ce qu'un
 * visiteur reçoit, c'est cette ligne-là. Enregistrer un logo depuis le navigateur
 * d'un administrateur ne pouvait donc jamais le rendre visible à qui le destinait.
 *
 * `ContactInfo` portait déjà tout : colonne `logo`, une ligne par locale
 * (`@@unique([locale])`), lecture publique, et le mappage exact de `lib/data.ts`.
 * Ce module ne crée aucun magasin : il relie deux interfaces à la table qui
 * savait déjà répondre. Le mappage est l'inverse de celui de `getConfig`, et il
 * est écrit à un seul endroit pour que les deux ne divergent pas.
 */
import { cmsAdminFetch } from '@/lib/cms-admin';
import { decidePull } from '@/lib/shop-mapping';

export interface SiteContactRow {
  id?: number;
  locale?: string;
  company?: string | null;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  logo?: string | null;
  social?: Record<string, string> | null;
  extras?: Record<string, unknown> | null;
}

/** Miroir de la projection que `getConfig` applique à la lecture. */
export interface SiteContact {
  meta: {
    companyName: string;
    tagline: string;
    description: string;
    logo: string;
    phone: string;
    email: string;
    address: string;
    hours: string;
    social: Record<string, string>;
  };
  stats: Record<string, string>;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const dict = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Fiche de contact, projetée sous la forme que les écrans manipulent. */
export function fromRow(row: SiteContactRow | null): SiteContact {
  const extras = dict(row?.extras);
  return {
    meta: {
      companyName: text(row?.company),
      tagline: text(row?.tagline),
      description: text(extras.description),
      logo: text(row?.logo),
      phone: text(row?.phone),
      email: text(row?.email),
      address: text(row?.address),
      hours: text(row?.hours),
      social: Object.fromEntries(Object.entries(dict(row?.social)).map(([k, v]) => [k, text(v)])),
    },
    stats: Object.fromEntries(Object.entries(dict(extras.stats)).map(([k, v]) => [k, text(v)])),
  };
}

/** L'inverse : ce que la base doit recevoir. Un champ vide s'écrit, il efface. */
function toRow(locale: string, c: SiteContact): Record<string, unknown> {
  return {
    locale,
    company: c.meta.companyName,
    tagline: c.meta.tagline,
    phone: c.meta.phone,
    email: c.meta.email,
    address: c.meta.address,
    hours: c.meta.hours,
    logo: c.meta.logo,
    social: c.meta.social,
    extras: { description: c.meta.description, stats: c.stats },
  };
}

/*
 * Lecture par la route **publique**, et non par la liste d'administration. Ce n'est
 * pas une affaire de style : trois défauts vérifiés sur le serveur vivant.
 *
 * 1. `GET /contact/info` (liste) rend une projection allégée : `logo`, `tagline` et
 *    `social` en sont absents. Un formulaire rempli depuis elle afficherait des
 *    champs vides, et le premier enregistrement les écrirait tels quels — la fiche
 *    du client effacée par une simple ouverture d'écran.
 * 2. La liste passe par un point d'entrée différent de `findByLocale`, et c'est
 *    celui-ci qui rend la fiche telle qu'on va la modifier : champs complets,
 *    identifiant acceptable par `PATCH /contact/info/:id` (un nombre — les lignes
 *    héritées du jeu de démonstration portent un UUID, et `ParseIntPipe` les
 *    refuse, ce qui rend toute mise à jour impossible sous le pilote JSON ;
 *    défaut du moteur de recette, sans effet sur le déploiement MySQL).
 * 3. Surtout, c'est **cette route** que le rendu serveur de la vitrine consomme.
 *    Lire par elle garantit que ce que l'administrateur voit dans son écran est
 *    exactement ce que le visiteur recevra, au lieu de deux projections distinctes.
 *
 * Le `limit` de la liste n'était pas non plus libre : le serveur rejette au-delà de
 * 100. Une fiche par locale — la question ne se pose plus ici.
 */
export async function findContactRow(locale: string): Promise<SiteContactRow | null> {
  const payload = await cmsAdminFetch<SiteContactRow | { data?: SiteContactRow }>(
    `/public/contact?locale=${encodeURIComponent(locale)}`,
    { timeoutMs: 8000 },
  );
  const row = ((payload as { data?: unknown })?.data ?? payload) as SiteContactRow | null;
  // `PublicContactController.current` rend `{}` quand aucune fiche n'existe : sans
  // identité ni locale, il n'y a rien à mettre à jour, c'est une création.
  if (!row || (row.id === undefined && !row.locale)) return null;
  return row;
}

/**
 * Enregistre la fiche. Création ou mise à jour selon qu'elle existe déjà : une
 * base reprise partiellement peut n'avoir de fiche que pour le français, et
 * l'écran ne devrait pas avoir à le savoir.
 *
 * `toRow` écrit tous les champs, y compris vides : sur cet écran, effacer une
 * adresse est un choix de l'opérateur, pas un incident.
 */
export async function saveSiteContact(locale: string, next: SiteContact): Promise<void> {
  const existing = await findContactRow(locale);
  const body = toRow(locale, next);
  if (existing?.id !== undefined) {
    await cmsAdminFetch(`/contact/info/${existing.id}`, { method: 'PATCH', json: body, timeoutMs: 15000 });
    return;
  }
  await cmsAdminFetch('/contact/info', { method: 'POST', json: body, timeoutMs: 15000 });
}

/**
 * Uniquement le logo : l'écran Paramètres ne règle que ce champ-là, et un `PATCH`
 * partiel laisse le reste intact (vérifié — l'adresse et le téléphone survivent
 * quand on n'envoie que `logo`).
 */
export async function saveSiteLogo(locale: string, logo: string): Promise<void> {
  const existing = await findContactRow(locale);
  if (existing?.id !== undefined) {
    await cmsAdminFetch(`/contact/info/${existing.id}`, {
      method: 'PATCH',
      json: { logo },
      timeoutMs: 15000,
    });
    return;
  }
  await cmsAdminFetch('/contact/info', { method: 'POST', json: { locale, logo }, timeoutMs: 15000 });
}

/**
 * Ramène le logo du serveur dans le cache local, sans écraser un logo que ce
 * poste aurait saisi avant la mise en base.
 *
 * La règle est celle de `decidePull()`, réutilisée et non redéveloppée : un
 * tableau vide descendant d'une base neuve ne doit pas devenir la nouvelle
 * valeur locale. Différence avec les listes de coupons, ici la présence se juge
 * sur une chaîne — `ContactInfo.logo` peut être null, vide, ou absente.
 */
export async function hydrateSiteLogo(locale: string): Promise<{ logo: string; seeded: boolean }> {
  if (typeof window === 'undefined') return { logo: '', seeded: false };
  const key = 'sari_site_logo_synced';
  const local = loadLocalLogo();
  let row: SiteContactRow | null = null;
  try {
    row = await findContactRow(locale);
  } catch {
    // Backend injoignable : on ne touche à rien, le cache local reste affiché.
    return { logo: local, seeded: false };
  }
  const server = typeof row?.logo === 'string' ? row.logo.trim() : '';
  const decision = decidePull({
    serverCount: server ? 1 : 0,
    localCount: local ? 1 : 0,
    hasSyncedBefore: localStorage.getItem(key) !== null,
  });

  localStorage.setItem(key, new Date().toISOString());

  if (decision === 'seed') {
    await saveSiteLogo(locale, local).catch(() => undefined);
    return { logo: local, seeded: true };
  }
  if (decision === 'overwrite') writeLocalLogo(server);
  return { logo: decision === 'noop' ? local : server, seeded: false };
}

const LOGO_CACHE_KEY = 'sari_admin_settings';

/** Le logo tel que l'écran le lit aujourd'hui : dans le blob de réglages local. */
function loadLocalLogo(): string {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { siteLogo?: unknown };
    return typeof parsed?.siteLogo === 'string' ? parsed.siteLogo.trim() : '';
  } catch {
    return '';
  }
}

function writeLocalLogo(logo: string): void {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify({ ...parsed, siteLogo: logo }));
    window.dispatchEvent(new Event('sari-admin-settings-changed'));
  } catch {
    /* un cache illisible se régénère depuis les défauts au prochain appel */
  }
}
