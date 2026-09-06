'use client';

import { useEffect, useState } from 'react';

/**
 * Visibilité de la vitrine : permet de masquer/afficher des menus, pages,
 * modules, sections, boutons et actions depuis l'admin (sans toucher au code).
 *
 * Les réglages sont enregistrés EN BASE, une entrée par langue. Ils valent
 * donc pour tous les visiteurs, et masquer un lien en français ne le masque
 * plus en arabe.
 *
 * Auparavant ils vivaient dans le `localStorage` du navigateur : le réglage
 * était commun à toutes les langues et n'existait que sur le poste où il
 * avait été modifié. Le `localStorage` ne sert plus que de secours hors ligne,
 * lorsque l'API est injoignable.
 *
 * Seules les exceptions sont transmises : une clé absente vaut la valeur par
 * défaut déclarée dans `VISIBILITY_GROUPS`.
 */

export interface VisibilityItem {
  key: string;
  label: string;
  labelKey?: string;
  hint?: string;
  defaultOn: boolean;
}

export interface VisibilityGroup {
  key: string;
  label: string;
  labelKey?: string;
  items: VisibilityItem[];
}

export const VISIBILITY_GROUPS: VisibilityGroup[] = [
  {
    key: 'menus', labelKey: 'menus',
    label: 'Menus',
    items: [
      { key: 'menu.home', label: 'Accueil', defaultOn: true, labelKey: 'menu_home' },
      { key: 'menu.about', label: 'À propos', defaultOn: true, labelKey: 'menu_about' },
      { key: 'menu.solutions', label: 'Solutions', defaultOn: true, labelKey: 'menu_solutions' },
      { key: 'menu.services', label: 'Services', defaultOn: true, labelKey: 'menu_services' },
      { key: 'menu.products', label: 'Produits', defaultOn: true, labelKey: 'menu_products' },
      { key: 'menu.events', label: 'Événements', defaultOn: true, labelKey: 'menu_events' },
      { key: 'menu.news', label: 'Actualités', defaultOn: true, labelKey: 'menu_news' },
      { key: 'menu.careers', label: 'Carrières', defaultOn: true, labelKey: 'menu_careers' },
      { key: 'menu.contact', label: 'Contact', defaultOn: true, labelKey: 'menu_contact' },
    ],
  },
  {
    key: 'footer', labelKey: 'footer',
    label: 'Pied de page',
    items: [
      { key: 'footer.home', label: 'Accueil', defaultOn: true, labelKey: 'footer_home' },
      { key: 'footer.about', label: 'À propos', defaultOn: true, labelKey: 'footer_about' },
      { key: 'footer.solutions', label: 'Solutions', defaultOn: true, labelKey: 'footer_solutions' },
      { key: 'footer.services', label: 'Services', defaultOn: true, labelKey: 'footer_services' },
      { key: 'footer.products', label: 'Produits', defaultOn: true, labelKey: 'footer_products' },
      { key: 'footer.events', label: 'Événements', defaultOn: true, labelKey: 'footer_events' },
      { key: 'footer.news', label: 'Actualités', defaultOn: true, labelKey: 'footer_news' },
      { key: 'footer.careers', label: 'Carrières', defaultOn: true, labelKey: 'footer_careers' },
      { key: 'footer.contact', label: 'Contact', defaultOn: true, labelKey: 'footer_contact' },
      { key: 'footer.mentions', label: 'Mentions légales', defaultOn: true, labelKey: 'footer_mentions' },
      { key: 'footer.privacy', label: 'Confidentialité', defaultOn: true, labelKey: 'footer_privacy' },
      { key: 'footer.conditions', label: '"Conditions d\'utilisation"', defaultOn: true, labelKey: 'footer_conditions' },
      { key: 'footer.verification', label: 'Vérification', defaultOn: true, labelKey: 'footer_verification' },
    ],
  },
  {
    key: 'pages', labelKey: 'pages',
    label: 'Pages',
    items: [
      { key: 'page.about', label: 'À propos', defaultOn: true, labelKey: 'page_about' },
      { key: 'page.mentions', label: 'Mentions légales', defaultOn: true, labelKey: 'page_mentions' },
      { key: 'page.privacy', label: 'Politique de confidentialité', defaultOn: true, labelKey: 'page_privacy' },
      { key: 'page.conditions', label: 'CGV', defaultOn: true, labelKey: 'page_conditions' },
    ],
  },
  {
    key: 'modules', labelKey: 'modules',
    label: 'Modules vitrine',
    items: [
      { key: 'module.solutions', label: 'Solutions', defaultOn: true, labelKey: 'module_solutions' },
      { key: 'module.services', label: 'Services', defaultOn: true, labelKey: 'module_services' },
      { key: 'module.products', label: 'Catalogue produits', defaultOn: true, labelKey: 'module_products' },
      { key: 'module.events', label: 'Événements', defaultOn: true, labelKey: 'module_events' },
      { key: 'module.news', label: 'Actualités', defaultOn: true, labelKey: 'module_news' },
      { key: 'module.careers', label: 'Carrières', defaultOn: true, labelKey: 'module_careers' },
      { key: 'module.contact', label: 'Contact', defaultOn: true, labelKey: 'module_contact' },
    ],
  },
  {
    key: 'sections', labelKey: 'sections',
    label: "Sections (page d’accueil)",
    items: [
      { key: 'section.hero', label: 'Bannière', defaultOn: true, labelKey: 'section_hero' },
      { key: 'section.products', label: 'Produits à la une', defaultOn: true, labelKey: 'section_products' },
      { key: 'section.services', label: 'Services', defaultOn: true, labelKey: 'section_services' },
      { key: 'section.solutions', label: 'Solutions', defaultOn: true, labelKey: 'section_solutions' },
      { key: 'section.testimonials', label: 'Témoignages', defaultOn: true, labelKey: 'section_testimonials' },
      { key: 'section.partners', label: 'Partenaires', defaultOn: true, labelKey: 'section_partners' },
      { key: 'section.news', label: 'Actualités', defaultOn: true, labelKey: 'section_news' },
      { key: 'section.events', label: 'Événements', defaultOn: true, labelKey: 'section_events' },
      { key: 'section.navigation', label: 'Grille de navigation', defaultOn: true, labelKey: 'section_navigation' },
      { key: 'section.mission', label: 'Notre Mission (parallaxe)', defaultOn: true, labelKey: 'section_mission' },
      { key: 'section.stats', label: 'Chiffres clés', defaultOn: true, labelKey: 'section_stats' },
      { key: 'section.newsletter', label: 'Newsletter', defaultOn: true, labelKey: 'section_newsletter' },
      { key: 'section.cta', label: 'Appel à l’action (CTA)', defaultOn: true, labelKey: 'section_cta' },
    ],
  },
  {
    key: 'buttons', labelKey: 'buttons',
    label: 'Boutons',
    items: [
      { key: 'button.addToCart', label: 'Ajouter au panier', defaultOn: true, labelKey: 'button_addToCart' },
      { key: 'button.apply', label: 'Postuler', defaultOn: true, labelKey: 'button_apply' },
      { key: 'button.contact', label: 'Contact / devis', defaultOn: true, labelKey: 'button_contact' },
      { key: 'button.register', label: 'Inscription', defaultOn: true, labelKey: 'button_register' },
      { key: 'button.cart', label: 'Icône panier', defaultOn: true, labelKey: 'button_cart' },
    ],
  },
  {
    key: 'actions', labelKey: 'actions',
    label: 'Actions',
    items: [
      { key: 'action.order', label: 'Commander (ajouter au panier)', defaultOn: true, labelKey: 'action_order', hint: 'Masque le bloc quantité + ajout au panier.' },
      { key: 'action.apply', label: 'Postuler à une offre', defaultOn: true, labelKey: 'action_apply', hint: 'Masque le formulaire de candidature.' },
      { key: 'action.contact', label: 'Envoyer un message', defaultOn: true, labelKey: 'action_contact' },
      { key: 'action.register', label: 'Créer un compte', defaultOn: true, labelKey: 'action_register' },
    ],
  },
];

