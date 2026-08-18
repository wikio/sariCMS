// components/sections/AlternatingSections.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Check } from 'lucide-react';

export default function AlternatingSections() {
  const locale = useLocale();
  const t = useTranslations('components.sections.AlternatingSections');
  const sectionRef = useRef<HTMLElement>(null);

  // ✅ IntersectionObserver pour déclencher l'animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    const elements = sectionRef.current?.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const sections = [
    {
      key: 'block1',
      image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800',
      position: 'left' as const,
      defaultLink: '/solutions',
    },
    {
      key: 'block2',
      image: 'https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=800',
      position: 'right' as const,
      defaultLink: '/services',
    },
    {
      key: 'block3',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
      position: 'left' as const,
      defaultLink: '/products',
    },
  ];

  return (
    <section ref={sectionRef} className="py-24 bg-gray-50 dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        {sections.map((section, index) => (
          <div
            key={section.key}
            className={`flex flex-col ${
              section.position === 'right' ? 'lg:flex-row-reverse' : 'lg:flex-row'
            } items-center gap-12 mb-24 last:mb-0`}
          >
            {/* Image */}
            <div
              className={`w-full lg:w-1/2 ${
                section.position === 'right' ? 'reveal-right' : 'reveal-left'
              }`}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={section.image}
                  alt={t(`${section.key}Title`)}
                  className="w-full h-[400px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-sari-blue/20 to-transparent"></div>
              </div>
            </div>

            {/* Contenu */}
            <div className="w-full lg:w-1/2 reveal">
              <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
                {t(`${section.key}Subtitle`)}
              </span>
              <h3 className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mt-4 mb-6">
                {t(`${section.key}Title`)}
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
                {t(`${section.key}Desc`)}
              </p>
              <Link
                href={`/${locale}${t(`${section.key}Link`)}`}
                className="btn-primary text-white px-8 py-4 font-semibold inline-flex items-center gap-2"
              >
                {t(`${section.key}Cta`)}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}