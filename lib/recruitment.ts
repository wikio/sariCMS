'use client';

import { cmsAdminList } from '@/lib/cms-admin';

export type ApplicationStatus = 'new' | 'reviewed' | 'interview' | 'accepted' | 'rejected';

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
  mission?: string | null;
  typeTravail?: string | null;
  status?: string;
  [key: string]: unknown;
}

const APPS_KEY = 'sari_applications';

export const APP_STEPS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'new', label: 'Nouvelle' },
  { value: 'reviewed', label: 'Examinée' },
  { value: 'interview', label: 'Entretien' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'rejected', label: 'Refusée' },
];

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
  localStorage.setItem(APPS_KEY, JSON.stringify(rows));
}

export function statusRank(status: ApplicationStatus): number {
  return APP_STEPS.findIndex((s) => s.value === status);
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
  const byStatus = APP_STEPS.map((s) => ({ ...s, count: rows.filter((r) => r.status === s.value).length }));
  const offers = groupByOffer(rows).length;
  const accepted = rows.filter((r) => r.status === 'accepted').length;
  const conversion = total ? Math.round((accepted / total) * 100) : 0;
  const expYears = rows
    .map((r) => parseInt(String(r.experience || '0'), 10))
    .filter((n) => Number.isFinite(n));
  const avgExp = expYears.length ? (expYears.reduce((a, b) => a + b, 0) / expYears.length).toFixed(1) : '—';
  return { total, byStatus, offers, accepted, conversion, avgExp };
}

export function exportApplicationsCsv(rows: Application[], title?: string) {
  const cols = ['Candidat', 'Email', 'Téléphone', 'Offre', 'Expérience', 'Statut', 'Note', 'Score', 'Date', 'Motivation', 'Commentaire'];
  const lines = [cols.join(';')];
  for (const r of rows) {
    lines.push(
      [
        r.candidate, r.email, r.phone, r.jobTitle, r.experience, r.status,
        r.rating || '', r.score != null ? r.score : '', r.date,
        `"${String(r.motivation || '').replace(/"/g, '""')}"`,
        `"${String(r.note || '').replace(/"/g, '""')}"`,
      ].join(';'),
    );
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `candidatures${title ? '-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