/** Secours hors ligne : ne sert que si l'API est injoignable. */
const KEY = 'sari_site_visibility';
const EVENT = 'sari-visibility-changed';

/** Valeurs par défaut, identiques serveur et client. */
const ALL_DEFAULTS: Record<string, boolean> = {};
for (const g of VISIBILITY_GROUPS) for (const i of g.items) ALL_DEFAULTS[i.key] = i.defaultOn;

export function defaultVisibility(): Record<string, boolean> {
  return { ...ALL_DEFAULTS };
}

/**
 * Applique des exceptions sur les valeurs par défaut.
 *
 * Utilisable côté serveur comme côté client : c'est la seule façon de
 * transformer les données de l'API en dictionnaire complet.
 */
export function mergeVisibility(overrides?: Record<string, boolean> | null): Record<string, boolean> {
  const out: Record<string, boolean> = { ...ALL_DEFAULTS };
  if (!overrides) return out;
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ cache */

/**
 * Dernier état connu, alimenté par le serveur au premier rendu.
 *
 * Sans lui, chaque composant repartirait des valeurs par défaut le temps que
 * l'API réponde : un lien masqué apparaîtrait brièvement avant de disparaître.
 */
let current: Record<string, boolean> | null = null;
let currentLocale = '';

/** Renseigné par le fournisseur au montage, avec les données du serveur. */
export function primeVisibility(locale: string, overrides: Record<string, boolean>) {
  currentLocale = locale;
  current = mergeVisibility(overrides);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ locale, overrides }));
    } catch {
      /* quota ou navigation privée : le secours hors ligne est optionnel */
    }
  }
}

