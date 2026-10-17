'use client';

import type { CSSProperties } from 'react';
import { getLucideIcon } from '@/lib/lucide-icons';

/**
 * Rend une icône Lucide à partir de son nom stocké en base.
 *
 * - `style` / `color` sont transmis à l'icône : la vitrine peut donc appliquer
 *   la couleur de la fiche (module Solutions…) sans passer par les variables
 *   d'admin.
 * - Par défaut on hérite de `currentColor` : hors admin, `var(--ad-accent)`
 *   n'existe pas et l'icône devenait invisible / noire.
 */
export default function IconMark({
  name,
  className = 'w-4 h-4',
  showLabel = false,
  color,
  style,
  strokeWidth = 2,
  fallback,
}: {
  name?: string | null;
  className?: string;
  showLabel?: boolean;
  color?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Icône utilisée quand `name` est vide (ex. 'package'). */
  fallback?: string;
}) {
  const resolvedName = String(name || '').trim() || fallback || '';
  const Icon = getLucideIcon(resolvedName);

  if (!resolvedName) return showLabel ? <span>—</span> : null;

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Icon
        className={className}
        strokeWidth={strokeWidth}
        style={{ color: color ?? 'currentColor', flexShrink: 0, ...style }}
      />
      {showLabel && <span className="font-mono text-sm">{name}</span>}
    </span>
  );
}
