'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, Award, BarChart3, Briefcase, CalendarCheck2, CalendarDays,
  CheckCircle2, Clock, FileCheck, FileText, Filter, FolderKanban, HardDrive,
  Layers, MailCheck, Newspaper, PenTool, RefreshCw, ScrollText, ShieldCheck,
  ShoppingBag, Sparkles, UserCheck, Users,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useAnalyticsLabels } from '@/components/admin/useAnalyticsLabels';
import AnalyticsExportMenu from '@/components/admin/AnalyticsExportMenu';
import {
  AnimatedCounter,
  ConfigurableChartCard,
  MultiSeriesTimelineChart,
  StackedProgressBar,
  type ChartVisualType,
} from '@/components/admin/charts/AnalyticsCharts';
import { formatBytes, type ExportScope } from '@/lib/analytics-export';
import { money } from '@/lib/commerce-math';
import DateText from '@/components/shared/DateText';
import {
  DEFAULT_DASHBOARD_PREFS,
  type AnalyticsGranularity,
  type AnalyticsLocaleFilter,
  type AnalyticsRange,
  type AnalyticsSnapshot,
  type DashboardPrefs,
} from '@/lib/analytics-types';

type StatsTab = 'overview' | 'recruitment' | 'events' | 'content' | 'ged' | 'team' | 'commerce';

const TAB_TO_SCOPE: Record<StatsTab, ExportScope> = {
  overview: 'all',
  recruitment: 'applications',
  events: 'eventRegistrations',
  content: 'content',
  ged: 'ged',
  team: 'team',
  commerce: 'commerce',
};

