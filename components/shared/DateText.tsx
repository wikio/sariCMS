// components/shared/DateText.tsx
'use client';

import { useDateFormat } from '@/lib/use-date-format';

interface DateTextProps {
  /** Valeur à afficher : ISO, horodatage, `Date`, ou texte libre hérité. */
  value: unknown;
  /** Masque l'heure même si la valeur en comporte une. */
  dateOnly?: boolean;
  /** N'affiche que l'heure (flux d'activité du jour). */
  timeOnly?: boolean;
  /** Texte affiché lorsque la valeur est vide ou illisible. */
  fallback?: string;
}

/**
 * Affiche une date selon le format choisi dans « Paramètres → Dates & heures ».
 *
 * Composant plutôt que simple fonction : le format vit dans un hook, et un
 * composant reste utilisable dans un `.map()` ou une branche conditionnelle,
 * là où un hook ne le serait pas.
 */
export default function DateText({ value, dateOnly, timeOnly, fallback = '—' }: DateTextProps) {
  const { format } = useDateFormat();
  return <>{format(value, { dateOnly, timeOnly, fallback })}</>;
}
