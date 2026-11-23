'use client';

import { useTranslations } from 'next-intl';

/**
 * components/admin/BrandSection.tsx — Réglages → Identité du back-office.
 *
 * Un seul écran pour nom, accroche et logo. Avant lui, les trois valeurs étaient
 * écrites en quatre exemplaires dans le code et il fallait redeployer pour
 * changer un nom.
 *
 * L'aperçu n'est pas un ornement : la barre latérale a une largeur fixe, et un
 * titre de quarante caractères y déborde. Sans rendu immédiat, l'administrateur
 * découvre la casse après enregistrement — sur son propre écran, puis sur celui
 * de tout le monde.
 *
 * Enregistrer appelle `refresh()` du contexte : sans cela, la barre latérale
 * continuerait d'afficher l'ancien nom jusqu'au rechargement de la page, ce qui
 * ressemble furieusement à une sauvegarde qui n'a pas pris.
 */
import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, RotateCcw, Save, Shield, Upload } from 'lucide-react';

import GedPicker from '@/components/admin/GedPicker';
import { useAdminBrand } from '@/components/admin/BrandContext';
import { useToast } from '@/components/admin/Toast';
import { loadBrandStatus, resetBrand, saveBrand, safeLogo, type BrandSource } from '@/lib/brand';

export default function BrandSection() {
  const t = useTranslations('admin.brandSettings');
  const ts = useTranslations('admin.settings');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const { refresh } = useAdminBrand();
  const [form, setForm] = useState({ title: '', subtitle: '', logo: '' });
  const [source, setSource] = useState<BrandSource>('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ged, setGed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    loadBrandStatus()
      .then((st) => {
        if (!alive) return;
        setForm({ title: st.title, subtitle: st.subtitle, logo: st.logo });
        setSource(st.source);
      })
      .catch(() => {
        if (alive) showToast(t('loadError'), 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [showToast, t, tc]);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('module', 'logo');
      body.append('label', file.name);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = await res.json();
      if (json.url) patch({ logo: safeLogo(String(json.url)) });
      else showToast(json.error || ts('uploadError'), 'error');
    } catch {
      showToast(ts('uploadError'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = useCallback(async () => {
    if (!form.title.trim()) {
      setError(t('needTitle'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const st = await saveBrand({ ...form, title: form.title.trim() });
      setSource(st.source);
      setForm({ title: st.title, subtitle: st.subtitle, logo: st.logo });
      await refresh();
      showToast(t('saved'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : tc('saveError');
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [form, refresh, showToast, t, tc]);

  const reset = useCallback(async () => {
    setSaving(true);
    try {
      const st = await resetBrand();
      setSource(st.source);
      setForm({ title: st.title, subtitle: st.subtitle, logo: st.logo });
      await refresh();
      showToast(t('restored'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('resetError'), 'error');
    } finally {
      setSaving(false);
    }
  }, [refresh, showToast, t, tc]);

  if (loading) return <section className="ad-card p-5 text-sm opacity-60">{t('loading')}</section>;

  return (
    <div className="space-y-4">
      <section className="ad-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="ad-section-title">{ts('brand')}</h2>
          <span className="ad-chip text-[10px] uppercase tracking-widest" title={t('source')}>
            {t(`source_${source}`)}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
              {t('name')}
            </span>
            <input className="ad-input" value={form.title} maxLength={40} onChange={(e) => patch({ title: e.target.value })} placeholder="SARI CMS" />
            <span className="text-[11px] block" style={{ color: 'var(--ad-muted)' }}>
              {t('nameHint')}
            </span>
          </label>
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
              {t('tagline')}
            </span>
            <input className="ad-input" value={form.subtitle} maxLength={60} onChange={(e) => patch({ subtitle: e.target.value })} placeholder={t('taglinePlaceholder')} />
            <span className="text-[11px] block" style={{ color: 'var(--ad-muted)' }}>
              {t('taglineHint')}
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
            {t('logo')}
          </span>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div
              className="w-24 h-24 shrink-0 flex items-center justify-center rounded-lg border border-dashed overflow-hidden"
              style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}
            >
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt={t('logo')} className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <Shield className="w-8 h-8" style={{ color: 'var(--ad-muted)' }} />
              )}
            </div>
            <div className="flex-1 space-y-2 w-full">
              <input
                className="ad-input"
                value={form.logo}
                maxLength={400}
                onChange={(e) => patch({ logo: e.target.value })}
                placeholder={ts('logoPlaceholder')}
              />
              <div className="flex flex-wrap gap-2">
                <label className="ad-btn ad-btn-ghost cursor-pointer">
                  <Upload className="w-4 h-4" /> {uploading ? ts('uploading') : tc('upload')}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setGed(true)}>
                  <FolderOpen className="w-4 h-4" /> {ts('media')}
                </button>
                {form.logo && (
                  <button type="button" className="ad-btn ad-btn-ghost" onClick={() => patch({ logo: '' })}>
                    {ts('remove')}
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                {t('logoHint')}
              </p>
            </div>
          </div>
        </div>

        {error && <p className="text-sm ad-chip ad-chip-warn w-full justify-start py-2 px-3">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="ad-btn ad-btn-primary" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? tc('saving') : tc('save')}
          </button>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={reset} disabled={saving || source === 'default'}>
            <RotateCcw className="w-4 h-4" /> {t('reset')}
          </button>
        </div>
      </section>

      {/* Aperçu : ce que verront les postes, barre repliée et dépliée. */}
      <section className="ad-card p-5 space-y-3">
        <h2 className="ad-section-title">{tc('preview')}</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="w-[272px] rounded-xl p-4" style={{ background: 'var(--ad-sidebar)', color: 'var(--ad-sidebar-ink)' }}>
            <div className="flex items-center gap-3">
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt="" className="w-10 h-10 object-contain" style={{ borderRadius: 10 }} />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--ad-accent-2)', color: 'var(--ad-accent-2-ink)', borderRadius: 10 }}>
                  <Shield className="w-5 h-5" />
                </div>
              )}
              <div className="leading-tight min-w-0">
                <div className="font-black tracking-tight truncate max-w-[168px]">{form.title || 'SARI CMS'}</div>
                {form.subtitle ? (
                  <div className="text-[10px] uppercase tracking-[0.18em] opacity-60 truncate max-w-[168px]">{form.subtitle}</div>
                ) : null}
              </div>
            </div>
          </div>
          <p className="text-[11px] max-w-[280px]" style={{ color: 'var(--ad-muted)' }}>
            {t('previewHint')}
          </p>
        </div>
      </section>

      {ged && <GedPicker accept="image/*" onClose={() => setGed(false)} onPick={(url) => { patch({ logo: safeLogo(url) }); setGed(false); }} />}
    </div>
  );
}
