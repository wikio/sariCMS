'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, ChevronDown, Copy, Eye, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { renderField } from '@/components/admin/fields/FieldKit';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminFetch, cmsAdminUpdate } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { slugify } from '@/lib/slugify';
import { CmsError } from '@/lib/cms';
import { loadAdminSettings, nextSku } from '@/lib/admin-settings';
import { loadFicheLocale, saveFicheLocale } from '@/lib/fiche-i18n';

const LANGS = [
  { id: 'fr', label: 'FR' },
  { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' },
];

export default function CmsEditor({ mod, id }: { mod: CmsModule; id: string }) {
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const consult = params.get('consult') === '1';
  const { showToast } = useToast();
  const settings = loadAdminSettings();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [slugLocked, setSlugLocked] = useState(false);
  const [tab, setTab] = useState(settings.defaultLocale);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [i18nDraft, setI18nDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id === 'new') {
      setRecord({ ...mod.defaults, locale: settings.defaultLocale });
      return;
    }
    (async () => {
      try {
        const row = await cmsAdminFetch<Record<string, unknown>>(`/${mod.resource}/${id}?view=block`);
        setRecord(row);
        setSlugLocked(Boolean(row.slug));
        setI18nDraft(loadFicheLocale(mod.resource, String(row.id), tab));
      } catch (err) {
        showToast(err instanceof CmsError ? err.message : 'Fiche introuvable', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mod.key, locale]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof mod.fields>();
    for (const field of mod.fields) {
      const g = field.group || 'Général';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(field);
    }
    return Array.from(map.entries());
  }, [mod.fields]);

  const set = (key: string, value: unknown) => {
    const field = mod.fields.find((f) => f.key === key);
    const overlay = tab !== settings.defaultLocale && field?.i18n;
    if (overlay) {
      setI18nDraft((prev) => ({ ...prev, [key]: String(value ?? '') }));
      return;
    }
    setRecord((prev) => {
      const next = { ...(prev || {}), [key]: value };
      const slugField = mod.fields.find((f) => f.kind === 'slug');
      if (slugField && !slugLocked && slugField.slugFrom === key) {
        next[slugField.key] = slugify(String(value || ''));
      }
      return next;
    });
  };

  const valueOf = (key: string) => {
    const field = mod.fields.find((f) => f.key === key);
    if (tab !== settings.defaultLocale && field?.i18n) {
      return i18nDraft[key] ?? record?.[key];
    }
    return record?.[key];
  };

  const save = async () => {
    if (!record) return;
    const missing = mod.fields.filter((f) => f.required && !String(record[f.key] ?? '').trim());
    if (missing.length) {
      showToast(`Champs obligatoires : ${missing.map((f) => f.label).join(', ')}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...record, locale: record.locale || settings.defaultLocale };
      if (mod.key === 'products') {
        if (!String(payload.slug || '').trim()) payload.slug = slugify(String(payload.name || ''));
        if (!String(payload.sku || '').trim()) payload.sku = nextSku(settings.skuFormat);
      }
      const saved = id === 'new' || !record.id
        ? await cmsAdminCreate(mod.resource, payload)
        : await cmsAdminUpdate(mod.resource, String(record.id), payload);
      const newId = String((saved as { id?: string }).id || record.id);
      if (newId) saveFicheLocale(mod.resource, newId, tab, i18nDraft);
      showToast('Fiche enregistrée', 'success');
      if (id === 'new') router.replace(`/${locale}/admin/${mod.path}/${newId}`);
      else setRecord(saved as Record<string, unknown>);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!record) return;
    try {
      const copy = {
        ...record,
        id: undefined,
        slug: slugify(`${record[mod.titleKey] || 'copie'}-copie`),
        [mod.titleKey]: `${record[mod.titleKey] || ''} (copie)`,
        status: 'draft',
        sku: nextSku(settings.skuFormat),
      };
      const saved = await cmsAdminCreate(mod.resource, copy);
      showToast('Fiche dupliquée', 'success');
      router.push(`/${locale}/admin/${mod.path}/${(saved as { id: string }).id}`);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Duplication impossible', 'error');
    }
  };

  const remove = async () => {
    if (!record?.id || !confirm('Corbeille ?')) return;
    await cmsAdminDelete(mod.resource, String(record.id));
    router.push(`/${locale}/admin/${mod.path}`);
  };

  if (loading || !record) return <div className="ad-card"><PixelGridLoader label="Fiche" /></div>;

  const Icon = mod.icon;
  const previewImg = mod.imageKey ? String(record[mod.imageKey] || '') : '';

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 ad-rise">
        <div>
          <button className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--ad-muted)' }} onClick={() => router.push(`/${locale}/admin/${mod.path}`)}>
            <ArrowLeft className="w-3 h-3" /> {mod.label}
          </button>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Icon className="w-6 h-6" style={{ color: 'var(--ad-accent)' }} />
            {consult ? 'Consultation · ' : ''}{id === 'new' ? `Nouveau ${mod.singular}` : String(record[mod.titleKey] || 'Fiche')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.id ? (
            <>
              <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}/${record.id}${consult ? '' : '?consult=1'}`)}>
                <Eye className="w-4 h-4" /> {consult ? 'Éditer' : 'Consulter'}
              </button>
              {!consult && <button className="ad-btn ad-btn-ghost" onClick={duplicate}><Copy className="w-4 h-4" /> Dupliquer</button>}
              <button className="ad-btn ad-btn-danger" onClick={remove}><Trash2 className="w-4 h-4" /></button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 ad-rise">
        {LANGS.map((lang) => (
          <button
            key={lang.id}
            type="button"
            className={`ad-btn ${tab === lang.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            onClick={() => {
              if (record.id) setI18nDraft(loadFicheLocale(mod.resource, String(record.id), lang.id));
              setTab(lang.id as 'fr' | 'en' | 'ar');
            }}
          >
            {lang.label} {lang.id === settings.defaultLocale ? '· défaut' : ''}
          </button>
        ))}
        {tab !== settings.defaultLocale && (
          <span className="text-xs self-center" style={{ color: 'var(--ad-muted)' }}>
            Champ vide → repli sur {settings.defaultLocale.toUpperCase()}
          </span>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 ad-rise">
        {groups.map(([group]) => (
          <button key={group} type="button" className="ad-btn ad-btn-ghost" onClick={() => {
            setOpenGroups((p) => ({ ...p, [group]: true }));
            document.getElementById(`sec-${group}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            {group}
          </button>
        ))}
      </nav>

      {previewImg && (
        <div className="overflow-hidden p-3 ad-rise" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface)' }}>
          <img src={previewImg} alt="" className="max-h-56 max-w-full object-contain mx-auto" />
        </div>
      )}

      {groups.map(([group, fields], i) => {
        const htmlHeavy = fields.some((f) => f.kind === 'html');
        const open = openGroups[group] !== false;
        return (
          <section id={`sec-${group}`} key={group} className="ad-card p-5 ad-rise scroll-mt-28" style={{ animationDelay: `${i * 40}ms` }}>
            <button type="button" className="ad-section-title w-full justify-between" onClick={() => setOpenGroups((p) => ({ ...p, [group]: !open }))}>
              {group} <ChevronDown className={`w-4 h-4 transition ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && (
              consult ? (
                <div className={htmlHeavy ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
                  {fields.map((field) => (
                    <div key={field.key} className={field.wide || field.kind === 'html' ? 'md:col-span-2' : ''}>
                      <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{field.label}</div>
                      {field.kind === 'html' ? (
                        <HtmlEditor value={String(valueOf(field.key) || '')} onChange={() => undefined} readOnly />
                      ) : field.kind === 'image' && valueOf(field.key) ? (
                        <img src={String(valueOf(field.key))} alt="" className="max-h-40 object-contain" />
                      ) : (
                        <div className="text-sm font-semibold">{String(valueOf(field.key) ?? '—')}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={htmlHeavy ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      className={field.wide || field.kind === 'html' ? 'md:col-span-2' : ''}
                      onFocus={() => field.kind === 'slug' && setSlugLocked(true)}
                    >
                      {renderField(field, valueOf(field.key), (v) => set(field.key, v), record)}
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        );
      })}

      {!consult && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t px-5 py-3 flex justify-end gap-2" style={{ background: 'var(--ad-surface)', borderColor: 'var(--ad-line)' }}>
          <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}`)}>Annuler</button>
          {record.id && <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}/${record.id}?consult=1`)}><Eye className="w-4 h-4" /> Consulter</button>}
          <button className="ad-btn ad-btn-primary" disabled={saving} onClick={save}><Save className="w-4 h-4" /> {saving ? '…' : 'Enregistrer'}</button>
        </div>
      )}
    </div>
  );
}
