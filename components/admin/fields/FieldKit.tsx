'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote, ChevronsUpDown, FolderOpen, GripVertical, Link2, Mail, Phone, Plus, Star, Trash2, Upload,
} from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { FieldSpec } from '@/lib/cms-modules';
import { addTaxonomyTerm, listTaxonomy } from '@/lib/taxonomies';
import { searchLucideIcons } from '@/lib/lucide-icons';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import FilePicker from '@/components/admin/fields/FilePicker';
import GedPicker from '@/components/admin/GedPicker';
import IconMark from '@/components/admin/IconMark';
import ProcessFlow, { normalizeSteps } from '@/components/admin/ProcessFlow';
import Toggle from '@/components/admin/Toggle';
import DateTimePicker from '@/components/admin/fields/DateTimePicker';
import AutocompleteSelect from '@/components/admin/fields/AutocompleteSelect';
import ProductMultiSelect from '@/components/admin/fields/ProductMultiSelect';
import AuthorPicker from '@/components/admin/fields/AuthorPicker';
import { activeCurrencies, defaultCurrency, FALLBACK_CURRENCY, loadCurrencies, saveCurrencies, type Currency } from '@/lib/currencies';
import { useAdminLabels } from '@/lib/admin-labels';
import { COLOR_PRESETS, resolveColor } from '@/lib/colors';
import { useMessages, useTranslations } from 'next-intl';

/** Vérifie silencieusement si une clé de traduction existe dans un namespace */
function resolveOptionTranslation(messages: Record<string, any>, locale: string, value: string): string | null {
  const key = `option_${value}`;
  // Navigate: messages.admin.editor.option_XXX
  try {
    const editor = messages?.admin?.editor;
    if (editor && typeof editor === 'object' && key in editor) {
      const val = editor[key];
      if (typeof val === 'string' && val.length > 0) return val;
    }
  } catch {
    // Silently ignore
  }
  return null;
}

