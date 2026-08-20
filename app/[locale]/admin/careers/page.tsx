'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Briefcase, Download, GitCompare, MapPin, Plus, Users } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import { useToast } from '@/components/admin/Toast';
import {
  exportApplicationsCsv, loadApplications, loadOffers, type Application, type Offer,
} from '@/lib/recruitment';

export default function AdminCareersPage() {
  const locale = useLocale();
  const { showToast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [o, a] = await Promise.all([loadOffers(locale), Promise.resolve(loadApplications())]);
      setOffers(o);
      setApps(a);
    } catch {
      /* API offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => offers.filter((o) => {
    if (!q.trim()) return true;
    return `${o.title} ${o.location} ${o.type}`.toLowerCase().includes(q.toLowerCase());
  }), [offers, q]);

  const appsFor = (o: Offer) => apps.filter((a) => (a.offerId != null && Number(o.legacyId) === a.offerId) || String(a.jobTitle || '').toLowerCase() === String(o.title || '').toLowerCase());

  const totalApps = apps.length;
  const offersWithApps = offers.filter((o) => appsFor(o).length > 0).length;

  const exportFor = (o: Offer) => {
    const rows = appsFor(o);
    if (!rows.length) { showToast('Aucune candidature pour cette offre', 'warning'); return; }
    exportApplicationsCsv(rows, String(o.title));
    showToast('Export CSV généré', 'success');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            <Briefcase className="w-3.5 h-3.5" /> RH
          </div>
          <h1 className="text-3xl font-black tracking-tight">Offres d’emploi</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{offers.length} offre(s) · {totalApps} candidature(s)</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/admin/applications/compare`} className="ad-btn ad-btn-ghost"><GitCompare className="w-4 h-4" /> Comparer</Link>
          <Link href={`/${locale}/admin/careers/new`} className="ad-btn ad-btn-primary"><Plus className="w-4 h-4" /> Nouvelle offre</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ad-card p-3 ad-rise"><div className="text-2xl font-black">{offers.length}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>Offres</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-2"><div className="text-2xl font-black">{totalApps}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>Candidatures</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-3"><div className="text-2xl font-black">{offersWithApps}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>Offres avec candidats</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-4"><div className="text-2xl font-black">{offers.filter((o) => o.status === 'published').length}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>Publiées</div></div>
      </div>

      <div className="ad-card p-3 ad-rise ad-rise-2">
        <SearchField value={draft} onChange={setDraft} onSubmit={() => setQ(draft)} showSubmit placeholder="Rechercher une offre (titre, lieu, type)…" />
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label="Offres" /></div>
      ) : (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Offre</th><th>Localisation</th><th>Type</th><th>Statut</th><th>Candidats</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const count = appsFor(o).length;
                return (
                  <tr key={String(o.id)}>
                    <td className="font-bold">{String(o.title)}</td>
                    <td className="text-sm" style={{ color: 'var(--ad-muted)' }}><span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{String(o.location || '—')}</span></td>
                    <td>{String(o.type || '—')}</td>
                    <td><span className={`ad-chip ${o.status === 'published' ? 'ad-chip-ok' : 'ad-chip-acc'}`}>{String(o.status || 'draft')}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1 font-black" style={count ? { color: 'var(--ad-accent)' } : undefined}>
                        <Users className="w-3.5 h-3.5" /> {count}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/${locale}/admin/applications/compare?offer=${encodeURIComponent(String(o.title))}`} className="ad-btn ad-btn-ghost" title="Comparer les candidats"><GitCompare className="w-4 h-4" /> Comparer</Link>
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title="Exporter les candidatures" onClick={() => exportFor(o)}><Download className="w-4 h-4" /></button>
                        <Link href={`/${locale}/admin/careers/${o.id}`} className="ad-btn ad-btn-ghost">Éditer</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>Aucune offre. Importez le catalogue ou créez-en une.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
