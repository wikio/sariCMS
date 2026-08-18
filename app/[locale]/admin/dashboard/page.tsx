'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Package, Wrench, Layers, Briefcase, Newspaper, Calendar, FileText, Users,
  DownloadCloud, Zap, Activity,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsHealth, cmsImportCatalog, cmsStatus } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';

export default function AdminDashboardPage() {
  const locale = useLocale();
  const t = useTranslations('admin');
  const { showToast } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const refresh = async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) setCounts(status.counts);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [locale]);

  const handleImport = async (replace = false) => {
    setImporting(true);
    try {
      const result = await cmsImportCatalog(replace);
      const total = Object.values(result.imported || {}).reduce((a, b) => a + Number(b), 0);
      showToast(total ? `${total} fiches importées` : 'Catalogue déjà présent', 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Import impossible', 'error');
    } finally {
      setImporting(false);
    }
  };

  const tiles = [
    { label: t('dashboard.stats.products'), value: counts.products || 0, icon: Package, href: `/${locale}/admin/data/products` },
    { label: t('dashboard.stats.services'), value: counts.services || 0, icon: Wrench, href: `/${locale}/admin/data/services` },
    { label: t('dashboard.stats.solutions'), value: counts.solutions || 0, icon: Layers, href: `/${locale}/admin/data/solution-categories` },
    { label: t('dashboard.stats.careers'), value: counts.careers || 0, icon: Briefcase, href: `/${locale}/admin/data/careers` },
    { label: t('dashboard.stats.news'), value: counts.news || 0, icon: Newspaper, href: `/${locale}/admin/data/news` },
    { label: t('dashboard.stats.events'), value: counts.events || 0, icon: Calendar, href: `/${locale}/admin/data/events` },
    { label: 'Pages', value: counts.pages || 0, icon: FileText, href: `/${locale}/admin/pages` },
    { label: 'Utilisateurs', value: counts.users || 0, icon: Users, href: `/${locale}/admin/users` },
  ];

  if (loading) return <div className="ad-card"><PixelGridLoader label="Boot CMS" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--ad-muted)' }}>SARI OS</div>
          <h1 className="text-3xl font-black tracking-tight">Tableau de bord</h1>
        </div>
        <div className={`ad-chip ${connected ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
          <Activity className="w-3 h-3" /> {connected ? `API ${driver || 'ok'}` : 'Hors ligne'}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className={`ad-card p-4 ad-rise hover:-translate-y-1 transition-transform`} style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-3xl font-black tabular-nums">{tile.value}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ad-muted)' }}>{tile.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ad-card p-5 ad-rise ad-rise-2">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: 'var(--ad-accent-2)' }} /> Actions</h3>
          <div className="space-y-1">
            {[
              [`/${locale}/admin/data/products`, 'Nouveau produit'],
              [`/${locale}/admin/data/news`, 'Nouvel article'],
              [`/${locale}/admin/pages`, 'Éditeur de pages'],
              [`/${locale}/admin/translations`, 'Traductions'],
              [`/${locale}/admin/users`, 'Utilisateurs'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="block px-3 py-2 rounded-xl text-sm hover:bg-[var(--ad-surface-2)]">{label}</Link>
            ))}
          </div>
        </div>
        <div className="ad-card p-5 lg:col-span-2 ad-rise ad-rise-3">
          <h3 className="font-bold mb-2 flex items-center gap-2"><DownloadCloud className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} /> Catalogue</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--ad-muted)' }}>
            Importez `data/fr|en|ar` dans le CMS pour alimenter toutes les listes avancées.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="ad-btn ad-btn-primary" disabled={importing || !connected} onClick={() => handleImport(false)}>
              {importing ? 'Import…' : 'Importer le catalogue'}
            </button>
            <button className="ad-btn ad-btn-ghost" disabled={importing || !connected} onClick={() => handleImport(true)}>
              Réimporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