export function FieldShell({ spec, value, origin, originLocale, moduleKey, children }: { spec: FieldSpec; value?: unknown; origin?: unknown; originLocale?: string; moduleKey?: string; children: React.ReactNode }) {
  const t = useTranslations('admin.editor');
  const labels = useAdminLabels(moduleKey);
  const resolvedLabel = labels.field(spec.key, spec.label);
  const resolvedHint = labels.hint(spec.key, spec.hint);
  const len = typeof value === 'string' ? value.length : 0;
  const over = spec.maxLength != null && len > spec.maxLength;
  const originText = origin == null || origin === '' ? '' : typeof origin === 'string' ? origin : JSON.stringify(origin);
  return (
    <div className={`space-y-1.5 ${spec.wide || spec.kind === 'html' || spec.kind === 'process' || spec.kind === 'price' ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
          {resolvedLabel}
        </span>
        {spec.required
          ? <span className="ad-chip ad-chip-warn">{t("required")}</span>
          : <span className="ad-chip ad-chip-mute">{t("optional")}</span>}
        {spec.maxLength != null && (
          <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: over ? 'var(--ad-danger)' : 'var(--ad-muted)' }}>
            {len} / {spec.maxLength}
          </span>
        )}
      </div>
      {children}
      {resolvedHint && <p className="text-[11px] leading-snug" style={{ color: 'var(--ad-muted)' }}>{resolvedHint}</p>}
      {originText && (
        <p className="ad-origin">{t('origin')} ({(originLocale || 'défaut').toUpperCase()}) : {originText.replace(/<[^>]+>/g, ' ').slice(0, 280)}</p>
      )}
    </div>
  );
}

export function FieldLabel({ spec, children }: { spec: FieldSpec; children: React.ReactNode }) {
  return <FieldShell spec={spec}>{children}</FieldShell>;
}

export function renderField(
  spec: FieldSpec,
  value: unknown,
  onChange: (v: unknown) => void,
  record: Record<string, unknown>,
  extra: {
    origin?: unknown;
    originLocale?: string;
    t?: (key: string) => string;
    moduleKey?: string;
    valueOf?: (key: string) => unknown;
    /** Écriture d'un autre champ du même formulaire (ex. `authorName` depuis le sélecteur d'auteur). */
    setField?: (key: string, value: unknown) => void;
  } = {},
) {
  const ph = spec.placeholder || '';
  const t = extra.t || ((key: string) => key); // Fallback: retourner la clé si pas de fonction de traduction
  const wrap = (node: React.ReactNode) => (
    <FieldShell spec={spec} value={value} origin={extra.origin} originLocale={extra.originLocale} moduleKey={extra.moduleKey}>{node}</FieldShell>
  );
  switch (spec.kind) {
    case 'html':
      return wrap(<HtmlEditor value={String(value || '')} onChange={onChange} placeholder={ph || 'Rédigez le contenu détaillé…'} />);
    case 'slug': {
      // Utiliser valueOf pour récupérer le titre traduit, sinon fallback sur record
      const titleValue = extra.valueOf 
        ? String(extra.valueOf(spec.slugFrom || 'title') || extra.valueOf('name') || '')
        : String(record[spec.slugFrom || 'title'] || record.name || '');
      
      return wrap(
        <div className="flex gap-2">
          <span className="ad-input !w-auto flex items-center text-xs" style={{ color: 'var(--ad-muted)' }}>/</span>
          <input className="ad-input font-mono" value={String(value || '')} placeholder={ph || 'url-de-la-fiche'} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange(slugify(titleValue))}>{t('auto')}</button>
        </div>,
      );
    }
    case 'email':
      return wrap(
        <div className="ad-search">
          <Mail className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
          <input className="ad-input" type="email" placeholder={ph || 'contact@exemple.com'} value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
        </div>,
      );
    case 'phone':
      return wrap(
        <div className="ad-search">
          <Phone className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
          <input className="ad-input" placeholder={ph || '+213 …'} value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
        </div>,
      );
    case 'url':
      return wrap(
        <div className="ad-search">
          <Link2 className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
          <input className="ad-input" placeholder={ph || 'https://…'} value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
        </div>,
      );
    case 'price':
      return wrap(<PriceInner value={String(value || '')} onChange={onChange} placeholder={spec.placeholder || '0'} />);
    case 'icon':
      return wrap(<IconPicker value={String(value || '')} onChange={onChange} />);
    case 'color':
      return wrap(<ColorPicker value={String(value || '')} onChange={onChange} />);
    case 'datetime':
      return wrap(<DateTimePicker 
        value={String(value || '')} 
        onChange={(newValue) => {
          onChange(newValue);
        }} 
        label={spec.label} 
        includeTime={true} 
        placeholder={spec.placeholder} 
        required={spec.required} 
      />);
    case 'select':
      return wrap(<TaxonomySelect spec={spec} locale={String(record.locale || 'fr')} value={String(value || '')} onChange={onChange} />);
    case 'radio':
      return wrap(
        <div className="flex flex-wrap gap-2">
          {(spec.options || []).map((o) => {
            const on = String(value ?? '') === String(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`ad-choice ${on ? 'is-on' : ''}`} aria-pressed={on}>
                {o.label}
              </button>
            );
          })}
        </div>,
      );
    case 'toggle':
      return wrap(
        <Toggle on={value === true || value === 'true'} onChange={onChange} label="" />,
      );
    case 'textarea':
      return wrap(
        <textarea className="ad-textarea min-h-[90px]" placeholder={ph || (spec.placeholder || '')} maxLength={spec.maxLength} value={String(value || '')} onChange={(e) => onChange(e.target.value)} />,
      );
    case 'image':
      return wrap(<MediaPicker value={String(value || '')} onChange={onChange} moduleName={extra.moduleKey || spec.key} recordId={record.id as string | number | undefined} recordSlug={record.slug as string} />);
    case 'file':
      return wrap(<FilePicker value={String(value || '')} onChange={onChange} />);
    case 'gallery':
      return wrap(<GalleryEditor value={asStringArray(value)} onChange={onChange} />);
    case 'faq':
      return wrap(<FaqEditor value={asFaq(value)} onChange={onChange} />);
    case 'process':
      return wrap(<ProcessEditor value={normalizeSteps(value)} onChange={onChange} />);
    case 'list':
      return wrap(<ListEditor value={asStringArray(value)} onChange={onChange} />);
    case 'tags':
      return wrap(<ListEditor value={asStringArray(value)} onChange={onChange} placeholder="Tag" />);
    case 'specs':
      return wrap(<SpecsEditor value={asRecord(value)} onChange={onChange} />);
    case 'options':
      return wrap(<OptionsEditor value={asOptions(value)} onChange={onChange} />);
    case 'agenda':
      return wrap(<AgendaEditor value={value} onChange={onChange} />);
    case 'slides':
    case 'sections':
      return wrap(<BlocksEditor value={asBlocks(value)} onChange={onChange} />);
    case 'products':
      return wrap(<ProductMultiSelect value={Array.isArray(value) ? value : []} onChange={onChange} />);
    case 'author':
      return wrap(
        <AuthorPicker
          value={value as string | number | null}
          onChange={onChange}
          // Le nom reste stocké sur l'article : la vitrine et les exports
          // continuent de l'afficher même si la fiche auteur est supprimée.
          onNameChange={(name) => extra.setField?.('authorName', name)}
        />,
      );
    case 'rating':
      return wrap(
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)}>
              <Star className="w-5 h-5" fill={n <= Number(value || 0) ? 'var(--ad-warn)' : 'transparent'} color="var(--ad-warn)" />
            </button>
          ))}
        </div>,
      );
    case 'number':
      return wrap(<input className="ad-input" type="number" placeholder={ph || '0'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />);
    case 'text':
    default:
      return wrap(
        spec.prefix ? (
          <div className="ad-search">
            <span className="ad-search-ico text-xs font-bold">{spec.prefix}</span>
            <input className="ad-input" placeholder={ph || spec.placeholder || ''} maxLength={spec.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        ) : (
          <div className="relative">
            <input className={`ad-input ${spec.suffix ? 'pr-12' : ''}`} placeholder={ph || spec.placeholder || ''} maxLength={spec.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
            {spec.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--ad-muted)' }}>{spec.suffix}</span>}
          </div>
        ),
      );
  }
}

function TaxonomySelect({ spec, value, onChange, locale }: { spec: FieldSpec; value: string; onChange: (v: string) => void; locale?: string }) {
  const t = useTranslations('admin.editor');
  const messages = useMessages() as Record<string, any>;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [tick, setTick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [comboRect, setComboRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ne pas fermer si le clic est dans le box OU dans le portal du dropdown
      if (box.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onTax = () => setTick((n) => n + 1);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('sari-taxonomies', onTax);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('sari-taxonomies', onTax);
    };
  }, []);

  useEffect(() => {
    if (open && box.current) {
      const rect = box.current.getBoundingClientRect();
      setComboRect(rect);
    }
  }, [open]);

  // Fermer la liste au scroll
  useEffect(() => {
    if (!open) return;
    
    const handleScroll = () => {
      setOpen(false);
    };
    
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const options = useMemo(() => {
    // Les libellés sont résolus selon la langue de la fiche éditée.
    const tax = spec.taxonomy ? listTaxonomy(spec.taxonomy, locale) : [];
    const base = [...(spec.options || [])];
    
    // Traduire les options selon la locale (silencieux si clé absente)
    const translatedBase = base.map((opt) => {
      // 1. Essayer depuis les traductions de taxonomie (localStorage)
      const taxTerm = tax.find(t => t.value === opt.value);
      if (taxTerm?.translations) {
        const l = (locale || 'fr') as 'fr' | 'en' | 'ar';
        const fromTax = taxTerm.translations[l];
        if (fromTax) return { ...opt, label: fromTax };
      }
      // 2. Fallback: clés option_ dans messages JSON
      const translatedLabel = resolveOptionTranslation(messages, locale || 'fr', opt.value);
      if (translatedLabel) return { ...opt, label: translatedLabel };
      return opt;
    });
    
    for (const taxItem of tax) {
      if (!translatedBase.some((o) => o.value === taxItem.value)) {
        // Utiliser les traductions localStorage de la taxonomie
        const l = (locale || 'fr') as 'fr' | 'en' | 'ar';
        const fromTax = taxItem.translations?.[l];
        if (fromTax) {
          translatedBase.push({ ...taxItem, label: fromTax });
        } else {
          // Fallback: clés option_ dans messages JSON
          const taxTranslated = resolveOptionTranslation(messages, locale || 'fr', taxItem.value);
          if (taxTranslated) {
            translatedBase.push({ ...taxItem, label: taxTranslated });
          } else {
            translatedBase.push(taxItem);
          }
        }
      }
    }
    return translatedBase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.options, spec.taxonomy, tick, locale, t, messages]);

  const filtered = options.filter((o) => {
    const blob = `${o.label} ${o.value}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });
  // Match by value OR by translated label (backward compat with data saved with translated values)
  const current = options.find((o) => o.value === value) 
    || options.find((o) => o.label === value);
  
  // Normalize: if value is a translated label (not canonical), auto-fix to canonical value
  useEffect(() => {
    if (!value || !options.length) return;
    const matchedByValue = options.some((o) => o.value === value);
    if (matchedByValue) return; // already canonical
    const matchedByLabel = options.find((o) => o.label === value);
    if (matchedByLabel) {
      onChange(matchedByLabel.value);
    }
  }, [value, options, onChange]);
  
  // Debug log

  const create = () => {
    const label = draft.trim();
    if (!label) return;
    const next = spec.taxonomy ? addTaxonomyTerm(spec.taxonomy, { value: label, label }) : [];
    const created = next.find((t) => t.label === label) || { value: label, label };
    onChange(created.value);
    setDraft('');
    setAdding(false);
    setOpen(false);
    setTick((n) => n + 1);
  };

  return (
      <div className="flex gap-2" ref={box}>
        <div className={`ad-combo flex-1 ${open ? 'is-open' : ''}`}>
          <button type="button" className="ad-select text-left flex items-center justify-between" onClick={() => setOpen((v) => !v)}>
            <span className={current ? '' : 'opacity-50'}>{current?.label || spec.placeholder || t("select")}</span>
            <ChevronsUpDown className="w-4 h-4 opacity-50" />
          </button>
          {open && comboRect && createPortal(
            <div 
              ref={portalRef}
              className="ad-combo-list"
              style={{
                position: 'fixed',
                top: `${comboRect.bottom + 4}px`,
                ...(document.documentElement.dir === 'rtl' 
                  ? { right: `${window.innerWidth - comboRect.right}px` }
                  : { left: `${comboRect.left}px` }
                ),
                width: `${comboRect.width}px`,
                zIndex: 99999,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
                maxHeight: '240px',
                overflow: 'auto',
                borderRadius: '8px',
              }}
            >
              <div className="p-2">
                <input
                  autoFocus
                  className="ad-input"
                  placeholder={t('searchOptions')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ad-combo-item ${(o.value === value || o.label === value) ? 'is-on font-bold' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-2 text-xs" style={{ color: 'var(--ad-muted)' }}>{t("noResults")}</div>}
            </div>,
            document.body
          )}
        </div>
        {spec.taxonomy && (
          adding ? (
            <div className="flex gap-1">
              <input className="ad-input w-40" placeholder={t("newOption")} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
              <button type="button" className="ad-btn ad-btn-primary" onClick={create}>OK</button>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => { setAdding(false); setDraft(''); }}>{t("cancel")}</button>
            </div>
          ) : (
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> {t('newOption')}
            </button>
          )
        )}
      </div>
  );
}

function parsePrice(value: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([\d\s.,]+)\s*(.*)$/);
  return { amount: match?.[1]?.trim() || '', suffix: match?.[2]?.trim() || '' };
}

