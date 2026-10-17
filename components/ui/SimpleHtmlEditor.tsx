'use client';

import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Underline, Eraser } from 'lucide-react';

/**
 * Éditeur HTML léger, pour les champs de texte libre côté client.
 *
 * L'éditeur riche de l'administration (TipTap) apporte tableaux, images et
 * variables de fusion : c'est disproportionné pour une note de devis, et cela
 * chargerait plusieurs centaines de kilo-octets sur la vitrine. On s'appuie
 * donc sur `contentEditable` et un jeu volontairement restreint de mises en
 * forme : gras, italique, souligné, listes.
 *
 * Le HTML produit est nettoyé à la saisie : seules les balises de la liste
 * blanche survivent, sans attribut. Un contenu collé depuis un traitement de
 * texte n'introduit donc ni style, ni script, ni balise inattendue.
 */

/** Balises conservées. Tout le reste est réduit à son texte. */
const BALISES_AUTORISEES = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P', 'DIV']);

/**
 * Retire tout ce qui n'est pas dans la liste blanche, ainsi que les attributs.
 *
 * Le nettoyage s'appuie sur `DOMParser` plutôt que sur des expressions
 * régulières : le HTML collé est souvent mal formé, et une regex y laisse
 * passer des cas limites.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const racine = doc.body.firstElementChild;
  if (!racine) return '';

  const parcourir = (node: Element) => {
    for (const enfant of Array.from(node.children)) {
      parcourir(enfant);
      if (!BALISES_AUTORISEES.has(enfant.tagName)) {
        // Remplace la balise par son contenu, sans perdre le texte.
        enfant.replaceWith(...Array.from(enfant.childNodes));
      } else {
        for (const attr of Array.from(enfant.attributes)) {
          enfant.removeAttribute(attr.name);
        }
      }
    }
  };
  parcourir(racine);
  return racine.innerHTML;
}

/** Texte brut, pour compter les caractères réellement saisis. */
export function htmlToText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}

export default function SimpleHtmlEditor({
  value,
  onChange,
  placeholder = '',
  rows = 6,
  maxLength,
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false);

  /*
   * On ne réécrit le DOM que si la valeur diffère réellement.
   * Réassigner `innerHTML` à chaque frappe replacerait le curseur au début.
   */
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || '';
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(sanitizeHtml(el.innerHTML));
  };

  const commande = (cmd: string) => {
    if (disabled) return;
    ref.current?.focus();
    // `execCommand` est officiellement déprécié mais reste la seule API
    // universellement disponible pour ce type d'édition sans dépendance.
    document.execCommand(cmd, false);
    emit();
  };

  const texte = htmlToText(value || '');
  const trop = typeof maxLength === 'number' && texte.length > maxLength;
  const vide = texte.length === 0;

  const boutons: Array<{ cmd: string; icon: typeof Bold; titre: string }> = [
    { cmd: 'bold', icon: Bold, titre: 'Gras' },
    { cmd: 'italic', icon: Italic, titre: 'Italique' },
    { cmd: 'underline', icon: Underline, titre: 'Souligné' },
    { cmd: 'insertUnorderedList', icon: List, titre: 'Liste à puces' },
    { cmd: 'insertOrderedList', icon: ListOrdered, titre: 'Liste numérotée' },
    { cmd: 'removeFormat', icon: Eraser, titre: 'Effacer la mise en forme' },
  ];

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        trop
          ? 'border-red-500'
          : focus
            ? 'border-sari-blue'
            : 'border-gray-300 dark:border-gray-700'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161616]">
        {boutons.map(({ cmd, icon: Icon, titre }) => (
          <button
            key={cmd}
            type="button"
            title={titre}
            aria-label={titre}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commande(cmd)}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:cursor-not-allowed"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        {typeof maxLength === 'number' && (
          <span className={`ml-auto text-[11px] ${trop ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
            {texte.length} / {maxLength}
          </span>
        )}
      </div>

      <div className="relative">
        {/*
          * `contentEditable` n'a pas d'attribut `placeholder` : on superpose un
          * texte, masqué dès que le contenu n'est plus vide.
          */}
        {vide && !focus && placeholder && (
          <div className="absolute inset-0 px-4 py-3 pointer-events-none text-gray-400 text-sm">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel || placeholder || 'Éditeur de texte'}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={() => { setFocus(false); emit(); }}
          onFocus={() => setFocus(true)}
          onPaste={(e) => {
            // Colle en texte brut : évite d'importer les styles du presse-papiers.
            e.preventDefault();
            const texteColle = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, texteColle);
          }}
          className="w-full px-4 py-3 outline-none text-sm dark:bg-[#111111] dark:text-white prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          style={{ minHeight: `${rows * 1.6}rem` }}
        />
      </div>
    </div>
  );
}
