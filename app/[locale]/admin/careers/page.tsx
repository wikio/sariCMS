'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase, CalendarDays, Copy, Download, Eye, GitCompare, Layers, MapPin,
  Plus, Users,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import Drawer from '@/components/admin/Drawer';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate } from '@/lib/cms-admin';
import { slugify } from '@/lib/slugify';
import ProcessFlow, { normalizeSteps } from '@/components/admin/ProcessFlow';
import {
  exportApplicationsCsv, loadApplications, loadOffers, type Application, type Offer,
} from '@/lib/recruitment';

export default function AdminCareersPage() {
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();
  const t = useTranslations('admin.careers');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [consult, setConsult] = useState<Offer | null>(null);
  const [duplicating, setDuplicating] = useState(false);

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

  useEffect(() => { load(); }, [locale]);

  const shown = useMemo(() => offers.filter((o) => {
    if (!q.trim()) return true;
    return `${o.title} ${o.location} ${o.type}`.toLowerCase().includes(q.toLowerCase());
  }), [offers, q]);

  const appsFor = (o: Offer) => apps.filter((a) => (a.offerId != null && Number(o.legacyId) === a.offerId) || String(a.jobTitle || '').toLowerCase() === String(o.title || '').toLowerCase());

  const totalApps = apps.length;
  const offersWithApps = offers.filter((o) => appsFor(o).length > 0).length;

  const exportFor = (o: Offer) => {
    const rows = appsFor(o);
    if (!rows.length) { showToast(t('toastNoApplications'), 'warning'); return; }
    exportApplicationsCsv(rows, String(o.title));
    showToast(t('toastExportGenerated'), 'success');
  };

  const duplicate = async (o: Offer) => {
    setDuplicating(true);
    try {
      const saved = await cmsAdminCreate<{ id: string }>('careers', {
        title: `${String(o.title)} (copie)`,
        slug: slugify(`${String(o.title)}-copie`),
        locale,
        type: o.type,
        location: o.location,
        salary: o.salary,
        shortDesc: o.shortDesc,
        fullDesc: o.fullDesc,
        mission: o.mission,
        typeTravail: o.typeTravail,
        experience: o.experience,
        objectifs: o.objectifs,
        prerequis: o.prerequis,
        workflow: o.workflow,
        benefits: o.benefits,
        contact: o.contact,
        status: 'draft',
      });
      showToast(t('toastOfferDuplicated'), 'success');
      setConsult(null);
      await load();
      if (saved?.id) router.push(`/${locale}/admin/careers/${saved.id}`);
    } catch {
      showToast(t('toastDuplicateFailed'), 'error');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            <Briefcase className="w-3.5 h-3.5" /> {t("breadcrumb")}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t("title")}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t("countSummary", { offers: offers.length, apps: totalApps })}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/admin/applications/compare`} className="ad-btn ad-btn-ghost"><GitCompare className="w-4 h-4" /> {t("compare")}</Link>
          <Link href={`/${locale}/admin/careers/new`} className="ad-btn ad-btn-primary"><Plus className="w-4 h-4" /> {t("newOffer")}</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ad-card p-3 ad-rise"><div className="text-2xl font-black">{offers.length}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t("offers")}</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-2"><div className="text-2xl font-black">{totalApps}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t("applications")}</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-3"><div className="text-2xl font-black">{offersWithApps}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t("offersWithCandidates")}</div></div>
        <div className="ad-card p-3 ad-rise ad-rise-4"><div className="text-2xl font-black">{offers.filter((o) => o.status === 'published').length}</div><div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t("published")}</div></div>
      </div>

      <div className="ad-card p-3 ad-rise ad-rise-2">
        <SearchField value={draft} onChange={setDraft} onSubmit={() => setQ(draft)} showSubmit placeholder={t("searchPlaceholder")} />
      </div>

      {loading ? (
        <div className="ad-card"><PixelGridLoader label={t("loaderLabel")} /></div>
      ) : (
        <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
          <table className="ad-table min-w-[820px]">
            <thead>
              <tr>
                <th>{t("offer")}</th><th>{t("location")}</th><th>{t("type")}</th><th>{t("status")}</th><th>{t("candidates")}</th><th className="text-right">{t("actions")}</th>
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
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t("consult")} onClick={() => setConsult(o)}><Eye className="w-4 h-4" /></button>
                        <Link href={`/${locale}/admin/careers/${o.id}/flow`} className="ad-btn ad-btn-ghost" title={t("flowTitle")}><Layers className="w-4 h-4" /> {t("flow")}</Link>
                        <Link href={`/${locale}/admin/applications/compare?offer=${encodeURIComponent(String(o.title))}`} className="ad-btn ad-btn-ghost" title={t("compareCandidates")}><GitCompare className="w-4 h-4" /> {t("compare")}</Link>
                        <button className="ad-btn ad-btn-icon ad-btn-ghost" title={t("exportApplications")} onClick={() => exportFor(o)}><Download className="w-4 h-4" /></button>
                        <Link href={`/${locale}/admin/careers/${o.id}`} className="ad-btn ad-btn-ghost">{t("editBtn")}</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--ad-muted)' }}>{t("noOffers")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer de consultation */}
      <Drawer
        open={!!consult}
        title={consult ? String(consult.title) : ''}
        subtitle={consult ? `${t("offerSubtitle")} · ${consult.status || "draft"}` : undefined}
        onClose={() => setConsult(null)}
        width={640}
        footer={consult ? (
          <>
            <button className="ad-btn ad-btn-ghost mr-auto" disabled={duplicating} onClick={() => duplicate(consult)}><Copy className="w-4 h-4" /> {t("duplicate")}</button>
            <Link href={`/${locale}/admin/applications?offer=${encodeURIComponent(String(consult.title))}`} className="ad-btn ad-btn-ghost"><Users className="w-4 h-4" /> {t("viewApplications")}</Link>
            <Link href={`/${locale}/admin/careers/${consult.id}`} className="ad-btn ad-btn-primary"><Briefcase className="w-4 h-4" /> {t("modify")}</Link>
          </>
        ) : null}
      >
        {consult && <OfferConsult offer={consult} appCount={appsFor(consult).length} t={t} />}
      </Drawer>
    </div>
  );
}

function OfferConsult({ offer, appCount, t }: { offer: Offer; appCount: number; t: ReturnType<typeof useTranslations> }) {
  const steps = normalizeSteps(offer.workflow);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="ad-chip ad-chip-acc">{String(offer.type || t('contractUnspecified'))}</span>
        <span className="ad-chip ad-chip-mute"><MapPin className="w-3 h-3" /> {String(offer.location || t('locationUnspecified'))}</span>
        {offer.salary && <span className="ad-chip ad-chip-ok">{String(offer.salary)}</span>}
        <span className={`ad-chip ${offer.status === 'published' ? 'ad-chip-ok' : 'ad-chip-acc'}`}>{String(offer.status || 'draft')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span style={{ color: 'var(--ad-muted)' }}>{t("applicationCount")}</span><div className="font-black text-lg">{appCount}</div></div>
        <div><span style={{ color: 'var(--ad-muted)' }}>{t("workPace")}</span><div>{String(offer.typeTravail || '—')}</div></div>
        <div><span style={{ color: 'var(--ad-muted)' }}>{t("requiredExperience")}</span><div>{String(offer.experience || '—')}</div></div>
        <div><span style={{ color: 'var(--ad-muted)' }}>{t("hrContact")}</span><div>{String(offer.contact || '—')}</div></div>
        {offer.publishedAt && (
          <div className="col-span-2"><span style={{ color: 'var(--ad-muted)' }}>{t("publishDate")}</span>
            <div className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {new Date(offer.publishedAt).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      {offer.shortDesc && (
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("description")}</div>
          <p className="text-sm">{String(offer.shortDesc)}</p>
        </div>
      )}

      {offer.fullDesc && (
        <div className="text-sm ad-tiptap" dangerouslySetInnerHTML={{ __html: String(offer.fullDesc) }} />
      )}

      {offer.mission && (
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("mission")}</div>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{String(offer.mission)}</p>
        </div>
      )}

      {Array.isArray(offer.objectifs) && offer.objectifs.length > 0 && (
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("objectives")}</div>
          <ul className="text-sm space-y-1 list-disc pl-5">{offer.objectifs.map((o, i) => <li key={i}>{String(o)}</li>)}</ul>
        </div>
      )}

      {Array.isArray(offer.prerequis) && offer.prerequis.length > 0 && (
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("prerequisites")}</div>
          <ul className="text-sm space-y-1 list-disc pl-5">{offer.prerequis.map((o, i) => <li key={i}>{String(o)}</li>)}</ul>
        </div>
      )}

      {Array.isArray(offer.benefits) && offer.benefits.length > 0 && (
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("benefits")}</div>
          <ul className="text-sm space-y-1 list-disc pl-5">{offer.benefits.map((o, i) => <li key={i}>{String(o)}</li>)}</ul>
        </div>
      )}

      <div>
        <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{t("flowPreview")}</div>
        {steps.length ? <ProcessFlow steps={steps} /> : (
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t("noFlowDefined")}</p>
        )}
      </div>
    </div>
  );
}
