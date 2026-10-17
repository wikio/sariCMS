'use client';

import { useEffect, useState } from 'react';

/**
 * Visibilité de la vitrine : permet de masquer/afficher des menus, pages,
 * modules, sections, boutons et actions depuis l'admin (sans toucher au code).
 * Les valeurs sont stockées en localStorage (clé `sari_site_visibility`).
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

const KEY = 'sari_site_visibility';
const EVENT = 'sari-visibility-changed';

const ALL_DEFAULTS: Record<string, boolean> = {};
for (const g of VISIBILITY_GROUPS) for (const i of g.items) ALL_DEFAULTS[i.key] = i.defaultOn;

function readOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function loadVisibility(): Record<string, boolean> {
  const overrides = readOverrides();
  const out: Record<string, boolean> = { ...ALL_DEFAULTS };
  for (const [k, v] of Object.entries(overrides)) out[k] = Boolean(v);
  return out;
}

export function isEnabled(key: string): boolean {
  return loadVisibility()[key] !== false;
}

export function setVisibility(key: string, on: boolean) {
  const overrides = readOverrides();
  overrides[key] = on;
  localStorage.setItem(KEY, JSON.stringify(overrides));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function setVisibilityGroup(groupKey: string, on: boolean) {
  const group = VISIBILITY_GROUPS.find((g) => g.key === groupKey);
  if (!group) return;
  const overrides = readOverrides();
  for (const item of group.items) overrides[item.key] = on;
  localStorage.setItem(KEY, JSON.stringify(overrides));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function resetVisibility() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Hook réactif : re-rend à chaque modification (même onglet + onglets distants).
 *  SSR-safe : retourne les valeurs par défaut au premier rendu (serveur + hydration),
 *  puis charge localStorage après le montage pour éviter les mismatches. */
export function useVisibility(): Record<string, boolean> {
  // Initialiser avec les défauts (identiques serveur/client → pas de mismatch)
  const [state, setState] = useState<Record<string, boolean>>(() => ({ ...ALL_DEFAULTS }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Après le montage, charger les overrides localStorage et mettre à jour
    setMounted(true);
    setState(loadVisibility());

    const refresh = () => setState(loadVisibility());
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Pendant SSR + hydration : retourner les défauts ; après montage : l'état réel
  return mounted ? state : { ...ALL_DEFAULTS };
}
