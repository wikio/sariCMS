// components/admin/AdminLayout.tsx
'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, Package, Wrench, Briefcase, Newspaper,
  Calendar, Layers, MessageCircle, Handshake, Image as ImageIcon,
  FileStack, Menu as MenuIcon, Compass, Scale, Settings, ShoppingCart,
  Users, UserCog, FileCheck, Globe, Sliders, ExternalLink, LogOut,
  Database, Shield
} from 'lucide-react';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';
import { ToastProvider } from '@/components/admin/Toast';

interface MenuItem {
  id?: string;
  type?: 'divider';
  icon?: React.ElementType;
  label: string;
  href?: string;
}

export default function AdminLayout({ children, title = 'Administration' }: { children: ReactNode; title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('admin');
  const isRTL = locale === 'ar';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ✅ Détection de la page de login (pas de sidebar)
  const isLoginPage = pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`;

  // Vérification de l'authentification (sauf sur la page login)
  useEffect(() => {
    if (isLoginPage) return;

    const auth = localStorage.getItem('sari_admin_auth');
    const authTime = localStorage.getItem('sari_admin_time');

    if (auth !== 'true' || !authTime) {
      router.push(`/${locale}/admin`);
      return;
    }

    const elapsed = Date.now() - parseInt(authTime);
    if (elapsed > 2 * 60 * 60 * 1000) {
      localStorage.removeItem('sari_admin_auth');
      localStorage.removeItem('sari_admin_time');
      router.push(`/${locale}/admin`);
    }
  }, [router, pathname, locale, isLoginPage]);

  const handleLogout = () => {
    localStorage.removeItem('sari_admin_auth');
    localStorage.removeItem('sari_admin_time');
    router.push(`/${locale}`);
  };

  // ✅ Menu admin complet
  const menuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('menu.dashboard'), href: `/${locale}/admin/dashboard` },
    { type: 'divider', label: t('menu.contentSection') },
    { id: 'pages', icon: FileText, label: t('menu.pages'), href: `/${locale}/admin/pages` },
    { id: 'products', icon: Package, label: t('menu.products'), href: `/${locale}/admin/data/products` },
    { id: 'services', icon: Wrench, label: t('menu.services'), href: `/${locale}/admin/data/services` },
    { id: 'careers', icon: Briefcase, label: t('menu.careers'), href: `/${locale}/admin/data/careers` },
    { id: 'news', icon: Newspaper, label: t('menu.news'), href: `/${locale}/admin/data/news` },
    { id: 'events', icon: Calendar, label: t('menu.events'), href: `/${locale}/admin/data/events` },
    { id: 'solutions', icon: Layers, label: t('menu.solutions'), href: `/${locale}/admin/data/solution-categories` },
    { id: 'testimonials', icon: MessageCircle, label: t('menu.testimonials'), href: `/${locale}/admin/data/testimonials` },
    { id: 'partners', icon: Handshake, label: t('menu.partners'), href: `/${locale}/admin/data/partners` },
    { type: 'divider', label: t('menu.siteSection') },
    { id: 'hero', icon: ImageIcon, label: t('menu.hero'), href: `/${locale}/admin/data/hero` },
    { id: 'genericContent', icon: FileStack, label: t('menu.genericContent'), href: `/${locale}/admin/data/genericContent` },
    { id: 'menu', icon: MenuIcon, label: t('menu.menuNav'), href: `/${locale}/admin/data/menu` },
    { id: 'navigation', icon: Compass, label: t('menu.navigation'), href: `/${locale}/admin/data/navigation` },
    { id: 'legal', icon: Scale, label: t('menu.legal'), href: `/${locale}/admin/data/legal` },
    { id: 'config', icon: Settings, label: t('menu.config'), href: `/${locale}/admin/config` },
    { type: 'divider', label: t('menu.eshopSection') },
    { id: 'orders', icon: ShoppingCart, label: t('menu.orders'), href: `/${locale}/admin/orders` },
    { id: 'quotes', icon: FileText, label: t('menu.quotes'), href: `/${locale}/admin/quotes` },
    { id: 'clients', icon: Users, label: t('menu.clients'), href: `/${locale}/admin/clients` },
    { type: 'divider', label: t('menu.usersSection') },
    { id: 'users', icon: UserCog, label: t('menu.users'), href: `/${locale}/admin/users` },
    { id: 'applications', icon: FileCheck, label: t('menu.applications'), href: `/${locale}/admin/applications` },
    { type: 'divider', label: t('menu.configSection') },
    { id: 'translations', icon: Globe, label: t('menu.translations'), href: `/${locale}/admin/translations` },
    { id: 'settings', icon: Sliders, label: t('menu.settings'), href: `/${locale}/admin/settings` },
  ];

  const getActiveId = () => {
    if (pathname.includes('/admin/dashboard')) return 'dashboard';
    if (pathname.includes('/admin/data/')) return pathname.split('/admin/data/')[1];
    if (pathname.includes('/admin/config')) return 'config';
    if (pathname.includes('/admin/applications')) return 'applications';
    if (pathname.includes('/admin/orders')) return 'orders';
    if (pathname.includes('/admin/quotes')) return 'quotes';
    if (pathname.includes('/admin/clients')) return 'clients';
    if (pathname.includes('/admin/users')) return 'users';
    if (pathname.includes('/admin/pages')) return 'pages';
    if (pathname.includes('/admin/translations')) return 'translations';
    if (pathname.includes('/admin/settings')) return 'settings';
    return null;
  };

  const activeId = getActiveId();

  // ✅ Si on est sur la page de login, on n'affiche PAS la sidebar
  if (isLoginPage) {
    return (
      <ToastProvider>
        <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-sari-dark via-gray-900 to-sari-dark">
          {children}
        </div>
      </ToastProvider>
    );
  }

  // ✅ Sinon, on affiche l'interface admin complète avec sidebar
  return (
    <ToastProvider>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a] flex">
        {/* Sidebar */}
        <aside 
          className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-sari-dark text-white transition-all duration-300 flex flex-col fixed h-full z-40 shadow-2xl ${isRTL ? 'right-0' : 'left-0'}`}
        >
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 bg-sari-lime rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
              <Shield className="w-5 h-5 text-sari-dark" />
            </div>
            {sidebarOpen && (
              <div>
                <div className="font-bold text-sm">SARI Admin</div>
                <div className="text-xs text-gray-400">{t('header.version')}</div>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
            {menuItems.map((item, idx) => {
              if (item.type === 'divider') {
                return sidebarOpen ? (
                  <div key={idx} className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider mt-4">
                    {item.label}
                  </div>
                ) : <div key={idx} className="border-t border-white/10 my-2 mx-2"></div>;
              }

              const Icon = item.icon;
              const isActive = activeId === item.id;

              return (
                <Link
                  key={item.id}
                  href={item.href || '#'}
                  className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all text-sm mb-0.5 ${
                    isActive ? 'bg-sari-blue text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-2">
            <Link href={`/${locale}`} className="flex items-center gap-3 text-gray-400 hover:text-white text-sm w-full">
              <ExternalLink className="w-4 h-4" />
              {sidebarOpen && <span>{t('header.seeSite')}</span>}
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-3 text-red-400 hover:text-red-300 text-sm w-full">
              <LogOut className="w-4 h-4" />
              {sidebarOpen && <span>{t('header.logout')}</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${isRTL ? (sidebarOpen ? 'mr-64' : 'mr-16') : (sidebarOpen ? 'ml-64' : 'ml-16')}`}>
          <header className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <MenuIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-lg font-bold text-sari-dark dark:text-white">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <AdminLanguageSwitcher />
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-full text-xs font-semibold">
                <Database className="w-3 h-3" />
                {t('header.jsonLocalMode')}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-sari-blue to-sari-dark rounded-full flex items-center justify-center text-white text-sm font-bold">
                    A
                  </div>
                  <span className="hidden md:inline text-sm font-medium text-sari-dark dark:text-white">
                    {t('header.admin')}
                  </span>
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-56 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl z-50 rounded-lg overflow-hidden`}>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="font-bold text-sari-dark dark:text-white">
                          {t('header.administrator')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {t('header.adminEmail')}
                        </div>
                      </div>
                      <div className="p-2">
                        <Link href={`/${locale}/admin/config`} onClick={() => setShowProfileMenu(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm">
                          <Settings className="w-4 h-4" /> {t('header.settings')}
                        </Link>
                        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded text-sm">
                          <LogOut className="w-4 h-4" /> {t('header.logout')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}