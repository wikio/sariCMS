// components/admin/AdminLanguageSwitcher.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

export default function AdminLanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLangChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;

    // ✅ Remplacer la locale dans l'URL
    // Ex: /fr/admin/dashboard → /en/admin/dashboard
    const newPathname = pathname.replace(
      /^\/[a-z]{2}(\/|$)/,
      `/${newLocale}$1`
    );

    console.log(`🌍 Changement de langue: ${currentLocale} → ${newLocale}`);
    console.log(`📍 Navigation: ${pathname} → ${newPathname}`);

    router.push(newPathname);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => handleLangChange(l.code)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
            currentLocale === l.code
              ? 'bg-sari-blue text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={l.name}
        >
          <span>{l.flag}</span>
          <span className="hidden md:inline">{l.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}