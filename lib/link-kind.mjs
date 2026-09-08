/**
 * lib/link-kind.mjs — ce qu'est un lien saisi dans l'administration.
 *
 * Un lien de menu, de pied de page ou de bouton peut être :
 *
 * - un **chemin interne** — `/contact`, `/products/12-electrocardiogramme`. Il est
 *   enregistré SANS préfixe de langue : la vitrine est multilingue et le préfixe
 *   dépend de la langue affichée, pas de celle où l'administrateur travaillait en
 *   écrivant. C'est le affichage (`menuHref`, `localizeHref`) qui le pose.
 * - une **URL externe** — `https://…`, `//…`, `mailto:`, `tel:`. Elle est enregistrée
 *   telle quelle et doit rester intacte : y coller une langue produirait
 *   `/fr/https://exemple.com`, c'est-à-dire rien de consultable.
 *
 * Les règles tiennent dans un seul fichier, sans import et sans dépendance, pour une
 * raison précise : l'atelier et la vitrine doivent normaliser pareil, et un test doit
 * pouvoir les jouer sous `node` nu (`scripts/test-link-kind.mjs`), sans transpileur ni
 * serveur. C'est aussi pourquoi l'ensemble des langues reconnues est passé en
 * paramètre — `lib/i18n.ts` les déclare, ce module les reçoit, il n'en duplique pas
 * la liste.
 */

const EXTERNAL = /^(?:https?:)?\/\//i;
const CONTACT_SCHEME = /^(?:mailto:|tel:|sms:|whatsapp:)/i;
const LOCALE_SEGMENT = /^\/?([a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?)(?=\/|$)/;

/** Le lien pointe-t-il hors du site ? (schéma, `//` nu, adresse de contact direct) */
export function isExternalLink(raw) {
  const h = String(raw ?? '').trim();
  return EXTERNAL.test(h) || CONTACT_SCHEME.test(h);
}

/**
 * `exemple.com`, `www.exemple.com` : une adresse sans schéma. Le navigateur la
 * lirait comme un chemin du site — `/exemple.com` — d'où la question posée à
 * l'administrateur plutôt que le silence.
 */
export function looksLikeBareDomain(raw) {
  const h = String(raw ?? '').trim();
  if (!h || h.includes(' ') || h.includes('/')) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(h);
}

/** `https://` posé devant une adresse nue, et rien d'autre. */
export function schemeIt(raw) {
  const h = String(raw ?? '').trim();
  if (!h || h.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(h)) return h;
  return `https://${h}`;
}

/**
 * `/fr/contact`, `/en/contact/` → Contact, et la langue qui traînait en tête.
 *
 * Un segment de deux lettres n'est PAS une langue : `/france`, `/la/`… aussi la
 * liste des langues admises vient-elle de l'appelant, jamais d'une supposition.
 */
export function stripLocalePrefix(raw, localeSet) {
  const h = String(raw ?? '').trim();
  const match = h.match(LOCALE_SEGMENT);
  const known = match && new Set([...(localeSet || [])].map((l) => String(l).toLowerCase())).has(match[1].toLowerCase());
  if (!known) return { path: h, stripped: null };
  return { path: h.slice(match[0].length) || '/', stripped: match[1] };
}

/**
 * Le chemin interne, prêt à être enregistré : slash initial, pas de préfixe de
 * langue, pas de double barre, pas de slash de fin. Un ancrage seul (`#resultats`)
 * est conservé tel quel — il ne désigne aucune page à préfixer.
 */
export function normalizeInternalHref(raw, localeSet) {
  let h = String(raw ?? '').trim();
  if (!h) return '';
  if (h.startsWith('#')) return h;
  h = stripLocalePrefix(h, localeSet).path;
  if (!h.startsWith('/')) h = `/${h}`;
  h = h.replace(/\/{2,}/g, '/');
  if (h.length > 1) h = h.replace(/\/+(?=$|[?#])/, '');
  return h || '/';
}

/**
 * Le lien d'un menu (bandeau ou pied de page), prêt à coller dans `href`.
 *
 * Trois cas, un seul jeu de règles pour les deux emplacements — le même
 * enregistrement les alimente tous les deux :
 *
 *   - dehors → intact ;
 *   - déjà préfixé → réécrit pour la langue courante (un sous-menu généré arrive
 *     préfixé : le re-préfixer donnerait `/fr/fr/solutions`, donc un 404) ;
 *   - chemin nu ou ancre → préfixé par la langue.
 */
export function menuHref(raw, locale, localeSet) {
  const h = String(raw ?? '').trim();
  if (isExternalLink(h)) return h;
  if (!h || h === '#') return `/${locale}`;
  const clean = h.replace(/^[#/]+/, '');
  const prefixed = stripLocalePrefix(`/${clean}`, localeSet);
  if (prefixed.stripped) {
    const rest = prefixed.path.replace(/^\//, '');
    return rest ? `/${locale}/${rest}`.replace(/\/+$/, '') : `/${locale}`;
  }
  return (`/${locale}/${clean}`).replace(/\/+$/, '') || `/${locale}`;
}

/** Attributs de cible pour un lien sortant : nouvel onglet, et rien qui fuise. */
export function externalLinkAttrs(raw) {
  if (!isExternalLink(raw)) return {};
  const h = String(raw ?? '').trim();
  // Une adresse de contact s'ouvre dans l'application choisie par le système :
  // un onglet du navigateur pour un `mailto:` serait une erreur de parcours.
  if (CONTACT_SCHEME.test(h)) return {};
  return { target: '_blank', rel: 'noopener noreferrer' };
}
