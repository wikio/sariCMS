// components/layout/Footer.tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Compass, Shield, Send, Heart } from 'lucide-react';
import type { Config, Menu as MenuType } from '@/types';

// ✅ Icônes SVG inline pour éviter les bugs Turbopack
const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
const LinkedinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
);
const TwitterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
);
const YoutubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
);

export default function Footer({ config, menu }: { config: Config; menu: MenuType }) {
  const locale = useLocale();
  const t = useTranslations('components.layout.Footer');
  const tNav = useTranslations('common.nav');

  const navigation = menu.footerMenu?.navigation || [];
  const legal = menu.footerMenu?.legal || [];

  // ✅ Fonction utilitaire pour nettoyer et formater les liens avec la locale
  const getLinkHref = (href: string) => {
    // Supprime les '#' ou '/' au début pour éviter les doubles slashes ou les mots collés
    const cleanPath = href.replace(/^[#\/]+/, '');
    return `/${locale}/${cleanPath}`;
  };

  // Traduit un libellé de menu par son id (common.nav ou clés légales du Footer),
  // sinon conserve le libellé fourni (données CMS déjà localisées).
  const getLabel = (item: { id?: string; label: string }) => {
    if (!item.id) return item.label;
    const viaNav = tNav(item.id as never);
    if (viaNav && viaNav !== item.id) return viaNav;
    const viaFooter = t(item.id as never);
    if (viaFooter && viaFooter !== item.id) return viaFooter;
    return item.label;
  };

  return (
    <footer className="bg-sari-dark text-white pt-20 pb-10 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-bg opacity-5"></div>
      
      <div className="container mx-auto px-6 relative">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          
          {/* Colonne 1 : À propos */}
          <div>
            <img
              src={config.meta?.logo || ''}
              alt={config.meta?.companyName || 'Logo'}
              className="h-12 mb-6 brightness-0 invert"
            />
            <p className="text-gray-400 text-sm mb-6">
              {config.meta?.description || ''}
            </p>
            <div className="flex gap-4">
              {config.meta?.social?.facebook && (
                <a href={config.meta.social.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-sari-lime transition-colors">
                  <FacebookIcon />
                </a>
              )}
              {config.meta?.social?.linkedin && (
                <a href={config.meta.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-sari-lime transition-colors">
                  <LinkedinIcon />
                </a>
              )}
              {config.meta?.social?.twitter && (
                <a href={config.meta.social.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-sari-lime transition-colors">
                  <TwitterIcon />
                </a>
              )}
              {config.meta?.social?.youtube && (
                <a href={config.meta.social.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-sari-lime transition-colors">
                  <YoutubeIcon />
                </a>
              )}
            </div>
          </div>

          {/* Colonne 2 : Navigation */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Compass className="w-5 h-5 text-sari-blue" />
              {t('navigation')}
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              {navigation.map((item, i) => (
                <li key={i}>
                  <Link 
                    href={getLinkHref(item.href)}
                    className="hover:text-sari-lime transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-sari-lime transition-all"></span>
                    {getLabel(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne 3 : Légal + Sécurité */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-sari-blue" />
              {t('legalSecurity')}
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              {legal.map((item, i) => (
                <li key={i}>
                  <Link 
                    href={getLinkHref(item.href)}
                    className="hover:text-sari-lime transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-sari-lime transition-all"></span>
                    {getLabel(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne 4 : Contact */}
          <div>
            <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-sari-blue" />
              {t('contact')}
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-sari-blue flex-shrink-0 mt-0.5" />
                <span>{config.meta?.address || ''}</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-sari-blue flex-shrink-0 mt-0.5" />
                <a 
                  href={`tel:${config.meta?.phone}`} 
                  className="hover:text-sari-lime transition-colors"
                >
                  {config.meta?.phone || '+213 21 23 45 67'}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-sari-blue flex-shrink-0 mt-0.5" />
                <a 
                  href={`mailto:${config.meta?.email}`} 
                  className="hover:text-sari-lime transition-colors"
                >
                  {config.meta?.email || 'contact@sari-systeme.dz'}
                </a>
              </li>
            </ul>
            
            <Link 
              href={getLinkHref('#contact')}
              className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 mt-4"
            >
              <Send className="w-4 h-4" />
              {t('contactUs')}
            </Link>
          </div>
        </div>

        {/* Séparateur */}
        <div className="border-t border-gray-700 my-8"></div>

        {/* Bas de page */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} {config.meta?.companyName || 'SARI Système'}. {t('allRightsReserved')}.
          </p>
          <p className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            {t('designedWith')}
          </p>
        </div>
      </div>
    </footer>
  );
}