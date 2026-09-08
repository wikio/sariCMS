// components/cards/PartnerCard.tsx
'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import type { Partner } from '@/types';

interface PartnerCardProps {
  partner: Partner;
  showName?: boolean;
}

export default function PartnerCard({ partner, showName = false }: PartnerCardProps) {
  const t = useTranslations('components.cards.PartnerCard');

  return (
    <div className="bg-gray-50 dark:bg-[#111111] p-8 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800 rounded-xl hover:border-sari-blue hover:shadow-lg transition-all duration-300 group">
      {/* Logo avec fallback */}
      <div className="relative w-full h-16 flex items-center justify-center">
        {partner.logo ? (
          <img
            src={partner.logo}
            alt={partner.name}
            className="max-h-16 w-auto object-contain opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 grayscale group-hover:grayscale-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.className = 'text-2xl font-bold text-sari-blue';
                fallback.textContent = partner.name.charAt(0);
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div className="text-2xl font-bold text-sari-blue">{partner.name.charAt(0)}</div>
        )}
      </div>

      {showName && (
        <>
          {/* Séparateur */}
          <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-3"></div>
          <div className="text-center">
            <div className="font-bold text-sari-dark dark:text-white text-sm">
              {partner.name}
            </div>
            {partner.category && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-sari-blue/10 text-sari-blue text-xs font-semibold rounded">
                {partner.category}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}