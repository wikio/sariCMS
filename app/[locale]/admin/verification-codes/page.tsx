'use client';

/**
 * « Codes de vérification » — le catalogue qui donne un sens aux codes de
 * l'API externe.
 *
 * L'API de vérification ne renvoie qu'une valeur — 1, 0, 2, 3, et demain
 * peut-être 4 ou « EXPIRED_YEAR ». Ce qui se fait avec relève de cet écran :
 * chaque ligne marie une valeur brute à un comportement de page (libellés
 * traduits, couleur, et le détail Type + Émetteur qu'on montre ou qu'on tait).
 * Un code renvoyé que personne n'a ici n'est pas un « invalide » par défaut :
 * la page publique répond une anomalie, pour qu'un nouveau code d'API ne
 * puisse jamais se déguiser en feu vert.
 *
 * L'ordre pilote l'affichage du formulaire de vérification en mode aperçu ;
 * une ligne désactivée continue d'exister mais ne répond plus — l'API qui la
 * renverrait tombera sous le coup de l'anomalie, ce qui est le comportement
 * voulu quand un code est retiré du service.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Eye, EyeOff, Pencil, Plus, RotateCcw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

type Semantic = 'valid' | 'forged' | 'expired' | 'revoked' | 'neutral';

interface CodeDef {
  id: string;
  code: string;
  semantic: Semantic;
  labels: { fr?: string; en?: string; ar?: string };
  descriptions?: { fr?: string; en?: string; ar?: string };
  showDetails: boolean;
  active: boolean;
  sortOrder: number;
}

const SEMANTICS: { id: Semantic; tone: string }[] = [
  { id: 'valid', tone: '#16a34a' },
  { id: 'forged', tone: '#dc2626' },
  { id: 'expired', tone: '#ca8a04' },
  { id: 'revoked', tone: '#ea580c' },
  { id: 'neutral', tone: '#199aca' },
];

const DEFAULT_CATALOG: CodeDef[] = [
  { id: 'valid', code: '1', semantic: 'valid', labels: { fr: 'Document valide', en: 'Valid document', ar: 'مستند صالح' }, descriptions: { fr: 'Le document est authentique et son intégrité est confirmée par l\'émetteur.', en: 'The document is authentic and its integrity is confirmed by the issuer.' }, showDetails: true, active: true, sortOrder: 1 },
  { id: 'forged', code: '0', semantic: 'forged', labels: { fr: 'Document falsifié', en: 'Forged document', ar: 'مستند مزوّر' }, descriptions: { fr: 'Le couple code / clé ne correspond à aucun document émis, ou correspond à un document altéré.', en: 'The code / key pair matches no issued document, or matches an altered one.' }, showDetails: true, active: true, sortOrder: 2 },
  { id: 'expired', code: '2', semantic: 'expired', labels: { fr: 'Document expiré', en: 'Expired document', ar: 'مستند منتهي الصلاحية' }, descriptions: { fr: 'Le document était valide ; sa durée de vérification est dépassée.', en: 'The document was valid; its verification window has elapsed.' }, showDetails: true, active: true, sortOrder: 3 },
  { id: 'revoked', code: '3', semantic: 'revoked', labels: { fr: 'Document révoqué', en: 'Revoked document', ar: 'مستند مسحوب' }, descriptions: { fr: 'L\'émetteur a retiré ce document ; il ne doit plus être accepté.', en: 'The issuer withdrew this document; it must no longer be accepted.' }, showDetails: true, active: true, sortOrder: 4 },
];

function nextId(codes: CodeDef[]): string {
  let n = codes.length + 1;
  while (codes.some((c) => c.id === `code-${n}`)) n += 1;
  return `code-${n}`;
}

export default function VerificationCodesAdminPage() {
  const t = useTranslations('admin.verificationCodes');
  const locale = useLocale();
  const { showToast } = useToast();
  const [codes, setCodes] = useState<CodeDef[] | null>(null);
  const [draft, setDraft] = useState<CodeDef | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/verification', { cache: 'no-store' });
        const json = await res.json();
        const rows: CodeDef[] = Array.isArray(json?.codes) ? json.codes : [];
        setCodes(rows.sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        showToast(t('loadError'), 'error');
        setCodes([]);
      }
    })();
    // Une lecture à l'entrée de l'écran : c'est l'édition qui réécrit, pas un minuteur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (rows: CodeDef[], notice: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: rows }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast((json as { error?: string } | null)?.error || t('saveError'), 'error');
        return false;
      }
      setCodes(rows);
      showToast(notice, 'success');
      return true;
    } catch {
      showToast(t('saveError'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const label = (c: CodeDef) => c.labels?.[locale as 'fr' | 'en' | 'ar'] || c.labels?.fr || c.code;

  return (
    <div className="space-y-4">
      <header className="ad-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Système</div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <ShieldCheck className="w-7 h-7" style={{ color: '#199aca' }} />
            {t('title')}
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--ad-muted)' }}>{t('intro')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="ad-btn ad-btn-ghost inline-flex items-center gap-2"
            onClick={() => setDraft({ id: nextId(codes || []), code: '', semantic: 'neutral', labels: {}, descriptions: {}, showDetails: false, active: true, sortOrder: (codes?.length || 0) + 1 })}
          >
            <Plus className="w-4 h-4" />
            {t('addNew')}
          </button>
          <Link href={`/${locale}/admin/settings`} className="ad-btn ad-btn-ghost">
            {t('backToSettings')}
          </Link>
        </div>
      </header>

      {!codes ? (
        <section className="ad-card p-5 text-sm" style={{ color: 'var(--ad-muted)' }}>{t('loading')}</section>
      ) : (
        <section className="ad-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest" style={{ color: 'var(--ad-muted)', borderBottom: '1px solid var(--ad-line)' }}>
                <th className="px-4 py-3 font-black">{t('columns.code')}</th>
                <th className="px-4 py-3 font-black">{t('columns.semantic')}</th>
                <th className="px-4 py-3 font-black">{t('columns.label')}</th>
                <th className="px-4 py-3 font-black text-center">{t('columns.details')}</th>
                <th className="px-4 py-3 font-black text-center">{t('columns.active')}</th>
                <th className="px-4 py-3 font-black text-right">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="font-semibold">{t('empty.title')}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{t('empty.hint')}</p>
                    <button type="button" className="ad-btn ad-btn-ghost mt-4 inline-flex items-center gap-2" onClick={() => persist(DEFAULT_CATALOG.map((c) => ({ ...c })), t('restored'))}>
                      <RotateCcw className="w-4 h-4" />
                      {t('restoreDefaults')}
                    </button>
                  </td>
                </tr>
              )}
              {codes.map((c) => {
                const tone = SEMANTICS.find((s) => s.id === c.semantic)?.tone || '#64748b';
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--ad-line)' }} className={c.active ? '' : 'opacity-50'}>
                    <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: tone }}>
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: tone }} />
                        {t(`semantics.${c.semantic}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{label(c)}</td>
                    <td className="px-4 py-3 text-center">
                      {c.showDetails ? <Check className="w-4 h-4 inline" style={{ color: '#16a34a' }} /> : <X className="w-4 h-4 inline" style={{ color: 'var(--ad-muted)' }} />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        title={c.active ? t('deactivate') : t('activate')}
                        className="ad-btn ad-btn-ghost !px-2 !py-1"
                        onClick={() => persist(codes.map((r) => (r.id === c.id ? { ...r, active: !r.active } : r)), c.active ? t('deactivated') : t('activated'))}
                      >
                        {c.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" title={t('edit')} className="ad-btn ad-btn-ghost !px-2 !py-1 mr-1" onClick={() => setDraft({ ...c, labels: { ...c.labels }, descriptions: { ...(c.descriptions || {}) } })}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={t('delete')}
                        className="ad-btn ad-btn-ghost !px-2 !py-1 text-red-600"
                        onClick={() => persist(codes.filter((r) => r.id !== c.id), t('deleted'))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-[11px] max-w-3xl leading-relaxed" style={{ color: 'var(--ad-muted)' }}>
        {t('footnote')}
      </p>

      {draft && (
        <CodeEditor
          draft={draft}
          isNew={!codes?.some((c) => c.id === draft.id)}
          others={(codes || []).filter((c) => c.id !== draft.id)}
          saving={saving}
          onCancel={() => setDraft(null)}
          onSave={async (next) => {
            const rowsBase = codes || [];
            const exists = rowsBase.some((r) => r.id === next.id);
            const rows = exists ? rowsBase.map((r) => (r.id === next.id ? next : r)) : [...rowsBase, next];
            if (await persist(rows, exists ? t('saved') : t('created'))) setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function CodeEditor({
  draft,
  isNew,
  others,
  onSave,
  onCancel,
  saving,
}: {
  draft: CodeDef;
  /** Nouvelle ligne ou édition d'une existante — change le titre et la validation de doublon. */
  isNew: boolean;
  /** Les autres lignes du catalogue : deux codes identiques se disputeraient la même réponse. */
  others: CodeDef[];
  /** L'appelant ferme la fiche lui-même quand l'enregistrement a passé le serveur. */
  onSave: (next: CodeDef) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const t = useTranslations('admin.verificationCodes');
  const [form, setForm] = useState<CodeDef>({ ...draft, labels: { ...draft.labels }, descriptions: { ...(draft.descriptions || {}) } });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (patch: Partial<CodeDef>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const keys = Object.keys(patch).filter((k) => e[k]);
      if (!keys.length) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  };
  const setLabel = (loc: 'fr' | 'en' | 'ar', v: string) => set({ labels: { ...form.labels, [loc]: v || undefined } });
  const setDesc = (loc: 'fr' | 'en' | 'ar', v: string) => set({ descriptions: { ...form.descriptions, [loc]: v || undefined } });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: Record<string, string> = {};
    const code = form.code.trim();
    if (!code) {
      errs.code = t('editor.needCode');
    } else if (!/^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,23}$/.test(code)) {
      // borné, sans espace : la clé d'un doublon doit rester lisible dans un tableau
      errs.code = t('editor.badCode');
    } else if (others.some((o) => clash(o.code, code))) {
      errs.code = t('editor.duplicateCode');
    }
    if (!(form.labels.fr || '').trim()) errs.labelFr = t('editor.needLabel');
    if (!(form.labels.en || '').trim()) errs.labelEn = t('editor.needLabelEn');
    if (!(form.labels.ar || '').trim()) errs.labelAr = t('editor.needLabelAr');
    const order = Number(form.sortOrder);
    if (!Number.isInteger(order) || order < 0) errs.sortOrder = t('editor.badSort');
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    onSave({
      ...form,
      code,
      labels: {
        fr: (form.labels.fr || '').trim() || undefined,
        en: (form.labels.en || '').trim() || undefined,
        ar: (form.labels.ar || '').trim() || undefined,
      },
      descriptions: {
        fr: (form.descriptions?.fr || '').trim() || undefined,
        en: (form.descriptions?.en || '').trim() || undefined,
        ar: (form.descriptions?.ar || '').trim() || undefined,
      },
      sortOrder: order,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={isNew ? t('editor.titleNew') : t('editor.titleEdit')}>
      <form onSubmit={submit} className="ad-card w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--ad-line)' }}>
          <div>
            <h2 className="ad-section-title">{isNew ? t('editor.titleNew') : `${t('editor.titleEdit')} — ${form.code.trim() || '…'}`}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ad-muted)' }}>{t('editor.intro')}</p>
          </div>
          <button type="button" className="ad-btn ad-btn-ghost !px-2 !py-1 shrink-0" onClick={onCancel} aria-label={t('cancel')}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="ad-scroll flex-1 min-h-0 px-5 py-4 space-y-4 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-3">
            <EditorField label={t('editor.code')} hint={t('editor.codeHelp')} error={errors.code} htmlFor="vc-code">
              <input
                id="vc-code"
                className="ad-input font-mono"
                autoFocus
                maxLength={24}
                value={form.code}
                onChange={(e) => set({ code: e.target.value.replace(/\s+/g, '') })}
                placeholder="1"
                aria-invalid={errors.code ? true : undefined}
              />
            </EditorField>
            <EditorField label={t('editor.semantic')} hint={t('editor.semanticHelp')} htmlFor="vc-semantic">
              <select id="vc-semantic" className="ad-select" value={form.semantic} onChange={(e) => set({ semantic: e.target.value as Semantic })}>
                {SEMANTICS.map((sm) => (
                  <option key={sm.id} value={sm.id}>{t(`semantics.${sm.id}`)}</option>
                ))}
              </select>
            </EditorField>
          </div>

          {(['fr', 'en', 'ar'] as const).map((loc) => (
            <fieldset key={loc} className="space-y-3 rounded-lg p-3" style={{ border: '1px solid var(--ad-line)' }}>
              <legend className="px-1 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                {loc === 'fr' ? 'Français' : loc === 'en' ? 'English' : 'العربية'}
              </legend>
              <EditorField label={t('editor.label')} error={loc === 'fr' ? errors.labelFr : loc === 'en' ? errors.labelEn : errors.labelAr} htmlFor={`vc-label-${loc}`}>
                <input
                  id={`vc-label-${loc}`}
                  className="ad-input"
                  dir={loc === 'ar' ? 'rtl' : 'ltr'}
                  maxLength={160}
                  value={form.labels[loc] || ''}
                  onChange={(e) => setLabel(loc, e.target.value)}
                  placeholder={t('editor.labelPlaceholder')}
                  aria-invalid={(loc === 'fr' ? errors.labelFr : loc === 'en' ? errors.labelEn : errors.labelAr) ? true : undefined}
                />
              </EditorField>
              <EditorField label={t('editor.description')} hint={loc === 'fr' ? t('editor.descriptionHelp') : undefined} htmlFor={`vc-desc-${loc}`}>
                <textarea
                  id={`vc-desc-${loc}`}
                  className="ad-textarea"
                  rows={2}
                  dir={loc === 'ar' ? 'rtl' : 'ltr'}
                  maxLength={400}
                  value={form.descriptions?.[loc] || ''}
                  onChange={(e) => setDesc(loc, e.target.value)}
                />
              </EditorField>
            </fieldset>
          ))}

          <div className="grid md:grid-cols-[9rem_1fr] gap-3 items-start">
            <EditorField label={t('editor.sortOrder')} error={errors.sortOrder} htmlFor="vc-order">
              <input
                id="vc-order"
                className="ad-input"
                type="number"
                min={0}
                step={1}
                value={form.sortOrder}
                onChange={(e) => set({ sortOrder: Number(e.target.value) })}
                aria-invalid={errors.sortOrder ? true : undefined}
              />
            </EditorField>
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={form.showDetails} onChange={(e) => set({ showDetails: e.target.checked })} />
                <span>
                  <span className="font-bold">{t('editor.showDetails')}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.showDetailsHelp')}</span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
                <span className="font-bold">{t('editor.active')}</span>
              </label>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-4 shrink-0" style={{ borderTop: '1px solid var(--ad-line)' }}>
          <span className="mr-auto text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.saveNote')}</span>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={onCancel}>{t('cancel')}</button>
          <button type="submit" className="ad-btn ad-btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? t('saving') : t('save')}
          </button>
        </footer>
      </form>
    </div>
  );
}

/** Deux codes qui « se disputent » la même réponse de l'API — même règle que le serveur. */
function clash(a: string, b: string): boolean {
  const x = String(a || '').trim().toLowerCase();
  const y = String(b || '').trim().toLowerCase();
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return x !== '' && y !== '' && Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

function EditorField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{hint}</p>
      ) : null}
    </div>
  );
}
