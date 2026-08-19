'use client';

import { Search } from 'lucide-react';

export default function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`ad-search ${className}`.trim()}>
      <Search className="ad-search-ico w-4 h-4" />
      <input
        className="ad-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
