/**
 * Appels du studio « Page d'accueil » côté navigateur.
 *
 * Tout passe par la passerelle `/api/admin/home` : elle porte le jeton
 * d'administration vers le CMS, retombe sur les fichiers du projet quand le CMS
 * ne répond pas, et dit dans les deux cas où elle a écrit (`stored`). Un écran
 * qui parlerait directement à l'API perdrait ce mode secours.
 */
'use client';

import { readAdminAccess } from '@/lib/admin-session';
import type { HomeSectionConfig, HomeSectionKey, HomeSections } from './config';
import type { HomeOption, HomeOptionResource } from './config';

export interface HomeSnapshot {
  locale: string;
  ref: string;
  api: boolean;
  stored: 'api' | 'local';
  order: HomeSectionKey[];
  sections: HomeSections;
  /** Blocs dont le contenu vient des fichiers du site, non encore enregistrés. */
  seeded?: HomeSectionKey[];
}

async function json<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((payload as { message?: string; error?: string } | null)?.message
      || (payload as { error?: string } | null)?.error
      || `Erreur ${res.status}`);
  }
  return payload as T;
}

function headers(): HeadersInit {
  const token = readAdminAccess();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchHome(locale: string): Promise<HomeSnapshot> {
  const res = await fetch(`/api/admin/home?locale=${encodeURIComponent(locale)}`, {
    headers: headers(),
    cache: 'no-store',
  });
  return json<HomeSnapshot>(res);
}

export async function saveHomeSection(input: {
  key: HomeSectionKey;
  locale: string;
  config: HomeSectionConfig;
}): Promise<{ stored: 'api' | 'local'; section: HomeSectionConfig }> {
  const res = await fetch('/api/admin/home', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(input),
  });
  return json(res);
}

export async function homeAction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/admin/home', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  return json(res);
}

export function reorderHome(locale: string, order: HomeSectionKey[]) {
  return homeAction({ action: 'reorder', locale, order });
}

export function copyHome(input: { from: string; to: string[]; key?: HomeSectionKey; withTexts?: boolean }) {
  return homeAction({ action: 'copy', ...input });
}

export function resetHome(key: HomeSectionKey, locale: string) {
  return homeAction({ action: 'reset', key, locale });
}

/**
 * « Reprendre le contenu du site » : copie les textes, éléments et sélections
 * lus dans `data/{langue}/*.json` et les traductions vers la configuration
 * enregistrée du bloc. Sans `keys`, tous les blocs concernés sont importés.
 */
export async function importHomeLegacy(input: {
  locale: string;
  keys?: HomeSectionKey[];
  force?: boolean;
}): Promise<{ stored: 'api' | 'local'; imported: HomeSectionKey[]; skipped: HomeSectionKey[] }> {
  const res = await fetch('/api/admin/home', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action: 'import', ...input }),
  });
  return json(res);
}

const optionsCache = new Map<string, { at: number; options: HomeOption[] }>();

/**
 * Liste de fiches pour un sélecteur.
 *
 * Mise en cache courte (30 s) : le studio rouvre souvent le même sélecteur
 * d'un bloc à l'autre, et l'administrateur n'attend pas de voir arriver ici la
 * fiche créée il y a deux heures dans un autre onglet.
 */
export async function fetchHomeOptions(resource: HomeOptionResource, locale: string): Promise<HomeOption[]> {
  const key = `${resource}:${locale}`;
  const hit = optionsCache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.options;
  const res = await fetch(`/api/admin/home/options?resource=${resource}&locale=${encodeURIComponent(locale)}`, {
    headers: headers(),
    cache: 'no-store',
  });
  const payload = await json<{ options?: HomeOption[] }>(res);
  const options = Array.isArray(payload.options) ? payload.options : [];
  optionsCache.set(key, { at: Date.now(), options });
  return options;
}

export function invalidateHomeOptions(resource?: string) {
  if (!resource) optionsCache.clear();
  else for (const key of [...optionsCache.keys()]) if (key.startsWith(`${resource}:`)) optionsCache.delete(key);
}
