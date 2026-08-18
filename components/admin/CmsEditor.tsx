'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { renderField } from '@/components/admin/fields/FieldKit';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminFetch, cmsAdminUpdate } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { slugify } from '@/lib/slugify';
import { CmsError } from '@/lib/cms';

export default function CmsEditor({ mod, id }: { mod: CmsModule; id: string }) {
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [slugLocked, setSlugLocked] = useState(false);

  useEffect(() => {
    if (id === 'new') {
      setRecord({ ...mod.defaults, locale });
      return;
    }
    (async () => {
      try {
        const row = await cmsAdminFetch<Record<string, unknown>>(`/${mod.resource}/${id}?view=block`);
        setRecord(row);
        setSlugLocked(Boolean(row.slug));
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
    setRecord((prev) => {
      const next = { ...(prev || {}), [key]: value };
      const slugField = mod.fields.find((f) => f.kind === 'slug');
      if (slugField && !slugLocked && slugField.slugFrom === key) {
        next[slugField.key] = slugify(String(value || ''));
      }
      return next;
    });
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
      const payload = { ...record, locale: record.locale || locale };
      const saved = id === 'new' || !record.id
        ? await cmsAdminCreate(mod.resource, payload)
        : await cmsAdminUpdate(mod.resource, String(record.id), payload);
      showToast('Fiche enregistrée', 'success');
      const newId = String((saved as { id?: string }).id || record.id);
      if (id === 'new') router.replace(`/${locale}/admin/${mod.path}/${newId}`);
      else setRecord(saved as Record<string, unknown>);
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 ad-rise">
        <div>
          <button className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--ad-muted)' }} onClick={() => router.push(`/${locale}/admin/${mod.path}`)}>
            <ArrowLeft className="w-3 h-3" /> {mod.label}
          </button>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Icon className="w-6 h-6" style={{ color: 'var(--ad-accent)' }} />
            {id === 'new' ? `Nouveau ${mod.singular}` : String(record[mod.titleKey] || 'Fiche')}
          </h1>
        </div>
        <div className="flex gap-2">
          {record.id ? <button className="ad-btn ad-btn-danger" onClick={remove}><Trash2 className="w-4 h-4" /></button> : null}
          <button className="ad-btn ad-btn-primary" disabled={saving} onClick={save}><Save className="w-4 h-4" /> {saving ? '…' : 'Enregistrer'}</button>
        </div>
      </div>

      {previewImg && (
        <div className="h-44 overflow-hidden ad-rise ad-rise-2" style={{ border: '1px solid var(--ad-line)' }}>
          <img src={previewImg} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {groups.map(([group, fields], i) => {
        const htmlHeavy = fields.some((f) => f.kind === 'html');
        return (
          <section key={group} className="ad-card p-5 ad-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <h2 className="ad-section-title">{group}</h2>
            <div className={htmlHeavy ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.wide || field.kind === 'html' ? 'md:col-span-2' : ''}
                  onFocus={() => field.kind === 'slug' && setSlugLocked(true)}
                >
                  {renderField(field, record[field.key], (v) => set(field.key, v), record)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
