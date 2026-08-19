'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, DonutChart } from '@/components/admin/charts/MiniCharts';
import { loadOrders, orderRevenue, type Order } from '@/lib/crm-store';
import { loadCoupons, loadTaxes, type Coupon, type TaxRule } from '@/lib/shop-store';

export default function ShopStatsPage() {
  const [period, setPeriod] = useState('month');
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  useEffect(() => {
    setOrders(loadOrders());
    setCoupons(loadCoupons());
    setTaxes(loadTaxes());
  }, []);

  const delivered = orders.filter((o) => o.status === 'delivered');
  const ca = orderRevenue(orders);
  const costs = delivered.reduce((s, o) => s + Number(o.cost || 0), 0);
  const discounted = coupons.reduce((s, c) => s + (c.type === 'percent' ? 0 : c.amount * c.used), 0);

  const byPay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) map[o.payment || 'autre'] = (map[o.payment || 'autre'] || 0) + o.total;
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: ['#199ACA', '#C6DA34', '#EBB518', '#333'][i % 4] }));
  }, [orders]);

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of delivered) {
      const k = o.date.slice(0, 7);
      map[k] = (map[k] || 0) + o.total;
    }
    return Object.entries(map).map(([label, value]) => ({ label, value, color: '#199ACA' }));
  }, [delivered]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">E-shop / Statistiques avancées</div>
          <h1 className="text-3xl font-black">Pilotage boutique</h1>
        </div>
        <select className="ad-select w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="day">Jour</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
          <option value="year">Année</option>
        </select>
      </header>
      <div className="grid md:grid-cols-4 gap-3">
        {[
          [ca.toLocaleString() + ' DA', 'CA livré'],
          [(ca - costs).toLocaleString() + ' DA', 'Marge'],
          [orders.filter((o) => o.status === 'processing' || o.status === 'pending').length, 'En cours'],
          [coupons.reduce((s, c) => s + c.revenue, 0).toLocaleString() + ' DA', 'CA coupons'],
        ].map(([v, l]) => (
          <div key={String(l)} className="ad-card p-4">
            <div className="text-2xl font-black tabular-nums">{v}</div>
            <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <section className="ad-card p-5"><h2 className="ad-section-title">Ventes finalisées</h2><BarChart items={byMonth} /></section>
        <section className="ad-card p-5"><h2 className="ad-section-title">Par mode de paiement</h2><DonutChart items={byPay} /></section>
      </div>
      <section className="ad-card p-5">
        <h2 className="ad-section-title">Coupons & taxes</h2>
        <p className="text-sm">Remises estimées : {discounted.toLocaleString()} DA · Taxes actives : {taxes.filter((t) => t.active).map((t) => t.name).join(', ') || '—'}</p>
      </section>
    </div>
  );
}
