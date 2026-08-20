'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileText, GitCompare, Mail, Phone, Star } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { DEMO_APPLICATIONS, DEMO_FLAG } from '@/lib/demo-seed';
import {
  APP_STEPS, Application, candidateStats, downloadText, exportApplicationsCsv,
  groupByOffer, loadApplications, loadOffers, offerById, saveApplications, statusRank, type Offer,
} from '@/lib/recruitment';

const SEED: Application[] = DEMO_APPLICATIONS as Application[];

type SortKey = 'rank' | 'candidate' | 'experience' | 'date' | 'score' | 'status';

export default function CompareCandidatesPage() {
  const locale = useLocale();
  const params = useSearchParams();
  const offerParam = params.get('offer') || '';
  const { showToast } = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offer, setOffer] = useState(offerParam);
  const [viewer, setViewer] = useState<{ title: string; content: string; filename: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const stored = loadApplications();
    setRows(stored.length >= SEED.length ? stored : SEED);
    if (stored.length < SEED.length) saveApplications(SEED);
    loadOffers(locale).then(setOffers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => { if (offerParam) setOffer(offerParam); }, [offerParam]);

  const offersList = useMemo(() => groupByOffer(rows), [rows]);

  const scoreOf = (app: Application): number => {
    const years = parseInt(String(app.experience || '0'), 10) || 0;
    const statusScore = APP_STEPS.length - 1 - Math.max(0, statusRank(app.status));
    const rating = app.rating || 0;
    return years * 10 + statusScore * 5 + rating * 6;
  };

  const baseCandidates = useMemo(
    () => rows.filter((r) => !offer || r.jobTitle === offer),
    [rows, offer],
  );

  const ranked = useMemo(() => {
    const scored = baseCandidates.map((app) => ({ app, score: scoreOf(app) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [baseCandidates]);

  const candidates = useMemo(() => {
    const arr = [...ranked];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'rank': return (a.rank - b.rank) * dir;
        case 'candidate': return String(a.app.candidate).localeCompare(String(b.app.candidate)) * dir;
        case 'experience': return (parseInt(String(a.app.experience || '0'), 10) - parseInt(String(b.app.experience || '0'), 10)) * dir;
        case 'date': return String(a.app.date).localeCompare(String(b.app.date)) * dir;
        case 'score': return (a.score - b.score) * dir;
        case 'status': return String(a.app.status).localeCompare(String(b.app.status)) * dir;
        default: return 0;
      }
    });
    return arr;
  }, [ranked, sortKey, sortDir]);

  const stats = candidateStats(baseCandidates);

  const commit = (next: Application[]) => { setRows(next); saveApplications(next); };

  const setRating = (id: number, rating: number) => {
    commit(rows.map((r) => r.id === id ? { ...r, rating } : r));
  };

  const setNote = (id: number, note: string) => {
    commit(rows.map((r) => r.id === id ? { ...r, note } : r));
  };

  const openDoc = (kind: 'cv' | 'lm', app: Application) => {
    const content = kind === 'cv' ? app.cv : app.lm;
    if (!content) { showToast('Document non fourni', 'warning'); return; }
    setViewer({ title: `${kind === 'cv' ? 'CV' : 'Lettre de motivation'} — ${app.candidate}`, content, filename: `${kind === 'cv' ? 'CV' : 'LM'}-${app.candidate.replace(/\s+/g, '-')}.txt` });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : null}</span>
    </th>
  );

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
          <button className="ad-btn ad-btn-primary" onClick={() => { exportApplicationsCsv(baseCandidates, offer || undefined); showToast('Export CSV généré', 'success'); }}>
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Candidats" value={stats.total} />
        <MiniStat label="En entretien" value={stats.byStatus.find((s) => s.value === 'interview')?.count || 0} />
        <MiniStat label="Acceptés" value={stats.accepted} />
        <MiniStat label="Exp. moyenne" value={`${stats.avgExp} ans`} />
        <MiniStat label="Note moyenne" value={(baseCandidates.length ? (baseCandidates.reduce((s, r) => s + (r.rating || 0), 0) / baseCandidates.length).toFixed(1) : '—')} />
      </div>

      {candidates.length === 0 ? (
        <div className="ad-card p-12 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun candidat pour cette offre.</div>
      ) : (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-2">
          <table className="ad-table min-w-[900px]">
            <thead>
              <tr>
                <SortHeader label="Classement" k="rank" />
                <SortHeader label="Candidat" k="candidate" />
                <th>Contact</th>
                <SortHeader label="Expérience" k="experience" />
                <th>Motivation</th>
                <th>Note</th>
                <th>Commentaire</th>
                <SortHeader label="Statut" k="status" />
                <SortHeader label="Score" k="score" />
                <th className="text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map(({ app, score, rank }) => {
                const offerInfo = offerById(offers, app);
                return (
                  <tr key={app.id}>
                    <td>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm"
                        style={rank === 1 ? { background: '#eab616', color: '#1a1400' } : rank === 2 ? { background: 'color-mix(in srgb, var(--ad-accent) 30%, var(--ad-surface))', color: 'var(--ad-accent)' } : rank === 3 ? { background: 'color-mix(in srgb, var(--ad-accent) 16%, var(--ad-surface))', color: 'var(--ad-accent)' } : { background: 'var(--ad-surface-2)', color: 'var(--ad-muted)' }}>
                        {rank}
                      </span>
                    </td>
                    <td className="font-bold">
                      {app.candidate}
                      <div className="text-xs font-normal" style={{ color: 'var(--ad-muted)' }}>{app.jobTitle}</div>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>
                      <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.email}</div>
                      <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.phone}</div>
                      {offerInfo?.location && <div className="mt-0.5">📍 {offerInfo.location}</div>}
                    </td>
                    <td>{app.experience}</td>
                    <td className="max-w-xs text-sm" style={{ color: 'var(--ad-muted)' }}>{app.motivation}</td>
                    <td>
                      <span className="inline-flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" className="p-0 leading-none" onClick={() => setRating(app.id, n)} title={`${n}/5`}>
                            <Star className="w-4 h-4" style={{ color: n <= (app.rating || 0) ? '#eab616' : 'var(--ad-line)', fill: n <= (app.rating || 0) ? '#eab616' : 'none' }} />
                          </button>
                        ))}
                      </span>
                    </td>
                    <td className="min-w-[160px]">
                      <input className="ad-input !h-8 text-xs" placeholder="Note recruteur…" defaultValue={app.note || ''} onBlur={(e) => setNote(app.id, e.target.value)} />
                    </td>
                    <td><span className={`ad-chip ${app.status === 'accepted' ? 'ad-chip-ok' : app.status === 'rejected' ? 'ad-chip-warn' : 'ad-chip-acc'}`}>{app.status}</span></td>
                    <td className="font-black tabular-nums" style={{ color: 'var(--ad-accent)' }}>{score}</td>
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
