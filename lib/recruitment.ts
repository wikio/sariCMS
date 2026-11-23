'use client';

import { escapeCsvCell, triggerDownload } from '@/lib/analytics-export';
import { cmsAdminList } from '@/lib/cms-admin';

export const APP_STEPS = ['new', 'reviewed', 'interview', 'accepted', 'rejected'] as const;
export type ApplicationStatus = (typeof APP_STEPS)[number];

export interface Application {
  id: number;
  candidate: string;
  email: string;
  phone: string;
  jobTitle: string;
  offerId?: number;
  status: ApplicationStatus;
  date: string;
  experience: string;
  motivation: string;
  rating?: number;
  score?: number;
  note?: string;
  cv?: string;
  lm?: string;
  history?: Array<{ status: string; at: string; note?: string }>;
}

export interface Offer {
  id: string;
  legacyId?: number | null;
  title: string;
  location?: string | null;
  type?: string | null;
  salary?: string | null;
  shortDesc?: string | null;
  fullDesc?: string | null;
  mission?: string | null;
  typeTravail?: string | null;
  experience?: string | null;
  contact?: string | null;
  objectifs?: string[] | null;
  prerequis?: string[] | null;
  workflow?: string[] | null;
  benefits?: string[] | null;
  status?: string;
  publishedAt?: string | null;
  [key: string]: unknown;
}

export const APPS_KEY = 'sari_applications';

export function loadApplications(): Application[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(APPS_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

export function saveApplications(rows: Application[]) {
  const prevRaw = typeof window !== 'undefined' ? localStorage.getItem(APPS_KEY) : null;
  localStorage.setItem(APPS_KEY, JSON.stringify(rows));
  void import('@/lib/crm-sync').then((m) => m.pushCollection('applications', rows, prevRaw)).catch(() => {});
}

export function statusRank(status: ApplicationStatus): number {
  return APP_STEPS.indexOf(status);
}

/** Charge les offres (carrières) depuis le CMS, mappées par legacyId + titre. */
export async function loadOffers(locale?: string): Promise<Offer[]> {
  try {
    const list = await cmsAdminList<Offer>('careers', locale ? { view: 'block', filter: JSON.stringify({ locale }) } : { view: 'block' });
    return list;
  } catch {
    return [];
  }
}

export function offerById(offers: Offer[], app: Application): Offer | undefined {
  if (app.offerId != null) {
    const byLegacy = offers.find((o) => Number(o.legacyId) === app.offerId);
    if (byLegacy) return byLegacy;
  }
  const t = String(app.jobTitle || '').toLowerCase();
  return offers.find((o) => {
    const title = String(o.title || '').toLowerCase();
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm(title) === norm(t) || norm(title).includes(norm(t)) || norm(t).includes(norm(title));
  });
}

/** Regroupe les candidatures par offre (titre). */
export function groupByOffer(rows: Application[]): Array<{ key: string; title: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.jobTitle || '—');
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([title, count]) => ({ key: title, title, count }));
}

export function candidateStats(rows: Application[]) {
  const total = rows.length;
  const byStatus = APP_STEPS.map((value) => ({ value, count: rows.filter((r) => r.status === value).length }));
  const offers = groupByOffer(rows).length;
  const accepted = rows.filter((r) => r.status === 'accepted').length;
  const conversion = total ? Math.round((accepted / total) * 100) : 0;
  const expYears = rows
    .map((r) => parseInt(String(r.experience || '0'), 10))
    .filter((n) => Number.isFinite(n));
  const avgExp = expYears.length ? (expYears.reduce((a, b) => a + b, 0) / expYears.length).toFixed(1) : '—';
  return { total, byStatus, offers, accepted, conversion, avgExp };
}

type ApplicationLabel = (key: string, values?: Record<string, string | number>) => string;

/** Translate a numeric duration, never an applicant's free-text description. */
export function formatExperience(value: string, label: ApplicationLabel): string {
  const match = /^(\d+(?:[.,]\d+)?)\s*(?:ans?|years?)$/i.exec(String(value ?? '').trim());
  return match ? label('years', { count: Number(match[1].replace(',', '.')) }) : value;
}

export function exportApplicationsCsv(rows: Application[], label: ApplicationLabel, title?: string) {
  const columns = ['candidate', 'email', 'phone', 'offer', 'experience', 'status', 'rating', 'score', 'date', 'motivation', 'comment'];
  const lines = [columns.map((column) => escapeCsvCell(label(column))).join(';')];
  for (const r of rows) {
    lines.push([
      r.candidate, r.email, r.phone, r.jobTitle, formatExperience(r.experience, label),
      APP_STEPS.includes(r.status) ? label(`step_${r.status}`) : r.status, r.rating || '', r.score ?? '', r.date,
      r.motivation || '', r.note || '',
    ].map(escapeCsvCell).join(';'));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${label('csvName')}${title ? '-' + title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') : ''}.csv`);
}

export function downloadText(filename: string, content: string) {
  triggerDownload(new Blob([content], { type: 'text/plain;charset=utf-8' }), filename);
}
