'use client';

import { useEffect, useState } from 'react';
import { primeVisibility } from '@/lib/site-visibility';

/**
 * Injecte les réglages de visibilité lus côté serveur.
 *
 * Le rendu du serveur et la première passe du client doivent partir des mêmes
 * valeurs, sinon React signale une divergence d'hydratation et un lien masqué
 * clignote avant de disparaître. On amorce donc l'état de façon synchrone,
 * pendant le rendu, avant que le moindre composant ne lise `useVisibility()`.
 *
 * Les réglages dépendent de la langue : changer de langue réamorce l'état.
 */
export default function VisibilityProvider({
  locale,
  overrides,
  children,
}: {
  locale: string;
  overrides: Record<string, boolean>;
  children: React.ReactNode;
}) {
  // Amorçage synchrone : `useState` n'exécute son initialiseur qu'une fois,
  // avant le premier rendu des enfants.
  useState(() => {
    primeVisibility(locale, overrides);
    return null;
  });

  useEffect(() => {
    primeVisibility(locale, overrides);
  }, [locale, overrides]);

  return <>{children}</>;
}
