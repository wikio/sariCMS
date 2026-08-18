'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard, FileText, Package, Wrench, Briefcase, Newspaper,
  Calendar, Layers, MessageCircle, Handshake, Image as ImageIcon,
  FileStack, Menu as MenuIcon, Compass, Scale, Settings, ShoppingCart,
  Users, UserCog, FileCheck, Globe, Sliders, ExternalLink, LogOut,
  Shield, Search, ChevronLeft, Palette,
} from 'lucide-react';
import '@/app/admin.css';
import { ToastProvider } from '@/components/admin/Toast';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';
import { AdminThemeProvider, ADMIN_THEMES, useAdminTheme } from '@/components/admin/AdminTheme';
import { clearAdminSession, hasAdminSession, readAdminUser } from '@/lib/admin-session';

interface Item {
  id?: string;
  type?: 'divider';
  icon?: React.ElementType;
  label: string;
  href?: string;
}

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('admin');
  const isRTL = locale === 'ar';
  const { theme, setTheme } = useAdminTheme();
  const [open, setOpen] = useState(true);
  const [themesOpen, setThemesOpen] = useState(false);
  const [user, setUser] = useState(readAdminUser());
  const isLogin = pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`;

  useEffect(() => {
    setUser(readAdminUser());
    if (!isLogin && !hasAdminSession()) router.push(`/${locale}/admin`);
  }, [pathname, locale, isLogin, router]);

  const menu: Item[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('menu.dashboard'), href: `/${locale}/admin/dashboard` },
    { type: 'divider', label: t('menu.contentSection') },
    { id: 'pages', icon: FileText, label: t('menu.pages'), href: `/${locale}/admin/pages` },
    { id: 'products', icon: Package, label: t('menu.products'), href: `/${locale}/admin/products` },
    { id: 'services', icon: Wrench, label: t('menu.services'), href: `/${locale}/admin/services` },
    { id: 'careers', icon: Briefcase, label: t('menu.careers'), href: `/${locale}/admin/careers` },
    { id: 'news', icon: Newspaper, label: t('menu.news'), href: `/${locale}/admin/news` },
    { id: 'events', icon: Calendar, label: t('menu.events'), href: `/${locale}/admin/events` },
    { id: 'solutions', icon: Layers, label: t('menu.solutions'), href: `/${locale}/admin/solutions` },
    { id: 'testimonials', icon: MessageCircle, label: t('menu.testimonials'), href: `/${locale}/admin/testimonials` },
    { id: 'partners', icon: Handshake, label: t('menu.partners'), href: `/${locale}/admin/partners` },
    { type: 'divider', label: t('menu.siteSection') },
    { id: 'hero', icon: ImageIcon, label: t('menu.hero'), href: `/${locale}/admin/hero` },
    { id: 'galleries', icon: FileStack, label: 'Galeries', href: `/${locale}/admin/galleries` },
    { id: 'media', icon: Compass, label: 'Médiathèque', href: `/${locale}/admin/media` },
    { id: 'menu', icon: MenuIcon, label: t('menu.menuNav'), href: `/${locale}/admin/menus` },
    { id: 'legal', icon: Scale, label: t('menu.legal'), href: `/${locale}/admin/legal` },
    { id: 'emails', icon: Settings, label: 'Emails', href: `/${locale}/admin/emails` },
    { type: 'divider', label: t('menu.eshopSection') },
    { id: 'orders', icon: ShoppingCart, label: t('menu.orders'), href: `/${locale}/admin/orders` },
    { id: 'quotes', icon: FileText, label: t('menu.quotes'), href: `/${locale}/admin/quotes` },
    { id: 'clients', icon: Users, label: t('menu.clients'), href: `/${locale}/admin/clients` },
    { type: 'divider', label: t('menu.usersSection') },
    { id: 'users', icon: UserCog, label: t('menu.users'), href: `/${locale}/admin/users` },
    { id: 'permissions', icon: Shield, label: t('menu.permissions') || 'Permissions', href: `/${locale}/admin/permissions` },
    { id: 'applications', icon: FileCheck, label: t('menu.applications'), href: `/${locale}/admin/applications` },
    { type: 'divider', label: t('menu.configSection') },
    { id: 'translations', icon: Globe, label: t('menu.translations'), href: `/${locale}/admin/translations` },
    { id: 'settings', icon: Sliders, label: t('menu.settings'), href: `/${locale}/admin/settings` },
  ];

  const active = (() => {
    if (pathname.includes('/admin/dashboard')) return 'dashboard';
    if (pathname.includes('/admin/data/')) return pathname.split('/admin/data/')[1];
    if (pathname.includes('/admin/products')) return 'products';
    if (pathname.includes('/admin/services')) return 'services';
    if (pathname.includes('/admin/careers')) return 'careers';
    if (pathname.includes('/admin/news')) return 'news';
    if (pathname.includes('/admin/events')) return 'events';
    if (pathname.includes('/admin/solutions')) return 'solutions';
    if (pathname.includes('/admin/testimonials')) return 'testimonials';
    if (pathname.includes('/admin/partners')) return 'partners';
    if (pathname.includes('/admin/hero')) return 'hero';
    if (pathname.includes('/admin/galleries')) return 'galleries';
    if (pathname.includes('/admin/media')) return 'media';
    if (pathname.includes('/admin/menus')) return 'menu';
    if (pathname.includes('/admin/legal')) return 'legal';
    if (pathname.includes('/admin/emails')) return 'emails';
    if (pathname.includes('/admin/permissions')) return 'permissions';
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
  })();

  if (isLogin) {
    return (
      <div data-admin-theme={theme} dir={isRTL ? 'rtl' : 'ltr'} className="ad-app min-h-screen relative overflow-hidden">
        <div className="ad-grid-bg absolute inset-0 opacity-70" />
        <div className="absolute top-5 right-5 z-10 flex gap-2">
          <AdminLanguageSwitcher />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div data-admin-theme={theme} dir={isRTL ? 'rtl' : 'ltr'} className="ad-app">
      <aside
        className={`${open ? 'w-[272px]' : 'w-[76px]'} fixed inset-y-0 z-40 flex flex-col transition-all duration-300 ${isRTL ? 'right-0' : 'left-0'}`}
        style={{ background: 'var(--ad-sidebar)', color: 'var(--ad-sidebar-ink)' }}
      >
        <div className="h-[72px] px-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--ad-accent-2)', color: 'var(--ad-accent-2-ink)' }}>
            <Shield className="w-5 h-5" />
          </div>
          {open && (
            <div className="leading-tight">
              <div className="font-black tracking-tight">SARI OS</div>
              <div className="text-[10px] uppercase tracking-[0.18em] opacity-60">Admin · v2</div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto ad-scroll py-3">
          {menu.map((item, i) => {
            if (item.type === 'divider') {
              return open ? (
                <div key={i} className="px-5 pt-4 pb-1 text-[10px] uppercase tracking-[0.18em] opacity-40">{item.label}</div>
              ) : <div key={i} className="mx-3 my-2 border-t border-white/10" />;
            }
            const Icon = item.icon;
            const on = active === item.id;
            return (
              <Link
                key={item.id}
                href={item.href || '#'}
                className={`mx-2 mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  on ? 'bg-white/12 shadow-lg' : 'opacity-70 hover:opacity-100 hover:bg-white/6'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {open && <span className="truncate">{item.label}</span>}
                {on && open && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ad-accent-2)' }} />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link href={`/${locale}`} className="flex items-center gap-3 px-3 py-2 text-sm opacity-70 hover:opacity-100">
            <ExternalLink className="w-4 h-4" /> {open && t('header.seeSite')}
          </Link>
          <button onClick={() => { clearAdminSession(); router.push(`/${locale}`); }} className="flex items-center gap-3 px-3 py-2 text-sm text-rose-300 w-full">
            <LogOut className="w-4 h-4" /> {open && t('header.logout')}
          </button>
        </div>
      </aside>

      <div className={`min-h-screen transition-all duration-300 ${isRTL ? (open ? 'mr-[272px]' : 'mr-[76px]') : (open ? 'ml-[272px]' : 'ml-[76px]')}`}>
        <header className="sticky top-0 z-30 h-[72px] px-5 flex items-center justify-between backdrop-blur-xl border-b" style={{ background: 'color-mix(in srgb, var(--ad-surface) 82%, transparent)', borderColor: 'var(--ad-line)' }}>
          <div className="flex items-center gap-3">
            <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setOpen((v) => !v)}>
              <ChevronLeft className={`w-4 h-4 transition ${open ? '' : 'rotate-180'}`} />
            </button>
            <div className="hidden md:flex items-center gap-2 ad-input !w-72 !py-2">
              <Search className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />
              <input className="bg-transparent outline-none flex-1 text-sm" placeholder="Commande rapide…" readOnly />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="ad-btn ad-btn-ghost" onClick={() => setThemesOpen((v) => !v)}>
                <Palette className="w-4 h-4" /> <span className="hidden sm:inline">Thème</span>
              </button>
              {themesOpen && (
                <div className="absolute right-0 mt-2 w-56 ad-card p-2 z-50">
                  {ADMIN_THEMES.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => { setTheme(th.id); setThemesOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${theme === th.id ? 'bg-[var(--ad-surface-2)] font-bold' : ''}`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ background: th.swatch }} />
                      {th.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AdminLanguageSwitcher />
            <div className="pl-2 flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-black" style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}>
                {(user?.firstName || user?.email || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-sm font-bold">{user?.firstName || t('header.admin')}</div>
                <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{user?.email || t('header.adminEmail')}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode; title?: string }) {
  return (
    <AdminThemeProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </AdminThemeProvider>
  );
}
