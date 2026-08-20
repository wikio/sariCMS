'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, GitCompare, Mail, Phone } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { DEMO_APPLICATIONS, DEMO_FLAG } from '@/lib/demo-seed';
import {
  APP_STEPS, Application, candidateStats, downloadText, exportApplicationsCsv,
  groupByOffer, loadApplications, loadOffers, offerById, saveApplications, type Offer,
} from '@/lib/recruitment';

const SEED: Application[] = DEMO_APPLICATIONS as Application[];

export default function CompareCandidatesPage() {
  const locale = useLocale();
  const params = useSearchParams();
  const offerParam = params.get('offer') || '';
  const { showToast } = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offer, setOffer] = useState(offerParam);
  const [viewer, setViewer] = useState<{ title: string; content: string; filename: string } | null>(null);

  useEffect(() => {
    const stored = loadApplications();
    setRows(stored.length >= SEED.length ? stored : SEED);
    if (stored.length < SEED.length) saveApplications(SEED);
    loadOffers(locale).then(setOffers);
    if (!localStorage.getItem(DEMO_FLAG) && stored.length < SEED.length) localStorage.setItem(DEMO_FLAG, '1');
  }, []);

  useEffect(() => { if (offerParam) setOffer(offerParam); }, [offerParam]);

  const offersList = useMemo(() => groupByOffer(rows), [rows]);

  const candidates = useMemo(
    () => rows.filter((r) => !offer || r.jobTitle === offer).sort((a, b) => (b.experience || '').localeCompare(a.experience || '')),
    [rows, offer],
  );

  const stats = candidateStats(candidates);

  const openDoc = (kind: 'cv' | 'lm', app: Application) => {
    const content = kind === 'cv' ? app.cv : app.lm;
    if (!content) { showToast('Document non fourni', 'warning'); return; }
    setViewer({ title: `${kind === 'cv' ? 'CV' : 'Lettre de motivation'} — ${app.candidate}`, content, filename: `${kind === 'cv' ? 'CV' : 'LM'}-${app.candidate.replace(/\s+/g, '-')}.txt` });
  };

  const scoreOf = (app: Application): number => {
    const years = parseInt(String(app.experience || '0'), 10) || 0;
    const statusScore = APP_STEPS.length - 1 - Math.max(0, APP_STEPS.findIndex((s) => s.value === app.status));
    return years * 10 + statusScore * 5;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 ad-rise">
        <div>
          <Link href={`/${locale}/admin/applications`} className="text-xs font-bold uppercase tracking-widest flex items-center gap-1 mb-1" style={{ color: 'var(--ad-muted)' }}>
            <ArrowLeft className="w-3 h-3" /> Candidatures
          </Link>
          <h1 className="text-2xl font-black flex items-center gap-2"><GitCompare className="w-5 h-5" style={{ color: 'var(--ad-accent)' }} /> Comparaison des candidats</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{candidates.length} candidat(s) pour « {offer || 'toutes les offres'} »</p>
        </div>
        <div className="flex gap-2">
          <select className="ad-select w-64" value={offer} onChange={(e) => setOffer(e.target.value)}>
            <option value="">Toutes les offres</option>
            {offersList.map((o) => <option key={o.key} value={o.title}>{o.title} ({o.count})</option>)}
          </select>
          <button className="ad-btn ad-btn-primary" onClick={() => { exportApplicationsCsv(candidates, offer || undefined); showToast('Export CSV généré', 'success'); }}>
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Candidats" value={stats.total} />
        <MiniStat label="En entretien" value={stats.byStatus.find((s) => s.value === 'interview')?.count || 0} />
        <MiniStat label="Acceptés" value={stats.accepted} />
        <MiniStat label="Exp. moyenne" value={`${stats.avgExp} ans`} />
      </div>

      {candidates.length === 0 ? (
        <div className="ad-card p-12 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun candidat pour cette offre.</div>
      ) : (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-2">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Candidat</th>
                <th>Contact</th>
                <th>Expérience</th>
                <th>Motivation</th>
                <th>Statut</th>
                <th>Score</th>
                <th className="text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((app) => {
                const offerInfo = offerById(offers, app);
                return (
                  <tr key={app.id}>
                    <td className="font-bold">
                      {app.candidate}
                      <div className="text-xs font-normal" style={{ color: 'var(--ad-muted)' }}>{app.jobTitle}</div>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>
                      <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.email}</div>
                      <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.phone}</div>
                    </td>
                    <td>{app.experience}</td>
                    <td className="max-w-xs text-sm" style={{ color: 'var(--ad-muted)' }}>{app.motivation}</td>
                    <td><span className={`ad-chip ${app.status === 'accepted' ? 'ad-chip-ok' : app.status === 'rejected' ? 'ad-chip-warn' : 'ad-chip-acc'}`}>{app.status}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1 font-black tabular-nums" style={{ color: 'var(--ad-accent)' }}>
                        {scoreOf(app)}
                      </span>
                      <div className="text-[10px]" style={{ color: 'var(--ad-muted)' }}>{offerInfo?.location || ''}</div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title="CV" onClick={() => openDoc('cv', app)}><FileText className="w-4 h-4" /></button>
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Lettre" onClick={() => openDoc('lm', app)}><Download className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewer && (
        <div className="ad-modal" onClick={() => setViewer(null)}>
          <div className="ad-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-lg font-black">{viewer.title}</h3>
              <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setViewer(null)}>×</button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed max-h-[60vh] overflow-auto ad-scroll">{viewer.content}</pre>
            <div className="flex justify-end pt-3">
              <button className="ad-btn ad-btn-primary" onClick={() => downloadText(viewer.filename, viewer.content)}><Download className="w-4 h-4" /> Télécharger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ad-card p-3 ad-card-hover">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{label}</div>
    </div>
  );
}
