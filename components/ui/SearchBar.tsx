// components/ui/SearchBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium' | 'large';
  showButton?: boolean;
  autoFocus?: boolean;
}

export default function SearchBar({
  value = '',
  onChange,
  onSearch,
  placeholder,
  size = 'medium',
  showButton = true,
  autoFocus = false,
}: SearchBarProps) {
  const t = useTranslations('components.ui.SearchBar');
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(localValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (onChange) onChange(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
    if (onChange) onChange('');
  };

  const sizes = {
    small: 'py-2 px-4 text-sm',
    medium: 'py-3 px-4 text-base',
    large: 'py-4 px-6 text-lg',
  };

  // ✅ Placeholder traduit (utilise la prop si fournie, sinon la traduction)
  const displayPlaceholder = placeholder || t('placeholder');

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={displayPlaceholder}
          autoFocus={autoFocus}
          className={`w-full ${sizes[size]} pl-12 pr-12 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-[#1a1a1a] text-sari-dark dark:text-white placeholder-gray-400 focus:border-sari-blue focus:ring-2 focus:ring-sari-blue/20 outline-none transition-all`}
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-16 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label={t('clear')}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
        {showButton && (
          <button
            type="submit"
            className="absolute right-2 bg-sari-blue text-white px-4 py-2 rounded-lg hover:bg-sari-blue/90 transition-colors font-semibold"
          >
            {t('searchButton')}
          </button>
        )}
      </div>
    </form>
  );
}