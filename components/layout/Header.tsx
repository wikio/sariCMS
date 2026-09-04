// components/layout/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, X, Phone, Mail, ShoppingCart, User, LogOut, LayoutDashboard, Package, Briefcase, FileText, Search, Moon, Sun, ChevronDown } from 'lucide-react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import SearchHeader from '@/components/layout/SearchHeader';
import IconMark from '@/components/admin/IconMark';
import type { Config, Menu as MenuType } from '@/types';
import { loadAdminSettings } from '@/lib/admin-settings';
import { useCart } from '@/contexts/CartContext';
import { useVisibility } from '@/lib/site-visibility';
import { locales } from '@/lib/i18n';

/** Segments de langue reconnus en tête d'URL (voir getLinkHref). */
const LOCALE_SEGMENTS = new Set<string>(locales);

export default function Header({ config, menu }: { config: Config; menu: MenuType }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(false); // Géré par votre ThemeProvider si nécessaire

  const locale = useLocale();
  const t = useTranslations('components.layout.header');
  const tNav = useTranslations('common.nav');

  // Nombre exact d'articles dans le panier (somme des quantités).
  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // ✅ Fonction robuste pour générer les liens avec la locale
  const getLinkHref = (href: string) => {
    const raw = String(href || '');
    // Lien externe : laissé intact (mailto:, tel:, https://…).
    if (/^(https?:)?\/\//i.test(raw) || /^(mailto|tel):/i.test(raw)) return raw;
    // Supprime les '#' ou '/' au début pour éviter les doubles slashes ou les mots collés
    const cleanPath = raw.replace(/^[#\/]+/, '');
    // Les sous-menus générés viennent de `entityUrl`, qui préfixe déjà la
    // langue : re-préfixer produirait `/fr/fr/solutions/...`, donc un 404.
    if (/^[a-z]{2}(-[A-Za-z]{2})?(\/|$)/.test(cleanPath)) {
      const [first, ...rest] = cleanPath.split('/');
      if (LOCALE_SEGMENTS.has(first)) return `/${locale}/${rest.join('/')}`.replace(/\/+$/, '') || `/${locale}`;
    }
    return `/${locale}/${cleanPath}`;
  };

  const visibility = useVisibility();

  // ✅ Mapping : id de menu → clé de visibilité page/module correspondante.
  // Si la page ou le module cible est masqué, le lien du menu l'est aussi.
  const PAGE_MODULE_KEYS: Record<string, string> = {
    about: 'page.about',
    solutions: 'module.solutions',
    services: 'module.services',
    products: 'module.products',
    events: 'module.events',
    news: 'module.news',
    careers: 'module.careers',
    contact: 'module.contact',
  };

  const navigation = (menu.mainMenu || []).filter((item) => {
    if (!item.id) return true;
    // 1) Vérifier la visibilité du menu lui-même
    const menuKey = `menu.${item.id}`;
    if (visibility[menuKey] === false) return false;
    // 2) Vérifier si la page/module cible est masquée → masquer le lien aussi
    const targetKey = PAGE_MODULE_KEYS[item.id];
    if (targetKey && visibility[targetKey] === false) return false;
    return true;
  });

  // Logo du site : le logo configuré dans Paramètres prime sur celui des données CMS.
  const [logo, setLogo] = useState<string>(config.meta?.logo || '');
  useEffect(() => {
    try { setLogo(loadAdminSettings().siteLogo || config.meta?.logo || ''); } catch { /* */ }
  }, [config]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getNavText = (item: any) => {
    if (item.id) {
      try {
        const translated = tNav(item.id);
        return translated.startsWith('common.nav.') ? item.label : translated;
      } catch {
        return item.label;
      }
    }
    return item.label;
  };

  const handleLogout = () => {
    // Votre logique de logout ici
    setShowUserMenu(false);
  };

  const getUserTypeLabel = () => {
    return t('userTypeDefault'); // Adaptez selon votre contexte d'auth
  };

  return (
    <header className="fixed w-full top-0 z-50">
      {/* BANDEAU SUPÉRIEUR */}
      <div className={`relative z-50 w-full transition-all duration-500 border-b border-white/10 ${isScrolled ? 'bg-gray-900/90 backdrop-blur-xl shadow-2xl' : 'bg-stone-800/70 backdrop-blur-xl'}`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="hidden lg:flex items-center gap-8 text-gray-200 text-sm">
              <a href={`tel:${config.meta?.phone?.replace(/\s/g, '') || '+21321234567'}`} className="flex items-center gap-3 group hover:text-sari-lime transition-all">
                <div className="w-8 h-8 bg-sari-lime/10 flex items-center justify-center group-hover:bg-sari-lime/20 transition-all">
                  <Phone className="w-4 h-4 text-sari-lime" />
                </div>
                <span className="font-medium">{config.meta?.phone || '+213 21 23 45 67'}</span>
              </a>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sari-lime/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-sari-lime" />
                </div>
                <span className="font-medium">{config.meta?.email || 'contact@sari-systeme.dz'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto lg:ml-0">
              <div className="relative z-[60]">
                <LanguageSwitcher />
              </div>
              <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
              <SearchHeader />
              
              {/* Bouton Panier */}
              {visibility['button.cart'] !== false && (
              <Link href={getLinkHref('#cart')} className="relative p-2.5 text-sari-lime hover:text-white transition-all group" aria-label={`${t('cart')} (${cartCount})`}>
                <div className="absolute inset-0 bg-sari-lime/0 group-hover:bg-sari-lime/20 transition-all"></div>
                <ShoppingCart className="w-5 h-5 relative z-10" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 z-20 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </Link>
              )}

              {/* Connexion / Utilisateur */}
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="relative p-2.5 text-sari-lime hover:text-white transition-all group flex items-center gap-2" aria-label={t('account')}>
                  <div className="absolute inset-0 bg-sari-lime/0 group-hover:bg-sari-lime/20 transition-all"></div>
                  <div className="relative z-10 w-8 h-8 bg-sari-lime/20 rounded-full flex items-center justify-center border-2 border-sari-lime">
                    <User className="w-4 h-4 text-sari-lime" />
                  </div>
                  <span className="hidden sm:inline font-semibold relative z-10 text-sm">{t('login')}</span>
                </button>
                
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-[55]" onClick={() => setShowUserMenu(false)}></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl z-[100] rounded-lg overflow-hidden">
                      <div className="p-4 bg-sari-blue text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-bold">{t("user")}</div>
                            <div className="text-xs text-blue-100 capitalize">{getUserTypeLabel()}</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <Link href={getLinkHref('#dashboard')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded">
                          <LayoutDashboard className="w-4 h-4 text-sari-blue" />
                          <span className="text-sm font-medium">{t('dashboard')}</span>
                        </Link>
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors rounded">
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('logout')}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
              <Link href={getLinkHref('#contact')} className="relative p-2.5 text-sari-lime hover:text-white transition-all group flex items-center gap-2">
                <div className="absolute inset-0 bg-sari-lime/0 group-hover:bg-sari-lime/20 transition-all"></div>
                <FileText className="w-5 h-5 relative z-10" />
                <span className="hidden sm:inline font-semibold relative z-10">{t('freeQuote')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* BANDEAU PRINCIPAL */}
      <div className={`relative z-40 w-full transition-all duration-300 border-b ${isScrolled ? 'bg-white dark:bg-[#1a1a1a] shadow-md border-gray-200 dark:border-gray-800' : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800'}`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link href={getLinkHref('#home')} className="flex items-center gap-3 group flex-shrink-0">
              <img src={logo} alt={config.meta?.companyName} className="h-12 w-auto transition-transform duration-500 group-hover:scale-110" />
              <div className="hidden md:block">
                <h1 className="font-bold text-xl lg:text-2xl text-sari-dark dark:text-white leading-tight">{config.meta?.companyName || 'SARI Système'}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{config.meta?.tagline || 'Équipements Médicaux'}</p>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navigation.map((item, idx) => (
                <div key={idx} className="relative group" onMouseEnter={() => item.submenu && setActiveSubmenu(idx)} onMouseLeave={() => setActiveSubmenu(null)}>
                  <Link href={getLinkHref(item.href)} className="relative px-4 py-2 font-medium transition-colors whitespace-nowrap overflow-hidden text-sari-dark dark:text-white hover:text-sari-blue">
                    {getNavText(item)}
                    {item.submenu && <ChevronDown className="w-4 h-4 inline ml-1 transition-transform group-hover:rotate-180" />}
                    <div className="absolute bottom-0 left-0 h-0.5 bg-sari-lime transition-all duration-300 w-0 group-hover:w-full"></div>
                  </Link>
                  {item.submenu && activeSubmenu === idx && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-800 z-50 rounded-lg overflow-hidden">
                      {item.submenu.map((sub, subIdx) => (
                        <Link key={subIdx} href={getLinkHref(sub.href)} onClick={() => setActiveSubmenu(null)} className="block px-4 py-3 hover:bg-sari-blue/5 dark:hover:bg-sari-blue/10 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                          {/* L'icône n'est présente que si l'administration l'a
                              activée et que la fiche en possède une. */}
                          <div className="flex items-start gap-2.5">
                            {sub.icon && (
                              <IconMark name={sub.icon} className="w-4 h-4 mt-0.5 shrink-0 text-sari-blue" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-sari-dark dark:text-white">{sub.label}</div>
                              {sub.desc && <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{sub.desc}</div>}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <button className="lg:hidden p-2 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={t('menu')}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 absolute w-full shadow-2xl max-h-[85vh] overflow-y-auto z-40">
          <div className="container mx-auto px-6 py-4 space-y-1">
            <div className="pb-3 mb-3 border-b border-gray-200 dark:border-gray-800">
              <LanguageSwitcher />
            </div>
            {navigation.map((item, idx) => (
              <div key={idx}>
                <Link href={getLinkHref(item.href)} onClick={() => setMobileMenuOpen(false)} className="block py-3 px-3 font-medium border-b border-gray-100 dark:border-gray-800 text-sari-dark dark:text-white">
                  {getNavText(item)}
                </Link>
                {item.submenu && (
                  <div className="pl-4 space-y-1 pb-2 bg-gray-50 dark:bg-[#111111]">
                    {item.submenu.map((sub, subIdx) => (
                      <Link key={subIdx} href={getLinkHref(sub.href)} onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-600 dark:text-gray-400 text-sm hover:text-sari-blue">
                        {/* Mêmes options qu'en desktop : la configuration de
                            l'administration doit valoir sur les deux rendus. */}
                        <span className="flex items-start gap-2">
                          {sub.icon && (
                            <IconMark name={sub.icon} className="w-4 h-4 mt-0.5 shrink-0 text-sari-blue" />
                          )}
                          <span className="min-w-0">
                            <span className="block">{sub.label}</span>
                            {sub.desc && (
                              <span className="block text-xs text-gray-500 dark:text-gray-500 mt-0.5">{sub.desc}</span>
                            )}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-800 my-3 pt-3 space-y-2">
              <Link href={getLinkHref('#dashboard')} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 px-3 text-sari-dark dark:text-white font-medium border-b border-gray-100 dark:border-gray-800">
                <LayoutDashboard className="w-5 h-5 text-sari-lime" />
                {t('dashboard')}
              </Link>
              <Link href={getLinkHref('#contact')} onClick={() => setMobileMenuOpen(false)} className="btn-primary text-white px-6 py-3 font-semibold block text-center mt-4">
                {t('freeQuote')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}