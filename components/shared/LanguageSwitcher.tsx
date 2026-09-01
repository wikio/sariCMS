// components/shared/LanguageSwitcher.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { translateSlug } from '@/lib/fiche-i18n';
import { entityRouteKey, findByRouteKey, matchTranslation, routeId } from '@/lib/entity-url';
import { getEntityTranslations, getRoutableList } from '@/lib/data';

/**
 * Ressources dont le segment d'URL est un couple `id-slug` traduisible.
 * La valeur est le nom de la ressource CMS utilisée pour retrouver la
 * traduction du slug (clé `resource:id` du store fiche-i18n).
 */
const TRANSLATABLE_RESOURCES: Record<string, string> = {
  solutions: 'solutions',
  services: 'services',
  products: 'products',
  news: 'news',
  events: 'events',
  jobs: 'careers',
  careers: 'careers',
  partners: 'partners',
  content: 'pages',
  // `legal` est volontairement absent : /legal/{type} porte un type fixe
  // (mentions-legales, cgv…) identique dans toutes les langues, pas un id de
  // fiche. Le traduire produirait une URL inexistante.
};

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('components.shared.LanguageSwitcher');

  const languages = [
    { code: 'fr', label: t('french') || 'Français', flag: '🇫🇷' },
    { code: 'ar', label: t('arabic') || 'العربية', flag: '🇩🇿' },
    { code: 'en', label: t('english') || 'English', flag: '🇬🇧' }
  ];

  const currentLang = languages.find(l => l.code === locale) || languages[0];

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Traduit le segment `id-slug` d'une fiche vers la langue cible.
   *
   * Le point essentiel : chaque langue possède sa propre fiche, avec son propre
   * id. Conserver l'id d'origine mènerait à une fiche différente (ou à une 404)
   * dans la langue cible — c'est le défaut que cette fonction corrige.
   *
   * 1. Endpoint `/translations` : fiches sœurs reliées par `legacyId` (CMS).
   * 2. Comparaison des listes des deux langues (legacyId, puis id).
   * 3. À défaut, traduction du slug stockée dans la fiche i18n.
   * 4. En dernier recours on garde l'ID : la page sait toujours le résoudre.
   */
  const translateEntitySegment = async (
    resource: string,
    segment: string,
    targetLocale: string,
  ): Promise<string> => {
    const id = routeId(segment);

    // 1) Source de vérité : les versions linguistiques déclarées par l'API.
    try {
      const byLocale = await getEntityTranslations(resource, segment);
      const sibling = byLocale[targetLocale];
      if (sibling) return entityRouteKey(sibling);
    } catch {
      /* endpoint absent ou hors ligne → on continue */
    }

    // 2) Repli : rapprochement des listes des deux langues.
    try {
      const [current, target] = await Promise.all([
        getRoutableList(resource, locale),
        getRoutableList(resource, targetLocale),
      ]);
      if (target.length) {
        const source = findByRouteKey(current, segment);
        const match =
          matchTranslation(source, target) ||
          target.find((item) => String(item.id) === id);
        if (match) return entityRouteKey(match);
      }
    } catch {
      /* API indisponible → on passe au plan B */
    }

    // 3) Slug traduit enregistré dans la fiche i18n
    const translated = translateSlug(resource, segment, locale, targetLocale, id);
    if (translated && translated !== segment) {
      return /^\d+$/.test(id) ? `${id}-${translated}` : translated;
    }

    // 4) Fallback : ID seul (toujours résoluble), sinon segment inchangé
    return /^\d+$/.test(id) ? id : segment;
  };

  const handleLanguageChange = async (newLocale: string) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    try {
      let newPathname = pathname;

      if (pathname === '/' || pathname === `/${locale}`) {
        newPathname = `/${newLocale}`;
      } else if (pathname.startsWith(`/${locale}/`)) {
        const pathWithoutLocale = pathname.slice(`/${locale}/`.length);
        const pathParts = pathWithoutLocale.split('/');
        const resource = TRANSLATABLE_RESOURCES[pathParts[0]];

        if (resource && pathParts.length >= 2 && pathParts[1]) {
          pathParts[1] = await translateEntitySegment(resource, pathParts[1], newLocale);
        }

        newPathname = `/${newLocale}/${pathParts.join('/')}`;
      } else {
        newPathname = `/${newLocale}${pathname}`;
      }

      router.push(newPathname);
    } finally {
      setSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 text-gray-300 hover:text-sari-lime transition-colors bg-transparent border-0 cursor-pointer"
        aria-label={t('changeLanguage') || 'Changer de langue'}
        aria-expanded={isOpen}
        disabled={switching}
      >
        <Globe className="w-4 h-4 text-sari-lime" />
        <span className="text-sm font-semibold uppercase">{currentLang.code}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer en cliquant à l'extérieur */}
          <div className="fixed inset-0 z-[55]" onClick={() => setIsOpen(false)}></div>

          {/* Menu déroulant */}
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl z-[100] overflow-hidden rounded-lg">
            {languages.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleLanguageChange(l.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  locale === l.code
                    ? 'bg-sari-blue/10 text-sari-blue font-semibold'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <span>{l.label}</span>
                {locale === l.code && <Check className="w-4 h-4 ml-auto text-sari-blue" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
