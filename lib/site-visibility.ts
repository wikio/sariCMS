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
  hint?: string;
  defaultOn: boolean;
}

export interface VisibilityGroup {
  key: string;
  label: string;
  items: VisibilityItem[];
}

export const VISIBILITY_GROUPS: VisibilityGroup[] = [
  {
    key: 'menus',
    label: 'Menus',
    items: [
      { key: 'menu.home', label: 'Accueil', defaultOn: true },
      { key: 'menu.about', label: 'À propos', defaultOn: true },
      { key: 'menu.solutions', label: 'Solutions', defaultOn: true },
      { key: 'menu.services', label: 'Services', defaultOn: true },
      { key: 'menu.products', label: 'Produits', defaultOn: true },
      { key: 'menu.events', label: 'Événements', defaultOn: true },
      { key: 'menu.news', label: 'Actualités', defaultOn: true },
      { key: 'menu.careers', label: 'Carrières', defaultOn: true },
      { key: 'menu.contact', label: 'Contact', defaultOn: true },
    ],
  },
  {
    key: 'footer',
    label: 'Pied de page',
    items: [
      { key: 'footer.about', label: 'À propos', defaultOn: true },
      { key: 'footer.solutions', label: 'Solutions', defaultOn: true },
      { key: 'footer.services', label: 'Services', defaultOn: true },
      { key: 'footer.products', label: 'Produits', defaultOn: true },
      { key: 'footer.news', label: 'Actualités', defaultOn: true },
      { key: 'footer.careers', label: 'Carrières', defaultOn: true },
      { key: 'footer.contact', label: 'Contact', defaultOn: true },
      { key: 'footer.mentions', label: 'Mentions légales', defaultOn: true },
      { key: 'footer.privacy', label: 'Confidentialité', defaultOn: true },
      { key: 'footer.conditions', label: 'Conditions d’utilisation', defaultOn: true },
      { key: 'footer.verification', label: 'Vérification', defaultOn: true },
    ],
  },
  {
    key: 'pages',
    label: 'Pages',
    items: [
      { key: 'page.about', label: 'À propos', defaultOn: true },
      { key: 'page.mentions', label: 'Mentions légales', defaultOn: true },
      { key: 'page.privacy', label: 'Politique de confidentialité', defaultOn: true },
      { key: 'page.conditions', label: 'CGV', defaultOn: true },
    ],
  },
  {
    key: 'modules',
    label: 'Modules vitrine',
    items: [
      { key: 'module.solutions', label: 'Solutions', defaultOn: true },
      { key: 'module.services', label: 'Services', defaultOn: true },
      { key: 'module.products', label: 'Catalogue produits', defaultOn: true },
      { key: 'module.events', label: 'Événements', defaultOn: true },
      { key: 'module.news', label: 'Actualités', defaultOn: true },
      { key: 'module.careers', label: 'Carrières', defaultOn: true },
      { key: 'module.contact', label: 'Contact', defaultOn: true },
    ],
  },
  {
    key: 'sections',
    label: 'Sections (page d’accueil)',
    items: [
      { key: 'section.hero', label: 'Bannière', defaultOn: true },
      { key: 'section.products', label: 'Produits à la une', defaultOn: true },
      { key: 'section.services', label: 'Services', defaultOn: true },
      { key: 'section.solutions', label: 'Solutions', defaultOn: true },
      { key: 'section.testimonials', label: 'Témoignages', defaultOn: true },
      { key: 'section.partners', label: 'Partenaires', defaultOn: true },
      { key: 'section.news', label: 'Actualités', defaultOn: true },
      { key: 'section.events', label: 'Événements', defaultOn: true },
    ],
  },
  {
    key: 'buttons',
    label: 'Boutons',
    items: [
      { key: 'button.addToCart', label: 'Ajouter au panier', defaultOn: true },
      { key: 'button.apply', label: 'Postuler', defaultOn: true },
      { key: 'button.contact', label: 'Contact / devis', defaultOn: true },
      { key: 'button.register', label: 'Inscription', defaultOn: true },
      { key: 'button.cart', label: 'Icône panier', defaultOn: true },
    ],
  },
  {
    key: 'actions',
    label: 'Actions',
    items: [
      { key: 'action.order', label: 'Commander (ajouter au panier)', defaultOn: true, hint: 'Masque le bloc quantité + ajout au panier.' },
      { key: 'action.apply', label: 'Postuler à une offre', defaultOn: true, hint: 'Masque le formulaire de candidature.' },
      { key: 'action.contact', label: 'Envoyer un message', defaultOn: true },
      { key: 'action.register', label: 'Créer un compte', defaultOn: true },
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

/** Hook réactif : re-rend à chaque modification (même onglet + onglets distants). */
export function useVisibility(): Record<string, boolean> {
  const [state, setState] = useState<Record<string, boolean>>(() => loadVisibility());
  useEffect(() => {
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
