// components/layout/SiteWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FloatingCartButton from './FloatingCartButton';
import FloatingApplicationsButton from './FloatingApplicationsButton';
import type { Config, Menu } from '@/types';

interface SiteWrapperProps {
  children: React.ReactNode;
  config: Config;
  menu: Menu;
}

export default function SiteWrapper({ children, config, menu }: SiteWrapperProps) {
  const pathname = usePathname();
  
  // ✅ Détection des routes admin : on n'affiche PAS le Header/Footer du site public
  const isAdminRoute = pathname?.includes('/admin');

  if (isAdminRoute) {
    // Interface admin pure, le menu admin sera géré par app/[locale]/admin/layout.tsx
    return <>{children}</>;
  }

  // ✅ Site public : on affiche le Header, le contenu, et le Footer
  return (
    <div className="min-h-screen flex flex-col">
      <Header config={config} menu={menu} />
      <main className="flex-grow pt-0">
        {children}
      </main>
      <Footer config={config} menu={menu} />
      <FloatingCartButton />
      <FloatingApplicationsButton />
    </div>
  );
}