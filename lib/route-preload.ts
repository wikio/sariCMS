// lib/route-preload.ts
/**
 * Ce que le visiteur va cliquer, tiède ou froid.
 *
 * Next préchauffe déjà les liens dans le champ de vision, mais la vitrine a deux
 * particularités : les pages construites par l'éditeur (`/p/{slug}`, `/content/{id}`)
 * sont trop nombreuses pour tenir toutes en cache, et le menu mobile se déroule à la
 * demande — donc hors champ au chargement. D'où un préchargement au survol (et au
 * focus clavier) avec mémoire de ce qui est déjà chaud, pour ne pas re-précharger à
 * chaque passage de souris, et un état « navigation en cours » que l'écran de
 * chargement peut afficher avant même que la nouvelle page ne soit prête.
 *
 * Le module ne dépend pas du routeur : on lui passe la fonction de préchargement.
 * Ainsi il se teste sans DOM, et il reste utilisable depuis n'importe quel composant.
 */

const WARM_LIMIT = 60;
const warm = new Set<string>();

export function isWarm(href: string): boolean {
  return warm.has(href);
}

export function markWarm(href: string): void {
  warm.add(href);
  // Un aller simple dans la session ne doit pas faire grossir la mémoire sans fin.
  if (warm.size > WARM_LIMIT) {
    const oldest = warm.values().next().value;
    if (oldest) warm.delete(oldest);
  }
}

/** Un lien interne, dans la même origine, sans téléchargement ni onglet neuf. */
export function isInternalHref(anchor: HTMLAnchorElement | null, currentOrigin: string): string | null {
  if (!anchor) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  try {
    const url = new URL(href, currentOrigin);
    if (url.origin !== currentOrigin) return null;
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next')) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Le lien qui porte la cible d'une navigation, en remontant depuis l'élément cliqué :
 * un clic tombe souvent sur la `<span>` ou le `<svg>` de la vignette, pas sur la
 * balise `a` elle-même.
 */
export function anchorFrom(target: EventTarget | null): HTMLAnchorElement | null {
  let node = target as (Node | null);
  while (node && node instanceof Element) {
    const anchor = node.closest('a');
    if (anchor instanceof HTMLAnchorElement) return anchor;
    node = node.parentElement;
  }
  return null;
}

/**
 * La cible est-elle la page où l'on est, à un ancrage près ? Un lien de sommaire ou
 * d'onglet ne charge rien : le voile n'a rien à y faire, et l'afficher une frame pour
 * rien serait pire que ne pas l'afficher.
 */
export function isSamePage(
  href: string,
  current: string =
    typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`,
): boolean {
  if (!current) return false;
  return href.split('#')[0] === current;
}
