'use client';

import { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className = '',
  onSubmit,
  showSubmit = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  showSubmit?: boolean;
}) {
  const t = useTranslations('admin.common');
  
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    onSubmit?.();
  };

  return (
    <form className={`ad-search-bar ${className}`.trim()} onSubmit={submit}>
      <div className="ad-search">
        <Search className="ad-search-ico w-4 h-4" />
        <input
          className="ad-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
        />
      </div>
      {showSubmit && (
        <>
          <button type="submit" className="ad-btn ad-btn-primary shrink-0">
            <Search className="w-4 h-4" /> {t('searchBtn')}
          </button>
          <p className="ad-search-hint">{t('searchHint')}</p>
        </>
      )}
    </form>
  );
}
