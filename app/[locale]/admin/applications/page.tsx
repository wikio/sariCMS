'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
  ChevronDown, Download, Eye, FileText, GitCompare, Mail, Phone, Trash2, Users,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import SearchField from '@/components/admin/SearchField';
import Drawer from '@/components/admin/Drawer';
import { DEMO_APPLICATIONS, DEMO_FLAG } from '@/lib/demo-seed';
import {
  APP_STEPS, Application, candidateStats, downloadText, exportApplicationsCsv,
  groupByOffer, loadApplications, loadOffers, offerById, saveApplications, statusRank, type Offer,
} from '@/lib/recruitment';

const SEED: Application[] = DEMO_APPLICATIONS as Application[];

export default function AdminApplicationsPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [offerFilter, setOfferFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ title: string; content: string; filename: string } | null>(null);

  useEffect(() => {
    const stored = loadApplications();
    if (stored && stored.length >= SEED.length) {
      setRows(stored);
    } else {
      setRows(SEED);
      saveApplications(SEED);
    }
    loadOffers(locale).then(setOffers);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(DEMO_FLAG)) return;
    setRows(SEED.length > loadApplications().length ? SEED : loadApplications());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (offerFilter && r.jobTitle !== offerFilter) return false;
    if (!q.trim()) return true;
    return `${r.candidate} ${r.jobTitle} ${r.email}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, status, offerFilter]);

  const stats = candidateStats(rows);
  const offersList = groupByOffer(rows);
  const offerByApp = useMemo(() => {
    const map: Record<number, Offer | undefined> = {};
    for (const app of rows) map[app.id] = offerById(offers, app);
    return map;
  }, [rows, offers]);

  const setStatusOf = (id: number, next: string) => {
    const updated = rows.map((r) =>
      r.id === id ? { ...r, status: next as Application['status'], history: [...(r.history || []), { status: next, at: new Date().toISOString() }] } : r,
    );
    setRows(updated);
    saveApplications(updated);
    showToast('Statut mis à jour', 'success');
  };

  const remove = (id: number) => {
    const updated = rows.filter((r) => r.id !== id);
    setRows(updated);
    saveApplications(updated);
  };

  const openDoc = (kind: 'cv' | 'lm', app: Application) => {
    const content = kind === 'cv' ? app.cv : app.lm;
    if (!content) { showToast('Document non fourni', 'warning'); return; }
    const filename = `${kind === 'cv' ? 'CV' : 'LM'}-${app.candidate.replace(/\s+/g, '-')}.txt`;
    setViewer({ title: `${kind === 'cv' ? 'CV' : 'Lettre de motivation'} — ${app.candidate}`, content, filename });
  };

  const exportCurrent = () => {
    exportApplicationsCsv(shown, offerFilter || undefined);
    showToast('Export CSV généré', 'success');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>RH</div>
          <h1 className="text-3xl font-black tracking-tight">Candidatures</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{stats.total} candidature(s) · {stats.offers} offre(s)</p>
        </div>
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={exportCurrent}><Download className="w-4 h-4" /> Exporter</button>
          <Link href={`/${locale}/admin/applications/compare`} className="ad-btn ad-btn-primary"><GitCompare className="w-4 h-4" /> Comparer les candidats</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatTile label="Total" value={stats.total} icon={Users} accent />
        {stats.byStatus.map((s) => (
          <StatTile key={s.value} label={s.label} value={s.count} icon={null} />
        ))}
        <StatTile label="Taux d’acceptation" value={`${stats.conversion}%`} icon={null} />
        <StatTile label="Exp. moyenne" value={`${stats.avgExp} ans`} icon={null} />
      </div>

      <div className="ad-card p-3 flex flex-col lg:flex-row gap-2 ad-rise ad-rise-2">
        <SearchField className="flex-1" value={draft} onChange={setDraft} onSubmit={() => setQ(draft)} showSubmit placeholder="Candidat, e-mail, offre…" />
        <select className="ad-select lg:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {APP_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="ad-select lg:w-56" value={offerFilter} onChange={(e) => setOfferFilter(e.target.value)}>
          <option value="">Toutes les offres</option>
          {offersList.map((o) => <option key={o.key} value={o.title}>{o.title} ({o.count})</option>)}
        </select>
      </div>

      <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Candidat</th><th>Offre</th><th>Expérience</th><th>Date</th><th>Statut</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const isOpen = expanded === row.id;
              const offer = offerByApp[row.id];
              return (
                <RowGroup key={row.id}>
                  <tr onClick={() => setExpanded(isOpen ? null : row.id)} className="cursor-pointer">
                    <td className="font-bold">
                      <div className="flex items-center gap-1">{row.candidate}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
                      <div className="text-xs font-normal flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}><Mail className="w-3 h-3" />{row.email} · <Phone className="w-3 h-3" />{row.phone}</div>
                    </td>
                    <td>{row.jobTitle}</td>
                    <td>{row.experience}</td>
                    <td>{row.date}</td>
                    <td>
                      <select className="ad-select !w-auto !h-8 text-xs" value={row.status} onChange={(e) => { e.stopPropagation(); setStatusOf(row.id, e.target.value); }}>
                        {APP_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Voir le CV" onClick={() => openDoc('cv', row)}><FileText className="w-4 h-4" /></button>
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Télécharger le CV" onClick={() => { row.cv ? downloadText(`CV-${row.candidate.replace(/\s+/g, '-')}.txt`, row.cv) : showToast('CV non fourni', 'warning'); }}><Download className="w-4 h-4" /></button>
                        <Link href={`/${locale}/admin/applications/compare?offer=${encodeURIComponent(row.jobTitle)}`} className="ad-btn ad-btn-ghost" title="Comparer cette offre"><GitCompare className="w-4 h-4" /> Comparer</Link>
                        <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => remove(row.id)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--ad-surface-2)' }}>
                        <OfferDetails offer={offer} app={row} onOpenDoc={(kind) => openDoc(kind, row)} />
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>Aucune candidature</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!viewer}
        title={viewer?.title || ''}
        subtitle="Consultez le document puis téléchargez-le."
        onClose={() => setViewer(null)}
        footer={viewer ? (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setViewer(null)}>Fermer</button>
            <button className="ad-btn ad-btn-primary" onClick={() => downloadText(viewer.filename, viewer.content)}><Download className="w-4 h-4" /> Télécharger</button>
          </>
        ) : null}
      >
        {viewer && <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--ad-ink)' }}>{viewer.content}</pre>}
      </Drawer>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StatTile({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType | null; accent?: boolean }) {
  return (
    <div className={`ad-card p-3 ad-rise ad-card-hover ${accent ? '' : ''}`} style={accent ? { borderColor: 'color-mix(in srgb, var(--ad-accent) 40%, var(--ad-line))' } : undefined}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-black tabular-nums" style={accent ? { color: 'var(--ad-accent)' } : undefined}>{value}</span>
        {Icon && <Icon className="w-4 h-4" style={{ color: 'var(--ad-muted)' }} />}
      </div>
      <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{label}</div>
    </div>
  );
}

function OfferDetails({ offer, app, onOpenDoc }: { offer?: Offer; app: Application; onOpenDoc: (kind: 'cv' | 'lm') => void }) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-black">{offer ? offer.title : app.jobTitle}</h4>
        <span className="ad-chip ad-chip-acc">{offer?.type || '—'}</span>
        <span className="ad-chip ad-chip-mute">{offer?.location || 'Lieu non précisé'}</span>
        {offer?.salary && <span className="ad-chip ad-chip-ok">{String(offer.salary)}</span>}
      </div>
      {offer?.shortDesc && <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{offer.shortDesc}</p>}
      <p className="text-sm italic" style={{ color: 'var(--ad-muted)' }}>Motivation : {app.motivation}</p>
      <div className="flex flex-wrap gap-2">
        <button className="ad-btn ad-btn-ghost" onClick={() => onOpenDoc('cv')}><Eye className="w-4 h-4" /> Voir CV</button>
        <button className="ad-btn ad-btn-ghost" onClick={() => onOpenDoc('lm')}><FileText className="w-4 h-4" /> Voir lettre de motivation</button>
      </div>
    </div>
  );
}
