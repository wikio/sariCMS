/**
 * Moteur d'agrégation analytique serveur pour l'accueil du Tableau de bord
 * et le centre de Statistiques (`/api/admin/analytics`).
 *
 * Principes :
 * - Privilégie toujours la base de données CMS (via `cmsFetch` avec le jeton
 *   de l'administrateur courant).
 * - Complète proprement avec les magasins locaux serveur (inscriptions événements,
 *   newsletter locale, GED sur disque `public/uploads`, catalogue `data/{fr,en,ar}`,
 *   journaux d'audit locaux `logs/audit`) sans jamais inventer de faux chiffres.
 * - Cross-référence automatiquement les URLs `/uploads/...` dans tous les contenus
 *   pour mesurer les vraies statistiques d'utilisation de la GED (fichiers utilisés
 *   vs orphelins, nombre de références, top fichiers).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { cmsFetch, unwrapList } from './cms';
import { listRegistrations, type EventRegistration } from './event-registrations';
import { readStore as readLocalNewsletter } from './newsletter-store';
import { gedStore } from './ged/store.mjs';
import {
  DEFAULT_DASHBOARD_PREFS,
  type AnalyticsFilters,
  type AnalyticsGranularity,
  type AnalyticsLocaleFilter,
  type AnalyticsRange,
  type AnalyticsSnapshot,
  type AnalyticsSource,
  type DashboardPrefs,
  type NamedCount,
  type StaffMemberStats,
  type TimelinePoint,
  type WorkQueueItem,
} from './analytics-types';

const PALETTE = [
  '#169EC9', '#0F9F6E', '#EAB616', '#8B5CF6', '#EC4899',
  '#F97316', '#06B6D4', '#C6DA34', '#EF4444', '#64748B',
];

const MONTHS_FR_EN: Record<string, number> = {
  jan: 0, janvier: 0, january: 0,
  feb: 1, fev: 1, février: 1, fevrier: 1, february: 1,
  mar: 2, mars: 2, march: 2,
  apr: 3, avr: 3, avril: 3, april: 3,
  may: 4, mai: 4,
  jun: 5, juin: 5, june: 5,
  jul: 6, juil: 6, juillet: 6, july: 6,
  aug: 7, aou: 7, août: 7, aout: 7, august: 7,
  sep: 8, sept: 8, septembre: 8, september: 8,
  oct: 9, octobre: 9, october: 9,
  nov: 10, novembre: 10, november: 10,
  dec: 11, déc: 11, décembre: 11, decembre: 11, december: 11,
};

/** Parse souplement ISO, timestamps ou dates textuelles FR/EN (« 15-18 Mars 2024 »). */
export function parseFlexibleDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const raw = String(input).trim();
  if (!raw) return null;

  // ISO ou YYYY-MM-DD direct
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY
  const dmy = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(raw);
  if (dmy) {
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // « 15-18 Mars 2024 » ou « 5 Mai 2024 »
  const norm = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const txt = /(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+([a-z]+)\s+(\d{4})/.exec(norm);
  if (txt) {
    const m = MONTHS_FR_EN[txt[2]];
    if (m !== undefined) {
      return new Date(Date.UTC(Number(txt[3]), m, Number(txt[1])));
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveFilters(params: URLSearchParams): AnalyticsFilters {
  const validRanges: AnalyticsRange[] = ['7d', '30d', '90d', '365d', 'all', 'custom'];
  const validGrans: AnalyticsGranularity[] = ['day', 'week', 'month'];
  const validLocales: AnalyticsLocaleFilter[] = ['all', 'fr', 'en', 'ar'];

  const rawRange = (params.get('range') || 'all') as AnalyticsRange;
  const range: AnalyticsRange = validRanges.includes(rawRange) ? rawRange : 'all';

  const rawLocale = (params.get('locale') || 'all') as AnalyticsLocaleFilter;
  const locale: AnalyticsLocaleFilter = validLocales.includes(rawLocale) ? rawLocale : 'all';

  const now = new Date();
  let from = '';
  let to = '';

  if (range === 'custom') {
    from = String(params.get('from') || '').slice(0, 10);
    to = String(params.get('to') || '').slice(0, 10);
  } else if (range !== 'all') {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const start = new Date(now.getTime() - days * 86_400_000);
    from = start.toISOString().slice(0, 10);
    to = now.toISOString().slice(0, 10);
  }

  const rawGran = params.get('granularity') as AnalyticsGranularity | null;
  const granularity: AnalyticsGranularity =
    rawGran && validGrans.includes(rawGran)
      ? rawGran
      : range === '7d' || range === '30d'
        ? 'day'
        : range === '90d'
          ? 'week'
          : 'month';

  return { range, from, to, locale, granularity };
}

export function inDateRange(date: Date | null, filters: AnalyticsFilters): boolean {
  if (filters.range === 'all' && !filters.from && !filters.to) return true;
  if (!date) return filters.range === 'all';
  const iso = date.toISOString().slice(0, 10);
  if (filters.from && iso < filters.from) return false;
  if (filters.to && iso > filters.to) return false;
  return true;
}

export function bucketForDate(date: Date, granularity: AnalyticsGranularity): { bucket: string; label: string } {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  if (granularity === 'day') {
    return { bucket: `${y}-${m}-${d}`, label: `${d}/${m}` };
  }
  if (granularity === 'week') {
    const tmp = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    const wStr = String(week).padStart(2, '0');
    return { bucket: `${tmp.getUTCFullYear()}-W${wStr}`, label: `S${wStr} ${String(tmp.getUTCFullYear()).slice(2)}` };
  }
  return { bucket: `${y}-${m}`, label: `${m}/${y}` };
}

function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

async function readLocalJsonArray(relPath: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), relPath), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

async function readLocalLocalized(fileName: string, localeFilter: AnalyticsLocaleFilter): Promise<Record<string, unknown>[]> {
  const locales = localeFilter === 'all' ? ['fr', 'en', 'ar'] : [localeFilter];
  const chunks = await Promise.all(
    locales.map(async (loc) => {
      const rows = await readLocalJsonArray(path.join('data', loc, fileName));
      return rows.map((r) => ({ ...r, locale: r.locale || loc }));
    }),
  );
  return chunks.flat();
}

async function tryCmsList<T = Record<string, unknown>>(
  endpoint: string,
  token: string | null,
): Promise<{ rows: T[]; ok: boolean }> {
  if (!token) return { rows: [], ok: false };
  try {
    const payload = await cmsFetch<unknown>(endpoint, { token, timeoutMs: 4500 });
    return { rows: unwrapList<T>(payload), ok: true };
  } catch {
    return { rows: [], ok: false };
  }
}

async function readLocalAuditLogs(maxEntries = 300): Promise<Array<Record<string, unknown>>> {
  const dir = path.join(process.cwd(), 'logs', 'audit');
  try {
    const files = (await fs.readdir(dir))
      .filter((f) => f.endsWith('.jsonl') || f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 7);
    const out: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), 'utf8').catch(() => '');
      const lines = content.split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        try {
          out.push(JSON.parse(line) as Record<string, unknown>);
          if (out.length >= maxEntries) return out;
        } catch {
          /* ignore malformed line */
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Extrait toutes les références `/uploads/...` présentes dans une structure arbitraire
 * afin de calculer le taux réel d'utilisation des fichiers GED.
 */
function extractUploadRefs(obj: unknown, collector: Map<string, Set<string>>, tag: string) {
  if (!obj) return;
  if (typeof obj === 'string') {
    const matches = obj.match(/\/uploads\/[^\s"'<>)?#]+/g);
    if (matches) {
      for (const m of matches) {
        const clean = decodeURIComponent(m).replace(/\/+$/, '');
        if (!collector.has(clean)) collector.set(clean, new Set());
        collector.get(clean)!.add(tag);
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) extractUploadRefs(item, collector, tag);
    return;
  }
  if (typeof obj === 'object') {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      extractUploadRefs(val, collector, tag);
    }
  }
}

function classifyCareerStatus(row: Record<string, unknown>): 'active' | 'completed' | 'draft' {
  const st = String(row.status || '').trim().toLowerCase();
  if (['closed', 'completed', 'filled', 'archived', 'expired', 'ended', 'terminated', 'pourvue', 'terminee', 'terminée'].includes(st)) {
    return 'completed';
  }
  if (['draft', 'brouillon', 'pending', 'paused'].includes(st)) {
    return 'draft';
  }
  if (row.closedAt || row.filledAt) return 'completed';
  const deadline = parseFlexibleDate(row.deadline || row.expiresAt || row.endDate);
  if (deadline && deadline.getTime() < Date.now()) return 'completed';
  return 'active';
}

function classifyEventStatus(row: Record<string, unknown>, nowMs: number): 'upcoming' | 'past' | 'draft' {
  const st = String(row.status || '').trim().toLowerCase();
  if (['draft', 'brouillon'].includes(st)) return 'draft';
  if (['completed', 'past', 'ended', 'archived', 'cancelled'].includes(st)) return 'past';
  const dt = parseFlexibleDate(row.startDate || row.date || row.publishedAt);
  if (dt) {
    return dt.getTime() >= nowMs ? 'upcoming' : 'past';
  }
  return 'upcoming';
}

function classifyUserRole(row: Record<string, unknown>): {
  category: 'admin' | 'employee' | 'client' | 'partner' | 'candidate';
  roleLabel: string;
} {
  const type = String(row.type || '').trim().toLowerCase();
  const roleObj = row.role as { name?: string; slug?: string } | string | undefined;
  const roleName = (typeof roleObj === 'string' ? roleObj : roleObj?.slug || roleObj?.name || '').trim().toLowerCase();
  const position = String(row.position || '').trim().toLowerCase();

  if (
    roleName.includes('superadmin') ||
    roleName === 'admin' ||
    roleName === 'administrator' ||
    (type === 'admin' && !['employee', 'employe', 'employé', 'editor', 'editeur', 'staff', 'operator', 'agent', 'support', 'manager', 'rh', 'hr'].some((k) => roleName.includes(k)))
  ) {
    return { category: 'admin', roleLabel: roleName || 'admin' };
  }
  if (
    type === 'admin' ||
    type === 'employee' ||
    type === 'staff' ||
    ['employee', 'employe', 'employé', 'editor', 'editeur', 'staff', 'operator', 'agent', 'support', 'manager', 'rh', 'hr'].some(
      (k) => roleName.includes(k) || position.includes(k),
    )
  ) {
    return { category: 'employee', roleLabel: roleName || type || 'employee' };
  }
  if (type === 'partner') return { category: 'partner', roleLabel: 'partner' };
  if (type === 'candidate') return { category: 'candidate', roleLabel: 'candidate' };
  return { category: 'client', roleLabel: 'client' };
}

function topNamed(map: Map<string, number>, max = 8, startColor = 0): NamedCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([label, value], i) => ({
      key: label,
      label,
      value,
      color: PALETTE[(i + startColor) % PALETTE.length],
    }));
}

export async function buildAnalyticsSnapshot(
  token: string | null,
  filters: AnalyticsFilters,
): Promise<AnalyticsSnapshot> {
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Chargement parallèle de toutes les sources (API CMS si dispo + magasins locaux serveur)
  const localeQs = filters.locale !== 'all' ? `&filter=${encodeURIComponent(JSON.stringify({ locale: filters.locale }))}` : '';

  const [
    statusRes,
    appsApi,
    careersApi,
    newsApi,
    eventsApi,
    authorsApi,
    usersApi,
    ordersApi,
    quotesApi,
    paymentsApi,
    messagesApi,
    newsletterApi,
    auditApi,
    eventRegsStore,
    localNewsletterStore,
    gedRes,
    localAuditRows,
  ] = await Promise.all([
    token
      ? cmsFetch<{ connected?: boolean; driver?: string; counts?: Record<string, number>; unavailable?: string[] }>('/settings/status', { token, timeoutMs: 4000 }).catch(() => null)
      : Promise.resolve(null),
    tryCmsList(`/applications?limit=500`, token),
    tryCmsList(`/careers?limit=500${localeQs}`, token),
    tryCmsList(`/news?limit=500${localeQs}`, token),
    tryCmsList(`/events?limit=500${localeQs}`, token),
    tryCmsList(`/authors?limit=200${localeQs}`, token),
    tryCmsList(`/users?limit=500`, token),
    tryCmsList(`/orders?limit=500`, token),
    tryCmsList(`/quotes?limit=500`, token),
    tryCmsList(`/payment-records/all`, token),
    tryCmsList(`/contact/messages?limit=500`, token),
    tryCmsList(`/newsletter?limit=1000`, token),
    tryCmsList(`/audit-logs?limit=300&sortBy=createdAt&sortOrder=desc`, token),
    Promise.all([
      listRegistrations({ includeDeleted: false }).catch(() => [] as EventRegistration[]),
      listRegistrations({ includeDeleted: true }).catch(() => [] as EventRegistration[]),
    ]).then(([active, trashed]) => [...active, ...trashed]),
    readLocalNewsletter().catch(() => ({ version: 1, rows: [] })),
    gedStore.listAssets({ page: 1, limit: 5000 }).catch(() => ({ items: [], total: 0 })),
    readLocalAuditLogs(200),
  ]);

  // Fallbacks locaux `data/{fr,en,ar}/*.json` lorsque la collection API n'a pas répondu
  const [
    localCareers,
    localNews,
    localEvents,
    localAuthors,
    localProducts,
    localServices,
    localSolutions,
    localPartners,
    localTestimonials,
    localHero,
  ] = await Promise.all([
    careersApi.ok ? Promise.resolve([]) : readLocalLocalized('careers.json', filters.locale),
    newsApi.ok ? Promise.resolve([]) : readLocalLocalized('news.json', filters.locale),
    eventsApi.ok ? Promise.resolve([]) : readLocalLocalized('events.json', filters.locale),
    authorsApi.ok ? Promise.resolve([]) : readLocalLocalized('authors.json', filters.locale),
    readLocalLocalized('products.json', filters.locale),
    readLocalLocalized('services.json', filters.locale),
    readLocalLocalized('solution-categories.json', filters.locale),
    readLocalLocalized('partners.json', filters.locale),
    readLocalLocalized('testimonials.json', filters.locale),
    readLocalLocalized('hero.json', filters.locale),
  ]);

  const connected = Boolean(statusRes?.connected);
  const driver = statusRes?.driver || (connected ? 'db' : 'local-json');
  const statusCounts = statusRes?.counts || {};
  const unavailable = statusRes?.unavailable || [];

  // Timeline accumulator
  const timelineMap = new Map<string, TimelinePoint>();
  const touchBucket = (date: Date | null, field: keyof Omit<TimelinePoint, 'bucket' | 'label'>) => {
    if (!date) return;
    if (!inDateRange(date, filters)) return;
    const { bucket, label } = bucketForDate(date, filters.granularity);
    if (!timelineMap.has(bucket)) {
      timelineMap.set(bucket, {
        bucket,
        label,
        applications: 0,
        eventRegistrations: 0,
        newsletter: 0,
        articles: 0,
        gedUploads: 0,
        orders: 0,
        staffActions: 0,
      });
    }
    timelineMap.get(bucket)![field] += 1;
  };

  // =========================================================================
  // A. CANDIDATURES EMPLOI (multi-statuts)
  // =========================================================================
  const rawApps = appsApi.rows;
  const scopedApps = rawApps.filter((a) => inDateRange(parseFlexibleDate(a.date || a.createdAt), filters));
  const appCounts = { new: 0, reviewed: 0, interview: 0, accepted: 0, rejected: 0 };
  let appRatingSum = 0;
  let appRatingN = 0;
  let appWithCv = 0;
  const appsByOffer = new Map<string, number>();

  for (const app of scopedApps) {
    const dt = parseFlexibleDate(app.date || app.createdAt);
    touchBucket(dt, 'applications');
    const st = String(app.status || 'new').toLowerCase();
    if (st === 'reviewed') appCounts.reviewed += 1;
    else if (st === 'interview') appCounts.interview += 1;
    else if (st === 'accepted' || st === 'hired' || st === 'approved') appCounts.accepted += 1;
    else if (st === 'rejected' || st === 'declined') appCounts.rejected += 1;
    else appCounts.new += 1;

    const rating = Number(app.rating);
    if (Number.isFinite(rating) && rating > 0) {
      appRatingSum += rating;
      appRatingN += 1;
    }
    if (app.cv) appWithCv += 1;
    const offer = String(app.jobTitle || 'Non précisée').trim() || 'Non précisée';
    appsByOffer.set(offer, (appsByOffer.get(offer) || 0) + 1);
  }

  const appsInProgress = appCounts.new + appCounts.reviewed + appCounts.interview;
  const appsProcessed = appCounts.accepted + appCounts.rejected;

  // =========================================================================
  // B. CANDIDATURES ÉVÉNEMENTS (multi-statuts : approuvées, en attente, etc.)
  // =========================================================================
  const allEventRegs = eventRegsStore.filter((r) => filters.locale === 'all' || r.locale === filters.locale);
  const trashEventRegs = allEventRegs.filter((r) => r.deleted).length;
  const activeEventRegs = allEventRegs.filter(
    (r) => !r.deleted && inDateRange(parseFlexibleDate(r.createdAt), filters),
  );

  const regCounts = { pending: 0, confirmed: 0, attended: 0, waitlist: 0, rejected: 0, cancelled: 0 };
  let regLinkedClients = 0;
  const regByEventMap = new Map<
    string,
    { eventId: string; title: string; total: number; approved: number; pending: number; attended: number; rejected: number }
  >();

  for (const reg of activeEventRegs) {
    touchBucket(parseFlexibleDate(reg.createdAt), 'eventRegistrations');
    const st = reg.status;
    if (st in regCounts) regCounts[st as keyof typeof regCounts] += 1;
    if (reg.clientUserId) regLinkedClients += 1;

    const key = reg.eventLegacyId || reg.eventId || reg.eventTitle;
    if (!regByEventMap.has(key)) {
      regByEventMap.set(key, {
        eventId: reg.eventId,
        title: reg.eventTitle || reg.eventSlug || key,
        total: 0,
        approved: 0,
        pending: 0,
        attended: 0,
        rejected: 0,
      });
    }
    const ev = regByEventMap.get(key)!;
    ev.total += 1;
    if (st === 'confirmed' || st === 'attended') ev.approved += 1;
    if (st === 'pending' || st === 'waitlist') ev.pending += 1;
    if (st === 'attended') ev.attended += 1;
    if (st === 'rejected' || st === 'cancelled') ev.rejected += 1;
  }

  const regApproved = regCounts.confirmed + regCounts.attended;
  const regToProcess = regCounts.pending + regCounts.waitlist;

  // =========================================================================
  // C. OFFRES D'EMPLOI (actives vs terminées vs brouillons)
  // =========================================================================
  const careerRows = careersApi.ok ? careersApi.rows : localCareers;
  let jobsActive = 0;
  let jobsCompleted = 0;
  let jobsDraft = 0;
  const jobsByType = new Map<string, number>();
  const jobsByLoc = new Map<string, number>();

  for (const job of careerRows) {
    const cls = classifyCareerStatus(job);
    if (cls === 'active') jobsActive += 1;
    else if (cls === 'completed') jobsCompleted += 1;
    else jobsDraft += 1;

    const tp = String(job.type || job.typeTravail || 'CDI').trim() || 'Autre';
    jobsByType.set(tp, (jobsByType.get(tp) || 0) + 1);
    const loc = String(job.location || 'Non précisé').trim() || 'Non précisé';
    jobsByLoc.set(loc, (jobsByLoc.get(loc) || 0) + 1);
  }

  // =========================================================================
  // D. ARTICLES (news), ÉVÉNEMENTS (catalogue) & AUTEURS
  // =========================================================================
  const newsRows = newsApi.ok ? newsApi.rows : localNews;
  let articlesPublished = 0;
  let articlesDraft = 0;
  const articlesByCat = new Map<string, number>();
  const articlesByAuthor = new Map<string, number>();

  for (const art of newsRows) {
    const dt = parseFlexibleDate(art.publishedAt || art.createdAt || art.date);
    touchBucket(dt, 'articles');
    const st = String(art.status || 'published').toLowerCase();
    if (st === 'draft' || st === 'brouillon') articlesDraft += 1;
    else articlesPublished += 1;

    const cat = String(art.category || 'Général').trim() || 'Général';
    articlesByCat.set(cat, (articlesByCat.get(cat) || 0) + 1);

    const authorObj = art.author as { name?: string } | string | undefined;
    const authorName = (typeof authorObj === 'string' ? authorObj : authorObj?.name || '').trim() || 'Rédaction';
    articlesByAuthor.set(authorName, (articlesByAuthor.get(authorName) || 0) + 1);
  }

  const eventRows = eventsApi.ok ? eventsApi.rows : localEvents;
  let eventsUpcoming = 0;
  let eventsPast = 0;
  let eventsDraft = 0;
  const eventsByType = new Map<string, number>();

  for (const ev of eventRows) {
    const cls = classifyEventStatus(ev, nowMs);
    if (cls === 'upcoming') eventsUpcoming += 1;
    else if (cls === 'past') eventsPast += 1;
    else eventsDraft += 1;
    const tp = String(ev.type || 'Événement').trim() || 'Événement';
    eventsByType.set(tp, (eventsByType.get(tp) || 0) + 1);
  }

  const authorRows = authorsApi.ok ? authorsApi.rows : localAuthors;
  // Déduplication par nom/legacyId lorsque locale=all sur les fichiers locaux
  const uniqueAuthors = new Map<string, { name: string; role: string; articles: number }>();
  for (const au of authorRows) {
    const name = String(au.name || '').trim();
    if (!name) continue;
    const key = String(au.legacyId || name.toLowerCase());
    if (!uniqueAuthors.has(key)) {
      uniqueAuthors.set(key, {
        name,
        role: String(au.role || 'Auteur').trim(),
        articles: articlesByAuthor.get(name) || 0,
      });
    }
  }
  for (const [authorName, count] of articlesByAuthor.entries()) {
    const found = [...uniqueAuthors.values()].find((a) => a.name.toLowerCase() === authorName.toLowerCase());
    if (found) found.articles = Math.max(found.articles, count);
    else uniqueAuthors.set(`art:${authorName.toLowerCase()}`, { name: authorName, role: 'Contributeur', articles: count });
  }
  const topAuthors = [...uniqueAuthors.values()].sort((a, b) => b.articles - a.articles).slice(0, 10);
  const activeAuthorsCount = [...uniqueAuthors.values()].filter((a) => a.articles > 0).length;

  // =========================================================================
  // E. ABONNÉS NEWSLETTER
  // =========================================================================
  const nlRows: Array<Record<string, unknown>> = newsletterApi.ok
    ? newsletterApi.rows
    : (localNewsletterStore.rows as unknown as Array<Record<string, unknown>>).filter((r) => !r.deleted);
  const scopedNl = nlRows.filter(
    (s) =>
      (filters.locale === 'all' || String(s.locale || 'fr') === filters.locale) &&
      inDateRange(parseFlexibleDate(s.subscribedAt || s.createdAt), filters),
  );

  const nlCounts = { subscribed: 0, pending: 0, unsubscribed: 0, bounced: 0, blocked: 0 };
  const nlByLocale = new Map<string, number>();
  const nlBySource = new Map<string, number>();

  for (const sub of scopedNl) {
    touchBucket(parseFlexibleDate(sub.subscribedAt || sub.createdAt), 'newsletter');
    const st = String(sub.status || 'subscribed').toLowerCase();
    if (st === 'pending') nlCounts.pending += 1;
    else if (st === 'unsubscribed') nlCounts.unsubscribed += 1;
    else if (st === 'bounced') nlCounts.bounced += 1;
    else if (st === 'blocked') nlCounts.blocked += 1;
    else nlCounts.subscribed += 1;

    const loc = String(sub.locale || 'fr').toUpperCase();
    nlByLocale.set(loc, (nlByLocale.get(loc) || 0) + 1);
    const src = String(sub.source || 'site').trim() || 'site';
    nlBySource.set(src, (nlBySource.get(src) || 0) + 1);
  }

  // =========================================================================
  // F. GED — FICHIERS, STOCKAGE & UTILISATIONS RÉELLES
  // =========================================================================
  const gedItems = (gedRes?.items || []) as Array<{
    file: string;
    name: string;
    url: string;
    kind: string;
    module: string;
    bytes: number;
    size: number;
    version?: number;
    editable?: boolean;
    createdAt?: string;
    source?: { origin?: string } | null;
    history?: unknown[];
  }>;

  // Construire l'index de toutes les URLs `/uploads/...` référencées dans les contenus
  const refIndex = new Map<string, Set<string>>();
  extractUploadRefs(newsRows, refIndex, 'Articles');
  extractUploadRefs(eventRows, refIndex, 'Événements');
  extractUploadRefs(careerRows, refIndex, 'Emplois');
  extractUploadRefs(authorRows, refIndex, 'Auteurs');
  extractUploadRefs(localProducts, refIndex, 'Produits');
  extractUploadRefs(localServices, refIndex, 'Services');
  extractUploadRefs(localSolutions, refIndex, 'Solutions');
  extractUploadRefs(localPartners, refIndex, 'Partenaires');
  extractUploadRefs(localTestimonials, refIndex, 'Témoignages');
  extractUploadRefs(localHero, refIndex, 'Hero');
  extractUploadRefs(rawApps, refIndex, 'Candidatures');

  let gedTotalBytes = 0;
  let gedEditable = 0;
  let gedVersioned = 0;
  let gedTotalVersions = 0;
  let gedUsedFiles = 0;
  let gedTotalRefs = 0;

  const gedKindMap = new Map<string, { count: number; bytes: number }>();
  const gedModMap = new Map<string, { count: number; bytes: number }>();
  const gedOriginMap = new Map<string, number>();
  const gedUsageList: Array<{
    file: string;
    name: string;
    url: string;
    kind: string;
    module: string;
    bytes: number;
    references: number;
    usedIn: string[];
  }> = [];

  for (const item of gedItems) {
    const dt = parseFlexibleDate(item.createdAt);
    touchBucket(dt, 'gedUploads');
    const bytes = Number(item.bytes || item.size || 0);
    gedTotalBytes += bytes;
    if (item.editable) gedEditable += 1;
    const histLen = Array.isArray(item.history) ? item.history.length : 0;
    const ver = Number(item.version || 1);
    if (histLen > 0 || ver > 1) gedVersioned += 1;
    gedTotalVersions += Math.max(1, ver);

    const k = String(item.kind || 'other').toLowerCase();
    const kEntry = gedKindMap.get(k) || { count: 0, bytes: 0 };
    kEntry.count += 1;
    kEntry.bytes += bytes;
    gedKindMap.set(k, kEntry);

    const mod = String(item.module || 'ged').toLowerCase();
    const mEntry = gedModMap.get(mod) || { count: 0, bytes: 0 };
    mEntry.count += 1;
    mEntry.bytes += bytes;
    gedModMap.set(mod, mEntry);

    const orig = String(item.source?.origin || 'media');
    gedOriginMap.set(orig, (gedOriginMap.get(orig) || 0) + 1);

    const urlClean = decodeURIComponent(String(item.url || '')).replace(/\/+$/, '');
    const usedSet = refIndex.get(urlClean);
    const refs = usedSet ? usedSet.size : 0;
    if (refs > 0) {
      gedUsedFiles += 1;
      gedTotalRefs += refs;
    }
    gedUsageList.push({
      file: item.file,
      name: item.name || item.file,
      url: item.url,
      kind: k,
      module: mod,
      bytes,
      references: refs,
      usedIn: usedSet ? [...usedSet] : [],
    });
  }

  const gedUnusedFiles = Math.max(0, gedItems.length - gedUsedFiles);

  // =========================================================================
  // G. COMMERCE & MESSAGES
  // =========================================================================
  const ordersRows = ordersApi.rows.filter((o) => inDateRange(parseFlexibleDate(o.date || o.createdAt), filters));
  let ordersPending = 0;
  let ordersProcessing = 0;
  let ordersDelivered = 0;
  let ordersCancelled = 0;
  let revenueDelivered = 0;
  let revenuePending = 0;

  for (const o of ordersRows) {
    touchBucket(parseFlexibleDate(o.date || o.createdAt), 'orders');
    const st = String(o.status || 'pending').toLowerCase();
    const total = Number(o.total || o.totalAmount || 0);
    if (st === 'delivered' || st === 'completed') {
      ordersDelivered += 1;
      revenueDelivered += total;
    } else if (st === 'cancelled' || st === 'refunded') {
      ordersCancelled += 1;
    } else if (st === 'processing' || st === 'shipped' || st === 'confirmed') {
      ordersProcessing += 1;
      revenuePending += total;
    } else {
      ordersPending += 1;
      revenuePending += total;
    }
  }

  const quotesRows = quotesApi.rows.filter((q) => inDateRange(parseFlexibleDate(q.date || q.createdAt), filters));
  let quotesOpen = 0;
  let quotesAccepted = 0;
  let quotesRejected = 0;
  for (const q of quotesRows) {
    const st = String(q.status || 'pending').toLowerCase();
    if (st === 'accepted' || st === 'converted') quotesAccepted += 1;
    else if (st === 'rejected' || st === 'expired' || st === 'cancelled') quotesRejected += 1;
    else quotesOpen += 1;
  }

  const paymentsRows = paymentsApi.rows.filter((p) => inDateRange(parseFlexibleDate(p.paidAt || p.createdAt), filters));
  let paymentsPending = 0;
  let paymentsValidated = 0;
  let paymentsPendingAmount = 0;
  let paymentsValidatedAmount = 0;
  for (const p of paymentsRows) {
    const st = String(p.status || 'pending').toLowerCase();
    const amt = Number(p.amount || 0);
    if (st === 'pending') {
      paymentsPending += 1;
      paymentsPendingAmount += amt;
    } else if (st === 'validated' || st === 'confirmed' || st === 'paid') {
      paymentsValidated += 1;
      paymentsValidatedAmount += amt;
    }
  }

  const messagesRows = messagesApi.rows.filter((m) => inDateRange(parseFlexibleDate(m.createdAt), filters));
  let messagesUnread = 0;
  let messagesResolved = 0;
  for (const m of messagesRows) {
    const st = String(m.status || (m.read ? 'read' : 'unread')).toLowerCase();
    if (st === 'resolved' || st === 'replied' || st === 'archived' || st === 'closed') messagesResolved += 1;
    else if (st === 'unread' || st === 'new' || m.read === false) messagesUnread += 1;
  }

  // =========================================================================
  // H. EMPLOYÉS, ADMINISTRATEURS, ACTIVITÉ & FILE DE TRAITEMENT
  // =========================================================================
  const usersRows = usersApi.rows;
  let admins = 0;
  let employees = 0;
  let staffActive = 0;
  let staffWith2FA = 0;
  let clients = 0;
  let partners = 0;
  let candidates = 0;

  const staffIndex = new Map<string, StaffMemberStats>();
  const staffByEmail = new Map<string, StaffMemberStats>();

  for (const u of usersRows) {
    const { category, roleLabel } = classifyUserRole(u);
    if (category === 'admin') admins += 1;
    else if (category === 'employee') employees += 1;
    else if (category === 'partner') partners += 1;
    else if (category === 'candidate') candidates += 1;
    else clients += 1;

    if (category === 'admin' || category === 'employee') {
      const status = String(u.status || 'active').toLowerCase();
      if (status === 'active') staffActive += 1;
      if (u.totpEnabled) staffWith2FA += 1;
      const id = String(u.id || u.email || '');
      const email = String(u.email || '').toLowerCase();
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || email || `Staff #${id}`;
      const member: StaffMemberStats = {
        id,
        name,
        email,
        role: roleLabel,
        category,
        status,
        totpEnabled: Boolean(u.totpEnabled),
        actionsTotal: 0,
        actionsInRange: 0,
        lastActiveAt: u.lastLoginAt ? String(u.lastLoginAt) : null,
        topResources: [],
      };
      staffIndex.set(id, member);
      if (email) staffByEmail.set(email, member);
    }
  }

  // Journaux d'audit (API ou local) pour mesurer l'activité des admins & employés
  const auditRows = auditApi.ok ? auditApi.rows : localAuditRows;
  const actionsByType = new Map<string, number>();
  const actionsByResource = new Map<string, number>();
  const staffResources = new Map<string, Map<string, number>>();
  let auditInRange = 0;

  for (const log of auditRows) {
    const dt = parseFlexibleDate(log.createdAt || log.timestamp);
    const inRange = inDateRange(dt, filters);
    if (inRange) {
      auditInRange += 1;
      touchBucket(dt, 'staffActions');
    }
    const action = String(log.action || log.type || 'event').trim();
    const resource = String(log.resource || log.path || 'system').trim();
    if (inRange) {
      actionsByType.set(action, (actionsByType.get(action) || 0) + 1);
      actionsByResource.set(resource, (actionsByResource.get(resource) || 0) + 1);
    }

    const actorId = String(log.actorId || log.userId || '').trim();
    const actorEmail = String(log.actorEmail || log.email || '').trim().toLowerCase();
    let member = (actorId && staffIndex.get(actorId)) || (actorEmail && staffByEmail.get(actorEmail)) || null;
    if (!member && (actorId || actorEmail)) {
      const syntheticId = actorId || actorEmail;
      member = {
        id: syntheticId,
        name: actorEmail || `Opérateur #${actorId}`,
        email: actorEmail,
        role: 'admin',
        category: 'admin',
        status: 'active',
        totpEnabled: false,
        actionsTotal: 0,
        actionsInRange: 0,
        lastActiveAt: null,
        topResources: [],
      };
      staffIndex.set(syntheticId, member);
    }
    if (member) {
      member.actionsTotal += 1;
      if (inRange) member.actionsInRange += 1;
      if (dt && (!member.lastActiveAt || dt.toISOString() > member.lastActiveAt)) {
        member.lastActiveAt = dt.toISOString();
      }
      if (!staffResources.has(member.id)) staffResources.set(member.id, new Map());
      const rm = staffResources.get(member.id)!;
      rm.set(resource, (rm.get(resource) || 0) + 1);
    }
  }

  for (const member of staffIndex.values()) {
    const rm = staffResources.get(member.id);
    if (rm) {
      member.topResources = [...rm.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([res]) => res);
    }
  }

  const staffActivity = [...staffIndex.values()].sort(
    (a, b) => b.actionsInRange - a.actionsInRange || b.actionsTotal - a.actionsTotal,
  );

  // File de traitement globale (en cours, restant à traiter, terminé)
  const queues: WorkQueueItem[] = [
    {
      key: 'applications',
      label: 'Candidatures emploi',
      href: '/admin/applications',
      total: scopedApps.length,
      inProgress: appCounts.reviewed + appCounts.interview,
      remaining: appsInProgress,
      completed: appsProcessed,
      completionRate: pct(appsProcessed, scopedApps.length),
      color: '#169EC9',
    },
    {
      key: 'eventRegistrations',
      label: 'Participations événements',
      href: '/admin/events/registrations',
      total: activeEventRegs.length,
      inProgress: regCounts.waitlist,
      remaining: regToProcess,
      completed: activeEventRegs.length - regToProcess,
      completionRate: pct(activeEventRegs.length - regToProcess, activeEventRegs.length),
      color: '#8B5CF6',
    },
    {
      key: 'orders',
      label: 'Commandes clients',
      href: '/admin/orders',
      total: ordersRows.length,
      inProgress: ordersProcessing,
      remaining: ordersPending + ordersProcessing,
      completed: ordersDelivered + ordersCancelled,
      completionRate: pct(ordersDelivered + ordersCancelled, ordersRows.length),
      color: '#0F9F6E',
    },
    {
      key: 'quotes',
      label: 'Devis commerciaux',
      href: '/admin/quotes',
      total: quotesRows.length,
      inProgress: quotesOpen,
      remaining: quotesOpen,
      completed: quotesAccepted + quotesRejected,
      completionRate: pct(quotesAccepted + quotesRejected, quotesRows.length),
      color: '#EAB616',
    },
    {
      key: 'payments',
      label: 'Encaissements à valider',
      href: '/admin/payment-records',
      total: paymentsRows.length,
      inProgress: paymentsPending,
      remaining: paymentsPending,
      completed: paymentsValidated,
      completionRate: pct(paymentsValidated, paymentsRows.length),
      color: '#F97316',
    },
    {
      key: 'messages',
      label: 'Messages & support',
      href: '/admin/messages',
      total: messagesRows.length,
      inProgress: Math.max(0, messagesRows.length - messagesUnread - messagesResolved),
      remaining: Math.max(0, messagesRows.length - messagesResolved),
      completed: messagesResolved,
      completionRate: pct(messagesResolved, messagesRows.length),
      color: '#EC4899',
    },
    {
      key: 'newsletter',
      label: 'Confirmations newsletter',
      href: '/admin/newsletter',
      total: scopedNl.length,
      inProgress: nlCounts.pending,
      remaining: nlCounts.pending,
      completed: Math.max(0, scopedNl.length - nlCounts.pending),
      completionRate: pct(Math.max(0, scopedNl.length - nlCounts.pending), scopedNl.length),
      color: '#06B6D4',
    },
  ];

  const workloadTotal = queues.reduce((s, q) => s + q.total, 0);
  const workloadInProgress = queues.reduce((s, q) => s + q.inProgress, 0);
  const workloadRemaining = queues.reduce((s, q) => s + q.remaining, 0);
  const workloadCompleted = queues.reduce((s, q) => s + q.completed, 0);

  // Catalogue résumé
  const catalogProducts = statusCounts.products ?? localProducts.length;
  const catalogServices = statusCounts.services ?? localServices.length;
  const catalogSolutions = statusCounts.solutions ?? localSolutions.length;
  const catalogPages = statusCounts.pages ?? 0;
  const catalogPartners = statusCounts.partners ?? localPartners.length;
  const catalogTestimonials = statusCounts.testimonials ?? localTestimonials.length;

  const timeline = [...timelineMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-36);

  const kindLabels: Record<string, string> = {
    image: 'Images (PNG/JPG/WebP)',
    canvas: 'Planches Canvas',
    svg: 'Vectoriels SVG',
    doc: 'Documents (PDF)',
    other: 'Autres fichiers',
  };

  return {
    generatedAt: now.toISOString(),
    connected,
    driver,
    filters,
    unavailable,
    applications: {
      source: appsApi.ok ? 'api' : 'local',
      total: scopedApps.length,
      ...appCounts,
      inProgress: appsInProgress,
      remaining: appsInProgress,
      processed: appsProcessed,
      acceptanceRate: pct(appCounts.accepted, scopedApps.length),
      avgRating: appRatingN ? Math.round((appRatingSum / appRatingN) * 10) / 10 : null,
      withCv: appWithCv,
      byStatus: [
        { key: 'new', label: 'Nouvelles', value: appCounts.new, color: '#169EC9' },
        { key: 'reviewed', label: 'Examinées', value: appCounts.reviewed, color: '#8B5CF6' },
        { key: 'interview', label: 'Entretien', value: appCounts.interview, color: '#EAB616' },
        { key: 'accepted', label: 'Acceptées', value: appCounts.accepted, color: '#0F9F6E' },
        { key: 'rejected', label: 'Refusées', value: appCounts.rejected, color: '#EF4444' },
      ],
      byOffer: topNamed(appsByOffer, 8),
    },
    eventRegistrations: {
      source: 'local',
      total: activeEventRegs.length,
      ...regCounts,
      trash: trashEventRegs,
      approved: regApproved,
      toProcess: regToProcess,
      approvalRate: pct(regApproved, activeEventRegs.length),
      attendanceRate: pct(regCounts.attended, regApproved),
      linkedClients: regLinkedClients,
      byStatus: [
        { key: 'confirmed', label: 'Approuvées', value: regCounts.confirmed, color: '#0F9F6E' },
        { key: 'attended', label: 'Présents', value: regCounts.attended, color: '#169EC9' },
        { key: 'pending', label: 'En attente', value: regCounts.pending, color: '#EAB616' },
        { key: 'waitlist', label: 'Liste d’attente', value: regCounts.waitlist, color: '#8B5CF6' },
        { key: 'rejected', label: 'Refusées', value: regCounts.rejected, color: '#EF4444' },
        { key: 'cancelled', label: 'Annulées', value: regCounts.cancelled, color: '#64748B' },
      ],
      byEvent: [...regByEventMap.values()].sort((a, b) => b.total - a.total).slice(0, 10),
    },
    jobs: {
      source: careersApi.ok ? 'api' : 'local',
      total: careerRows.length,
      active: jobsActive,
      completed: jobsCompleted,
      draft: jobsDraft,
      byStatus: [
        { key: 'active', label: 'Actives / Ouvertes', value: jobsActive, color: '#0F9F6E' },
        { key: 'completed', label: 'Terminées / Pourvues', value: jobsCompleted, color: '#64748B' },
        { key: 'draft', label: 'Brouillons', value: jobsDraft, color: '#EAB616' },
      ],
      byType: topNamed(jobsByType, 6),
      byLocation: topNamed(jobsByLoc, 6, 2),
    },
    articles: {
      source: newsApi.ok ? 'api' : 'local',
      total: newsRows.length,
      published: articlesPublished,
      draft: articlesDraft,
      byCategory: topNamed(articlesByCat, 8),
      byAuthor: topNamed(articlesByAuthor, 8, 3),
    },
    events: {
      source: eventsApi.ok ? 'api' : 'local',
      total: eventRows.length,
      upcoming: eventsUpcoming,
      past: eventsPast,
      draft: eventsDraft,
      byType: topNamed(eventsByType, 6, 1),
    },
    authors: {
      source: authorsApi.ok ? 'api' : 'local',
      total: uniqueAuthors.size,
      active: activeAuthorsCount,
      topAuthors,
    },
    newsletter: {
      source: newsletterApi.ok ? 'api' : 'local',
      total: scopedNl.length,
      ...nlCounts,
      activeRate: pct(nlCounts.subscribed, scopedNl.length),
      byStatus: [
        { key: 'subscribed', label: 'Abonnés actifs', value: nlCounts.subscribed, color: '#0F9F6E' },
        { key: 'pending', label: 'En attente', value: nlCounts.pending, color: '#EAB616' },
        { key: 'unsubscribed', label: 'Désabonnés', value: nlCounts.unsubscribed, color: '#64748B' },
        { key: 'bounced', label: 'Rebondis', value: nlCounts.bounced, color: '#F97316' },
        { key: 'blocked', label: 'Bloqués', value: nlCounts.blocked, color: '#EF4444' },
      ],
      byLocale: topNamed(nlByLocale, 6),
      bySource: topNamed(nlBySource, 6, 2),
    },
    ged: {
      source: 'ged',
      totalFiles: gedItems.length,
      totalBytes: gedTotalBytes,
      editableCount: gedEditable,
      versionedCount: gedVersioned,
      totalVersions: gedTotalVersions,
      usedFiles: gedUsedFiles,
      unusedFiles: gedUnusedFiles,
      utilizationRate: pct(gedUsedFiles, gedItems.length),
      totalReferences: gedTotalRefs,
      byKind: [...gedKindMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([key, v], i) => ({
          key,
          label: kindLabels[key] || key.toUpperCase(),
          count: v.count,
          bytes: v.bytes,
          color: PALETTE[i % PALETTE.length],
        })),
      byModule: [...gedModMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([key, v], i) => ({
          key,
          label: key,
          count: v.count,
          bytes: v.bytes,
          color: PALETTE[(i + 2) % PALETTE.length],
        })),
      byOrigin: topNamed(gedOriginMap, 6, 4),
      topUsed: [...gedUsageList]
        .filter((f) => f.references > 0)
        .sort((a, b) => b.references - a.references || b.bytes - a.bytes)
        .slice(0, 8),
      largestFiles: [...gedUsageList]
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 8)
        .map((f) => ({
          file: f.file,
          name: f.name,
          url: f.url,
          kind: f.kind,
          module: f.module,
          bytes: f.bytes,
          used: f.references > 0,
        })),
    },
    team: {
      source: usersApi.ok ? 'api' : auditApi.ok ? 'mixed' : 'local',
      totalUsers: usersRows.length || (statusCounts.users ?? 0),
      admins,
      employees,
      staffTotal: admins + employees,
      staffActive,
      staffWith2FA,
      clients,
      partners,
      candidates,
      byRole: [
        { key: 'admin', label: 'Administrateurs', value: admins, color: '#169EC9' },
        { key: 'employee', label: 'Employés / Équipe', value: employees, color: '#8B5CF6' },
        { key: 'client', label: 'Clients', value: clients, color: '#0F9F6E' },
        { key: 'partner', label: 'Partenaires', value: partners, color: '#EAB616' },
        { key: 'candidate', label: 'Candidats', value: candidates, color: '#F97316' },
      ],
      queues,
      workload: {
        totalItems: workloadTotal,
        inProgress: workloadInProgress,
        remaining: workloadRemaining,
        completed: workloadCompleted,
        completionRate: pct(workloadCompleted, workloadTotal),
      },
      auditTotal: auditRows.length,
      auditInRange,
      actionsByType: topNamed(actionsByType, 8),
      actionsByResource: topNamed(actionsByResource, 8, 2),
      staffActivity: staffActivity.slice(0, 15),
    },
    commerce: {
      source: ordersApi.ok ? 'api' : 'local',
      ordersTotal: ordersRows.length,
      ordersPending,
      ordersProcessing,
      ordersDelivered,
      ordersCancelled,
      revenueDelivered,
      revenuePending,
      quotesTotal: quotesRows.length,
      quotesOpen,
      quotesAccepted,
      quotesRejected,
      quoteConversionRate: pct(quotesAccepted, quotesRows.length),
      paymentsTotal: paymentsRows.length,
      paymentsPending,
      paymentsValidated,
      paymentsPendingAmount,
      paymentsValidatedAmount,
      messagesTotal: messagesRows.length,
      messagesUnread,
      messagesResolved,
    },
    catalog: {
      source: connected ? 'api' : 'local',
      products: catalogProducts,
      services: catalogServices,
      solutions: catalogSolutions,
      pages: catalogPages,
      partners: catalogPartners,
      testimonials: catalogTestimonials,
      totalCms:
        catalogProducts +
        catalogServices +
        catalogSolutions +
        catalogPages +
        catalogPartners +
        catalogTestimonials +
        newsRows.length +
        eventRows.length +
        careerRows.length,
    },
    timeline,
  };
}

// =========================================================================
// Préférences de tableau de bord (persistance serveur atomique)
// =========================================================================

function prefsFile(): string {
  return process.env.ANALYTICS_PREFS_FILE || path.join(process.cwd(), 'data', 'analytics-prefs.json');
}

let prefQueue: Promise<unknown> = Promise.resolve();
let prefTmpSeq = 0;

export function sanitizeDashboardPrefs(input: unknown): DashboardPrefs {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const validRanges: AnalyticsRange[] = ['7d', '30d', '90d', '365d', 'all', 'custom'];
  const validCharts: Array<DashboardPrefs['defaultChartType']> = ['column', 'bar', 'area', 'donut', 'table'];

  return {
    hiddenWidgets: Array.isArray(obj.hiddenWidgets)
      ? [...new Set(obj.hiddenWidgets.map((s) => String(s).slice(0, 48)).filter(Boolean))].slice(0, 30)
      : DEFAULT_DASHBOARD_PREFS.hiddenWidgets,
    defaultRange: validRanges.includes(obj.defaultRange as AnalyticsRange)
      ? (obj.defaultRange as AnalyticsRange)
      : DEFAULT_DASHBOARD_PREFS.defaultRange,
    defaultChartType: validCharts.includes(obj.defaultChartType as DashboardPrefs['defaultChartType'])
      ? (obj.defaultChartType as DashboardPrefs['defaultChartType'])
      : DEFAULT_DASHBOARD_PREFS.defaultChartType,
    animationsEnabled:
      obj.animationsEnabled !== undefined ? Boolean(obj.animationsEnabled) : DEFAULT_DASHBOARD_PREFS.animationsEnabled,
  };
}

export async function readDashboardPrefs(): Promise<DashboardPrefs> {
  try {
    const raw = await fs.readFile(prefsFile(), 'utf8');
    return sanitizeDashboardPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DASHBOARD_PREFS };
  }
}

export function writeDashboardPrefs(patch: Partial<DashboardPrefs>): Promise<DashboardPrefs> {
  const run = prefQueue.then(async () => {
    const cur = await readDashboardPrefs();
    const merged = sanitizeDashboardPrefs({ ...cur, ...patch });
    const target = prefsFile();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${(prefTmpSeq += 1)}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(merged, null, 2), 'utf8');
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
    return merged;
  });
  prefQueue = run.then(() => undefined, () => undefined);
  return run;
}
