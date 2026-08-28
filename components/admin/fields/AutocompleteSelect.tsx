'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Check } from 'lucide-react';

interface AutocompleteSelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
  placeholder?: string;
  allowCreate?: boolean;
  onCreateNew?: (value: string) => void;
  required?: boolean;
}

/**
 * Composant AutocompleteSelect avec recherche et création de nouvelles valeurs
 */
export default function AutocompleteSelect({
  value,
  onChange,
  label,
  options,
  placeholder = 'Rechercher ou créer...',
  allowCreate = true,
  onCreateNew,
  required = false,
}: AutocompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtrer les options selon la recherche
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Vérifier si la valeur actuelle existe dans les options
  const valueExists = options.includes(value);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gérer la navigation au clavier
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (allowCreate && searchQuery && !valueExists) {
          handleCreate();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreate = () => {
    if (searchQuery.trim()) {
      const newValue = searchQuery.trim();
      onChange(newValue);
      if (onCreateNew) {
        onCreateNew(newValue);
      }
      setSearchQuery('');
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        {/* Input de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchQuery : value}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value || placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sari-blue focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {/* Options filtrées */}
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-2 text-left flex items-center justify-between transition-colors ${
                      highlightedIndex === index
                        ? 'bg-sari-blue text-white'
                        : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                    } ${option === value ? 'font-semibold' : ''}`}
                  >
                    <span>{option}</span>
                    {option === value && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Option de création */}
            {allowCreate && searchQuery && !valueExists && (
              <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full px-4 py-2 text-left flex items-center gap-2 text-sari-blue hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Créer "{searchQuery}"
                  </span>
                </button>
              </div>
            )}

            {/* Message si aucun résultat */}
            {filteredOptions.length === 0 && (!allowCreate || !searchQuery) && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {searchQuery ? 'Aucun résultat' : 'Aucune option disponible'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
