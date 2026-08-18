// components/shared/ImageWithFallback.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  className?: string;
  fallbackText?: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '2:1' | null;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export default function ImageWithFallback({
  src,
  alt = '',
  fallbackSrc = 'https://placehold.co/400x300?text=Image',
  className = '',
  fallbackText = 'Image',
  aspectRatio = null,
  objectFit = 'cover'
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('components.shared.ImageWithFallback');

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const aspectRatios = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '3:4': 'aspect-[3/4]',
    '2:1': 'aspect-[2/1]'
  };

  // ✅ Logique de traduction : si le texte est le défaut 'Image', on le traduit
  const displayText = fallbackText === 'Image'
    ? t('fallbackText')
    : fallbackText;

  return (
    <div className={`relative overflow-hidden ${aspectRatio ? aspectRatios[aspectRatio] : ''} ${className}`}>
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
      )}
      <img
        src={hasError ? fallbackSrc : src}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        className={`w-full h-full object-${objectFit} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center">
            <ImageOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <span className="text-xs text-gray-500">{displayText}</span>
          </div>
        </div>
      )}
    </div>
  );
}