// components/shared/Avatar.tsx
'use client';

import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  showBorder?: boolean;
}

export default function Avatar({
  src,
  alt = '',
  name = '',
  size = 'medium',
  status = null,
  showBorder = false
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizes = {
    small: 'w-8 h-8 text-xs',
    medium: 'w-12 h-12 text-base',
    large: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500'
  };

  const statusSizes = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4',
    xl: 'w-5 h-5'
  };

  const getInitials = () => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getBgColor = () => {
    const colors = [
      'bg-sari-blue', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-green-500', 'bg-yellow-500'
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const showImage = src && !imageError;

  return (
    <div className="relative inline-block">
      {showImage && (
        <img
          src={src}
          alt={alt || name}
          className={`${sizes[size]} rounded-full object-cover ${showBorder ? 'border-2 border-sari-blue' : ''}`}
          onError={() => setImageError(true)}
        />
      )}
      <div
        className={`${sizes[size]} rounded-full ${getBgColor()} text-white font-bold flex items-center justify-center ${showBorder ? 'border-2 border-sari-blue' : ''}`}
        style={{ display: showImage ? 'none' : 'flex' }}
      >
        {getInitials()}
      </div>
      {status && (
        <span className={`absolute bottom-0 right-0 ${statusSizes[size]} ${statusColors[status]} rounded-full border-2 border-white dark:border-[#1a1a1a]`}></span>
      )}
    </div>
  );
}