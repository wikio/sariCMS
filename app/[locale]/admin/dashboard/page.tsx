'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, AlertTriangle, Award, Banknote, BarChart3, Briefcase, CalendarCheck2,
  CalendarDays, CheckCircle2, Clock, FileCheck, FileText, FolderKanban, HardDrive,
  Layers, MailCheck, Newspaper, Package, PenTool, Receipt, RefreshCw, ScrollText,
  ShieldCheck, SlidersHorizontal, Sparkles, UserCheck, Users, Wallet, Wrench,
} from 'lucide-react';
import { useAdminBrand } from '@/components/admin/BrandContext';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useAnalyticsLabels } from '@/components/admin/useAnalyticsLabels';
import AnalyticsExportMenu from '@/components/admin/AnalyticsExportMenu';
import {
  AnimatedCounter,
  ConfigurableChartCard,
  StackedProgressBar,
  type ChartVisualType,
} from '@/components/admin/charts/AnalyticsCharts';
import { cmsAdminFetch, cmsHealth, cmsStatus } from '@/lib/cms-admin';
import { docStatus } from '@/lib/settings-doc';
import { unwrapList } from '@/lib/cms';
import type { PaymentRecord } from '@/lib/payments';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';
import { formatBytes } from '@/lib/analytics-export';
import { getClientCsrfToken } from '@/lib/csrf';
import {
  DEFAULT_DASHBOARD_PREFS,
  type AnalyticsRange,
  type AnalyticsSnapshot,
  type DashboardPrefs,
} from '@/lib/analytics-types';

const QUOTES_TO_PROCESS = ['submitted', 'processing', 'pending', 'sent', 'revision'];

