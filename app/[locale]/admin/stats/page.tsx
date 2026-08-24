'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { BarChart, DonutChart } from '@/components/admin/charts/MiniCharts';
import { cmsStatus } from '@/lib/cms-admin';
import { loadOrders, loadQuotes, orderRevenue } from '@/lib/crm-store';

export default function StatsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.stats');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ReturnType<typeof loadOrders>>([]);
  const [quotes, setQuotes] = useState<ReturnType<typeof loadQuotes>>([]);

  useEffect(() => {
    (async () => {
      const status = await cmsStatus();
      if (status?.counts) setCounts(status.counts);
      setOrders(loadOrders());
      setQuotes(loadQuotes());
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="ad-card"><PixelGridLoader label="Statistiques" /></div>;

  const content = [
    { label: 'Produits', value: counts.products || 0, color: '#169EC9' },
    { label: 'Services', value: counts.services || 0, color: '#C6DA34' },
    { label: 'Actualités', value: counts.news || 0, color: '#EAB616' },
    { label: t("events", { defaultMessage: "Événements" }), value: counts.events || 0, color: '#169EC9' },
    { label: 'Offres', value: counts.careers || 0, color: '#333333' },
    { label: 'Pages', value: counts.pages || 0, color: '#C6DA34' },
  ];

  const orderDonut = [
    { label: t("delivered", { defaultMessage: "Livrées" }), value: orders.filter((o) => o.status === 'delivered').length, color: '#0f9f6e' },
    { label: 'En cours', value: orders.filter((o) => o.status === 'processing' || o.status === 'shipped').length, color: '#169EC9' },
    { label: 'Attente', value: orders.filter((o) => o.status === 'pending').length, color: '#EAB616' },
    { label: t("cancelled", { defaultMessage: "Annulées" }), value: orders.filter((o) => o.status === 'cancelled').length, color: '#e11d48' },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>{t("breadcrumb")}</div>
          <h1 className="text-3xl font-black tracking-tight">{t("title")}</h1>
        </div>
        <Link href={`/${locale}/admin/logs`} className="ad-btn ad-btn-ghost">{t("viewLogs")}</Link>
      </header>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          [Object.values(counts).reduce((a, b) => a + b, 0), 'Fiches CMS'],
          [orders.length, 'Commandes'],
          [`${orderRevenue(orders).toLocaleString()} DA`, 'CA livré'],
          [quotes.filter((q) => q.status === 'accepted').length, 'Devis acceptés'],
        ].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <section className="ad-card p-5">
          <h2 className="ad-section-title">{t("publishedContent")}</h2>
          <BarChart items={content} />
        </section>
        <section className="ad-card p-5">
          <h2 className="ad-section-title">{t("orderPipeline")}</h2>
          <DonutChart items={orderDonut} />
        </section>
      </div>
    </div>
  );
}
