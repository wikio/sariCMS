'use client';

import { useState } from 'react';
import { Calendar, Image as ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackIcon?: 'calendar' | 'image';
  fallbackClassName?: string;
  placeholderSize?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Composant d'image avec gestion automatique des erreurs et placeholders
 * Affiche une icône de remplacement si l'image est manquante ou ne peut pas être chargée
 */
export default function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackIcon = 'image',
  fallbackClassName = '',
  placeholderSize = 'md',
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  // Si pas de source ou erreur de chargement, afficher le placeholder
  if (!src || hasError) {
    const Icon = fallbackIcon === 'calendar' ? Calendar : ImageIcon;
    
    // Tailles des icônes selon placeholderSize
    const iconSizes = {
      sm: 'w-8 h-8',
      md: 'w-16 h-16',
      lg: 'w-24 h-24',
      xl: 'w-32 h-32',
    };

    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 text-gray-400 dark:text-gray-600 ${className} ${fallbackClassName}`}
        role="img"
        aria-label={alt}
      >
        <Icon className={iconSizes[placeholderSize]} />
      </div>
    );
  }

  // Afficher l'image normale
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
