'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const MAP: Record<string, string> = {
  products: 'products',
  services: 'services',
  careers: 'careers',
  news: 'news',
  events: 'events',
  testimonials: 'testimonials',
  partners: 'partners',
  'solution-categories': 'solutions',
  hero: 'hero',
  genericContent: 'pages',
  legal: 'legal',
  menu: 'menus',
  navigation: 'menus',
};

export default function LegacyDataRedirect() {
  const params = useParams();
  const locale = useLocale();
  const router = useRouter();
  useEffect(() => {
    const dest = MAP[String(params.type)] || 'products';
    router.replace(`/${locale}/admin/${dest}`);
  }, [params.type, locale, router]);
  return null;
}