export default function StatsPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations('admin.stats');
  const ta = useTranslations('admin.analytics');

  const initialTab = (searchParams?.get('tab') as StatsTab) || 'overview';
  const validTabs: StatsTab[] = ['overview', 'recruitment', 'events', 'content', 'ged', 'team', 'commerce'];

  const [activeTab, setActiveTab] = useState<StatsTab>(validTabs.includes(initialTab) ? initialTab : 'overview');
  const [range, setRange] = useState<AnalyticsRange>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locFilter, setLocFilter] = useState<AnalyticsLocaleFilter>('all');
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('month');
  const [globalChartType, setGlobalChartType] = useState<ChartVisualType>('column');
  const [animations, setAnimations] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const [rawSnapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const snapshot = useAnalyticsLabels(rawSnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const wanted = searchParams?.get('tab') as StatsTab | null;
    if (wanted && validTabs.includes(wanted)) setActiveTab(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadAnalytics = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams();
        qs.set('range', range);
        qs.set('locale', locFilter);
        qs.set('granularity', granularity);
        if (range === 'custom') {
          if (from) qs.set('from', from);
          if (to) qs.set('to', to);
        }
        const res = await fetch(`/api/admin/analytics?${qs.toString()}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          snapshot?: AnalyticsSnapshot;
          prefs?: DashboardPrefs;
          error?: string;
        } | null;
        if (!res.ok || !json?.ok || !json.snapshot) {
          throw new Error(json?.error || ta('loadError'));
        }
        setSnapshot(json.snapshot);
        if (json.prefs && !silent) {
          setAnimations(json.prefs.animationsEnabled ?? DEFAULT_DASHBOARD_PREFS.animationsEnabled);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : ta('loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, from, to, locFilter, granularity, ta],
  );

  useEffect(() => {
    void loadAnalytics(false);
  }, [loadAnalytics]);

  const tabs: Array<{ id: StatsTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'overview', label: ta('tabOverview'), icon: Sparkles },
    { id: 'recruitment', label: ta('tabRecruitment'), icon: Briefcase },
    { id: 'events', label: ta('tabEvents'), icon: CalendarCheck2 },
    { id: 'content', label: ta('tabContent'), icon: Newspaper },
    { id: 'ged', label: ta('tabGed'), icon: FolderKanban },
    { id: 'team', label: ta('tabTeam'), icon: ShieldCheck },
    { id: 'commerce', label: ta('tabCommerce'), icon: ShoppingBag },
  ];

  const timelineSeries = useMemo(
    () => [
      { key: 'applications', label: ta('jobApplications'), color: '#169EC9' },
      { key: 'eventRegistrations', label: ta('eventRegistrations'), color: '#8B5CF6' },
      { key: 'articles', label: ta('articles'), color: '#F97316' },
      { key: 'newsletter', label: ta('newsletter'), color: '#EAB616' },
      { key: 'gedUploads', label: ta('gedFiles'), color: '#0EA5E9' },
      { key: 'orders', label: ta('orders'), color: '#0F9F6E' },
      { key: 'staffActions', label: ta('teamActions'), color: '#EC4899' },
    ],
    [ta],
  );

  const filteredStaff = useMemo(() => {
    if (!snapshot) return [];
    const q = searchFilter.trim().toLowerCase();
    if (!q) return snapshot.team.staffActivity;
    return snapshot.team.staffActivity.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q),
    );
  }, [snapshot, searchFilter]);

  const filteredEventRows = useMemo(() => {
    if (!snapshot) return [];
    const q = searchFilter.trim().toLowerCase();
    if (!q) return snapshot.eventRegistrations.byEvent;
    return snapshot.eventRegistrations.byEvent.filter((e) => e.title.toLowerCase().includes(q));
  }, [snapshot, searchFilter]);

  if (loading && !snapshot) {
    return (
      <div className="ad-card">
        <PixelGridLoader label={t('title')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            {t('breadcrumb')}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {ta('hubSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAnalytics(true)}
            className="ad-btn ad-btn-ghost"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {ta('refresh')}
          </button>

          <AnalyticsExportMenu
            snapshot={snapshot}
            scope={TAB_TO_SCOPE[activeTab]}
            title={`${t('title')} — ${tabs.find((x) => x.id === activeTab)?.label || ''}`}
          />

          <Link href={`/${locale}/admin/shop-stats`} className="ad-btn ad-btn-ghost">
            <ShoppingBag className="w-4 h-4" /> {ta('shopStatsLink')}
          </Link>
          <Link href={`/${locale}/admin/logs`} className="ad-btn ad-btn-ghost">
            <ScrollText className="w-4 h-4" /> {t('viewLogs')}
          </Link>
        </div>
      </header>

      {/* Barre de filtres & configuration dynamique */}
      <div className="ad-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--ad-muted)' }}>
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--ad-accent)' }} />
            {ta('filters')}
          </span>

          {/* Période */}
          <div className="inline-flex flex-wrap rounded-lg p-0.5 border text-xs" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
            {([
              ['7d', ta('range7d')],
              ['30d', ta('range30d')],
              ['90d', ta('range90d')],
              ['365d', ta('range365d')],
              ['all', ta('rangeAll')],
              ['custom', ta('rangeCustom')],
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

          {range === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input type="date" className="ad-input !w-auto !py-1 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span>→</span>
              <input type="date" className="ad-input !w-auto !py-1 text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}

          {/* Langue */}
          <select
            className="ad-input !w-auto !py-1.5 text-xs"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value as AnalyticsLocaleFilter)}
            aria-label={ta('localeFilter')}
          >
            <option value="all">{ta('allLocales')}</option>
            <option value="fr">FR — Français</option>
            <option value="en">EN — English</option>
            <option value="ar">AR — العربية</option>
          </select>

          {/* Granularité */}
          <select
            className="ad-input !w-auto !py-1.5 text-xs"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as AnalyticsGranularity)}
            aria-label={ta('granularity')}
          >
            <option value="day">{ta('granDay')}</option>
            <option value="week">{ta('granWeek')}</option>
            <option value="month">{ta('granMonth')}</option>
          </select>

          {/* Style de graphique global */}
          <select
            className="ad-input !w-auto !py-1.5 text-xs"
            value={globalChartType}
            onChange={(e) => setGlobalChartType(e.target.value as ChartVisualType)}
            aria-label={ta('defaultChartStyle')}
          >
            <option value="column">{ta('chartColumn')}</option>
            <option value="bar">{ta('chartBar')}</option>
            <option value="area">{ta('chartArea')}</option>
            <option value="donut">{ta('chartDonut')}</option>
            <option value="table">{ta('chartTable')}</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
            <input type="checkbox" checked={animations} onChange={(e) => setAnimations(e.target.checked)} />
            <span>{ta('animations')}</span>
          </label>
        </div>

        {/* Onglets de domaines */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--ad-line)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const on = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`ad-btn !py-1.5 !px-3 text-xs ${on ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="ad-card p-4 border-red-500/40 text-sm text-red-500">{error}</div>
      )}

      {snapshot && (
        <>
          {/* ===================== VUE GLOBALE ===================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={Briefcase} color="#169EC9" label={ta('jobApplications')} value={snapshot.applications.total} sub={`${snapshot.applications.accepted} ${ta('acceptedShort')} · ${snapshot.applications.remaining} ${ta('remainingShort')}`} animated={animations} />
                <KpiCard icon={CalendarCheck2} color="#8B5CF6" label={ta('eventRegistrations')} value={snapshot.eventRegistrations.total} sub={`${snapshot.eventRegistrations.approved} ${ta('approvedShort')} · ${snapshot.eventRegistrations.pending} ${ta('pendingShort')}`} animated={animations} />
                <KpiCard icon={Award} color="#0F9F6E" label={ta('jobs')} value={snapshot.jobs.total} sub={`${snapshot.jobs.active} ${ta('activeShort')} · ${snapshot.jobs.completed} ${ta('completedShort')}`} animated={animations} />
                <KpiCard icon={Newspaper} color="#F97316" label={ta('articlesAndAuthors')} value={snapshot.articles.total} sub={`${snapshot.authors.total} ${ta('authors')} (${snapshot.authors.active} ${ta('activeShort')})`} animated={animations} />
                <KpiCard icon={CalendarDays} color="#06B6D4" label={ta('events')} value={snapshot.events.total} sub={`${snapshot.events.upcoming} ${ta('upcomingShort')} · ${snapshot.events.past} ${ta('pastShort')}`} animated={animations} />
                <KpiCard icon={MailCheck} color="#EAB616" label={ta('newsletterSubscribers')} value={snapshot.newsletter.subscribed} sub={`${snapshot.newsletter.total} total · ${snapshot.newsletter.activeRate}% ${ta('activeShort')}`} animated={animations} />
                <KpiCard icon={FolderKanban} color="#0EA5E9" label={ta('gedFiles')} value={snapshot.ged.totalFiles} sub={`${formatBytes(snapshot.ged.totalBytes, locale)} · ${snapshot.ged.utilizationRate}% ${ta('usedShort')}`} animated={animations} />
                <KpiCard icon={ShieldCheck} color="#6366F1" label={ta('teamWorkload')} value={snapshot.team.workload.remaining} sub={`${snapshot.team.workload.inProgress} ${ta('inProgressShort')} · ${snapshot.team.staffTotal} ${ta('staffShort')}`} animated={animations} />
              </div>

              <MultiSeriesTimelineChart
                title={ta('timelineTitle')}
                subtitle={ta('timelineSub')}
                data={snapshot.timeline as unknown as Array<Record<string, string | number>>}
                series={timelineSeries}
                animated={animations}
              />

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('jobApplicationsTitle')}
                  subtitle={`${snapshot.applications.total} total · ${snapshot.applications.acceptanceRate}% ${ta('acceptedShort')}`}
                  icon={<Briefcase className="w-4 h-4 text-[#169EC9]" />}
                  items={snapshot.applications.byStatus}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('eventRegsTitle')}
                  subtitle={`${snapshot.eventRegistrations.total} total · ${snapshot.eventRegistrations.approvalRate}% ${ta('approvedShort')}`}
                  icon={<CalendarCheck2 className="w-4 h-4 text-[#8B5CF6]" />}
                  items={snapshot.eventRegistrations.byStatus}
                  defaultType={globalChartType === 'column' ? 'donut' : globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('teamRemainingQueue')}
                  subtitle={`${snapshot.team.workload.remaining} ${ta('remainingShort')} · ${snapshot.team.workload.completionRate}% ${ta('doneShort')}`}
                  icon={<Clock className="w-4 h-4 text-[#D97706]" />}
                  items={snapshot.team.queues.map((q) => ({ key: q.key, label: q.label, value: q.remaining, color: q.color }))}
                  defaultType={globalChartType === 'column' ? 'bar' : globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('gedByKindTitle')}
                  subtitle={`${snapshot.ged.totalFiles} ${ta('filesShort')} · ${formatBytes(snapshot.ged.totalBytes, locale)} · ${snapshot.ged.utilizationRate}% ${ta('usedShort')}`}
                  icon={<FolderKanban className="w-4 h-4 text-[#0EA5E9]" />}
                  items={snapshot.ged.byKind.map((k) => ({ key: k.key, label: k.label, value: k.count, color: k.color }))}
                  defaultType={globalChartType}
                  animated={animations}
                />
              </div>
            </div>
          )}

          {/* ===================== CANDIDATURES & EMPLOIS ===================== */}
          {activeTab === 'recruitment' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard icon={Briefcase} color="#169EC9" label={ta('totalApplications')} value={snapshot.applications.total} sub={`${snapshot.applications.withCv} ${ta('withCv')}`} animated={animations} />
                <KpiCard icon={Sparkles} color="#06B6D4" label={ta('statusNew')} value={snapshot.applications.new} sub={ta('toReview')} animated={animations} />
                <KpiCard icon={Clock} color="#EAB616" label={ta('statusInterview')} value={snapshot.applications.interview} sub={`${snapshot.applications.reviewed} ${ta('reviewedShort')}`} animated={animations} />
                <KpiCard icon={CheckCircle2} color="#0F9F6E" label={ta('statusAccepted')} value={snapshot.applications.accepted} sub={`${snapshot.applications.acceptanceRate}% ${ta('acceptanceRate')}`} animated={animations} />
                <KpiCard icon={Award} color="#10B981" label={ta('jobsActive')} value={snapshot.jobs.active} sub={`${snapshot.jobs.total} ${ta('jobsTotal')}`} animated={animations} />
                <KpiCard icon={FileCheck} color="#64748B" label={ta('jobsCompleted')} value={snapshot.jobs.completed} sub={`${snapshot.jobs.draft} ${ta('draftShort')}`} animated={animations} />
              </div>

              <div className="ad-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-base">{ta('recruitmentPipeline')}</h3>
                  <Link href={`/${locale}/admin/applications`} className="ad-btn ad-btn-ghost !py-1 text-xs">
                    {ta('openModule')} →
                  </Link>
                </div>
                <StackedProgressBar
                  segments={snapshot.applications.byStatus.map((s) => ({ ...s, color: s.color || '#169EC9' }))}
                  animated={animations}
                  height={14}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('jobApplicationsTitle')}
                  subtitle={`${snapshot.applications.inProgress} ${ta('inProgressShort')} · ${snapshot.applications.processed} ${ta('processedShort')}`}
                  icon={<Briefcase className="w-4 h-4 text-[#169EC9]" />}
                  items={snapshot.applications.byStatus}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('applicationsByOffer')}
                  icon={<Award className="w-4 h-4 text-[#0F9F6E]" />}
                  items={snapshot.applications.byOffer}
                  defaultType="bar"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('jobsStatusTitle')}
                  subtitle={`${snapshot.jobs.active} ${ta('activeShort')} · ${snapshot.jobs.completed} ${ta('completedShort')}`}
                  icon={<FileCheck className="w-4 h-4 text-[#0F9F6E]" />}
                  items={snapshot.jobs.byStatus}
                  defaultType="donut"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('jobsByContractType')}
                  icon={<Layers className="w-4 h-4 text-[#8B5CF6]" />}
                  items={snapshot.jobs.byType}
                  defaultType={globalChartType}
                  animated={animations}
                />
              </div>
            </div>
          )}

          {/* ===================== ÉVÉNEMENTS & PARTICIPATIONS ===================== */}
          {activeTab === 'events' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard icon={CalendarCheck2} color="#8B5CF6" label={ta('eventRegistrations')} value={snapshot.eventRegistrations.total} sub={`${snapshot.eventRegistrations.linkedClients} ${ta('linkedClients')}`} animated={animations} />
                <KpiCard icon={CheckCircle2} color="#0F9F6E" label={ta('approvedRegs')} value={snapshot.eventRegistrations.approved} sub={`${snapshot.eventRegistrations.approvalRate}% ${ta('approvalRate')}`} animated={animations} />
                <KpiCard icon={UserCheck} color="#169EC9" label={ta('attendedRegs')} value={snapshot.eventRegistrations.attended} sub={`${snapshot.eventRegistrations.attendanceRate}% ${ta('attendanceRate')}`} animated={animations} />
                <KpiCard icon={Clock} color="#EAB616" label={ta('pendingRegs')} value={snapshot.eventRegistrations.pending} sub={`${snapshot.eventRegistrations.waitlist} ${ta('waitlistShort')}`} animated={animations} />
                <KpiCard icon={CalendarDays} color="#06B6D4" label={ta('eventsUpcoming')} value={snapshot.events.upcoming} sub={`${snapshot.events.total} ${ta('eventsTotal')}`} animated={animations} />
                <KpiCard icon={FileText} color="#64748B" label={ta('eventsPast')} value={snapshot.events.past} sub={`${snapshot.events.draft} ${ta('draftShort')}`} animated={animations} />
              </div>

              <div className="ad-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-base">{ta('eventRegsBreakdown')}</h3>
                  <Link href={`/${locale}/admin/events/registrations`} className="ad-btn ad-btn-ghost !py-1 text-xs">
                    {ta('openModule')} →
                  </Link>
                </div>
                <StackedProgressBar
                  segments={snapshot.eventRegistrations.byStatus.map((s) => ({ ...s, color: s.color || '#8B5CF6' }))}
                  animated={animations}
                  height={14}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('eventRegsTitle')}
                  icon={<CalendarCheck2 className="w-4 h-4 text-[#8B5CF6]" />}
                  items={snapshot.eventRegistrations.byStatus}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('eventsByTypeTitle')}
                  icon={<CalendarDays className="w-4 h-4 text-[#06B6D4]" />}
                  items={snapshot.events.byType}
                  defaultType="donut"
                  animated={animations}
                />
              </div>

              {/* Tableau détaillé par événement */}
              <section className="ad-card p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-base">{ta('regsByEventTable')}</h3>
                  <input
                    className="ad-input !w-56 !py-1.5 text-xs"
                    placeholder={ta('searchPlaceholder')}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                        <th className="py-2">{ta('thEvent')}</th>
                        <th className="py-2 text-right">Total</th>
                        <th className="py-2 text-right">{ta('approvedShort')}</th>
                        <th className="py-2 text-right">{ta('pendingShort')}</th>
                        <th className="py-2 text-right">{ta('attendedShort')}</th>
                        <th className="py-2 text-right">{ta('rejectedShort')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEventRows.map((row) => (
                        <tr key={row.eventId + row.title} className="border-b border-[var(--ad-line)]/50">
                          <td className="py-2 font-semibold">{row.title}</td>
                          <td className="py-2 text-right font-black tabular-nums">{row.total}</td>
                          <td className="py-2 text-right tabular-nums text-emerald-600 font-bold">{row.approved}</td>
                          <td className="py-2 text-right tabular-nums text-amber-600 font-bold">{row.pending}</td>
                          <td className="py-2 text-right tabular-nums text-sky-600 font-bold">{row.attended}</td>
                          <td className="py-2 text-right tabular-nums text-rose-600">{row.rejected}</td>
                        </tr>
                      ))}
                      {filteredEventRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center" style={{ color: 'var(--ad-muted)' }}>
                            {ta('noEventRegsYet')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ===================== CONTENU, AUTEURS & NEWSLETTER ===================== */}
          {activeTab === 'content' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard icon={Newspaper} color="#F97316" label={ta('articles')} value={snapshot.articles.total} sub={`${snapshot.articles.published} ${ta('publishedShort')} · ${snapshot.articles.draft} ${ta('draftShort')}`} animated={animations} />
                <KpiCard icon={PenTool} color="#EC4899" label={ta('authors')} value={snapshot.authors.total} sub={`${snapshot.authors.active} ${ta('activeAuthorsShort')}`} animated={animations} />
                <KpiCard icon={MailCheck} color="#0F9F6E" label={ta('newsletterActive')} value={snapshot.newsletter.subscribed} sub={`${snapshot.newsletter.activeRate}% ${ta('ofTotal', { total: snapshot.newsletter.total })}`} animated={animations} />
                <KpiCard icon={Clock} color="#EAB616" label={ta('newsletterPending')} value={snapshot.newsletter.pending} sub={`${snapshot.newsletter.unsubscribed} ${ta('unsubscribedShort')}`} animated={animations} />
                <KpiCard icon={Layers} color="#169EC9" label={ta('catalogItems')} value={snapshot.catalog.totalCms} sub={`${snapshot.catalog.products} ${ta('productsShort')}`} animated={animations} />
                <KpiCard icon={Users} color="#8B5CF6" label={ta('partners')} value={snapshot.catalog.partners} sub={`${snapshot.catalog.testimonials} ${ta('testimonialsShort')}`} animated={animations} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('articlesByCategory')}
                  icon={<Newspaper className="w-4 h-4 text-[#F97316]" />}
                  items={snapshot.articles.byCategory}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('newsletterByStatus')}
                  subtitle={`${snapshot.newsletter.total} total · ${snapshot.newsletter.activeRate}% ${ta('activeShort')}`}
                  icon={<MailCheck className="w-4 h-4 text-[#EAB616]" />}
                  items={snapshot.newsletter.byStatus}
                  defaultType="donut"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('articlesByAuthor')}
                  icon={<PenTool className="w-4 h-4 text-[#EC4899]" />}
                  items={snapshot.articles.byAuthor}
                  defaultType="bar"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('newsletterBySource')}
                  icon={<Activity className="w-4 h-4 text-[#06B6D4]" />}
                  items={snapshot.newsletter.bySource}
                  defaultType={globalChartType}
                  animated={animations}
                />
              </div>

              {/* Top Auteurs */}
              <section className="ad-card p-5 space-y-3">
                <h3 className="font-black text-base flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#EC4899]" />
                  {ta('authorsRanking')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                        <th className="py-2">{ta('thAuthor')}</th>
                        <th className="py-2">{ta('thRole')}</th>
                        <th className="py-2 text-right">{ta('articles')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.authors.topAuthors.map((au) => (
                        <tr key={au.name} className="border-b border-[var(--ad-line)]/50">
                          <td className="py-2 font-bold">{au.name}</td>
                          <td className="py-2" style={{ color: 'var(--ad-muted)' }}>{au.role}</td>
                          <td className="py-2 text-right font-black tabular-nums">{au.articles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ===================== GED, FICHIERS & UTILISATIONS ===================== */}
          {activeTab === 'ged' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard icon={FolderKanban} color="#0EA5E9" label={ta('gedFiles')} value={snapshot.ged.totalFiles} sub={`${snapshot.ged.totalVersions} ${ta('versionsShort')}`} animated={animations} />
                <KpiCard icon={HardDrive} color="#169EC9" label={ta('gedStorage')} textValue={formatBytes(snapshot.ged.totalBytes, locale)} sub={`${snapshot.ged.byModule.length} ${ta('modulesShort')}`} animated={animations} />
                <KpiCard icon={CheckCircle2} color="#0F9F6E" label={ta('gedUsedFiles')} value={snapshot.ged.usedFiles} sub={`${snapshot.ged.utilizationRate}% ${ta('utilizationShort')}`} animated={animations} />
                <KpiCard icon={Clock} color="#EAB616" label={ta('gedUnusedFiles')} value={snapshot.ged.unusedFiles} sub={ta('orphansHint')} animated={animations} />
                <KpiCard icon={Sparkles} color="#8B5CF6" label={ta('gedEditable')} value={snapshot.ged.editableCount} sub={ta('canvasSvgEditable')} animated={animations} />
                <KpiCard icon={Layers} color="#EC4899" label={ta('gedReferences')} value={snapshot.ged.totalReferences} sub={`${snapshot.ged.versionedCount} ${ta('versionedShort')}`} animated={animations} />
              </div>

              <div className="ad-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-base">{ta('gedUsageRatio')}</h3>
                  <Link href={`/${locale}/admin/media`} className="ad-btn ad-btn-ghost !py-1 text-xs">
                    {ta('openMediaLibrary')} →
                  </Link>
                </div>
                <StackedProgressBar
                  segments={[
                    { key: 'used', label: ta('gedUsedFiles'), value: snapshot.ged.usedFiles, color: '#0F9F6E' },
                    { key: 'unused', label: ta('gedUnusedFiles'), value: snapshot.ged.unusedFiles, color: '#94A3B8' },
                  ]}
                  animated={animations}
                  height={14}
                  emptyLabel={ta('gedEmpty')}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('gedByKindTitle')}
                  subtitle={`${snapshot.ged.totalFiles} ${ta('filesShort')} · ${formatBytes(snapshot.ged.totalBytes, locale)}`}
                  icon={<FolderKanban className="w-4 h-4 text-[#0EA5E9]" />}
                  items={snapshot.ged.byKind.map((k) => ({ key: k.key, label: k.label, value: k.count, color: k.color }))}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('gedByModuleTitle')}
                  icon={<HardDrive className="w-4 h-4 text-[#169EC9]" />}
                  items={snapshot.ged.byModule.map((m) => ({ key: m.key, label: m.label, value: m.count, color: m.color }))}
                  defaultType="bar"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('gedStorageByKind')}
                  icon={<Layers className="w-4 h-4 text-[#8B5CF6]" />}
                  items={snapshot.ged.byKind.map((k) => ({ key: k.key, label: k.label, value: Math.round(k.bytes / 1024), color: k.color }))}
                  valueFormatter={(v) => `${v} Ko`}
                  defaultType="donut"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('gedByOrigin')}
                  icon={<Sparkles className="w-4 h-4 text-[#EC4899]" />}
                  items={snapshot.ged.byOrigin}
                  defaultType={globalChartType}
                  animated={animations}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <section className="ad-card p-5 space-y-3">
                  <h3 className="font-black text-base">{ta('gedTopUsed')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                          <th className="py-1.5">{ta('thFile')}</th>
                          <th className="py-1.5">{ta('thUsedIn')}</th>
                          <th className="py-1.5 text-right">{ta('thRefs')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.ged.topUsed.map((f) => (
                          <tr key={f.file} className="border-b border-[var(--ad-line)]/50">
                            <td className="py-1.5 font-semibold truncate max-w-[180px]" title={f.file}>{f.name}</td>
                            <td className="py-1.5" style={{ color: 'var(--ad-muted)' }}>{f.usedIn.join(', ')}</td>
                            <td className="py-1.5 text-right font-black tabular-nums">{f.references}</td>
                          </tr>
                        ))}
                        {snapshot.ged.topUsed.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-6 text-center" style={{ color: 'var(--ad-muted)' }}>
                              {ta('gedNoRefsYet')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="ad-card p-5 space-y-3">
                  <h3 className="font-black text-base">{ta('gedLargestFiles')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                          <th className="py-1.5">{ta('thFile')}</th>
                          <th className="py-1.5">{ta('thModule')}</th>
                          <th className="py-1.5">{ta('thUsage')}</th>
                          <th className="py-1.5 text-right">{ta('thSize')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.ged.largestFiles.map((f) => (
                          <tr key={f.file} className="border-b border-[var(--ad-line)]/50">
                            <td className="py-1.5 font-semibold truncate max-w-[160px]" title={f.file}>{f.name}</td>
                            <td className="py-1.5" style={{ color: 'var(--ad-muted)' }}>{f.module}</td>
                            <td className="py-1.5">
                              <span className={`ad-chip ${f.used ? 'ad-chip-ok' : 'ad-chip-mute'}`}>
                                {f.used ? ta('usedShort') : ta('unusedShort')}
                              </span>
                            </td>
                            <td className="py-1.5 text-right font-bold tabular-nums">{formatBytes(f.bytes, locale)}</td>
                          </tr>
                        ))}
                        {snapshot.ged.largestFiles.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center" style={{ color: 'var(--ad-muted)' }}>
                              {ta('gedEmpty')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ===================== EMPLOYÉS, ADMINISTRATEURS & TRAITEMENTS ===================== */}
          {activeTab === 'team' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <KpiCard icon={ShieldCheck} color="#169EC9" label={ta('adminsLabel')} value={snapshot.team.admins} sub={`${snapshot.team.staffWith2FA} 2FA`} animated={animations} />
                <KpiCard icon={Users} color="#8B5CF6" label={ta('employeesLabel')} value={snapshot.team.employees} sub={`${snapshot.team.staffActive} ${ta('activeShort')}`} animated={animations} />
                <KpiCard icon={Activity} color="#06B6D4" label={ta('inProgressWork')} value={snapshot.team.workload.inProgress} sub={ta('acrossAllQueues')} animated={animations} />
                <KpiCard icon={Clock} color="#D97706" label={ta('remainingWork')} value={snapshot.team.workload.remaining} sub={ta('stillToHandle')} animated={animations} />
                <KpiCard icon={CheckCircle2} color="#0F9F6E" label={ta('completedWork')} value={snapshot.team.workload.completed} sub={`${snapshot.team.workload.completionRate}% ${ta('completionRate')}`} animated={animations} />
                <KpiCard icon={ScrollText} color="#EC4899" label={ta('auditActions')} value={snapshot.team.auditInRange} sub={`${snapshot.team.auditTotal} total`} animated={animations} />
              </div>

              {/* Tableau des files de traitement : En cours / Restant / Terminé */}
              <section className="ad-card p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black text-base">{ta('workloadQueuesTitle')}</h3>
                    <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{ta('workloadQueuesSub')}</p>
                  </div>
                  <span className="ad-chip ad-chip-acc tabular-nums">
                    {snapshot.team.workload.completionRate}% {ta('doneShort')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                        <th className="py-2">{ta('thQueue')}</th>
                        <th className="py-2 text-right">Total</th>
                        <th className="py-2 text-right">{ta('inProgressShort')}</th>
                        <th className="py-2 text-right">{ta('remainingShort')}</th>
                        <th className="py-2 text-right">{ta('doneShort')}</th>
                        <th className="py-2 w-40">{ta('thProgress')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.team.queues.map((q) => (
                        <tr key={q.key} className="border-b border-[var(--ad-line)]/50">
                          <td className="py-2 font-bold">
                            <Link href={`/${locale}${q.href}`} className="hover:underline flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: q.color }} />
                              {q.label}
                            </Link>
                          </td>
                          <td className="py-2 text-right tabular-nums">{q.total}</td>
                          <td className="py-2 text-right tabular-nums text-sky-600 font-bold">{q.inProgress}</td>
                          <td className="py-2 text-right tabular-nums font-black" style={{ color: q.remaining > 0 ? '#D97706' : '#0F9F6E' }}>
                            {q.remaining}
                          </td>
                          <td className="py-2 text-right tabular-nums text-emerald-600 font-bold">{q.completed}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ad-surface-2)' }}>
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${q.completionRate}%`, background: q.color }} />
                              </div>
                              <span className="w-10 text-right tabular-nums font-bold">{q.completionRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={ta('usersByRole')}
                  icon={<Users className="w-4 h-4 text-[#169EC9]" />}
                  items={snapshot.team.byRole}
                  defaultType="donut"
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('actionsByTypeTitle')}
                  icon={<Activity className="w-4 h-4 text-[#EC4899]" />}
                  items={snapshot.team.actionsByType}
                  defaultType={globalChartType}
                  animated={animations}
                />
              </div>

              {/* Activité individuelle des Administrateurs & Employés */}
              <section className="ad-card p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#169EC9]" />
                    {ta('staffActivityTitle')}
                  </h3>
                  <input
                    className="ad-input !w-56 !py-1.5 text-xs"
                    placeholder={ta('searchStaff')}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                        <th className="py-2">{ta('thMember')}</th>
                        <th className="py-2">{ta('thRole')}</th>
                        <th className="py-2">{ta('thSecurity')}</th>
                        <th className="py-2 text-right">{ta('thActionsRange')}</th>
                        <th className="py-2 text-right">{ta('thActionsTotal')}</th>
                        <th className="py-2">{ta('thTopResources')}</th>
                        <th className="py-2 text-right">{ta('thLastActive')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((s) => (
                        <tr key={s.id} className="border-b border-[var(--ad-line)]/50">
                          <td className="py-2">
                            <div className="font-bold">{s.name}</div>
                            {s.email && <div className="text-[10px]" style={{ color: 'var(--ad-muted)' }}>{s.email}</div>}
                          </td>
                          <td className="py-2">
                            <span className={`ad-chip ${s.category === 'admin' ? 'ad-chip-acc' : 'ad-chip-mute'}`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`ad-chip ${s.totpEnabled ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
                              {s.totpEnabled ? '2FA' : ta('no2fa')}
                            </span>
                          </td>
                          <td className="py-2 text-right font-black tabular-nums">{s.actionsInRange}</td>
                          <td className="py-2 text-right tabular-nums">{s.actionsTotal}</td>
                          <td className="py-2" style={{ color: 'var(--ad-muted)' }}>{s.topResources.join(', ') || '—'}</td>
                          <td className="py-2 text-right" style={{ color: 'var(--ad-muted)' }}>
                            {s.lastActiveAt ? <DateText value={s.lastActiveAt} /> : '—'}
                          </td>
                        </tr>
                      ))}
                      {filteredStaff.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center" style={{ color: 'var(--ad-muted)' }}>
                            {ta('noStaffActivity')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ===================== COMMERCE & SUPPORT ===================== */}
          {activeTab === 'commerce' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={ShoppingBag} color="#0F9F6E" label={ta('orders')} value={snapshot.commerce.ordersTotal} sub={`${snapshot.commerce.ordersDelivered} ${ta('deliveredShort')} · ${snapshot.commerce.ordersPending} ${ta('pendingShort')}`} animated={animations} />
                <KpiCard icon={Sparkles} color="#169EC9" label={ta('revenueDelivered')} textValue={money(snapshot.commerce.revenueDelivered)} sub={`${money(snapshot.commerce.revenuePending)} ${ta('inProgressShort')}`} animated={animations} />
                <KpiCard icon={FileCheck} color="#EAB616" label={ta('quotes')} value={snapshot.commerce.quotesTotal} sub={`${snapshot.commerce.quotesOpen} ${ta('openShort')} · ${snapshot.commerce.quoteConversionRate}% conv.`} animated={animations} />
                <KpiCard icon={MailCheck} color="#EC4899" label={ta('supportMessages')} value={snapshot.commerce.messagesTotal} sub={`${snapshot.commerce.messagesUnread} ${ta('unreadShort')} · ${snapshot.commerce.messagesResolved} ${ta('resolvedShort')}`} animated={animations} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ConfigurableChartCard
                  title={t('orderPipeline')}
                  icon={<ShoppingBag className="w-4 h-4 text-[#0F9F6E]" />}
                  items={[
                    { key: 'delivered', label: t('delivered', { defaultMessage: 'Livrées' }), value: snapshot.commerce.ordersDelivered, color: '#0F9F6E' },
                    { key: 'processing', label: ta('inProgressShort'), value: snapshot.commerce.ordersProcessing, color: '#169EC9' },
                    { key: 'pending', label: ta('pendingShort'), value: snapshot.commerce.ordersPending, color: '#EAB616' },
                    { key: 'cancelled', label: t('cancelled', { defaultMessage: 'Annulées' }), value: snapshot.commerce.ordersCancelled, color: '#EF4444' },
                  ]}
                  defaultType={globalChartType}
                  animated={animations}
                />
                <ConfigurableChartCard
                  title={ta('quotesBreakdown')}
                  icon={<FileCheck className="w-4 h-4 text-[#EAB616]" />}
                  items={[
                    { key: 'accepted', label: ta('acceptedShort'), value: snapshot.commerce.quotesAccepted, color: '#0F9F6E' },
                    { key: 'open', label: ta('openShort'), value: snapshot.commerce.quotesOpen, color: '#169EC9' },
                    { key: 'rejected', label: ta('rejectedShort'), value: snapshot.commerce.quotesRejected, color: '#EF4444' },
                  ]}
                  defaultType="donut"
                  animated={animations}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  textValue,
  sub,
  animated = true,
}: {
  icon: typeof Activity;
  color: string;
  label: string;
  value?: number;
  textValue?: string;
  sub?: string;
  animated?: boolean;
}) {
  return (
    <div className="ad-card p-4 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-2xl font-black tabular-nums truncate">
          {textValue !== undefined ? textValue : <AnimatedCounter value={value} animated={animated} />}
        </div>
      </div>
      <div>
        <div className="text-xs font-bold truncate">{label}</div>
        {sub && (
          <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ad-muted)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
