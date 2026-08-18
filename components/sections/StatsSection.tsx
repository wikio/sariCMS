// components/sections/StatsSection.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Award, Headphones, ThumbsUp } from 'lucide-react';
import type { Config } from '@/types';

interface StatsSectionProps {
  config: Config;
}

// Hook personnalisé pour l'animation de compteur
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && end > 0) {
      let startTime: number;
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        setCount(Math.floor(progress * end));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isVisible, end, duration]);

  return { ref, count };
}

export default function StatsSection({ config }: StatsSectionProps) {
  const t = useTranslations('components.sections.StatsSection');

  // ✅ Extraction sécurisée des statistiques avec valeurs par défaut
  const clients = parseInt(config?.stats?.clients || '500') || 500;
  const experience = parseInt(config?.stats?.experience || '20') || 20;
  const satisfaction = parseInt(config?.stats?.satisfaction || '98') || 98;

  const counter1 = useCounter(clients, 2000);
  const counter2 = useCounter(experience, 2000);
  const counter3 = useCounter(satisfaction, 2000);

  const stats = [
    {
      ref: counter1.ref,
      value: `${counter1.count}+`,
      label: t('activeClients'),
      icon: Users,
    },
    {
      ref: counter2.ref,
      value: `${counter2.count}`,
      label: t('yearsExperience'),
      icon: Award,
    },
    {
      ref: null,
      value: config?.stats?.support || '24/7',
      label: t('techSupport'),
      icon: Headphones,
    },
    {
      ref: counter3.ref,
      value: `${counter3.count}%`,
      label: t('satisfiedClients'),
      icon: ThumbsUp,
    },
  ];

  return (
    <section className="py-24 bg-sari-blue text-white relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
      <div className="container mx-auto px-6 relative">
        <div className="text-center mb-16">
          <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
            {t('subtitle')}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-4">
            {t('title')}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={i}
                ref={stat.ref}
                className="text-center stagger-children"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <div className="text-5xl md:text-6xl font-black mb-2">
                  {stat.value}
                </div>
                <div className="text-blue-100 text-lg">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}