async function countWhere(resource: string, filter: Record<string, unknown>): Promise<number | null> {
  try {
    const shaped = Object.fromEntries(
      Object.entries(filter).map(([field, value]) => [field, Array.isArray(value) ? { in: value } : value]),
    );
    const page = await cmsAdminFetch<{ meta?: { total?: number } }>(
      `/${resource}?limit=1&filter=${encodeURIComponent(JSON.stringify(shaped))}`,
      { timeoutMs: 8000 },
    );
    const total = Number(page?.meta?.total);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

type SourceRow = { label: string; detail: string; base: boolean; href: string; count?: number | null };

const WIDGET_BLOCKS = ['overviewKpis', 'multiStatus', 'liveCharts', 'catalogTiles', 'todoAndSources', 'actionsAndLogs'] as const;

export default function AdminDashboardPage() {
  const { brand } = useAdminBrand();
  const locale = useLocale();
  const t = useTranslations('admin.dashboard');
  const tc = useTranslations('admin.common');
  const ta = useTranslations('admin.analytics');

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<Array<{ id?: string; action?: string; resource?: string; createdAt?: string }>>([]);
  const [pending, setPending] = useState<{ orders: number | null; quotes: number | null }>({ orders: null, quotes: null });
  const [ledger, setLedger] = useState<{ total: number; waiting: number; waitingAmount: number; source: 'base' | 'cache' | 'na' }>({
    total: 0, waiting: 0, waitingAmount: 0, source: 'na',
  });
  const [methods, setMethods] = useState<{ count: number; fromBase: boolean } | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const [range, setRange] = useState<AnalyticsRange>('all');
  const [rawSnapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const snapshot = useAnalyticsLabels(rawSnapshot);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS);
  const [configOpen, setConfigOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<'applications' | 'eventRegistrations' | 'workload' | 'ged' | 'content'>('eventRegistrations');

  const refresh = useCallback(async (selectedRange: AnalyticsRange, silent = false) => {
    if (silent) setRefreshing(true);
    const [health, status, analyticsRes] = await Promise.all([
      cmsHealth(),
      cmsStatus(),
      fetch(`/api/admin/analytics?range=${encodeURIComponent(selectedRange)}&locale=all`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    if (analyticsRes?.ok) {
      if (analyticsRes.snapshot) setSnapshot(analyticsRes.snapshot);
      if (analyticsRes.prefs) setPrefs(analyticsRes.prefs);
    }

    setConnected(Boolean(health || status?.connected || analyticsRes?.snapshot?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || analyticsRes?.snapshot?.driver || '');
    if (status?.counts) setCounts(status.counts);
    setUnavailable(status?.unavailable ?? []);

    try {
      setLogs(unwrapList(await cmsAdminFetch<unknown>('/audit-logs/recent?limit=6')));
    } catch {
      setLogs([]);
    }

    const [orders, quotes] = await Promise.all([
      countWhere('orders', { status: 'pending' }),
      countWhere('quotes', { status: QUOTES_TO_PROCESS }),
    ]);
    setPending({ orders, quotes });

    try {
      const rows = unwrapList(await cmsAdminFetch<unknown>('/payment-records/all', { timeoutMs: 8000 }));
      const list = rows as PaymentRecord[];
      setLedger({
        total: list.length,
        waiting: list.filter((r) => r.status === 'pending').length,
        waitingAmount: list.filter((r) => r.status === 'pending').reduce((a, r) => a + (Number(r.amount) || 0), 0),
        source: 'base',
      });
    } catch {
      setLedger((prev) => ({ ...prev, source: 'na' }));
    }

    const doc = await docStatus('payments');
    setMethods(doc.source === 'na' ? null : { count: doc.rows, fromBase: doc.source === 'db' });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh(range, false);
  }, [refresh, range, locale]);

  const updatePrefs = async (patch: Partial<DashboardPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      const csrf = getClientCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrf) headers['x-csrf-token'] = csrf;
      await fetch('/api/admin/analytics', {
        method: 'PUT',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ prefs: next }),
      });
    } catch {
      /* non bloquant */
    }
  };

  const isVisible = (id: string) => !prefs.hiddenWidgets.includes(id);
  const toggleWidget = (id: string) => {
    const hidden = prefs.hiddenWidgets.includes(id)
      ? prefs.hiddenWidgets.filter((w) => w !== id)
      : [...prefs.hiddenWidgets, id];
    void updatePrefs({ hiddenWidgets: hidden });
  };

  const chartConfig = useMemo(() => {
    if (!snapshot) return { title: '', subtitle: '', items: [] as Array<{ key?: string; label: string; value: number; color?: string }> };
    if (chartMetric === 'applications') {
      return {
        title: ta('jobApplicationsTitle'),
        subtitle: `${snapshot.applications.total} ${tc('total')} · ${snapshot.applications.acceptanceRate}% ${ta('acceptedShort')}`,
        items: snapshot.applications.byStatus,
      };
    }
    if (chartMetric === 'eventRegistrations') {
      return {
        title: ta('eventRegsTitle'),
        subtitle: `${snapshot.eventRegistrations.total} ${tc('total')} · ${snapshot.eventRegistrations.approvalRate}% ${ta('approvedShort')}`,
        items: snapshot.eventRegistrations.byStatus,
      };
    }
    if (chartMetric === 'workload') {
      return {
        title: ta('teamRemainingQueue'),
        subtitle: `${snapshot.team.workload.remaining} ${ta('remainingShort')} · ${snapshot.team.workload.inProgress} ${ta('inProgressShort')}`,
        items: snapshot.team.queues.map((q) => ({ key: q.key, label: q.label, value: q.remaining, color: q.color })),
      };
    }
    if (chartMetric === 'ged') {
      return {
        title: ta('gedByKindTitle'),
        subtitle: `${snapshot.ged.totalFiles} ${ta('filesShort')} · ${formatBytes(snapshot.ged.totalBytes, locale)}`,
        items: snapshot.ged.byKind.map((k) => ({ key: k.key, label: k.label, value: k.count, color: k.color })),
      };
    }
    return {
      title: ta('editorialOverview'),
      subtitle: ta('editorialOverviewSub'),
      items: [
        { key: 'articles', label: ta('articles'), value: snapshot.articles.total, color: '#169EC9' },
        { key: 'events', label: ta('events'), value: snapshot.events.total, color: '#8B5CF6' },
        { key: 'authors', label: ta('authors'), value: snapshot.authors.total, color: '#0F9F6E' },
        { key: 'newsletter', label: ta('newsletterActive'), value: snapshot.newsletter.subscribed, color: '#EAB616' },
        { key: 'jobsActive', label: ta('jobsActive'), value: snapshot.jobs.active, color: '#06B6D4' },
        { key: 'jobsDone', label: ta('jobsCompleted'), value: snapshot.jobs.completed, color: '#64748B' },
      ],
    };
  }, [snapshot, chartMetric, ta, locale]);

  if (loading) {
    return (
      <div className="ad-card">
        <PixelGridLoader label={tc('loading')} />
      </div>
    );
  }

  const n = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value);
  const anim = prefs.animationsEnabled;

  // Tuiles enrichies (Candidatures, Événements, Articles, Auteurs, Newsletter, Emplois, GED, Équipe)
  const spotlightTiles = snapshot
    ? [
        {
          label: ta('jobApplications'),
          value: snapshot.applications.total,
          sub: `${snapshot.applications.accepted} ${ta('acceptedShort')} · ${snapshot.applications.remaining} ${ta('remainingShort')}`,
          icon: Briefcase,
          color: '#169EC9',
          href: `/${locale}/admin/applications`,
        },
        {
          label: ta('eventRegistrations'),
          value: snapshot.eventRegistrations.total,
          sub: `${snapshot.eventRegistrations.approved} ${ta('approvedShort')} · ${snapshot.eventRegistrations.pending} ${ta('pendingShort')}`,
          icon: CalendarCheck2,
          color: '#8B5CF6',
          href: `/${locale}/admin/events/registrations`,
        },
        {
          label: ta('jobs'),
          value: snapshot.jobs.total,
          sub: `${snapshot.jobs.active} ${ta('activeShort')} · ${snapshot.jobs.completed} ${ta('completedShort')}`,
          icon: Award,
          color: '#0F9F6E',
          href: `/${locale}/admin/careers`,
        },
        {
          label: ta('articles'),
          value: snapshot.articles.total,
          sub: `${snapshot.articles.published} ${ta('publishedShort')} · ${snapshot.articles.draft} ${ta('draftShort')}`,
          icon: Newspaper,
          color: '#F97316',
          href: `/${locale}/admin/news`,
        },
        {
          label: ta('events'),
          value: snapshot.events.total,
          sub: `${snapshot.events.upcoming} ${ta('upcomingShort')} · ${snapshot.events.past} ${ta('pastShort')}`,
          icon: CalendarDays,
          color: '#06B6D4',
          href: `/${locale}/admin/events`,
        },
        {
          label: ta('authors'),
          value: snapshot.authors.total,
          sub: `${snapshot.authors.active} ${ta('activeAuthorsShort')}`,
          icon: PenTool,
          color: '#EC4899',
          href: `/${locale}/admin/authors`,
        },
        {
          label: ta('newsletterSubscribers'),
          value: snapshot.newsletter.subscribed,
          sub: `${snapshot.newsletter.total} ${tc('total')} · ${snapshot.newsletter.activeRate}% ${ta('activeShort')}`,
          icon: MailCheck,
          color: '#EAB616',
          href: `/${locale}/admin/newsletter`,
        },
        {
          label: ta('gedFiles'),
          value: snapshot.ged.totalFiles,
          sub: `${formatBytes(snapshot.ged.totalBytes, locale)} · ${snapshot.ged.utilizationRate}% ${ta('usedShort')}`,
          icon: FolderKanban,
          color: '#0EA5E9',
          href: `/${locale}/admin/media`,
        },
        {
          label: ta('teamAdminsEmployees'),
          value: snapshot.team.staffTotal,
          sub: `${snapshot.team.admins} ${ta('adminsShort')} · ${snapshot.team.employees} ${ta('employeesShort')}`,
          icon: ShieldCheck,
          color: '#6366F1',
          href: `/${locale}/admin/users`,
        },
        {
          label: ta('teamWorkload'),
          value: snapshot.team.workload.remaining,
          sub: `${snapshot.team.workload.inProgress} ${ta('inProgressShort')} · ${snapshot.team.workload.completionRate}% ${ta('doneShort')}`,
          icon: Clock,
          color: '#D97706',
          href: `/${locale}/admin/stats?tab=team`,
        },
      ]
    : [];

  const catalogTiles = [
    { label: t('tileProducts', { defaultMessage: 'Produits' }), value: counts.products ?? snapshot?.catalog.products, icon: Package, href: `/${locale}/admin/products` },
    { label: t('tileServices', { defaultMessage: 'Services' }), value: counts.services ?? snapshot?.catalog.services, icon: Wrench, href: `/${locale}/admin/services` },
    { label: t('tileSolutions', { defaultMessage: 'Solutions' }), value: counts.solutions ?? snapshot?.catalog.solutions, icon: Layers, href: `/${locale}/admin/solutions` },
    { label: t('tilePages', { defaultMessage: 'Pages' }), value: counts.pages, icon: FileText, href: `/${locale}/admin/pages` },
    { label: t('tileOrders', { defaultMessage: 'Commandes' }), value: counts.orders, icon: Receipt, href: `/${locale}/admin/orders` },
    { label: t('tileQuotes', { defaultMessage: 'Devis' }), value: counts.quotes, icon: FileCheck, href: `/${locale}/admin/quotes` },
    { label: t('tilePayments', { defaultMessage: 'Encaissements' }), value: counts.paymentRecords, icon: Banknote, href: `/${locale}/admin/payment-records` },
    { label: t('tileUsers', { defaultMessage: 'Comptes & contacts' }), value: counts.users, icon: Users, href: `/${locale}/admin/users` },
  ];

  const toHandle = [
    { label: ta('todoEventRegs'), value: snapshot ? snapshot.eventRegistrations.toProcess : null, href: `/${locale}/admin/events/registrations` },
    { label: ta('todoJobApps'), value: snapshot ? snapshot.applications.remaining : null, href: `/${locale}/admin/applications` },
    { label: t('todoPayments', { defaultMessage: 'Encaissements à valider' }), value: ledger.source === 'na' ? null : ledger.waiting, href: `/${locale}/admin/payment-records`, amount: ledger.waitingAmount },
    { label: t('todoOrders', { defaultMessage: 'Commandes en attente' }), value: pending.orders, href: `/${locale}/admin/orders` },
    { label: t('todoQuotes', { defaultMessage: 'Devis à relancer' }), value: pending.quotes, href: `/${locale}/admin/quotes` },
    { label: ta('todoMessages'), value: snapshot && snapshot.commerce.source === 'api' ? snapshot.commerce.messagesUnread : null, href: `/${locale}/admin/messages` },
  ];

  const sources: SourceRow[] = [
    { label: ta('eventRegistrations'), detail: 'data/event-registrations.json', base: true, href: `/${locale}/admin/events/registrations`, count: snapshot?.eventRegistrations.total },
    { label: ta('gedFiles'), detail: 'public/uploads · GED', base: true, href: `/${locale}/admin/media`, count: snapshot?.ged.totalFiles },
    { label: ta('newsletterSubscribers'), detail: snapshot?.newsletter.source === 'api' ? 'newsletter_subscribers' : 'data/newsletter.json', base: true, href: `/${locale}/admin/newsletter`, count: snapshot?.newsletter.total },
    { label: t('srcPayments', { defaultMessage: 'Relevé d’encaissements' }), detail: 'payment_records', base: true, href: `/${locale}/admin/payment-records`, count: counts.paymentRecords },
    { label: t('srcPaymentMethods', { defaultMessage: 'Modes de paiement' }), detail: methods ? (methods.fromBase ? `doc_payments · ${methods.count}` : t('notRecorded', { document: 'doc_payments' })) : 'settings', base: Boolean(methods?.fromBase), href: `/${locale}/admin/payments`, count: methods?.count },
    { label: t('srcCoupons', { defaultMessage: 'Coupons' }), detail: 'coupons', base: true, href: `/${locale}/admin/coupons`, count: counts.coupons },
    { label: t('srcTaxes', { defaultMessage: 'Règles de taxes' }), detail: 'tax_rules', base: true, href: `/${locale}/admin/taxes`, count: counts.taxRules },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête + filtres rapides + personnalisation + export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--ad-muted)' }}>{brand.title}</div>
          <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>
            {t('subtitle', { defaultMessage: 'Les chiffres ci-dessous viennent de la base, pas du cache de ce navigateur.' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Sélecteur de période rapide */}
          <div className="inline-flex rounded-lg p-0.5 border text-xs" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
            {([
              ['7d', '7j'],
              ['30d', '30j'],
              ['90d', '90j'],
              ['all', ta('rangeAll')],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRange(val)}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${range === val ? 'ad-btn-primary' : 'opacity-75 hover:opacity-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void refresh(range, true)}
            className="ad-btn ad-btn-ghost !px-2.5"
            title={ta('refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              className="ad-btn ad-btn-ghost"
            >
              <SlidersHorizontal className="w-4 h-4" /> {ta('customize')}
            </button>
            {configOpen && (
              <div
                className="absolute right-0 mt-1.5 w-72 rounded-xl border shadow-xl p-3 z-40 space-y-2.5"
                style={{ background: 'var(--ad-surface)', borderColor: 'var(--ad-line)' }}
              >
                <div className="text-xs font-black uppercase tracking-wider">{ta('dashboardWidgets')}</div>
                <div className="space-y-1.5">
                  {WIDGET_BLOCKS.map((id) => (
                    <label key={id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVisible(id)}
                        onChange={() => toggleWidget(id)}
                      />
                      <span>{t(`widget_${id}`)}</span>
                    </label>
                  ))}
                </div>
                <div className="pt-2 border-t border-[var(--ad-line)] flex items-center justify-between text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.animationsEnabled}
                      onChange={(e) => void updatePrefs({ animationsEnabled: e.target.checked })}
                    />
                    <span>{ta('animations')}</span>
                  </label>
                  <button
                    type="button"
                    className="text-[11px] font-bold underline"
                    onClick={() => void updatePrefs(DEFAULT_DASHBOARD_PREFS)}
                  >
                    {ta('reset')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <AnalyticsExportMenu snapshot={snapshot} compact title={`${brand.title} — Tableau de bord`} />

          <Link href={`/${locale}/admin/stats`} className="ad-btn ad-btn-ghost">
            <BarChart3 className="w-4 h-4" /> {t('statistics')}
          </Link>
          <Link href={`/${locale}/admin/logs`} className="ad-btn ad-btn-ghost">
            <ScrollText className="w-4 h-4" /> {t('logs')}
          </Link>
          <div className={`ad-chip ${connected ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
            <Activity className="w-3 h-3" /> {connected ? `API ${driver || 'ok'}` : t('offline', { defaultMessage: 'Hors ligne' })}
          </div>
        </div>
      </div>

      {/* 1. Tuiles clés enrichies (Candidatures, Événements, Emplois, Articles, Auteurs, Newsletter, GED, Équipe) */}
      {isVisible('overviewKpis') && spotlightTiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {spotlightTiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className="ad-card p-4 ad-rise hover:-translate-y-0.5 transition-transform flex flex-col justify-between gap-3"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${tile.color} 16%, transparent)`, color: tile.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black">
                    <AnimatedCounter value={tile.value} animated={anim} />
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold truncate">{tile.label}</div>
                  <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                    {tile.sub}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 2. Blocs multi-statuts : Candidatures Emploi, Candidatures Événements, Emplois & Contenu, GED & Charge Équipe */}
      {isVisible('multiStatus') && snapshot && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Candidatures emploi (multi-statuts) */}
          <section className="ad-card p-5 space-y-3 ad-rise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#169EC9]" />
                <h3 className="font-black text-sm">{ta('jobApplicationsTitle')}</h3>
              </div>
              <Link href={`/${locale}/admin/applications`} className="text-xs font-bold hover:underline" style={{ color: 'var(--ad-accent)' }}>
                {ta('openModule')} →
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {snapshot.applications.byStatus.map((st) => (
                <div key={st.key} className="p-2 rounded-lg border" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
                  <div className="text-lg font-black tabular-nums" style={{ color: st.color }}>
                    <AnimatedCounter value={st.value} animated={anim} />
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>{st.label}</div>
                </div>
              ))}
            </div>
            <StackedProgressBar
              segments={snapshot.applications.byStatus.map((s) => ({ ...s, color: s.color || '#169EC9' }))}
              animated={anim}
              emptyLabel={ta('noApplicationsYet')}
            />
          </section>

          {/* Candidatures événements (multi-statuts) */}
          <section className="ad-card p-5 space-y-3 ad-rise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="font-black text-sm">{ta('eventRegsTitle')}</h3>
              </div>
              <Link href={`/${locale}/admin/events/registrations`} className="text-xs font-bold hover:underline" style={{ color: 'var(--ad-accent)' }}>
                {ta('openModule')} →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {snapshot.eventRegistrations.byStatus.map((st) => (
                <div key={st.key} className="p-2 rounded-lg border" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
                  <div className="text-lg font-black tabular-nums" style={{ color: st.color }}>
                    <AnimatedCounter value={st.value} animated={anim} />
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>{st.label}</div>
                </div>
              ))}
            </div>
            <StackedProgressBar
              segments={snapshot.eventRegistrations.byStatus.map((s) => ({ ...s, color: s.color || '#8B5CF6' }))}
              animated={anim}
              emptyLabel={ta('noEventRegsYet')}
            />
          </section>

          {/* Offres d'emploi & Éditorial / Newsletter */}
          <section className="ad-card p-5 space-y-3 ad-rise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0F9F6E]" />
                <h3 className="font-black text-sm">{ta('jobsAndEditorial')}</h3>
              </div>
              <Link href={`/${locale}/admin/stats?tab=content`} className="text-xs font-bold hover:underline" style={{ color: 'var(--ad-accent)' }}>
                {ta('viewDetails')} →
              </Link>
            </div>
            <StackedProgressBar
              segments={snapshot.jobs.byStatus.map((s) => ({ ...s, color: s.color || '#0F9F6E' }))}
              animated={anim}
              emptyLabel={ta('noJobsYet')}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <MiniMetric icon={Newspaper} label={ta('articles')} value={snapshot.articles.total} sub={`${snapshot.articles.published} ${ta('publishedShort')}`} color="#F97316" />
              <MiniMetric icon={CalendarDays} label={ta('events')} value={snapshot.events.total} sub={`${snapshot.events.upcoming} ${ta('upcomingShort')}`} color="#06B6D4" />
              <MiniMetric icon={PenTool} label={ta('authors')} value={snapshot.authors.total} sub={`${snapshot.authors.active} ${ta('activeShort')}`} color="#EC4899" />
              <MiniMetric icon={MailCheck} label={ta('newsletter')} value={snapshot.newsletter.subscribed} sub={`${snapshot.newsletter.pending} ${ta('pendingShort')}`} color="#EAB616" />
            </div>
          </section>

          {/* GED & Équipe (Admins / Employés — traitements en cours et restants) */}
          <section className="ad-card p-5 space-y-3 ad-rise">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#0EA5E9]" />
                <h3 className="font-black text-sm">{ta('gedAndTeamCard')}</h3>
              </div>
              <Link href={`/${locale}/admin/stats?tab=team`} className="text-xs font-bold hover:underline" style={{ color: 'var(--ad-accent)' }}>
                {ta('viewDetails')} →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniMetric icon={FolderKanban} label={ta('gedFiles')} value={snapshot.ged.totalFiles} sub={formatBytes(snapshot.ged.totalBytes, locale)} color="#0EA5E9" />
              <MiniMetric icon={CheckCircle2} label={ta('gedUtilization')} value={snapshot.ged.utilizationRate} suffix="%" sub={`${snapshot.ged.usedFiles}/${snapshot.ged.totalFiles}`} color="#0F9F6E" />
              <MiniMetric icon={UserCheck} label={ta('inProgressShort')} value={snapshot.team.workload.inProgress} sub={`${snapshot.team.staffTotal} ${ta('staffShort')}`} color="#169EC9" />
              <MiniMetric icon={Clock} label={ta('remainingShort')} value={snapshot.team.workload.remaining} sub={`${snapshot.team.workload.completionRate}% ${ta('doneShort')}`} color="#D97706" />
            </div>
            <StackedProgressBar
              segments={[
                { key: 'completed', label: ta('completedWork'), value: snapshot.team.workload.completed, color: '#0F9F6E' },
                { key: 'inProgress', label: ta('inProgressWork'), value: snapshot.team.workload.inProgress, color: '#169EC9' },
                { key: 'waiting', label: ta('waitingWork'), value: Math.max(0, snapshot.team.workload.remaining - snapshot.team.workload.inProgress), color: '#EAB616' },
              ]}
              animated={anim}
              emptyLabel={ta('noWorkloadYet')}
            />
          </section>
        </div>
      )}

      {/* 3. Graphique dynamique configurable en direct + File de charge équipe */}
      {isVisible('liveCharts') && snapshot && (
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <ConfigurableChartCard
              title={chartConfig.title}
              subtitle={chartConfig.subtitle}
              icon={<Sparkles className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />}
              items={chartConfig.items}
              defaultType={prefs.defaultChartType as ChartVisualType}
              animated={anim}
              extraHeader={
                <select
                  className="ad-input !w-auto !py-1 text-xs"
                  value={chartMetric}
                  onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                  aria-label={ta('selectDataset')}
                >
                  <option value="eventRegistrations">{ta('eventRegistrations')}</option>
                  <option value="applications">{ta('jobApplications')}</option>
                  <option value="workload">{ta('teamRemainingQueue')}</option>
                  <option value="ged">{ta('gedFiles')}</option>
                  <option value="content">{ta('editorialOverview')}</option>
                </select>
              }
            />
          </div>

          <section className="ad-card p-5 lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
                {ta('teamQueuesTitle')}
              </h3>
              <span className="ad-chip ad-chip-acc tabular-nums">
                {snapshot.team.workload.completionRate}% {ta('doneShort')}
              </span>
            </div>
            <div className="space-y-2.5">
              {snapshot.team.queues.map((q) => (
                <Link
                  key={q.key}
                  href={`/${locale}${q.href}`}
                  className="block p-2 rounded-lg hover:bg-[var(--ad-surface-2)] transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold truncate">{q.label}</span>
                    <span className="tabular-nums shrink-0">
                      <span style={{ color: 'var(--ad-muted)' }}>{ta('inProgressShort')}:</span>{' '}
                      <b>{q.inProgress}</b> ·{' '}
                      <span style={{ color: 'var(--ad-muted)' }}>{ta('remainingShort')}:</span>{' '}
                      <b style={{ color: q.remaining > 0 ? '#D97706' : '#0F9F6E' }}>{q.remaining}</b>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ad-surface-2)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${q.completionRate}%`, background: q.color }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 4. Tuiles Catalogue & Commerce */}
      {isVisible('catalogTiles') && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {catalogTiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="ad-card p-4 ad-rise hover:-translate-y-0.5 transition-transform"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-2xl font-black tabular-nums">{n(tile.value)}</span>
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--ad-muted)' }}>{tile.label}</div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 5. À traiter & Sources de données */}
      {isVisible('todoAndSources') && (
        <div className="grid lg:grid-cols-3 gap-4">
          <section className="ad-card p-5 ad-rise">
            <h3 className="ad-section-title">{t('toHandle', { defaultMessage: 'À traiter' })}</h3>
            <ul className="space-y-1">
              {toHandle.map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]">
                    <span>{item.label}</span>
                    <span className="flex items-center gap-2">
                      {typeof item.amount === 'number' && item.amount > 0 && (
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ad-muted)' }}>{money(item.amount)}</span>
                      )}
                      <b className="tabular-nums">{n(item.value)}</b>
                      {item.value ? <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ad-warn, #b45309)' }} /> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs mt-3" style={{ color: 'var(--ad-muted)' }}>
              {t('naIsNotZero', { defaultMessage: 'Un tiret veut dire « non mesurable ici » : droits insuffisants, API muette ou pilote sans table. Jamais « rien à faire ».' })}
            </p>
          </section>

          <section className="ad-card p-5 ad-rise lg:col-span-2">
            <h3 className="ad-section-title">
              <HardDrive className="w-4 h-4" /> {t('dataSource', { defaultMessage: 'Données & source' })}
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--ad-muted)' }}>
              {t('dataSourceHelp', {
                defaultMessage: 'Une liste qui semble vide vient rarement d’un bug d’affichage : soit la base ne contient encore rien (l’écran garde alors ses valeurs par défaut, non partagées), soit elle contient quelque chose que ce poste n’a pas le droit de lire.',
              })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--ad-muted)' }} className="text-left">
                    <th className="font-semibold py-1">{t('thScreen', { defaultMessage: 'Écran' })}</th>
                    <th className="font-semibold py-1">{t('thTable', { defaultMessage: 'Table ou document' })}</th>
                    <th className="font-semibold py-1 text-right">{t('thRows', { defaultMessage: 'Lignes' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((row) => (
                    <tr key={row.label} className="border-t border-[var(--ad-border)]">
                      <td className="py-2">
                        <Link href={row.href} className="hover:underline">{row.label}</Link>
                      </td>
                      <td className="py-2" style={{ color: 'var(--ad-muted)' }}>
                        <code className="text-xs">{row.detail}</code>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`ad-chip ${row.base ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
                          {row.base ? t('inBase', { defaultMessage: 'en base' }) : t('inBrowser', { defaultMessage: 'cache du poste' })}
                        </span>
                        {row.count !== undefined ? <span className="ml-2 tabular-nums font-semibold">{n(row.count)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unavailable.length > 0 && (
              <p className="text-sm mt-3 flex items-start gap-2" style={{ color: 'var(--ad-warn, #b45309)' }}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {t('unavailable', { defaultMessage: 'Compteurs que la base n’a pas fournis' })} :{' '}
                  <code className="text-xs">{unavailable.join(' · ')}</code>.
                </span>
              </p>
            )}
            {ledger.source === 'base' && (
              <p className="text-xs mt-3" style={{ color: 'var(--ad-muted)' }}>
                <Wallet className="w-3 h-3 inline mr-1" />
                {t('ledgerLine', {
                  defaultMessage: '{total} ligne(s) d’encaissement lues dans la base ; {waiting} en attente de validation pour {amount}.',
                  total: ledger.total,
                  waiting: ledger.waiting,
                  amount: money(ledger.waitingAmount),
                })}
              </p>
            )}
          </section>
        </div>
      )}

      {/* 6. Actions rapides & activité récente */}
      {isVisible('actionsAndLogs') && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="ad-card p-5">
            <h3 className="ad-section-title">{t('actions')}</h3>
            <div className="space-y-1">
              {[
                [`/${locale}/admin/stats`, ta('openFullStats')],
                [`/${locale}/admin/events/registrations`, ta('eventRegistrations')],
                [`/${locale}/admin/applications`, ta('jobApplications')],
                [`/${locale}/admin/media/studio`, ta('openLogoStudio')],
                [`/${locale}/admin/news/new`, t('newArticle', { defaultMessage: 'Nouvel article' })],
                [`/${locale}/admin/products/new`, t('newProduct', { defaultMessage: 'Nouveau produit' })],
                [`/${locale}/admin/settings?tab=demo`, t('demoLink', { defaultMessage: 'Import & jeu de démonstration' })],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="block px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)] rounded-md">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="ad-card p-5 lg:col-span-2">
            <h3 className="ad-section-title">
              <Newspaper className="w-4 h-4" /> {t('recentActivity')}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--ad-muted)' }}>
                {n(counts.news ?? snapshot?.articles.total)} {t('publishedCount', { defaultMessage: 'publications,' })}{' '}
                {n(counts.events ?? snapshot?.events.total)} {t('eventsCount', { defaultMessage: 'événements' })}
              </span>
            </h3>
            <ul className="space-y-2 text-sm">
              {logs.map((log) => (
                <li key={String(log.id)} className="flex justify-between gap-2">
                  <span>
                    <b>{log.action}</b> · {log.resource}
                  </span>
                  <span style={{ color: 'var(--ad-muted)' }}>
                    <DateText value={log.createdAt} timeOnly fallback="" />
                  </span>
                </li>
              ))}
              {logs.length === 0 && <li style={{ color: 'var(--ad-muted)' }}>{t('noActivity', { defaultMessage: 'Aucune activité pour l’instant.' })}</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  sub,
  color,
  suffix = '',
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  sub: string;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="p-2.5 rounded-lg border space-y-1" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
      <div className="flex items-center justify-between gap-1">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
        <span className="text-base font-black tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div className="text-[11px] font-bold truncate">{label}</div>
      <div className="text-[10px] truncate" style={{ color: 'var(--ad-muted)' }}>{sub}</div>
    </div>
  );
}
