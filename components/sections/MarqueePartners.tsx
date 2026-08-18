// components/sections/MarqueePartners.tsx
import type { Partner } from '@/types';

interface MarqueePartnersProps {
  partners: Partner[];
}

export default function MarqueePartners({ partners }: MarqueePartnersProps) {
  if (partners.length === 0) return null;

  // Dupliquer les partenaires pour créer un défilement continu
  const duplicatedPartners = [...partners, ...partners];

  return (
    <section className="py-8 bg-sari-blue text-white overflow-hidden">
      <div className="marquee">
        <div className="marquee-content">
          {duplicatedPartners.map((partner, i) => (
            <span key={i} className="inline-block mx-8 text-xl font-bold opacity-80">
              {partner.name} •
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}