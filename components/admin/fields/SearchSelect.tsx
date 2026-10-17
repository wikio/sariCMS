'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Ligne secondaire (code, e-mail, description courte). */
  hint?: string;
}

/**
 * Liste déroulante avec recherche, au style du back-office.
 *
 * Distinct de `AutocompleteSelect` (qui prend un tableau de chaînes et sait
 * créer une valeur) : celui-ci travaille sur des options `{value, label, hint}`
 * afin d'afficher un libellé traduit tout en enregistrant un code stable —
 * indispensable pour les rôles, les types de compte ou les wilayas.
 *
 * Les `<select>` natifs deviennent inutilisables au-delà d'une trentaine
 * d'entrées : ni recherche, ni description. Ce composant filtre à la frappe,
 * se pilote au clavier et affiche un libellé secondaire.
 *
 * Deux modes :
 * - `strict` (défaut) : seule une valeur de la liste est retenue ;
 * - `allowFree` : la saisie libre est conservée, pour les référentiels
 *   incomplets où l'on ne veut pas bloquer l'utilisateur.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = '',
  emptyLabel = 'Aucun résultat',
  allowFree = false,
  allowEmpty = true,
  error = false,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  allowFree?: boolean;
  allowEmpty?: boolean;
  error?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const selection = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  // En mode strict le champ affiche le libellé de l'option ; en saisie libre
  // il affiche la valeur brute, seule information dont on dispose.
  const affichage = selection ? selection.label : allowFree ? value : '';
  const [query, setQuery] = useState(affichage);
  const [open, setOpen] = useState(false);
  const [surbrillance, setSurbrillance] = useState(0);
  // Sens d'ouverture : vers le bas par défaut, vers le haut s'il manque la
  // place. Les champs pays et wilaya sont en bas d'un formulaire défilant, et
  // leur liste se retrouvait tronquée par le bord de la fenêtre modale.
  const [versLeHaut, setVersLeHaut] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(affichage); }, [affichage]);

  useEffect(() => {
    if (!open || !conteneur.current) return;
    const placer = () => {
      const cadre = conteneur.current?.getBoundingClientRect();
      if (!cadre) return;
      const hauteurListe = 264; // 16 rem de liste + marge
      const dessous = window.innerHeight - cadre.bottom;
      // On n'ouvre vers le haut que si le dessus offre réellement mieux.
      setVersLeHaut(dessous < hauteurListe && cadre.top > dessous);
    };
    placer();
    window.addEventListener('resize', placer);
    // `capture` : le défilement se produit dans le corps de la modale, pas
    // sur la fenêtre, et un écouteur simple ne le verrait pas.
    window.addEventListener('scroll', placer, true);
    return () => {
      window.removeEventListener('resize', placer);
      window.removeEventListener('scroll', placer, true);
    };
  }, [open]);

  // Fermeture au clic extérieur : sans cela la liste reste ouverte au-dessus
  // du reste du formulaire et masque les champs suivants.
  useEffect(() => {
    if (!open) return;
    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(affichage);
      }
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [open, affichage]);

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Une fois la valeur choisie, le champ contient son libellé : sans ce
    // test la liste se réduirait à la seule option déjà sélectionnée.
    if (!q || q === affichage.toLowerCase()) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || (o.hint || '').toLowerCase().includes(q),
    );
  }, [options, query, affichage]);

  const choisir = (opt: SearchSelectOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const auClavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setSurbrillance((i) => {
        const n = filtrees.length;
        if (!n) return 0;
        return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      });
      return;
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault();
      const opt = filtrees[surbrillance];
      if (opt) choisir(opt);
      else if (allowFree) { onChange(query.trim()); setOpen(false); }
      return;
    }
    if (e.key === 'Escape') { setOpen(false); setQuery(affichage); }
  };

  return (
    <div className="relative" ref={conteneur}>
      {/*
        `ad-affix` gère le décalage du texte par propriétés logiques : en arabe
        l'icône passe à droite et le remplissage suit, là où un décalage figé
        laissait l'icône chevaucher le texte saisi.
        `end-2` réserve la place du chevron et de la coche de validation.
      */}
      <div className={`ad-affix has-start ${selection ? 'end-2' : 'end-1'}`}>
        <span className="ad-affix-start">
          <Search className="w-4 h-4" />
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className="ad-input"
          style={error ? { borderColor: 'var(--ad-danger, #dc2626)' } : undefined}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSurbrillance(0);
            // En saisie libre la frappe vaut valeur : le formulaire reste
            // cohérent même si l'utilisateur ne choisit aucune suggestion.
            if (allowFree) onChange(e.target.value);
            else if (!e.target.value && allowEmpty) onChange('');
          }}
          onKeyDown={auClavier}
        />
        <span className="ad-affix-end">
          {selection && <Check className="w-4 h-4" style={{ color: 'var(--ad-ok)' }} />}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--ad-muted)' }}
          />
        </span>
      </div>

      {open && (
        <div
          role="listbox"
          className={`absolute z-40 left-0 right-0 ad-card ad-options ad-scroll ${versLeHaut ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {allowEmpty && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm italic hover:bg-[var(--ad-surface-2)]"
              style={{ color: 'var(--ad-muted)' }}
              onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
            >
              —
            </button>
          )}
          {filtrees.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                i === surbrillance ? 'bg-[var(--ad-surface-2)]' : 'hover:bg-[var(--ad-surface-2)]'
              }`}
              onMouseEnter={() => setSurbrillance(i)}
              onClick={() => choisir(opt)}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{opt.label}</span>
                {opt.hint && (
                  <span className="block truncate text-xs" style={{ color: 'var(--ad-muted)' }}>{opt.hint}</span>
                )}
              </span>
              {opt.value === value && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--ad-ok)' }} />}
            </button>
          ))}
          {filtrees.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--ad-muted)' }}>
              {emptyLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
