// components/sections/NavigationGrid.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Stethoscope, Wrench, Package, Calendar, Newspaper, Users,
  ChevronRight, ChevronLeft
} from 'lucide-react';

export default function NavigationGrid() {
  const locale = useLocale();
  const t = useTranslations('components.sections.NavigationGrid');
  const isRtl = locale === 'ar';
  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  const sections = [
    { 
      icon: Stethoscope, 
      title: t('solutions'), 
      desc: t('solutionsDesc'), 
      link: '/solutions', 
      img: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800' 
    },
    { 
      icon: Wrench, 
      title: t('services'), 
      desc: t('servicesDesc'), 
      link: '/services', 
      img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800' 
    },
    { 
      icon: Package, 
      title: t('products'), 
      desc: t('productsDesc'), 
      link: '/products', 
      img: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800' 
    },
    { 
      icon: Calendar, 
      title: t('events'), 
      desc: t('eventsDesc'), 
      link: '/events', 
      img: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800' 
    },
    { 
      icon: Newspaper, 
      title: t('news'), 
      desc: t('newsDesc'), 
      link: '/news', 
      img: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800' 
    },
    { 
      icon: Users, 
      title: t('careers'), 
      desc: t('careersDesc'), 
      link: '/careers', 
      img: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800' 
    }
  ];

  return (
    <section className="py-24 bg-sari-gray dark:bg-[#111111]">
      <div className="container mx-auto px-6">
        {/* Titre de section */}
        <div className="text-center mb-16">
          <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
            {t('subtitle')}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mt-4 mb-6">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            {t('description')}
          </p>
        </div>

        {/* Grille de navigation */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map((section, i) => {
            const IconComponent = section.icon;
            return (
              <Link 
                key={i} 
                href={`/${locale}${section.link}`}
                className="group bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover overflow-hidden relative"
              >
                {/* Image */}
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={section.img} 
                    alt={section.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Contenu */}
                <div className="p-6 relative">
                  <div className="w-12 h-12 bg-sari-blue flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">
                    {section.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {section.desc}
                  </p>
                  <span className="text-sari-blue font-semibold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                    {t('learnMore')}
                    <ArrowIcon className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}