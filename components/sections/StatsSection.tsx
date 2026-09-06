// components/sections/StatsSection.tsx
'use client';

/**
 * Bloc « Chiffres clés ».
 *
 * Les valeurs s'éditent directement dans le studio de la page d'accueil
 * (répéteur valeur / suffixe / libellé / icône), langue par langue. Tant
 * qu'aucun chiffre n'y est enregistré, le bloc reprend les statistiques du
 * fichier de configuration du site — les deux sources restent donc valides.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Award, Headphones, ThumbsUp, Users } from 'lucide-react';
import { getLucideIcon } from '@/lib/lucide-icons';
import { numberSetting, setting, visibleItems, type HomeItem, type HomeSectionConfig } from '@/lib/home/config';
import SectionFrame, { isSectionVisible } from '@/components/sections/SectionFrame';
import type { Config } from '@/types';

interface StatsSectionProps {
  /** Réglages généraux du site (data/config.json) : source de repli. */
  config?: Config;
  /** Réglages du bloc dans le studio de la page d'accueil. */
  home?: HomeSectionConfig;
}

/**
 * Compteur animé : démarre quand le bloc entre dans l'écran (une seule fois) et
 * décélère jusqu'à la valeur cible. Une valeur non numérique (« 24/7 ») n'est
 * pas animée, elle est affichée telle quelle.
 */
function useCounter(end: number, duration: number) {
  const [count, setCount] = useState(duration > 0 ? 0 : end);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (duration <= 0) {
      setCount(end);
      return;
    }
    const node = ref.current;
    if (!node) {
      setCount(end);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [duration, end]);

  useEffect(() => {
    if (!started || duration <= 0) return;
    let frame = 0;
    let startTime = 0;
    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      setCount(Math.floor((1 - (1 - progress) ** 2) * end));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, duration, end]);

  return { ref, count, ready: duration <= 0 ? true : started };
}

function Counter({ value, suffix, duration }: { value: number; suffix: string; duration: number }) {
  const { ref, count } = useCounter(value, duration);
  return (
    <div ref={ref} className="text-5xl md:text-6xl font-black mb-2">
      {value > 0 ? `${count}${suffix}` : `${value}${suffix}`}
    </div>
  );
}

export default function StatsSection({ config, home }: StatsSectionProps) {
  const t = useTranslations('components.sections.StatsSection');
  const animate = setting(home, 'animate', true);
  const duration = animate ? numberSetting(home, 'duration', 2000) : 0;
  const items = visibleItems(home);
  const fromConfig = home?.settings?.fromConfig === true;

  const fallback = [
    { value: parseInt(config?.stats?.clients || '500', 10) || 500, suffix: '+', label: t('activeClients'), icon: Users },
    { value: parseInt(config?.stats?.experience || '20', 10) || 20, suffix: '', label: t('yearsExperience'), icon: Award },
    { value: 0, suffix: '', label: t('techSupport'), icon: Headphones, raw: config?.stats?.support || '24/7' },
    { value: parseInt(config?.stats?.satisfaction || '98', 10) || 98, suffix: '%', label: t('satisfiedClients'), icon: ThumbsUp },
  ];

  const stats = items.length
    ? items.map((item: HomeItem, index: number) => ({
        value: Number(String(item.value ?? '').replace(/[^\d.]/g, '')) || 0,
        suffix: String(item.suffix ?? ''),
        label: String(item.label ?? ''),
        raw: /^\d+$/.test(String(item.value ?? '').trim()) ? '' : String(item.value ?? ''),
        icon: item.icon ? getLucideIcon(String(item.icon)) : [Users, Award, Headphones, ThumbsUp][index % 4],
      }))
    : fromConfig || !items.length
      ? fallback
      : [];

  if (!stats.length || !isSectionVisible(home)) return null;

  return (
    <SectionFrame sectionKey="stats" config={home} header={{ align: 'center', fallbacks: { subtitle: t('subtitle'), title: t('title') } }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((stat, i) => {
          const IconComponent = stat.icon as React.ComponentType<{ className?: string }>;
          return (
            <div key={i} className="text-center stagger-children">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <IconComponent className="w-8 h-8 text-white" />
              </div>
              {stat.raw ? (
                <div className="text-5xl md:text-6xl font-black mb-2">{stat.raw}</div>
              ) : (
                <Counter value={stat.value} suffix={stat.suffix} duration={duration} />
              )}
              <div className="text-blue-100 text-lg">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}
