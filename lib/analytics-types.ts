/**
 * Types partagés entre le moteur d'analytique serveur (`lib/analytics-engine.ts`),
 * l'API `/api/admin/analytics`, l'accueil du tableau de bord, la page Statistiques
 * et le moteur d'export (`lib/analytics-export.ts`).
 */

export type AnalyticsRange = '7d' | '30d' | '90d' | '365d' | 'all' | 'custom';
export type AnalyticsGranularity = 'day' | 'week' | 'month';
export type AnalyticsLocaleFilter = 'all' | 'fr' | 'en' | 'ar';
export type AnalyticsSource = 'api' | 'local' | 'mixed' | 'ged';

export interface AnalyticsFilters {
  range: AnalyticsRange;
  from: string;
  to: string;
  locale: AnalyticsLocaleFilter;
  granularity: AnalyticsGranularity;
}

export interface NamedCount {
  key: string;
  label: string;
  value: number;
  secondary?: number;
  color?: string;
}

export interface TimelinePoint {
  bucket: string;
  label: string;
  applications: number;
  eventRegistrations: number;
  newsletter: number;
  articles: number;
  gedUploads: number;
  orders: number;
  staffActions: number;
}

export interface ApplicationsStats {
  source: AnalyticsSource;
  total: number;
  new: number;
  reviewed: number;
  interview: number;
  accepted: number;
  rejected: number;
  inProgress: number;
  remaining: number;
  processed: number;
  acceptanceRate: number;
  avgRating: number | null;
  withCv: number;
  byStatus: NamedCount[];
  byOffer: NamedCount[];
}

export interface EventRegistrationsStats {
  source: AnalyticsSource;
  total: number;
  pending: number;
  confirmed: number;
  attended: number;
  waitlist: number;
  rejected: number;
  cancelled: number;
  trash: number;
  approved: number;
  toProcess: number;
  approvalRate: number;
  attendanceRate: number;
  linkedClients: number;
  byStatus: NamedCount[];
  byEvent: Array<{
    eventId: string;
    title: string;
    total: number;
    approved: number;
    pending: number;
    attended: number;
    rejected: number;
  }>;
}

export interface JobsStats {
  source: AnalyticsSource;
  total: number;
  active: number;
  completed: number;
  draft: number;
  byStatus: NamedCount[];
  byType: NamedCount[];
  byLocation: NamedCount[];
}

export interface ArticlesStats {
  source: AnalyticsSource;
  total: number;
  published: number;
  draft: number;
  byCategory: NamedCount[];
  byAuthor: NamedCount[];
}

export interface EventsCatalogStats {
  source: AnalyticsSource;
  total: number;
  upcoming: number;
  past: number;
  draft: number;
  byType: NamedCount[];
}

export interface AuthorsStats {
  source: AnalyticsSource;
  total: number;
  active: number;
  topAuthors: Array<{
    name: string;
    role: string;
    articles: number;
  }>;
}

export interface NewsletterStats {
  source: AnalyticsSource;
  total: number;
  subscribed: number;
  pending: number;
  unsubscribed: number;
  bounced: number;
  blocked: number;
  activeRate: number;
  byStatus: NamedCount[];
  byLocale: NamedCount[];
  bySource: NamedCount[];
}

export interface GedStats {
  source: 'ged';
  totalFiles: number;
  totalBytes: number;
  editableCount: number;
  versionedCount: number;
  totalVersions: number;
  usedFiles: number;
  unusedFiles: number;
  utilizationRate: number;
  totalReferences: number;
  byKind: Array<{ key: string; label: string; count: number; bytes: number; color: string }>;
  byModule: Array<{ key: string; label: string; count: number; bytes: number; color: string }>;
  byOrigin: NamedCount[];
  topUsed: Array<{
    file: string;
    name: string;
    url: string;
    kind: string;
    module: string;
    bytes: number;
    references: number;
    usedIn: string[];
  }>;
  largestFiles: Array<{
    file: string;
    name: string;
    url: string;
    kind: string;
    module: string;
    bytes: number;
    used: boolean;
  }>;
}

export interface WorkQueueItem {
  key: string;
  label: string;
  href: string;
  total: number;
  inProgress: number;
  remaining: number;
  completed: number;
  completionRate: number;
  color: string;
}

export interface StaffMemberStats {
  id: string;
  name: string;
  email: string;
  role: string;
  category: 'admin' | 'employee';
  status: string;
  totpEnabled: boolean;
  actionsTotal: number;
  actionsInRange: number;
  lastActiveAt: string | null;
  topResources: string[];
}

export interface TeamStats {
  source: AnalyticsSource;
  totalUsers: number;
  admins: number;
  employees: number;
  staffTotal: number;
  staffActive: number;
  staffWith2FA: number;
  clients: number;
  partners: number;
  candidates: number;
  byRole: NamedCount[];
  queues: WorkQueueItem[];
  workload: {
    totalItems: number;
    inProgress: number;
    remaining: number;
    completed: number;
    completionRate: number;
  };
  auditTotal: number;
  auditInRange: number;
  actionsByType: NamedCount[];
  actionsByResource: NamedCount[];
  staffActivity: StaffMemberStats[];
}

export interface CommerceStats {
  source: AnalyticsSource;
  ordersTotal: number;
  ordersPending: number;
  ordersProcessing: number;
  ordersDelivered: number;
  ordersCancelled: number;
  revenueDelivered: number;
  revenuePending: number;
  quotesTotal: number;
  quotesOpen: number;
  quotesAccepted: number;
  quotesRejected: number;
  quoteConversionRate: number;
  paymentsTotal: number;
  paymentsPending: number;
  paymentsValidated: number;
  paymentsPendingAmount: number;
  paymentsValidatedAmount: number;
  messagesTotal: number;
  messagesUnread: number;
  messagesResolved: number;
}

export interface CatalogSummary {
  source: AnalyticsSource;
  products: number;
  services: number;
  solutions: number;
  pages: number;
  partners: number;
  testimonials: number;
  totalCms: number;
}

export interface AnalyticsSnapshot {
  generatedAt: string;
  connected: boolean;
  driver: string;
  filters: AnalyticsFilters;
  unavailable: string[];
  applications: ApplicationsStats;
  eventRegistrations: EventRegistrationsStats;
  jobs: JobsStats;
  articles: ArticlesStats;
  events: EventsCatalogStats;
  authors: AuthorsStats;
  newsletter: NewsletterStats;
  ged: GedStats;
  team: TeamStats;
  commerce: CommerceStats;
  catalog: CatalogSummary;
  timeline: TimelinePoint[];
}

export interface DashboardPrefs {
  hiddenWidgets: string[];
  defaultRange: AnalyticsRange;
  defaultChartType: 'column' | 'bar' | 'area' | 'donut' | 'table';
  animationsEnabled: boolean;
}

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  hiddenWidgets: [],
  defaultRange: '30d',
  defaultChartType: 'column',
  animationsEnabled: true,
};