function PriceInner({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useTranslations('admin.editor');
  const [list, setList] = useState<Currency[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ code: '', symbol: '', name: '' });
  useEffect(() => {
    setList(activeCurrencies());
    const on = () => setList(activeCurrencies());
    window.addEventListener('sari-currencies', on);
    return () => window.removeEventListener('sari-currencies', on);
  }, []);
  const { amount, suffix } = parsePrice(value);
  // À défaut de devise reconnue dans la valeur saisie, on propose celle
  // configurée par défaut (page Devises) plutôt que la première de la liste.
  const curr = list.find((c) => suffix === c.symbol || suffix === c.code || suffix.includes(c.symbol) || suffix.includes(c.code))
    || (list.length ? defaultCurrency(list) : null)
    || FALLBACK_CURRENCY;

  const quote = /sur\s*devis/i.test(value) || suffix.toLowerCase() === 'sur devis';
  const setAmount = (next: string) => onChange(next.trim() ? `${next.trim()} ${curr.symbol}` : '');
  const setCurrency = (next: Currency) => onChange(amount ? `${amount} ${next.symbol}` : next.symbol);
  const setQuote = () => onChange(t("onQuote"));

  const create = () => {
    const code = draft.code.trim().toUpperCase();
    if (!code || !draft.symbol.trim()) return;
    const next: Currency = { id: `cur-${Date.now()}`, code, symbol: draft.symbol.trim(), name: draft.name.trim() || code, rate: 1, active: true };
    saveCurrencies([...loadCurrencies(), next]);
    setCurrency(next);
    setAdding(false);
    setDraft({ code: '', symbol: '', name: '' });
  };

  return (
    <div className="ad-price-split">
      <label className="ad-price-amount">
        <span className="ad-price-kicker">{t("amount")}</span>
        <span className="ad-price-box">
          <Banknote className="ad-price-ico" aria-hidden />
          <input
            className="ad-input"
            value={quote ? '' : amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d\s.,]/g, ''))}
            placeholder={quote ? t("onQuote") : (placeholder || '0')}
            inputMode="decimal"
            autoComplete="off"
            disabled={quote}
          />
        </span>
      </label>
      <div className="ad-price-currency">
        <span className="ad-price-kicker">{t("currency")}</span>
        <div className="ad-price-chips">
          <button type="button" className={`ad-price-chip ${quote ? 'is-on' : ''}`} onClick={setQuote}>
            <b>{t("onQuote")}</b>
          </button>
          {list.map((c) => (
            <button
              key={c.id || c.code}
              type="button"
              className={`ad-price-chip ${!quote && curr.code === c.code ? 'is-on' : ''}`}
              onClick={() => setCurrency(c)}
              title={c.name}
            >
              <b>{c.symbol}</b>
              <span>{c.code}</span>
            </button>
          ))}
          <button type="button" className="ad-price-chip is-add" onClick={() => setAdding((v) => !v)}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
        {adding && (
          <div className="ad-card p-3 space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              <input className="ad-input" placeholder={t("code")} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
              <input className="ad-input" placeholder="Symbole" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
              <input className="ad-input" placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => { setAdding(false); setDraft({ code: '', symbol: '', name: '' }); }}>{t('cancel')}</button>
              <button type="button" className="ad-btn ad-btn-primary" onClick={create}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('admin.editor');
  const [inputValue, setInputValue] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);

  // Palette partagée avec la vitrine (lib/colors.ts) : le rendu de l'admin
  // correspond exactement à la couleur affichée sur le site public.
  const PRESET_COLORS = COLOR_PRESETS;

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Mettre à jour la position en temps réel pendant le scroll
  useEffect(() => {
    if (!showSuggestions) return;

    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setInputRect(rect);
      }
    };

    // Mise à jour initiale
    updatePosition();

    // Écouter les événements de scroll et resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showSuggestions]);

  const filteredColors = useMemo(() => {
    if (!inputValue.trim()) return PRESET_COLORS;
    const search = inputValue.toLowerCase();
    return PRESET_COLORS.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.value.toLowerCase().includes(search)
    );
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleColorSelect = (colorName: string) => {
    setInputValue(colorName);
    onChange(colorName);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hexValue = e.target.value;
    setInputValue(hexValue);
    onChange(hexValue);
  };

  // Aperçu : jeton connu → sa couleur, sinon la valeur brute (hex, rgb…).
  const displayColor = useMemo(() => (inputValue ? resolveColor(inputValue) : ''), [inputValue]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            className="ad-input"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t('colorPlaceholder') || 'sari-blue, #1e40af, red-500...'}
          />
          {showSuggestions && filteredColors.length > 0 && inputRect && createPortal(
            <div 
              style={{
                position: 'fixed',
                top: `${inputRect.bottom + 4}px`,
                ...(document.documentElement.dir === 'rtl' 
                  ? { right: `${window.innerWidth - inputRect.right}px` }
                  : { left: `${inputRect.left}px` }
                ),
                width: `${Math.max(inputRect.width, 200)}px`,
                maxHeight: '240px',
                overflowY: 'auto',
                zIndex: 99999,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
                borderRadius: '8px',
              }}
            >
              {filteredColors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleColorSelect(color.name)}
                >
                  <div 
                    className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-sm font-medium">{color.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{color.value}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded border border-gray-300"
            style={{ backgroundColor: displayColor || '#ffffff' }}
            title={displayColor || 'No color'}
          />
          <input
            type="color"
            value={displayColor && displayColor.startsWith('#') ? displayColor : '#000000'}
            onChange={handleNativeColorChange}
            className="w-10 h-10 cursor-pointer border-0 p-0"
            title={t('pickColor') || 'Pick a color'}
          />
        </div>
      </div>
    </div>
  );
}

// Fonction pour générer une couleur basée sur le nom de l'icône
function getIconColor(name: string): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
  ];
  
  // Hash simple du nom pour attribuer une couleur cohérente
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('admin.editor');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = useState<DOMRect | null>(null);
  const hits = useMemo(() => searchLucideIcons(q, 500), [q]);

  // Mettre à jour la position en temps réel pendant le scroll
  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (boxRef.current) {
        const rect = boxRef.current.getBoundingClientRect();
        setPortalRect(rect);
      }
    };

    // Mise à jour initiale
    updatePosition();

    // Écouter les événements de scroll et resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="ad-search">
        <span className="ad-search-ico"><IconMark name={value} className="w-4 h-4" /></span>
        <input
          className="ad-input"
          placeholder={t('searchIcon')}
          value={q}
          onFocus={() => {
            setOpen(true);
          }}
          onChange={(e) => { 
            setQ(e.target.value); 
            setOpen(true); 
          }}
        />
      </div>
      {open && portalRect && (() => {
        return createPortal(
        <div
          className="ad-combo-list ad-scroll"
          style={{
            position: 'fixed',
            top: `${portalRect.bottom + 4}px`,
            ...(document.documentElement.dir === 'rtl' 
              ? { right: `${window.innerWidth - portalRect.right}px` }
              : { left: `${portalRect.left}px` }
            ),
            width: `${portalRect.width}px`,
            maxHeight: '320px',
            zIndex: 99999,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
            borderRadius: '8px',
          }}
        >
          {hits.length === 0 && <div className="ad-combo-item text-xs" style={{ color: 'var(--ad-muted)' }}>{t("noIconFound")}</div>}
          {hits.map((name) => (
            <button
              key={name}
              type="button"
              className={`ad-combo-item items-center gap-2 ${name === value ? 'is-on font-bold' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(name); 
                setQ(''); 
                setOpen(false);
              }}
            >
              <span style={{ color: getIconColor(name) }} className="shrink-0">
                <IconMark name={name} className="w-4 h-4" />
              </span>
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>,
        document.body
      );
      })()}
    </div>
  );
}

function ProcessEditor({ value, onChange }: { value: ReturnType<typeof normalizeSteps>; onChange: (v: unknown) => void }) {
  const t = useTranslations('admin.editor');
  const set = (next: typeof value) => onChange(next);
  return (
    <div className="space-y-3">
      <ProcessFlow steps={value} />
      {value.map((step, i) => (
        <div key={step.id || i} className="grid md:grid-cols-[1fr_1fr_auto] gap-2">
          <input className="ad-input" placeholder={t("stepN", { n: i + 1 })} value={step.label} onChange={(e) => set(value.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))} />
          <input className="ad-input" placeholder={t("detailResponsible")} value={step.detail || ''} onChange={(e) => set(value.map((s, j) => (j === i ? { ...s, detail: e.target.value } : s)))} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => set(value.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => set([...value, { id: `s-${Date.now()}`, label: t("stepN", { n: value.length + 1 }) }])}><Plus className="w-4 h-4" /> {t("step")}</button>
    </div>
  );
}

async function uploadOriginal(file: File, moduleName = 'ged', id?: string | number, slug?: string) {
  const body = new FormData();
  body.append('file', file);
  body.append('module', moduleName);
  body.append('label', file.name);
  if (id) body.append('id', String(id));
  if (slug) body.append('slug', slug);
  const res = await fetch('/api/admin/upload', { method: 'POST', body });
  const json = await res.json();
  return json.url as string | undefined;
}

export function MediaPicker({ value, onChange, moduleName = 'ged', recordId, recordSlug }: { value: string; onChange: (v: string) => void; moduleName?: string; recordId?: string | number; recordSlug?: string }) {
  const t = useTranslations('admin.editor');
  const [busy, setBusy] = useState(false);
  const [ged, setGed] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadOriginal(file, moduleName, recordId, recordSlug);
      if (url) onChange(url);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="ad-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("urlPlaceholder")} />
        <label className="ad-btn ad-btn-ghost cursor-pointer">
          <Upload className="w-4 h-4" /> {busy ? '…' : t("file")}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            if (e.target.files?.[0]) {
              upload(e.target.files[0]);
              e.target.value = ''; // Reset input to allow re-upload
            }
          }} />
        </label>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setGed(true)}><FolderOpen className="w-4 h-4" /> {t("ged")}</button>
      </div>
      {value && (
        <div className="min-h-24 p-2" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface-2)' }}>
          <img src={value} alt="" className="max-h-40 max-w-full object-contain mx-auto" />
        </div>
      )}
      {ged && <GedPicker onClose={() => setGed(false)} onPick={(url) => { onChange(url); setGed(false); }} />}
    </div>
  );
}

function GalleryEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('admin.editor');
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {value.map((src, i) => (
          <div key={`${src}-${i}`} className="relative group overflow-hidden h-24" style={{ border: '1px solid var(--ad-line)' }}>
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button type="button" className="absolute top-1 right-1 ad-btn ad-btn-danger ad-btn-icon opacity-0 group-hover:opacity-100" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <MediaPicker value="" onChange={(url) => url && onChange([...value, url])} />
      </div>
    </div>
  );
}

function ListEditor({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const t = useTranslations('admin.editor');
  const ph = placeholder || t('add');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <button type="button" className="opacity-40" onClick={() => move(i, i - 1)}><GripVertical className="w-4 h-4" /></button>
          <input className="ad-input" value={item} placeholder={placeholder} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, ''])}><Plus className="w-4 h-4" /> {t("add")}</button>
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: Array<{ q: string; a: string }>; onChange: (v: Array<{ q: string; a: string }>) => void }) {
  const t = useTranslations('admin.editor');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {value.map((item, i) => (
        <div key={i} className="ad-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => move(i, i - 1)} className="opacity-40"><GripVertical className="w-4 h-4" /></button>
            <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--ad-muted)' }}>{t('questionN', { n: i + 1 })}</span>
            <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></button>
          </div>
          <input className="ad-input" placeholder={t("question")} value={item.q} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))} />
          <textarea className="ad-textarea" placeholder={t("answer")} value={item.a} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, a: e.target.value } : v)))} />
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, { q: '', a: '' }])}><Plus className="w-4 h-4" /> {t("addQuestion")}</button>
    </div>
  );
}

function SpecsEditor({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const t = useTranslations('admin.editor');
  const entries = Object.entries(value);
  const set = (next: Array<[string, string]>) => onChange(Object.fromEntries(next.filter(([k]) => k)));
  return (
    <div id="specs" className="space-y-2 scroll-mt-28">
      {entries.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t("noSpecs")}</p>
      )}
      {entries.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input className="ad-input" placeholder="Caractéristique" value={k} onChange={(e) => {
            const n = [...entries]; n[i] = [e.target.value, v]; set(n);
          }} />
          <div className="flex gap-2">
            <input className="ad-input" placeholder="Valeur" value={v} onChange={(e) => {
              const n = [...entries]; n[i] = [k, e.target.value]; set(n);
            }} />
            <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => set(entries.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => set([...entries, ['', '']])}><Plus className="w-4 h-4" /> Ligne</button>
    </div>
  );
}

function OptionsEditor({ value, onChange }: { value: Array<{ name: string; choices: string[] }>; onChange: (v: Array<{ name: string; choices: string[] }>) => void }) {
  return (
    <div className="space-y-3">
      {value.map((opt, i) => (
        <div key={i} className="ad-card p-3 space-y-2">
          <input className="ad-input" placeholder="Nom de l’option (ex. Sonde)" value={opt.name} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))} />
          <ListEditor value={opt.choices || []} onChange={(choices) => onChange(value.map((v, j) => (j === i ? { ...v, choices } : v)))} placeholder="Choix" />
          <button type="button" className="ad-btn ad-btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>Retirer l’option</button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, { name: '', choices: [] }])}><Plus className="w-4 h-4" /> Option</button>
    </div>
  );
}

function AgendaEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const t = useTranslations('admin.careersFields');
  const items = Array.isArray(value)
    ? value.map((it) => (typeof it === 'string' ? { time: '', title: it } : { time: String((it as { time?: string }).time || ''), title: String((it as { title?: string }).title || '') }))
    : [];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2">
          <input className="ad-input" placeholder="09:00" value={it.time} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
          <input className="ad-input" placeholder={t('sessionPlaceholder')} value={it.title} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...items, { time: '', title: '' }])}><Plus className="w-4 h-4" /> {t('session')}</button>
    </div>
  );
}

function BlocksEditor({ value, onChange }: { value: Array<Record<string, unknown>>; onChange: (v: Array<Record<string, unknown>>) => void }) {
  return (
    <div className="space-y-3">
      {value.map((block, i) => (
        <div key={i} className="ad-card p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--ad-muted)' }}>BLOC {i + 1}</span>
            <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></button>
          </div>
          <input className="ad-input" placeholder="Titre" value={String(block.title || '')} onChange={(e) => onChange(value.map((b, j) => (j === i ? { ...b, title: e.target.value } : b)))} />
          <input className="ad-input" placeholder="Sous-titre" value={String(block.subtitle || '')} onChange={(e) => onChange(value.map((b, j) => (j === i ? { ...b, subtitle: e.target.value } : b)))} />
          <textarea className="ad-textarea" placeholder="Description" value={String(block.description || '')} onChange={(e) => onChange(value.map((b, j) => (j === i ? { ...b, description: e.target.value } : b)))} />
          <MediaPicker value={String(block.media || block.image || '')} onChange={(url) => onChange(value.map((b, j) => (j === i ? { ...b, media: url } : b)))} />
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, { title: '', subtitle: '', description: '', media: '' }])}><Plus className="w-4 h-4" /> Bloc</button>
    </div>
  );
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v) return v.split(',').map((s) => s.trim());
  return [];
}
function asFaq(v: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(v)) return [];
  return v.map((it) => ({ q: String((it as { q?: string }).q || ''), a: String((it as { a?: string }).a || '') }));
}
function asRecord(v: unknown): Record<string, string> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val)]));
  }
  return {};
}
function asOptions(v: unknown): Array<{ name: string; choices: string[] }> {
  if (!Array.isArray(v)) return [];
  return v.map((it) => ({ name: String((it as { name?: string }).name || ''), choices: asStringArray((it as { choices?: unknown }).choices) }));
}
function asBlocks(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.map((it) => (it && typeof it === 'object' ? (it as Record<string, unknown>) : { title: String(it) }));
}
