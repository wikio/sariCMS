'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, Briefcase, Calendar, DownloadCloud, FileText, Layers, Newspaper,
  Package, ScrollText, Users, Wrench,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { BarChart, DonutChart } from '@/components/admin/charts/MiniCharts';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminFetch, cmsHealth, cmsImportCatalog, cmsStatus } from '@/lib/cms-admin';
import { unwrapList, CmsError } from '@/lib/cms';
import { loadOrders, orderRevenue } from '@/lib/crm-store';
import { seedDemoWorkspace } from '@/lib/demo-seed';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';

export default function AdminDashboardPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const t = useTranslations('admin.dashboard');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [logs, setLogs] = useState<Array<{ id?: string; action?: string; resource?: string; createdAt?: string }>>([]);
  const [orders, setOrders] = useState<ReturnType<typeof loadOrders>>([]);

  const refresh = async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) setCounts(status.counts);
    try {
      const recent = await cmsAdminFetch<unknown>('/audit-logs/recent?limit=6');
      setLogs(unwrapList(recent));
    } catch {
      setLogs([]);
    }
    setOrders(loadOrders());
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
    { label: 'Produits', value: counts.products || 0, icon: Package, href: `/${locale}/admin/products` },
    { label: 'Services', value: counts.services || 0, icon: Wrench, href: `/${locale}/admin/services` },
    { label: 'Solutions', value: counts.solutions || 0, icon: Layers, href: `/${locale}/admin/solutions` },
    { label: 'Offres', value: counts.careers || 0, icon: Briefcase, href: `/${locale}/admin/careers` },
    { label: 'Actualités', value: counts.news || 0, icon: Newspaper, href: `/${locale}/admin/news` },
    { label: t("events"), value: counts.events || 0, icon: Calendar, href: `/${locale}/admin/events` },
    { label: 'Pages', value: counts.pages || 0, icon: FileText, href: `/${locale}/admin/pages` },
    { label: 'Utilisateurs', value: counts.users || 0, icon: Users, href: `/${locale}/admin/users` },
  ];

  if (loading) return <div className="ad-card"><PixelGridLoader label="Boot CMS" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--ad-muted)' }}>SARI OS</div>
          <h1 className="text-3xl font-black tracking-tight">{t("title")}</h1>
        </div>
        <div className="flex gap-2 items-center">
          <Link href={`/${locale}/admin/stats`} className="ad-btn ad-btn-ghost">{t("statistics")}</Link>
          <Link href={`/${locale}/admin/logs`} className="ad-btn ad-btn-ghost"><ScrollText className="w-4 h-4" /> Journaux</Link>
          <div className={`ad-chip ${connected ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
            <Activity className="w-3 h-3" /> {connected ? `API ${driver || 'ok'}` : 'Hors ligne'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="ad-card p-4 ad-rise hover:-translate-y-0.5 transition-transform" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-3xl font-black tabular-nums">{tile.value}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ad-muted)' }}>{tile.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="ad-card p-5 ad-rise">
          <h3 className="ad-section-title">{t("contentDistribution")}</h3>
          <BarChart items={tiles.slice(0, 6).map((t, i) => ({
            label: t.label,
            value: t.value,
            color: ['#169EC9', '#C6DA34', '#EAB616', '#169EC9', '#333333', '#C6DA34'][i],
          }))} />
        </section>
        <section className="ad-card p-5 ad-rise">
          <h3 className="ad-section-title">Commandes · {money(orderRevenue(orders))} livrés</h3>
          <DonutChart items={[
            { label: t("delivered"), value: orders.filter((o) => o.status === 'delivered').length, color: '#0f9f6e' },
            { label: 'En cours', value: orders.filter((o) => o.status === 'processing' || o.status === 'shipped').length, color: '#169EC9' },
            { label: 'Attente', value: orders.filter((o) => o.status === 'pending').length, color: '#EAB616' },
            { label: t("cancelled"), value: orders.filter((o) => o.status === 'cancelled').length, color: '#e11d48' },
          ]} />
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ad-card p-5">
          <h3 className="ad-section-title">{t("actions")}</h3>
          <div className="space-y-1">
            {[
              [`/${locale}/admin/products/new`, 'Nouveau produit'],
              [`/${locale}/admin/news/new`, 'Nouvel article'],
              [`/${locale}/admin/menus`, 'Menus vitrine'],
              [`/${locale}/admin/orders`, 'Commandes'],
              [`/${locale}/admin/taxonomies`, 'Taxonomies'],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="block px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]">{label}</Link>
            ))}
          </div>
        </div>
        <div className="ad-card p-5">
          <h3 className="ad-section-title"><DownloadCloud className="w-4 h-4" /> Catalogue</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--ad-muted)' }}>
            Importez `data/fr|en|ar` dans le CMS pour alimenter les listes.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="ad-btn ad-btn-primary" disabled={importing || !connected} onClick={() => handleImport(false)}>
              {importing ? 'Import…' : 'Importer le catalogue'}
            </button>
            <button className="ad-btn ad-btn-ghost" disabled={importing || !connected} onClick={() => handleImport(true)}>
              Réimporter
            </button>
            <button className="ad-btn ad-btn-lime" disabled={seeding} onClick={async () => {
              setSeeding(true);
              try {
                const r = await seedDemoWorkspace();
                showToast(`Démo prête : ${r.orders} commandes, ${r.quotes} devis, ${r.applications} candidatures, ${r.people} fiches CRM`, 'success');
                await refresh();
              } catch {
                showToast('Jeu de démo partiel (API hors ligne pour le catalogue / CRM)', 'warning');
              } finally {
                setSeeding(false);
              }
            }}>
              {seeding ? 'Chargement…' : t("loadDemo")}
            </button>
          </div>
        </div>
        <div className="ad-card p-5">
          <h3 className="ad-section-title">{t("recentActivity")}</h3>
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li key={String(log.id)} className="flex justify-between gap-2">
                <span><b>{log.action}</b> · {log.resource}</span>
                <span style={{ color: 'var(--ad-muted)' }}><DateText value={log.createdAt} timeOnly fallback="" /></span>
              </li>
            ))}
            {logs.length === 0 && <li style={{ color: 'var(--ad-muted)' }}>Aucune activité pour l’instant.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
