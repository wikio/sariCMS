// components/cards/ServiceCard.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Stethoscope, HeartPulse, Scan, Syringe, Baby, Activity, 
  Monitor, FlaskConical, Accessibility, ChevronRight, CheckCircle,
  Wrench, Shield, Truck, GraduationCap, Search, ClipboardList,
  Clock, Headphones, Zap, Image, Lock, Database, Smartphone,
  FileText, Video, TestTube, Microscope, Rotate3D, Thermometer,
  Droplets, Scissors, Flame, Lightbulb, Bed, Sun, Wind, Siren,
  Footprints, Dumbbell, Waves, Scale, Magnet, Package // ✅ AJOUTÉ ICI
} from 'lucide-react';
import type { Service } from '@/types';

interface ServiceCardProps {
  service: Service;
  variant?: 'standard' | 'compact';
  onClick?: (service: Service) => void;
}

// Mapping des icônes Lucide
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'stethoscope': Stethoscope,
  'heart-pulse': HeartPulse,
  'scan': Scan,
  'syringe': Syringe,
  'baby': Baby,
  'activity': Activity,
  'monitor': Monitor,
  'flask-conical': FlaskConical,
  'accessibility': Accessibility,
  'wrench': Wrench,
  'shield': Shield,
  'truck': Truck,
  'graduation-cap': GraduationCap,
  'search': Search,
  'clipboard-list': ClipboardList,
  'clock': Clock,
  'headphones': Headphones,
  'zap': Zap,
  'image': Image,
  'lock': Lock,
  'database': Database,
  'smartphone': Smartphone,
  'file-text': FileText,
  'video': Video,
  'test-tube': TestTube,
  'microscope': Microscope,
  'rotate-3d': Rotate3D,
  'thermometer': Thermometer,
  'droplets': Droplets,
  'scissors': Scissors,
  'flame': Flame,
  'lightbulb': Lightbulb,
  'bed': Bed,
  'sun': Sun,
  'wind': Wind,
  'siren': Siren,
  'footprints': Footprints,
  'dumbbell': Dumbbell,
  'waves': Waves,
  'scale': Scale,
  'magnet': Magnet,
};

export default function ServiceCard({ service, variant = 'standard', onClick }: ServiceCardProps) {
  const locale = useLocale();
  const t = useTranslations('components.cards.ServiceCard');

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(service);
    }
  };

  const serviceUrl = `/${locale}/services/${service.id}`;
  const IconComponent = iconMap[service.icon] || Package;

  // === Variante COMPACT ===
  if (variant === 'compact') {
    return (
      <Link
        href={serviceUrl}
        onClick={handleClick}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
      >
        <div className="w-12 h-12 bg-sari-blue/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-sari-blue transition-colors">
          <IconComponent className="w-6 h-6 text-sari-blue group-hover:text-white transition-colors" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors">
            {service.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
            {service.shortDesc}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-sari-blue transition-all" />
      </Link>
    );
  }

  // === Variante STANDARD ===
  return (
    <Link
      href={serviceUrl}
      onClick={handleClick}
      className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-8 rounded-xl hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col"
    >
      <div className="w-14 h-14 bg-sari-blue/10 dark:bg-sari-blue/20 flex items-center justify-center mb-6 group-hover:bg-sari-blue transition-colors rounded-lg">
        <IconComponent className="w-7 h-7 text-sari-blue group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-3 group-hover:text-sari-blue transition-colors">
        {service.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm flex-grow mb-4">
        {service.shortDesc}
      </p>
      {service.features && service.features.length > 0 && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 bg-sari-blue/10 text-sari-blue px-2 py-1 text-xs font-semibold rounded">
            <CheckCircle className="w-3 h-3" />
            {service.features.length} {t('advantages')}
          </span>
        </div>
      )}
      <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
        {t('learnMore')}
        <ChevronRight className="w-4 h-4" />
      </span>
    </Link>
  );
}