/** Exceptions mises de côté lors de la dernière visite, par langue. */
function readFallback(locale: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Ancien format : dictionnaire à plat, toutes langues confondues.
    if (parsed && typeof parsed === 'object' && !('overrides' in parsed)) {
      return parsed as Record<string, boolean>;
    }
    if (parsed?.locale && parsed.locale !== locale) return {};
    return (parsed?.overrides as Record<string, boolean>) || {};
  } catch {
    return {};
  }
}

/** État courant : le serveur s'il a répondu, sinon le secours, sinon les défauts. */
export function loadVisibility(locale?: string): Record<string, boolean> {
  if (current) return { ...current };
  return mergeVisibility(readFallback(locale || currentLocale));
}

export function isEnabled(key: string): boolean {
  return loadVisibility()[key] !== false;
}

/* ------------------------------------------------------------------- API */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
).replace(/\/$/, '');

/**
 * Réglages d'une langue, lus depuis l'API.
 *
 * L'implémentation vit dans `lib/visibility-server.ts`, sans directive
 * `'use client'`, pour rester appelable depuis un composant serveur ; on la
 * réexporte ici par commodité pour le code client.
 */
import { fetchVisibility } from './visibility-server';

export { fetchVisibility };

/* ------------------------------------------------------------- mutations */

/** Jeton d'administration, posé par le contexte d'authentification. */
function adminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('sari_admin_access') || '';
  } catch {
    return '';
  }
}

async function push(locale: string, path: string, body: unknown, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(adminToken() ? { authorization: `Bearer ${adminToken()}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.message || `HTTP ${res.status}`);
  }
  const payload = await res.json().catch(() => ({}));
  const value = payload?.data ?? payload;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    primeVisibility(locale, value as Record<string, boolean>);
  }
  notify();
  return value;
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
}

/** Bascule une clé pour UNE langue. */
export async function setVisibility(locale: string, key: string, on: boolean) {
  return push(locale, `/visibility/${encodeURIComponent(locale)}`, { key, on }, 'PATCH');
}

/** Bascule tout un groupe pour UNE langue. */
export async function setVisibilityGroup(locale: string, groupKey: string, on: boolean) {
  const group = VISIBILITY_GROUPS.find((g) => g.key === groupKey);
  if (!group) return;
  const overrides = { ...loadVisibility(locale) };
  for (const item of group.items) overrides[item.key] = on;
  return push(locale, `/visibility/${encodeURIComponent(locale)}`, { overrides });
}

/** Rétablit les valeurs par défaut pour UNE langue. */
export async function resetVisibility(locale: string) {
  const res = await fetch(`${API_BASE}/visibility/${encodeURIComponent(locale)}`, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      ...(adminToken() ? { authorization: `Bearer ${adminToken()}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  primeVisibility(locale, {});
  notify();
}

/** Copie les réglages d'une langue vers les autres. */
export async function copyVisibility(from: string, to?: string[]) {
  const res = await fetch(`${API_BASE}/visibility/copy/all`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(adminToken() ? { authorization: `Bearer ${adminToken()}` } : {}),
    },
    body: JSON.stringify({ from, ...(to?.length ? { to } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.message || `HTTP ${res.status}`);
  }
  notify();
  return res.json().catch(() => ({}));
}

/** Réglages de toutes les langues, pour l'écran d'administration. */
export async function fetchAllVisibility(locales: string[]): Promise<Record<string, Record<string, boolean>>> {
  const out: Record<string, Record<string, boolean>> = {};
  await Promise.all(locales.map(async (l) => { out[l] = await fetchVisibility(l); }));
  return out;
}

/* ------------------------------------------------------------------ hook */

/**
 * Hook réactif.
 *
 * La signature est inchangée — un dictionnaire complet clé → booléen — pour
 * que les composants existants n'aient rien à modifier. La donnée provient
 * désormais du serveur, injectée par `VisibilityProvider` avant le premier
 * rendu : il n'y a donc pas de scintillement.
 */
export function useVisibility(): Record<string, boolean> {
  const [state, setState] = useState<Record<string, boolean>>(() => loadVisibility());

  useEffect(() => {
    setState(loadVisibility());
    const refresh = () => setState(loadVisibility());
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return state;
}
