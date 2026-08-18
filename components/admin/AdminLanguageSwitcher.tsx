'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const languages = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية' },
];

export default function AdminLanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLangChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    router.push(pathname.replace(/^\/[a-z]{2}(\/|$)/, `/${newLocale}$1`));
  };

  return (
    <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--ad-surface-2)', border: '1px solid var(--ad-line)' }}>
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => handleLangChange(l.code)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide ${currentLocale === l.code ? 'ad-btn-primary' : ''}`}
          style={currentLocale === l.code ? { background: 'var(--ad-accent)', color: 'var(--ad-accent-ink)' } : { color: 'var(--ad-muted)' }}
          title={l.name}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
