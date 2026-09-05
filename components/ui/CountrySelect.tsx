'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { COUNTRIES, countryName, findCountry, searchCountries, type Country } from '@/lib/countries';

/**
 * Champ pays avec autocomplétion.
 *
 * Un simple champ texte laissait passer « Algerie », « algérie », « DZ » ou
 * une faute de frappe : autant de valeurs différentes pour un même pays,
 * impossibles à exploiter ensuite. Ici la saisie filtre une liste et la
 * valeur retenue est un nom normalisé.
 *
 * La saisie libre reste acceptée pour les pays absents de la liste : le champ
 * guide sans bloquer. `onValidChange` indique si la valeur correspond à une
 * entrée connue, ce qui permet au formulaire d'exiger une correspondance.
 */
export default function CountrySelect({
  value,
  onChange,
  onValidChange,
  placeholder = '',
  error = false,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const locale = useLocale();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [surbrillance, setSurbrillance] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  // La valeur peut changer depuis le parent (chargement d'un brouillon).
  useEffect(() => { setQuery(value || ''); }, [value]);

  const resultats = useMemo(() => searchCountries(query, locale), [query, locale]);
  const connu = useMemo(() => findCountry(query), [query]);

  useEffect(() => { onValidChange?.(Boolean(connu)); }, [connu, onValidChange]);

  // Fermeture au clic extérieur : sans cela le menu resterait ouvert.
  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, []);

  const choisir = (c: Country) => {
    const nom = countryName(c, locale);
    setQuery(nom);
    onChange(nom);
    setOpen(false);
  };

  const clavier = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSurbrillance((i) => Math.min(i + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSurbrillance((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && resultats[surbrillance]) {
      e.preventDefault();
      choisir(resultats[surbrillance]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={conteneur} className="relative">
      <div className="relative">
        <input
          id={id}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="country-name"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setSurbrillance(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={clavier}
          className={`w-full px-4 py-3 pr-10 border rounded-lg outline-none transition-colors dark:bg-[#111111] dark:text-white ${
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-sari-blue'
          } ${disabled ? 'opacity-60' : ''}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {connu && <Check className="w-4 h-4 text-green-500" />}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && resultats.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
        >
          {resultats.map((c, i) => {
            const nom = countryName(c, locale);
            return (
              <li key={c.code} role="option" aria-selected={i === surbrillance}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choisir(c)}
                  onMouseEnter={() => setSurbrillance(i)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                    i === surbrillance
                      ? 'bg-sari-blue/10 text-sari-blue'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  <span className="flex-1">{nom}</span>
                  <span className="text-[10px] font-mono opacity-50">{c.code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && resultats.length === 0 && query.trim() && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-500">
          {COUNTRIES.length > 0 && 'Aucun pays ne correspond — la saisie libre est acceptée.'}
        </div>
      )}
    </div>
  );
}
