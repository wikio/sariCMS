// components/shared/Rating.tsx
'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingProps {
  value?: number;
  max?: number;
  size?: 'small' | 'medium' | 'large';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (value: number) => void;
}

export default function Rating({
  value = 0,
  max = 5,
  size = 'medium',
  showValue = false,
  interactive = false,
  onChange
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;

  const sizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  const handleClick = (newValue: number) => {
    if (interactive && onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center">
        {[...Array(max)].map((_, i) => {
          const starValue = i + 1;
          const isFilled = starValue <= displayValue;
          const isHalf = !isFilled && starValue - 0.5 <= displayValue;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => interactive && setHoverValue(starValue)}
              onMouseLeave={() => interactive && setHoverValue(0)}
              className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
              disabled={!interactive}
            >
              <Star
                className={`${sizes[size]} ${
                  isFilled
                    ? 'text-sari-yellow fill-current'
                    : isHalf
                    ? 'text-sari-yellow fill-current opacity-50'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}