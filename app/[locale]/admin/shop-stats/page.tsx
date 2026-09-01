'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BarChart, DonutChart } from '@/components/admin/charts/MiniCharts';
import { loadOrders, loadQuotes, quoteConversion, type Order } from '@/lib/crm-store';
import { loadCouponUses, loadCoupons, loadTaxes, type Coupon } from '@/lib/shop-store';
import { computeTotals, money } from '@/lib/commerce-math';
import { useTranslations } from 'next-intl';

type Period = 'day' | 'week' | 'month' | 'year';

function bucketKey(date: string, period: Period) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  if (period === 'year') return String(d.getFullYear());
  if (period === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'week') {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
  }
  return date.slice(0, 10);
}

function inRange(date: string, from: string, to: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export default function ShopStatsPage() {
  const t = useTranslations('admin.shopStats');
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const quotes = typeof window === 'undefined' ? [] : loadQuotes();

  useEffect(() => {
    setOrders(loadOrders());
    setCoupons(loadCoupons());
  }, []);

  const scoped = orders.filter((o) => inRange(o.date, from, to));
  const taxes = loadTaxes();
  const uses = loadCouponUses();
  const delivered = scoped.filter((o) => o.status === 'delivered');
  const progress = scoped.filter((o) => o.status === 'processing' || o.status === 'pending' || o.status === 'shipped');
  const cancelled = scoped.filter((o) => o.status === 'cancelled');
  const ca = delivered.reduce((s, o) => s + o.total, 0);
  const costs = delivered.reduce((s, o) => s + Number(o.cost || 0), 0);
  const taxCollected = scoped.filter((o) => o.status !== 'cancelled').reduce((s, o) => {
    const coupon = coupons.find((c) => c.code === o.coupon);
    return s + computeTotals(o.items || [], taxes, coupon, { zone: o.zone }).taxTotal;
  }, 0);
  const discounted = uses.filter((u) => inRange(u.date, from, to)).reduce((s, u) => s + u.discount, 0);
  const conv = quoteConversion(quotes.filter((q) => inRange(q.date, from, to)));

  const byTime = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of delivered) {
      const k = bucketKey(o.date, period);
      map[k] = (map[k] || 0) + o.total;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value, color: '#199ACA' }));
  }, [delivered, period]);

  const byStatus = [
    { label: t("finalized"), value: delivered.length, color: '#C6DA34' },
    { label: 'En cours', value: progress.length, color: '#EBB518' },
    { label: t("cancelled", { defaultMessage: "Annulées" }), value: cancelled.length, color: '#e11d48' },
  ];

  const byPay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of scoped) map[o.payment || 'autre'] = (map[o.payment || 'autre'] || 0) + o.total;
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: ['#199ACA', '#C6DA34', '#EBB518', '#12323c', '#66757e'][i % 5] }));
  }, [scoped]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number; ca: number }> = {};
    for (const o of delivered) for (const it of o.items || []) {
      map[it.name] = map[it.name] || { qty: 0, ca: 0 };
      map[it.name].qty += it.quantity;
      map[it.name].ca += it.quantity * it.price;
    }
    return Object.entries(map).sort((a, b) => b[1].ca - a[1].ca).slice(0, 6);
  }, [delivered]);

  const topCats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of delivered) for (const it of o.items || []) {
      const k = it.category || 'Autre';
      map[k] = (map[k] || 0) + it.quantity * it.price;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [delivered]);

  const topClients = useMemo(() => {
    const map: Record<string, { ca: number; n: number }> = {};
    for (const o of delivered) {
      map[o.client] = map[o.client] || { ca: 0, n: 0 };
      map[o.client].ca += o.total;
      map[o.client].n += 1;
    }
    return Object.entries(map).sort((a, b) => b[1].ca - a[1].ca).slice(0, 6);
  }, [delivered]);

  const exportCsv = () => {
    const lines = [
      ['periode', period, from, to].join(';'),
      ['metrique', 'valeur'].join(';'),
      ['CA livré', ca].join(';'),
      ['Marge', ca - costs].join(';'),
      [t("taxesCollected"), Math.round(taxCollected)].join(';'),
      ['Remises coupons', discounted].join(';'),
      ['Taux conversion devis', `${Math.round(conv.rate * 100)}%`].join(';'),
      '',
      ['produit', 'qte', 'ca'].join(';'),
      ...topProducts.map(([n, v]) => [n, v.qty, v.ca].join(';')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shop-stats-${period}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="ad-breadcrumb">E-shop / Statistiques avancées</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="ad-input w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="ad-input w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="ad-select w-36" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="day">{t("day")}</option>
            <option value="week">{t("week")}</option>
            <option value="month">{t("month")}</option>
            <option value="year">{t("year")}</option>
          </select>
          <button className="ad-btn ad-btn-ghost" onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</button>
        </div>
      </header>
      <div className="grid md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          [money(ca), 'CA livré'],
          [money(ca - costs), 'Marge nette'],
          [progress.length, 'En cours'],
          [cancelled.length, t("cancelled", { defaultMessage: "Annulées" })],
          [money(taxCollected), t("taxesCollected")],
          [money(coupons.reduce((s, c) => s + c.revenue, 0)), 'CA coupons'],
        ].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <section className="ad-card p-5"><h2 className="ad-section-title">Évolution des ventes ({period})</h2><BarChart items={byTime} /></section>
        <section className="ad-card p-5"><h2 className="ad-section-title">Finalisées / en cours / annulées</h2><DonutChart items={byStatus} /></section>
        <section className="ad-card p-5"><h2 className="ad-section-title">{t("byPaymentMethod")}</h2><DonutChart items={byPay} /></section>
        <section className="ad-card p-5 space-y-2">
          <h2 className="ad-section-title">Devis → commandes</h2>
          <p className="text-sm">Taux de transformation : <strong>{Math.round(conv.rate * 100)} %</strong></p>
          <p className="text-sm">Délai moyen : <strong>{conv.avgDelay.toFixed(1)} j</strong></p>
          <p className="text-sm">Valeur moyenne convertis : <strong>{money(conv.convertedAvg)}</strong></p>
          <p className="text-sm">Valeur moyenne non convertis : <strong>{money(conv.otherAvg)}</strong></p>
          <p className="text-sm">Remises coupons sur la période : <strong>{money(discounted)}</strong></p>
        </section>
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <section className="ad-card p-5">
          <h2 className="ad-section-title">Top produits</h2>
          <ul className="text-sm space-y-1">{topProducts.map(([n, v]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><strong>{money(v.ca)}</strong></li>)}</ul>
        </section>
        <section className="ad-card p-5">
          <h2 className="ad-section-title">Top catégories</h2>
          <ul className="text-sm space-y-1">{topCats.map(([n, v]) => <li key={n} className="flex justify-between gap-2"><span>{n}</span><strong>{money(v)}</strong></li>)}</ul>
        </section>
        <section className="ad-card p-5">
          <h2 className="ad-section-title">Top clients</h2>
          <ul className="text-sm space-y-1">{topClients.map(([n, v]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><strong>{money(v.ca)}</strong></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
