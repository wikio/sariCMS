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
 * Deux pièges, tous deux dus au fait qu'en App Router une navigation vers la
 * même route avec un autre paramètre ne démonte PAS le composant : l'état React
 * et les refs survivent d'un clic à l'autre.
 *
 *  1. Mémoriser « déjà appliqué » par un simple booléen fige le premier choix :
 *     enchaîner deux catégories depuis le menu laissait la première active. On
 *     mémorise donc la valeur traitée, ce qui autorise chaque nouvelle valeur
 *     tout en laissant l'usager cliquer librement les onglets ensuite (l'URL ne
 *     change pas, donc rien ne le ramène de force à la catégorie d'origine).
 *
 *  2. La pagination survit elle aussi. Arriver sur une catégorie depuis la
 *     page 2 d'une liste plus longue affichait un écran vide : la tranche
 *     demandée dépassait le nombre de fiches filtrées. Le filtre doit donc
 *     remettre la pagination à la première page.
 *
 * La comparaison est insensible à la casse, aux espaces et à la forme Unicode
 * des accents (NFC/NFD), les valeurs venant de saisies libres sur les fiches.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

/** Clé de comparaison tolérante : casse, espaces et accents composés. */
function foldValue(value: string): string {
  return String(value).trim().toLowerCase().normalize('NFC');
}

export function useGroupFilter(
  param: 'category' | 'type',
  available: string[],
  apply: (value: string) => void,
  resetPage?: () => void,
) {
  const searchParams = useSearchParams();
  const raw = searchParams?.get(param) ?? '';

  // Dernière valeur d'URL traitée. `null` tant qu'aucune ne l'a été : une
  // chaîne vide est une valeur légitime (« aucun paramètre »).
  const handled = useRef<string | null>(null);

  // Les listes et fonctions passées par les pages sont recréées à chaque rendu.
  // Les garder dans des refs évite de redéclencher l'effet en boucle sans avoir
  // à exiger un useMemo/useCallback côté appelant.
  const availableRef = useRef(available);
  availableRef.current = available;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const resetPageRef = useRef(resetPage);
  resetPageRef.current = resetPage;

  useEffect(() => {
    const wanted = raw.trim();
    if (!wanted) return;
    // Valeur déjà traitée : ne pas écraser un choix fait depuis les onglets.
    if (handled.current === wanted) return;
    // La liste arrive après le chargement des fiches : sans elle, rien à
    // comparer, et marquer la valeur comme traitée la perdrait définitivement.
    const list = availableRef.current;
    if (!list.length) return;

    handled.current = wanted;

    const target = foldValue(wanted);
    const match = list.find((value) => foldValue(value) === target);
    // Une catégorie inconnue (fiche archivée, renommée) laisse la liste
    // complète plutôt qu'un écran vide sans explication.
    if (!match) return;

    applyRef.current(match);
    // Sans cela, arriver depuis la page 2 afficherait une tranche vide.
    resetPageRef.current?.();
  }, [raw, available]);
}
