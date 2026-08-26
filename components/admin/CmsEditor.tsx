'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ChevronDown, Copy, Eye, Save, Trash2 } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { renderField } from '@/components/admin/fields/FieldKit';
import ConsultValue from '@/components/admin/ConsultValue';
import IconMark from '@/components/admin/IconMark';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminFetch, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import type { CmsModule } from '@/lib/cms-modules';
import { slugify } from '@/lib/slugify';
import { CmsError } from '@/lib/cms';
import { loadAdminSettings, nextSku } from '@/lib/admin-settings';
import { isTranslatableField, loadFicheLocale, saveFicheLocale } from '@/lib/fiche-i18n';

const LANGS = [
  { id: 'fr', label: 'FR' },
  { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' },
];

export default function CmsEditor({ mod, id }: { mod: CmsModule; id: string }) {
  const locale = useLocale();
  const tEditor = useTranslations('admin.editor');
  const tTitles = useTranslations('admin.titles');
  const tFields = useTranslations('admin.careersFields');


  // Translate option labels (e.g. Brouillon→Draft, Publié→Published)
  const OPTION_LABEL_KEYS: Record<string, string> = {
    'Brouillon': 'statusDraft', 'Publié': 'statusPublished', 'Archivé': 'statusArchived',
    'Selon la configuration globale': 'applyInherit', 'Postuler sans connexion': 'applyOptional',
    'Connexion obligatoire': 'applyRequired',
  };
  const translateOptionLabel = (label: string) => {
    const key = OPTION_LABEL_KEYS[label];
    if (!key) return label;
    try { const r = tFields(key); return typeof r === 'string' ? r : label; } catch { return label; }
  };


  // Translate field options (e.g. status: Brouillon→Draft, Publié→Published)
  const translatedFields = useMemo(() => mod.fields.map(f => {
    if (!f.options || !Array.isArray(f.options)) return f;
    return {
      ...f,
      options: f.options.map((opt: { value: string; label: string }) => ({
        ...opt,
        label: typeof opt.label === 'string' ? translateOptionLabel(opt.label) : opt.label,
      })),
    };
  }), [mod.fields]);

  // Resolve group name: try admin.careersFields.group{Key} first, then fallback
  const GROUP_KEYS: Record<string, string> = { 
    'Poste': 'groupPoste', 'Média': 'groupMedia', 'Mission': 'groupMission', 
    'Profil': 'groupProfil', 'Identité': 'groupIdentité', 'Contenu': 'groupContenu', 
    'Détails': 'groupDétails', 'Catalogue': 'groupCatalogue', 'Médias': 'groupMédias', 
    'Technique': 'groupTechnique', 'Général': 'general',
    'Auteur': 'groupAuthor', 'Citation': 'groupQuote', 'Fiche': 'groupCard',
    'Informations': 'groupInfo', 'Coordonnées': 'groupContact',
    'Programme': 'groupProgramme', 'Texte': 'groupText', 'Article': 'groupArticle'
  };
  const groupName = (g: string) => {
    const key = GROUP_KEYS[g];
    if (!key) return g;
    try { return tFields(key); } catch { try { return tEditor(key); } catch { return g; } }
  };

  // Resolve field label: try admin.careersFields.{key} first, then fallback to field.label
  const fieldLabel = (field: { key: string; label: string }) => {
    try { 
      const translated = tFields(field.key);
      // Check if translation actually resolved (not just returning the key path)
      if (typeof translated === 'string' && translated !== field.key && !translated.startsWith('admin.careersFields.')) {
        return translated;
      }
    } catch {}
    
    // Fallback: try to find translation in module-specific namespace
    try {
      const moduleKey = mod.key; // e.g., 'testimonials', 'partners'
      const moduleTranslated = tFields(`${moduleKey}.${field.key}` as any);
      if (typeof moduleTranslated === 'string' && !moduleTranslated.includes('.')) {
        return moduleTranslated;
      }
    } catch {}
    
    return field.label;
  };

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
  const [overlays, setOverlays] = useState<Record<string, Record<string, unknown>>>({});

  const transKeys = useMemo(
    () => mod.fields.filter((f) => isTranslatableField(f.kind, f.i18n)).map((f) => f.key),
    [mod.fields],
  );

  useEffect(() => {
    if (id === 'new') {
      setRecord({ ...mod.defaults, locale: settings.defaultLocale });
      return;
    }
    (async () => {
      try {
        const row = await cmsAdminFetch<Record<string, unknown>>(`/${mod.resource}/${id}?view=block`);
        
        // Migration: copier date vers publicationDate si publicationDate est vide (pour news)
        if (mod.key === 'news' && row.date && !row.publicationDate) {
          row.publicationDate = row.date;
          console.log('[CmsEditor] Migrated date to publicationDate:', row.publicationDate);
        }
        
        setRecord(row);
        setSlugLocked(Boolean(row.slug));

        // Récupère les versions traduites (fiches sœurs) de la même fiche.
        const translatableKeys = mod.fields.filter((f) => isTranslatableField(f.kind, f.i18n)).map((f) => f.key);
        const linkKeys: Array<keyof Record<string, unknown>> = ['legacyId', 'slug'];
        let siblings: Record<string, unknown>[] = [];
        try {
          const all = await cmsAdminList<Record<string, unknown>>(mod.resource, {});
          const linkKey = linkKeys.find((k) => row[k] != null && String(row[k]) !== '');
          if (linkKey) {
            const ref = String(row[linkKey]);
            siblings = all.filter((r) => r.id !== row.id && String(r[linkKey]) === ref);
          }
        } catch {
          siblings = [];
        }

        const next: Record<string, Record<string, unknown>> = {};
        for (const lang of LANGS) {
          const saved = loadFicheLocale(mod.resource, String(row.id), lang.id);
          const sibling = siblings.find((s) => String(s.locale ?? '') === lang.id);
          const merged: Record<string, unknown> = {};
          if (sibling && lang.id !== String(row.locale ?? '')) {
            for (const k of translatableKeys) {
              if (sibling[k] !== undefined && sibling[k] !== null && String(sibling[k]) !== '') {
                merged[k] = sibling[k];
              }
            }
          }
          next[lang.id] = { ...merged, ...saved };
        }
        setOverlays(next);
      } catch (err) {
        showToast(err instanceof CmsError ? err.message : 'Fiche introuvable', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mod.key, locale]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof translatedFields>();
    for (const field of translatedFields) {
      const g = groupName(field.group || '');
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(field);
    }
    return Array.from(map.entries());
  }, [translatedFields]);

  const isDefault = tab === settings.defaultLocale;

  const valueOf = (key: string) => {
    const field = mod.fields.find((f) => f.key === key);
    const translatable = field ? isTranslatableField(field.kind, field.i18n) : false;
    if (!isDefault && translatable) {
      const overlay = overlays[tab] || {};
      return overlay[key] ?? '';
    }
    // Pour les champs image avec "Remplacer dans cette traduction"
    if (!isDefault && field?.kind === 'image') {
      const overlay = overlays[tab] || {};
      if (overlay[`${key}Keep`] === 'replace') {
        return overlay[key] ?? '';
      }
    }
    return record?.[key];
  };

  const originOf = (key: string) => {
    if (isDefault) return undefined;
    return record?.[key];
  };

  const set = (key: string, value: unknown) => {
    const field = mod.fields.find((f) => f.key === key);
    const translatable = field ? isTranslatableField(field.kind, field.i18n) : false;
    if (!isDefault && translatable) {
      setOverlays((prev) => ({ ...prev, [tab]: { ...(prev[tab] || {}), [key]: value } }));
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

  const switchLang = (lang: string) => {
    setTab(lang as 'fr' | 'en' | 'ar');
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
      
      // Supprimer date du payload pour news et events (utiliser seulement publicationDate/startDate)
      if ((mod.key === 'news' || mod.key === 'events') && 'date' in payload) {
        delete payload.date;
        console.log(`[CmsEditor.save] Removed date from payload for ${mod.key}, using only publicationDate/startDate`);
      }
      
      // S'assurer que icon et color sont toujours envoyés pour solutions (même s'ils sont vides)
      if (mod.key === 'solutions') {
        if (!('icon' in payload)) payload.icon = null;
        if (!('color' in payload)) payload.color = null;
        console.log('[CmsEditor.save] Ensured icon and color are in payload for solutions');
      }
      
      // Convertir publicationDate en objet Date si c'est une chaîne
      if (mod.key === 'news' && payload.publicationDate && typeof payload.publicationDate === 'string') {
        payload.publicationDate = new Date(payload.publicationDate);
        console.log('[CmsEditor.save] Converted publicationDate to Date object:', payload.publicationDate);
      }
      
      if (mod.key === 'products') {
        if (!String(payload.slug || '').trim()) payload.slug = slugify(String(payload.name || ''));
        if (!String(payload.sku || '').trim()) payload.sku = nextSku(settings.codes.product);
      }
      console.log('[CmsEditor.save] Payload being sent:', JSON.stringify(payload, null, 2));
      const saved = id === 'new' || !record.id
        ? await cmsAdminCreate(mod.resource, payload)
        : await cmsAdminUpdate(mod.resource, String(record.id), payload);
      const newId = String((saved as { id?: string }).id || record.id);
      if (newId) {
        for (const [lang, fields] of Object.entries(overlays)) {
          saveFicheLocale(mod.resource, newId, lang, fields);
        }
      }
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
        sku: nextSku(settings.codes.product),
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
  const iconName = String(record.icon || '');
  const translatedCount = transKeys.filter((k) => {
    const v = overlays[tab]?.[k];
    return v != null && String(v) !== '';
  }).length;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 ad-rise">
        <div>
          <button className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--ad-muted)' }} onClick={() => router.push(`/${locale}/admin/${mod.path}`)}>
            <ArrowLeft className="w-3 h-3" /> {(() => { try { return tTitles(mod.key); } catch { return mod.label; } })()}
          </button>
          <h1 className="text-2xl font-black flex items-center gap-2">
            {iconName ? <IconMark name={iconName} className="w-6 h-6" /> : <Icon className="w-6 h-6" style={{ color: 'var(--ad-accent)' }} />}
            {consult ? tEditor('consultation') : ''}{id === 'new' ? tEditor('newItem', { singular: mod.singular }) : String(record[mod.titleKey] || tEditor('record'))}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.id ? (
            <>
              <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}/${record.id}${consult ? '' : '?consult=1'}`)}>
                <Eye className="w-4 h-4" /> {consult ? tEditor('editMode') : tEditor('consultMode')}
              </button>
              {!consult && <button className="ad-btn ad-btn-ghost" onClick={duplicate}><Copy className="w-4 h-4" /> {tEditor('duplicate')}</button>}
              <button className="ad-btn ad-btn-danger" onClick={remove}><Trash2 className="w-4 h-4" /></button>
            </>
          ) : null}
        </div>
      </div>

      <div className="ad-card p-3 space-y-2 ad-rise">
        <div className="flex flex-wrap gap-2">
          {LANGS.map((lang) => {
            const done = transKeys.filter((k) => {
              const v = lang.id === settings.defaultLocale ? record[k] : overlays[lang.id]?.[k];
              return v != null && String(v) !== '';
            }).length;
            const pct = transKeys.length ? Math.round((done / transKeys.length) * 100) : 100;
            return (
              <button key={lang.id} type="button" className={`ad-btn ${tab === lang.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => switchLang(lang.id)}>
                {lang.label} {lang.id === settings.defaultLocale ? tEditor('origin') : ''}
                <span className="ad-chip ad-chip-acc">{pct}%</span>
              </button>
            );
          })}
        </div>
        {!isDefault && (
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            Formulaire {tab.toUpperCase()} rechargé : {translatedCount} champ(s) déjà traduit(s), les autres sont vides.
            Une note d’origine ({settings.defaultLocale.toUpperCase()}) apparaît sous chaque champ.
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 ad-rise">
        {groups.map(([group]) => (
          <button key={group} type="button" className="ad-btn ad-btn-ghost" onClick={() => {
            setOpenGroups((p) => ({ ...p, [group]: true }));
            document.getElementById(`sec-${group}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            {groupName(group)}
          </button>
        ))}
      </nav>

      {previewImg && (
        <div className="overflow-hidden p-3 ad-rise" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface)' }}>
          <img src={previewImg} alt="" className="max-h-56 max-w-full object-contain mx-auto" />
        </div>
      )}

      {groups.map(([group, fields], i) => {
        const htmlHeavy = fields.some((f) => f.kind === 'html' || f.kind === 'process');
        const open = openGroups[group] !== false;
        const compare = !isDefault && !consult;
        return (
          <section id={`sec-${group}`} key={group} className="ad-card p-5 ad-rise scroll-mt-28" style={{ animationDelay: `${i * 40}ms` }}>
            <button type="button" className="ad-section-title w-full justify-between" onClick={() => setOpenGroups((p) => ({ ...p, [group]: !open }))}>
              {groupName(group)} <ChevronDown className={`w-4 h-4 transition ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && (
              consult ? (
                <div className={htmlHeavy ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
                  {fields.map((field) => (
                    <div key={field.key} className={field.wide || field.kind === 'html' || field.kind === 'process' ? 'md:col-span-2' : ''}>
                      <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{fieldLabel(field)}</div>
                      <ConsultValue spec={field} value={valueOf(field.key)} />
                    </div>
                  ))}
                </div>
              ) : compare ? (
                <div className="space-y-4">
                  {fields.map((field) => {
                    const locked = ['sku', 'id', 'status', 'price', 'inStock', 'locale', 'stockQty', 'stockFinal'].includes(field.key);
                    return (
                      <div key={`${tab}-${field.key}`} className="ad-compare">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ad-muted)' }}>{fieldLabel(field)} · {settings.defaultLocale.toUpperCase()}</div>
                          <ConsultValue spec={field} value={record[field.key]} />
                        </div>
                        <div>
                          {locked || (field.kind === 'image' && overlays[tab]?.[`${field.key}Keep`] !== 'replace') ? (
                            <div className="space-y-2">
                              <ConsultValue spec={field} value={record[field.key]} />
                              {field.kind === 'image' && (
                                <button className="ad-btn ad-btn-ghost" onClick={() => {
                                  set(field.key + 'Keep', 'replace');
                                  set(field.key, ''); // Initialiser à vide pour permettre l'upload d'une nouvelle image
                                }}>Remplacer dans cette traduction</button>
                              )}
                              {locked && <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>Champ partagé, verrouillé.</p>}
                            </div>
                          ) : (
                            renderField(field, valueOf(field.key), (v) => set(field.key, v), record, { t: tEditor, moduleKey: mod.key })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={htmlHeavy ? 'space-y-4' : 'grid md:grid-cols-2 gap-4'}>
                  {fields.map((field) => (
                    <div
                      key={`${tab}-${field.key}`}
                      className={field.wide || field.kind === 'html' || field.kind === 'process' || field.kind === 'price' ? 'md:col-span-2' : ''}
                      onFocus={() => field.kind === 'slug' && setSlugLocked(true)}
                    >
                      {field.key === 'locale' ? (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{fieldLabel(field)}</div>
                          <ConsultValue spec={field} value={tab} />
                          <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{tEditor('lockedOnActiveLang')}</p>
                        </div>
                      ) : renderField(field, valueOf(field.key), (v) => set(field.key, v), record, { origin: originOf(field.key), originLocale: settings.defaultLocale, t: tEditor, moduleKey: mod.key })}
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
          <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}`)}>{tEditor('cancel')}</button>
          {record.id && <button className="ad-btn ad-btn-ghost" onClick={() => router.push(`/${locale}/admin/${mod.path}/${record.id}?consult=1`)}><Eye className="w-4 h-4" /> {tEditor('consultMode')}</button>}
          <button className="ad-btn ad-btn-primary" disabled={saving} onClick={save}><Save className="w-4 h-4" /> {saving ? '…' : tEditor('save')}</button>
        </div>
      )}
    </div>
  );
}
