/**
 * Lecture de la visibilité côté serveur.
 *
 * `lib/site-visibility.ts` porte la directive `'use client'` : ses fonctions
 * ne sont pas appelables depuis un composant serveur. Le layout a pourtant
 * besoin des réglages AVANT le premier rendu, sinon un lien masqué
 * apparaîtrait le temps que le client interroge l'API.
 *
 * Ce module, sans directive, est utilisable des deux côtés.
 */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1'
).replace(/\/$/, '');

/**
 * Exceptions enregistrées pour une langue.
 *
 * Retourne un objet vide si l'API est injoignable ou répond mal : la vitrine
 * applique alors ses valeurs par défaut, plutôt que de rendre une page en
 * erreur pour un simple réglage d'affichage.
 */
export async function fetchVisibility(locale: string): Promise<Record<string, boolean>> {
  try {
    const res = await fetch(
      `${API_BASE}/public/visibility?locale=${encodeURIComponent(locale)}`,
      { cache: 'no-store', headers: { accept: 'application/json' } },
    );
    if (!res.ok) return {};
    const body = await res.json();
    const value = body?.data ?? body;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    // On ne garde que des booléens : la valeur vient d'une colonne JSON.
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
