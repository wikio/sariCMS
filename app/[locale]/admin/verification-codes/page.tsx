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
import { useEffect, useState } from 'react';
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
                        onClick={() => persist(codes.map((r) => (r.id === c.id ? { ...r, active: !r.active } : r)), '')}
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
          setDraft={setDraft}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            if (!draft.code.trim()) {
              showToast(t('editor.needCode'), 'error');
              return;
            }
            const rowsBase = codes || [];
            const exists = rowsBase.some((r) => r.id === draft.id);
            const rows = exists ? rowsBase.map((r) => (r.id === draft.id ? draft : r)) : [...rowsBase, draft];
            if (await persist(rows, exists ? t('saved') : t('created'))) setDraft(null);
          }}
          saving={saving}
        />
      )}
    </div>
  );
}

function CodeEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: CodeDef;
  setDraft: (c: CodeDef) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const t = useTranslations('admin.verificationCodes');
  const set = (patch: Partial<CodeDef>) => setDraft({ ...draft, ...patch });
  const setLabel = (loc: 'fr' | 'en' | 'ar', v: string) => setDraft({ ...draft, labels: { ...draft.labels, [loc]: v || undefined } });
  const setDesc = (loc: 'fr' | 'en' | 'ar', v: string) => setDraft({ ...draft, descriptions: { ...draft.descriptions, [loc]: v || undefined } });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="ad-card w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="ad-section-title">{draft.code ? `${t('editor.titleEdit')} — ${draft.code}` : t('editor.titleNew')}</h2>
          <button type="button" className="ad-btn ad-btn-ghost !px-2 !py-1" onClick={onCancel}><X className="w-4 h-4" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('editor.code')}</span>
            <input className="ad-input font-mono" value={draft.code} onChange={(e) => set({ code: e.target.value.trim() })} placeholder="1" />
            <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.codeHelp')}</span>
          </label>
          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('editor.semantic')}</span>
            <select className="ad-select" value={draft.semantic} onChange={(e) => set({ semantic: e.target.value as Semantic })}>
              {SEMANTICS.map((s) => (
                <option key={s.id} value={s.id}>{t(`semantics.${s.id}`)}</option>
              ))}
            </select>
            <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.semanticHelp')}</span>
          </label>

          {(['fr', 'en', 'ar'] as const).map((loc) => (
            <label key={loc} className="space-y-1.5 block md:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
                {t('editor.label')} · {loc.toUpperCase()}
              </span>
              <input className="ad-input" dir={loc === 'ar' ? 'rtl' : 'ltr'} value={draft.labels[loc] || ''} onChange={(e) => setLabel(loc, e.target.value)} />
              <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.description')} · {loc.toUpperCase()}</span>
              <textarea className="ad-textarea" rows={2} dir={loc === 'ar' ? 'rtl' : 'ltr'} value={draft.descriptions?.[loc] || ''} onChange={(e) => setDesc(loc, e.target.value)} />
            </label>
          ))}

          <label className="space-y-1.5 block">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('editor.sortOrder')}</span>
            <input className="ad-input" type="number" value={draft.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })} />
          </label>
          <div className="space-y-2 pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={draft.showDetails} onChange={(e) => set({ showDetails: e.target.checked })} />
              {t('editor.showDetails')}
            </label>
            <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('editor.showDetailsHelp')}</p>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
              {t('editor.active')}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="ad-btn ad-btn-ghost" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="ad-btn ad-btn-primary inline-flex items-center gap-2" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
