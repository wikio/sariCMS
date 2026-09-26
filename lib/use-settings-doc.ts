// lib/use-settings-doc.ts
'use client';

import { useEffect, useRef } from 'react';
import { DOC_EVENT, type DocKind } from '@/lib/settings-doc';

/**
 * Relit un magasin de réglages chaque fois que la base en change.
 *
 * Le geste qui manque à un écran de réglages est toujours le même, et il coûte
 * cher à voir : `useEffect(() => setRows(loadX()), [])` copie le `localStorage`
 * dans un `useState` **une** fois, au montage. Or l'amorçage
 * (`AdminLayout` → `hydrateDocs()`) arrive juste après — sur un poste neuf, le
 * cache est vide à ce moment-là, et l'écran reste vide alors que la base est
 * pleine. Pire dans l'autre sens : l'écran affiche ce que le navigateur contenait,
 * l'opérateur enregistrera par-dessus la configuration d'un collègue.
 *
 * Un seul hook pour tous les écrans de réglages, pour la raison écrite dans
 * `lib/settings-doc.ts` à propos de `syncDoc()` : cinq écrans qui s'abonnent
 * chacun de leur côté, c'est un écran qui ne le fait pas.
 */
export function useDocRefresh(kind: DocKind, refresh: () => void): void {
  // La callback est gardée dans une référence : un écran recrée sa fonction à
  // chaque rendu, et la revérifier dans les dépendances désabonnerait/resabonnerait
  // l'écouteur à chaque frappe de clavier.
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: DocKind }>).detail;
      // Sans `kind`, l'événement est général : tout le monde relit.
      if (!detail?.kind || detail.kind === kind) latest.current();
    };
    window.addEventListener(DOC_EVENT, handler);
    return () => window.removeEventListener(DOC_EVENT, handler);
  }, [kind]);
}
