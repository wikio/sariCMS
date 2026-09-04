'use client';

/**
 * Présélection d'un filtre de liste depuis l'URL.
 *
 * Les sous-menus générés en mode « catégories » pointent vers la page de liste
 * du module avec un paramètre : `/fr/news?category=Santé`,
 * `/fr/events?type=Congrès`. Sans lecture de ce paramètre, ces liens seraient
 * inertes — la page s'ouvrirait sur la liste complète, et le visiteur ne
 * comprendrait pas pourquoi son clic n'a rien filtré.
 *
 * Le paramètre est appliqué une seule fois, à l'arrivée sur la page : l'usager
 * doit rester libre de changer de catégorie ensuite sans que l'URL le ramène de
 * force à celle d'origine. La comparaison est insensible à la casse et aux
 * espaces, les valeurs venant de saisies libres sur les fiches.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export function useGroupFilter(
  param: 'category' | 'type',
  available: string[],
  apply: (value: string) => void,
) {
  const searchParams = useSearchParams();
  const raw = searchParams?.get(param) ?? '';
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const wanted = raw.trim();
    if (!wanted) return;
    // On attend que la liste soit chargée, sinon rien à faire correspondre.
    if (!available.length) return;

    const match = available.find(
      (value) => String(value).trim().toLowerCase() === wanted.toLowerCase(),
    );
    applied.current = true;
    // Une catégorie inconnue (fiche archivée, renommée) laisse la liste
    // complète plutôt qu'un écran vide sans explication.
    if (match) apply(match);
  }, [raw, available, apply]);
}
