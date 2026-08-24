// components/shared/VisibleSection.tsx
'use client';

import { useVisibility } from '@/lib/site-visibility';
import type { ReactNode } from 'react';

interface VisibleSectionProps {
  /** Clé de visibilité, ex : 'section.hero', 'module.products', 'page.about' */
  visibilityKey: string;
  children: ReactNode;
  /** Élément de remplacement quand masqué (par défaut : null) */
  fallback?: ReactNode;
}

/**
 * Enveloppe une section de la vitrine et la masque si la clé de visibilité
 * est désactivée dans l'admin (Visibilité vitrine).
 */
export default function VisibleSection({ visibilityKey, children, fallback = null }: VisibleSectionProps) {
  const visibility = useVisibility();
  if (visibility[visibilityKey] === false) return <>{fallback}</>;
  return <>{children}</>;
}
