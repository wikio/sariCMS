'use client';

import { useEffect, useState } from 'react';
import { Check, Eye, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import {
  defaultCurrency,
  loadCurrencies,
  saveCurrencies,
  setDefaultCurrency,
  type Currency,
} from '@/lib/currencies';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import { useTranslations } from 'next-intl';

const empty = (): Currency => ({ id: `cur-${Date.now()}`, code: '', symbol: '', name: '', rate: 1, active: true });

export default function CurrenciesPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.currencies');
  const [rows, setRows] = useState<Currency[]>([]);
  const [draft, setDraft] = useState<Currency | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => { setRows(loadCurrencies()); }, []);
  const persist = (next: Currency[], toast = 'Devises enregistrées') => {
    setRows(next); saveCurrencies(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };

  // Devise réellement appliquée : si la ligne marquée par défaut a été
  // désactivée, `defaultCurrency` retombe sur la première devise active. La
  // table doit signaler celle qui sert vraiment, pas celle qui porte le drapeau.
  const applied = rows.length ? defaultCurrency(rows) : null;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">Configuration avancée / Devises</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Code, symbole, nom et taux de change par rapport au dinar (DZD = 1).</p>
          {applied && (
            <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>
              {t('appliedNotice', { name: applied.name, symbol: applied.symbol })}
            </p>
          )}
        </div>
        <button className="ad-btn ad-btn-primary" onClick={() => { setMode('edit'); setDraft(empty()); }}><Plus className="w-4 h-4" /> Ajouter</button>
      </header>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r))}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r))}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)))}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>{t("code")}</th><th>{t("symbol")}</th><th>{t("name", { defaultMessage: "Nom" })}</th><th>Taux / DZD</th><th>Statut</th><th>{t("isDefault")}</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id))} /></td>
                <td className="font-mono font-bold">{c.code}</td>
                <td>{c.symbol}</td>
                <td>{c.name}</td>
                <td>{c.rate}</td>
                <td><span className={`ad-chip ${c.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  {applied?.id === c.id ? (
                    <span className="ad-chip ad-chip-ok inline-flex items-center gap-1" title={t('isDefaultHint')}>
                      <Check className="w-3.5 h-3.5" /> {t('isDefault')}
                    </span>
                  ) : (
                    <button
                      className="ad-btn ad-btn-ghost"
                      title={c.active ? t('setDefault') : t('setDefaultInactive')}
                      disabled={!c.active}
                      onClick={() => persist(setDefaultCurrency(rows, c.id), t('defaultChanged', { code: c.code }))}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                </td>
                <td className="text-right">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...c }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...c }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== c.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.code}` : 'Devise'}
        onClose={() => setDraft(null)}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft?.code.trim()) return;
              const saved = { ...draft, code: draft.code.toUpperCase() };
              const next = rows.some((r) => r.id === saved.id)
                ? rows.map((r) => (r.id === saved.id ? saved : r))
                : [saved, ...rows];
              // Une seule devise par défaut : cocher celle-ci décoche les autres.
              persist(saved.isDefault ? setDefaultCurrency(next, saved.id) : next);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <input className="ad-input font-mono" disabled={mode === 'consult'} placeholder="Code ISO (EUR)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Symbole (€)" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t("rateToDZD")}</span>
              <input className="ad-input" type="number" disabled={mode === 'consult'} value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })} />
              <p className="ad-field-hint">1 unité de cette devise = ce nombre de dinars.</p>
            </label>
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Active" disabled={mode === 'consult'} />
            <label className="block space-y-1.5">
              <Toggle
                on={!!draft.isDefault}
                onChange={(isDefault) => setDraft({ ...draft, isDefault, active: isDefault ? true : draft.active })}
                label={t('isDefault')}
                disabled={mode === 'consult'}
              />
              <p className="ad-field-hint">{t('isDefaultHint')}</p>
            </label>
          </>
        )}
      </Drawer>
    </div>
  );
}
