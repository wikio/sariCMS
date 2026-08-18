// components/layout/FloatingApplicationsButton.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Briefcase } from 'lucide-react';

export default function FloatingApplicationsButton() {
  const [isHovered, setIsHovered] = useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('components.layout.FloatingApplicationsButton');
  const { user, isAuthenticated } = useAuth();

  // Ne pas afficher si l'utilisateur n'est pas un candidat
  if (!isAuthenticated || user?.type !== 'candidate') {
    return null;
  }

  // Ne pas afficher si on est déjà sur la page candidatures
  if (pathname.includes('/applications')) {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-8 z-40">
      <Link
        href={`/${locale}/applications`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group"
        aria-label={t('viewApplications')}
      >
        {/* Bouton principal */}
        <div className="w-16 h-16 bg-gradient-to-br from-sari-blue to-sari-dark rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300">
          <Briefcase className="w-7 h-7 text-white" />
        </div>

        {/* Tooltip au survol */}
        {isHovered && (
          <div className="absolute bottom-full left-0 mb-2 bg-sari-dark text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl animate-fade-in-up">
            {t('viewApplications')}
            {/* Flèche du tooltip */}
            <div className="absolute top-full left-6 w-2 h-2 bg-sari-dark transform rotate-45 -mt-1"></div>
          </div>
        )}

        {/* Animation d'onde */}
        <span className="absolute inset-0 rounded-full bg-sari-blue opacity-75 animate-ping"></span>
      </Link>
    </div>
  );
}