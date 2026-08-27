// components/shared/LanguageSwitcher.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { translateSlug } from '@/lib/fiche-i18n';

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleLanguageChange = (newLocale: string) => {
    let newPathname = pathname;
    
    if (pathname === '/') {
      newPathname = `/${newLocale}`;
    } else if (pathname.startsWith(`/${locale}/`)) {
      // Extraire le chemin après la locale
      const pathWithoutLocale = pathname.replace(`/${locale}/`, '');
      const pathParts = pathWithoutLocale.split('/');
      
      // Ressources qui ont des slugs traduisibles
      const translatableResources = ['solutions', 'services', 'products', 'news', 'events'];
      
      // Vérifier si le premier segment est une ressource traduisible
      if (pathParts.length >= 2 && translatableResources.includes(pathParts[0])) {
        const resource = pathParts[0];
        const currentSlug = pathParts[1];
        
        // Traduire le slug
        const translatedSlug = translateSlug(resource, currentSlug, locale, newLocale);
        
        // Reconstruire le chemin avec le slug traduit
        pathParts[1] = translatedSlug;
        newPathname = `/${newLocale}/${pathParts.join('/')}`;
      } else {
        // Pas de slug à traduire, juste remplacer la locale
        newPathname = pathname.replace(`/${locale}/`, `/${newLocale}/`);
      }
    } else if (pathname === `/${locale}`) {
      newPathname = `/${newLocale}`;
    } else {
      newPathname = `/${newLocale}${pathname}`;
    }

    router.push(newPathname);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 text-gray-300 hover:text-sari-lime transition-colors bg-transparent border-0 cursor-pointer"
        aria-label={t('changeLanguage') || 'Changer de langue'}
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