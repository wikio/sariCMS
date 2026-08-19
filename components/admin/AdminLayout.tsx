'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard, FileText, Package, Wrench, Briefcase, Newspaper,
  Calendar, Layers, MessageCircle, Handshake, Image as ImageIcon,
  FileStack, Menu as MenuIcon, Compass, Scale, Settings, ShoppingCart,
  Users, UserCog, FileCheck, Globe, Sliders, ExternalLink, LogOut,
  Shield, Search, ChevronDown, ChevronLeft, Palette, BarChart3, ScrollText,
  Tags, UserPlus, UserRound,
} from 'lucide-react';
import '@/app/admin.css';
import { ToastProvider } from '@/components/admin/Toast';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';
import { AdminThemeProvider, ADMIN_THEMES, useAdminTheme } from '@/components/admin/AdminTheme';
import { clearAdminSession, hasAdminSession, readAdminUser } from '@/lib/admin-session';

interface Child { id: string; label: string; href: string }
interface Item {
  id?: string;
  type?: 'divider' | 'group';
  icon?: React.ElementType;
  label: string;
  href?: string;
  children?: Child[];
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
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState<string>('products');
  const [user, setUser] = useState(readAdminUser());
  const [q, setQ] = useState('');
  const isLogin = pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`;

  useEffect(() => {
    setUser(readAdminUser());
    if (!isLogin && !hasAdminSession()) router.push(`/${locale}/admin`);
  }, [pathname, locale, isLogin, router]);

  const menu: Item[] = useMemo(() => [
    { type: 'divider', label: t('menu.pilotageSection') },
    { id: 'dashboard', icon: LayoutDashboard, label: t('menu.dashboard'), href: `/${locale}/admin/dashboard` },
    { id: 'stats', icon: BarChart3, label: t('menu.stats'), href: `/${locale}/admin/stats` },
    { id: 'logs', icon: ScrollText, label: t('menu.logs'), href: `/${locale}/admin/logs` },
    { type: 'divider', label: t('menu.contentSection') },
    {
      id: 'products', type: 'group', icon: Package, label: t('menu.products'), href: `/${locale}/admin/products`,
      children: [
        { id: 'products-list', label: 'Liste', href: `/${locale}/admin/products` },
        { id: 'products-cat', label: 'Catégories', href: `/${locale}/admin/taxonomies?key=products.category` },
        { id: 'products-type', label: 'Types', href: `/${locale}/admin/taxonomies?key=products.type` },
        { id: 'products-spec', label: 'Spécifications', href: `/${locale}/admin/taxonomies?key=products.spec` },
        { id: 'products-attr', label: 'Attributs', href: `/${locale}/admin/taxonomies?key=products.attribute` },
      ],
    },
    { id: 'services', icon: Wrench, label: t('menu.services'), href: `/${locale}/admin/services` },
    { id: 'solutions', icon: Layers, label: t('menu.solutions'), href: `/${locale}/admin/solutions` },
    { id: 'news', icon: Newspaper, label: t('menu.news'), href: `/${locale}/admin/news` },
    { id: 'events', icon: Calendar, label: t('menu.events'), href: `/${locale}/admin/events` },
    { id: 'careers', icon: Briefcase, label: t('menu.careers'), href: `/${locale}/admin/careers` },
    { id: 'testimonials', icon: MessageCircle, label: t('menu.testimonials'), href: `/${locale}/admin/testimonials` },
    { id: 'partners', icon: Handshake, label: t('menu.partners'), href: `/${locale}/admin/partners` },
    { id: 'pages', icon: FileText, label: t('menu.pages'), href: `/${locale}/admin/pages` },
    { type: 'divider', label: t('menu.siteSection') },
    { id: 'menu', icon: MenuIcon, label: t('menu.menuNav'), href: `/${locale}/admin/menus` },
    { id: 'hero', icon: ImageIcon, label: t('menu.hero'), href: `/${locale}/admin/hero` },
    { id: 'galleries', icon: FileStack, label: t('menu.galleries'), href: `/${locale}/admin/galleries` },
    { id: 'media', icon: Compass, label: t('menu.media'), href: `/${locale}/admin/media` },
    { id: 'legal', icon: Scale, label: t('menu.legal'), href: `/${locale}/admin/legal` },
    { type: 'divider', label: t('menu.crmSection') },
    { id: 'orders', icon: ShoppingCart, label: t('menu.orders'), href: `/${locale}/admin/orders` },
    { id: 'quotes', icon: FileText, label: t('menu.quotes'), href: `/${locale}/admin/quotes` },
    { id: 'clients', icon: Users, label: t('menu.clients'), href: `/${locale}/admin/clients` },
    { id: 'candidates', icon: UserPlus, label: t('menu.candidates'), href: `/${locale}/admin/candidates` },
    { id: 'applications', icon: FileCheck, label: t('menu.applications'), href: `/${locale}/admin/applications` },
    { type: 'divider', label: t('menu.configSection') },
    { id: 'taxonomies', icon: Tags, label: t('menu.taxonomies'), href: `/${locale}/admin/taxonomies` },
    { id: 'users', icon: UserCog, label: t('menu.users'), href: `/${locale}/admin/users` },
    { id: 'permissions', icon: Shield, label: t('menu.permissions'), href: `/${locale}/admin/permissions` },
    { id: 'translations', icon: Globe, label: t('menu.translations'), href: `/${locale}/admin/translations` },
    { id: 'emails', icon: Settings, label: t('menu.emails'), href: `/${locale}/admin/emails` },
    { id: 'settings', icon: Sliders, label: t('menu.settings'), href: `/${locale}/admin/settings` },
    { id: 'profile', icon: UserRound, label: 'Profil', href: `/${locale}/admin/profile` },
  ], [locale, t]);

  const active = pathname.includes('/admin/taxonomies') && pathname.includes('products') ? 'products'
    : pathname.includes('/admin/products') ? 'products'
    : pathname.includes('/admin/profile') ? 'profile'
    : pathname.includes('/admin/search') ? 'search'
    : menu.find((m) => m.href && pathname.includes(m.href.replace(`/${locale}`, '')))?.id || null;

  if (isLogin) {
    return (
      <div data-admin-theme={theme} dir={isRTL ? 'rtl' : 'ltr'} className="ad-app min-h-screen relative overflow-hidden">
        <div className="ad-grid-bg absolute inset-0 opacity-70" />
        <div className="absolute top-5 right-5 z-10 flex gap-2"><AdminLanguageSwitcher /></div>
        {children}
      </div>
    );
  }

  return (
    <div data-admin-theme={theme} dir={isRTL ? 'rtl' : 'ltr'} className="ad-app">
      <aside className={`${open ? 'w-[272px]' : 'w-[76px]'} fixed inset-y-0 z-40 flex flex-col transition-all duration-300 ${isRTL ? 'right-0' : 'left-0'}`} style={{ background: 'var(--ad-sidebar)', color: 'var(--ad-sidebar-ink)' }}>
        <div className="h-[72px] px-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--ad-accent-2)', color: 'var(--ad-accent-2-ink)', borderRadius: 2 }}>
            <Shield className="w-5 h-5" />
          </div>
          {open && <div className="leading-tight"><div className="font-black tracking-tight">SARI OS</div><div className="text-[10px] uppercase tracking-[0.18em] opacity-60">Admin · v3</div></div>}
        </div>
        <nav className="flex-1 overflow-y-auto ad-scroll py-3">
          {menu.map((item, i) => {
            if (item.type === 'divider') {
              return open ? <div key={i} className="px-5 pt-4 pb-1 text-[10px] uppercase tracking-[0.18em] opacity-40">{item.label}</div> : <div key={i} className="mx-3 my-2 border-t border-white/10" />;
            }
            const Icon = item.icon;
            const on = active === item.id || pathname.includes(`/${item.id}`);
            if (item.type === 'group' && item.children) {
              const shown = expanded === item.id && open;
              return (
                <div key={item.id}>
                  <button type="button" onClick={() => setExpanded((v) => v === item.id ? '' : item.id || '')} className={`mx-2 mb-0.5 w-[calc(100%-1rem)] flex items-center gap-3 px-3 py-2.5 text-sm ${on ? 'bg-white/12' : 'opacity-70 hover:opacity-100 hover:bg-white/6'}`}>
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    {open && <span className="truncate flex-1 text-left">{item.label}</span>}
                    {open && <ChevronDown className={`w-3.5 h-3.5 ${shown ? '' : '-rotate-90'}`} />}
                  </button>
                  {shown && item.children.map((ch) => (
                    <Link key={ch.id} href={ch.href} className="mx-2 mb-0.5 flex items-center pl-10 pr-3 py-2 text-xs opacity-70 hover:opacity-100 hover:bg-white/6">
                      {ch.label}
                    </Link>
                  ))}
                </div>
              );
            }
            return (
              <Link key={item.id} href={item.href || '#'} className={`mx-2 mb-0.5 flex items-center gap-3 px-3 py-2.5 text-sm transition-all ${on ? 'bg-white/12' : 'opacity-70 hover:opacity-100 hover:bg-white/6'}`}>
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {open && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link href={`/${locale}`} className="flex items-center gap-3 px-3 py-2 text-sm opacity-70 hover:opacity-100"><ExternalLink className="w-4 h-4" /> {open && t('header.seeSite')}</Link>
        </div>
      </aside>

      <div className={`min-h-screen transition-all duration-300 ${isRTL ? (open ? 'mr-[272px]' : 'mr-[76px]') : (open ? 'ml-[272px]' : 'ml-[76px]')}`}>
        <header className="sticky top-0 z-30 h-[72px] px-5 flex items-center justify-between backdrop-blur-xl border-b" style={{ background: 'color-mix(in srgb, var(--ad-surface) 82%, transparent)', borderColor: 'var(--ad-line)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setOpen((v) => !v)}><ChevronLeft className={`w-4 h-4 transition ${open ? '' : 'rotate-180'}`} /></button>
            <form className="flex-1 max-w-xl" onSubmit={(e) => { e.preventDefault(); router.push(`/${locale}/admin/search?q=${encodeURIComponent(q)}`); }}>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
                <input className="ad-input pl-9 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche globale…" />
              </div>
            </form>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="ad-btn ad-btn-ghost" onClick={() => setThemesOpen((v) => !v)}><Palette className="w-4 h-4" /> <span className="hidden sm:inline">Thème</span></button>
              {themesOpen && (
                <div className="absolute right-0 mt-2 w-56 ad-card p-2 z-50">
                  {ADMIN_THEMES.map((th) => (
                    <button key={th.id} onClick={() => { setTheme(th.id); setThemesOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-sm ${theme === th.id ? 'bg-[var(--ad-surface-2)] font-bold' : ''}`}>
                      <span className="w-3.5 h-3.5" style={{ background: th.swatch }} />{th.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AdminLanguageSwitcher />
            <div className="relative pl-2">
              <button type="button" className="flex items-center gap-2" onClick={() => setUserOpen((v) => !v)}>
                <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-black" style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)', borderRadius: 2 }}>
                  {(user?.firstName || user?.email || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden md:block leading-tight text-left">
                  <div className="text-sm font-bold">{user?.firstName || t('header.admin')}</div>
                  <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{user?.email || t('header.adminEmail')}</div>
                </div>
              </button>
              {userOpen && (
                <div className="absolute right-0 mt-2 w-56 ad-card p-2 z-50">
                  <Link href={`/${locale}/admin/profile`} className="block px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]" onClick={() => setUserOpen(false)}>Afficher le profil</Link>
                  <Link href={`/${locale}/admin/profile?edit=1`} className="block px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]" onClick={() => setUserOpen(false)}>Mettre à jour le profil</Link>
                  <button className="w-full text-left px-3 py-2 text-sm text-rose-500" onClick={() => { clearAdminSession(); router.push(`/${locale}`); }}>
                    <LogOut className="w-4 h-4 inline mr-2" />{t('header.logout')}
                  </button>
                </div>
              )}
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
