// components/shared/Tag.tsx
'use client';

import { X } from 'lucide-react';

interface TagProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export default function Tag({
  children,
  onClick,
  active = false,
  removable = false,
  onRemove,
  icon = null,
  size = 'medium'
}: TagProps) {
  const sizes = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5'
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all ${sizes[size]} ${
        active 
          ? 'bg-sari-blue text-white shadow-md' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {icon && <span className={iconSizes[size]}>{icon}</span>}
      {children}
      {removable && onRemove && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5"
        >
          <X className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
        </span>
      )}
    </button>
  );
}