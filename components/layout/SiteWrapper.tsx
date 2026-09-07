// components/layout/SiteWrapper.tsx
'use client';

/**
 * Coque du site public : bandeau de navigation, contenu, pied de page.
 *
 * Elle rend aussi l'unique mesure de la hauteur du bandeau, dans la variable
 * `--site-header-h`. Le bandeau est en `position: fixed` — il ne pousse pas la
 * page, il la survole — et sa hauteur dépend de la langue (la barre de contact
 * prend une ligne de plus en arabe) comme du point de rupture. S'en remettre à
 * une valeur écrite à la main faisait toucher le menu au premier bloc de
 * l'accueil et manger les ancres ; la CSS fournit un repli, la mesure corrige.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FloatingCartButton from './FloatingCartButton';
import FloatingApplicationsButton from './FloatingApplicationsButton';
import type { Config, Menu } from '@/types';

/** Pose `--site-header-h` à la hauteur réelle du bandeau fixe. */
function HeaderOffset() {
  useEffect(() => {
    let last = 0;
    const apply = () => {
      const header = document.getElementById('site-header');
      if (!header) return false;
      const height = Math.round(header.getBoundingClientRect().height);
      if (height > 0 && height !== last) {
        last = height;
        document.documentElement.style.setProperty('--site-header-h', `${height}px`);
      }
      return true;
    };

    if (!apply()) {
      // Bandeau monté après ce composant : une reprise suffit.
      const retry = window.setTimeout(apply, 100);
      return () => window.clearTimeout(retry);
    }

    // Le logo et les polices s'imposent après le premier peint, et la barre de
    // contact passe sur deux lignes selon la langue : on suit la hauteur.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    const header = document.getElementById('site-header');
    if (observer && header) observer.observe(header);
    window.addEventListener('resize', apply);
    const later = window.setTimeout(apply, 400);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      window.clearTimeout(later);
    };
  }, []);

  return null;
}

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
      <HeaderOffset />
      <main className="flex-grow pt-0">
        {children}
      </main>
      <Footer config={config} menu={menu} />
      <FloatingCartButton />
      <FloatingApplicationsButton />
    </div>
  );
}