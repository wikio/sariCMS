'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, Check, ChevronsUpDown, FolderOpen, GripVertical, Link2, Mail, Phone, Plus, Star, Trash2, Upload,
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

const CURRENCIES = [
  { code: 'DZD', symbol: 'DA' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'MAD', symbol: 'DH' },
  { code: 'TND', symbol: 'DT' },
];

export function FieldShell({ spec, value, origin, originLocale, children }: { spec: FieldSpec; value?: unknown; origin?: unknown; originLocale?: string; children: React.ReactNode }) {
  const len = typeof value === 'string' ? value.length : 0;
  const over = spec.maxLength != null && len > spec.maxLength;
  const originText = origin == null || origin === '' ? '' : typeof origin === 'string' ? origin : JSON.stringify(origin);
  return (
    <div className={`space-y-1.5 ${spec.wide || spec.kind === 'html' || spec.kind === 'process' ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
          {spec.label}
        </span>
        {spec.required
          ? <span className="ad-chip ad-chip-warn">Obligatoire</span>
          : <span className="ad-chip ad-chip-mute">Optionnel</span>}
        {spec.maxLength != null && (
          <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: over ? 'var(--ad-danger)' : 'var(--ad-muted)' }}>
            {len} / {spec.maxLength}
          </span>
        )}
      </div>
      {children}
      {spec.hint && <p className="text-[11px] leading-snug" style={{ color: 'var(--ad-muted)' }}>{spec.hint}</p>}
      {originText && (
        <p className="ad-origin">Origine ({(originLocale || 'défaut').toUpperCase()}) : {originText.replace(/<[^>]+>/g, ' ').slice(0, 280)}</p>
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
  extra: { origin?: unknown; originLocale?: string } = {},
) {
  const ph = spec.placeholder || '';
  const wrap = (node: React.ReactNode) => (
    <FieldShell spec={spec} value={value} origin={extra.origin} originLocale={extra.originLocale}>{node}</FieldShell>
  );
  switch (spec.kind) {
    case 'html':
      return wrap(<HtmlEditor value={String(value || '')} onChange={onChange} placeholder={ph || 'Rédigez le contenu détaillé…'} />);
    case 'slug':
      return wrap(
        <div className="flex gap-2">
          <span className="ad-input !w-auto flex items-center text-xs" style={{ color: 'var(--ad-muted)' }}>/</span>
          <input className="ad-input font-mono" value={String(value || '')} placeholder={ph || 'url-de-la-fiche'} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange(slugify(String(record[spec.slugFrom || 'title'] || record.name || '')))}>Auto</button>
        </div>,
      );
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
    case 'select':
      return wrap(<TaxonomySelect spec={spec} value={String(value || '')} onChange={onChange} />);
    case 'radio':
      return wrap(
        <div className="flex flex-wrap gap-2">
          {(spec.options || []).map((o) => (
            <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`ad-btn ${String(value) === o.value ? 'ad-btn-primary' : 'ad-btn-ghost'}`}>
              {o.label}
            </button>
          ))}
        </div>,
      );
    case 'toggle':
      return wrap(
        <button type="button" onClick={() => onChange(!value)} className={`ad-btn ${value ? 'ad-btn-lime' : 'ad-btn-ghost'}`}>
          {value ? <Check className="w-4 h-4" /> : null} {value ? 'Oui' : 'Non'}
        </button>,
      );
    case 'textarea':
      return wrap(
        <textarea className="ad-textarea min-h-[90px]" placeholder={ph || 'Saisissez le texte…'} maxLength={spec.maxLength} value={String(value || '')} onChange={(e) => onChange(e.target.value)} />,
      );
    case 'image':
      return wrap(<MediaPicker value={String(value || '')} onChange={onChange} />);
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
            <input className="ad-input" placeholder={ph || `Saisir ${spec.label.toLowerCase()}…`} maxLength={spec.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        ) : (
          <div className="relative">
            <input className={`ad-input ${spec.suffix ? 'pr-12' : ''}`} placeholder={ph || `Saisir ${spec.label.toLowerCase()}…`} maxLength={spec.maxLength} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
            {spec.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--ad-muted)' }}>{spec.suffix}</span>}
          </div>
        ),
      );
  }
}

function TaxonomySelect({ spec, value, onChange }: { spec: FieldSpec; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [tick, setTick] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onTax = () => setTick((n) => n + 1);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('sari-taxonomies', onTax);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('sari-taxonomies', onTax);
    };
  }, []);

  const options = useMemo(() => {
    const tax = spec.taxonomy ? listTaxonomy(spec.taxonomy) : [];
    const base = [...(spec.options || [])];
    for (const t of tax) {
      if (!base.some((o) => o.value === t.value)) base.push(t);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.options, spec.taxonomy, tick]);

  const filtered = options.filter((o) => {
    const blob = `${o.label} ${o.value}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });
  const current = options.find((o) => o.value === value);

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
            <span className={current ? '' : 'opacity-50'}>{current?.label || spec.placeholder || 'Sélectionner…'}</span>
            <ChevronsUpDown className="w-4 h-4 opacity-50" />
          </button>
          {open && (
            <div className="ad-combo-list">
              <div className="p-2">
                <input
                  autoFocus
                  className="ad-input"
                  placeholder="Rechercher…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ad-combo-item ${o.value === value ? 'is-on font-bold' : ''}`}
                  onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-2 text-xs" style={{ color: 'var(--ad-muted)' }}>Aucun résultat</div>}
            </div>
          )}
        </div>
        {spec.taxonomy && (
          adding ? (
            <div className="flex gap-1">
              <input className="ad-input w-40" placeholder="Nouveau…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
              <button type="button" className="ad-btn ad-btn-primary" onClick={create}>OK</button>
            </div>
          ) : (
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> Nouveau
            </button>
          )
        )}
      </div>
  );
}

function PriceInner({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const match = value.match(/^([\d\s.,]+)\s*(.*)$/);
  const amount = match?.[1]?.trim() || '';
  const curr = CURRENCIES.find((c) => value.includes(c.symbol) || value.includes(c.code)) || CURRENCIES[0];
  return (
      <div className="flex gap-2">
        <div className="ad-search flex-1">
          <Banknote className="ad-search-ico w-4 h-4" style={{ color: 'var(--ad-accent-2)' }} />
          <input className="ad-input" value={amount} onChange={(e) => onChange(`${e.target.value} ${curr.symbol}`.trim())} placeholder={placeholder || '0'} />
        </div>
        <select
          className="ad-select w-32"
          value={curr.code}
          onChange={(e) => {
            const next = CURRENCIES.find((c) => c.code === e.target.value) || curr;
            onChange(`${amount} ${next.symbol}`.trim());
          }}
        >
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
        </select>
      </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value);
  const hits = searchLucideIcons(q || value, 36);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="w-11 h-11 flex items-center justify-center" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface-2)' }}>
          <IconMark name={value} className="w-5 h-5" />
        </div>
        <div className="ad-search flex-1">
          <input className="ad-input" style={{ paddingLeft: '0.8rem' }} value={q} placeholder="Rechercher une icône Lucide…" onChange={(e) => {
            setQ(e.target.value);
          }} />
        </div>
      </div>
      <div className="ad-icon-grid">
        {hits.map((name) => (
          <button key={name} type="button" className={`ad-combo-item items-center gap-2 ${name === value ? 'is-on font-bold' : ''}`} onClick={() => { onChange(name); setQ(name); }}>
            <IconMark name={name} className="w-4 h-4" />
            <span className="truncate">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProcessEditor({ value, onChange }: { value: ReturnType<typeof normalizeSteps>; onChange: (v: unknown) => void }) {
  const set = (next: typeof value) => onChange(next);
  return (
    <div className="space-y-3">
      <ProcessFlow steps={value} />
      {value.map((step, i) => (
        <div key={step.id || i} className="grid md:grid-cols-[1fr_1fr_auto] gap-2">
          <input className="ad-input" placeholder={`Étape ${i + 1}`} value={step.label} onChange={(e) => set(value.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))} />
          <input className="ad-input" placeholder="Détail / responsable" value={step.detail || ''} onChange={(e) => set(value.map((s, j) => (j === i ? { ...s, detail: e.target.value } : s)))} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => set(value.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => set([...value, { id: `s-${Date.now()}`, label: `Étape ${value.length + 1}` }])}><Plus className="w-4 h-4" /> Étape</button>
    </div>
  );
}

async function uploadOriginal(file: File, moduleName = 'ged') {
  const body = new FormData();
  body.append('file', file);
  body.append('module', moduleName);
  body.append('label', file.name);
  const res = await fetch('/api/admin/upload', { method: 'POST', body });
  const json = await res.json();
  return json.url as string | undefined;
}

export function MediaPicker({ value, onChange, moduleName = 'ged' }: { value: string; onChange: (v: string) => void; moduleName?: string }) {
  const [busy, setBusy] = useState(false);
  const [ged, setGed] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadOriginal(file, moduleName);
      if (url) onChange(url);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="ad-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou /uploads/…" />
        <label className="ad-btn ad-btn-ghost cursor-pointer">
          <Upload className="w-4 h-4" /> {busy ? '…' : 'Fichier'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setGed(true)}><FolderOpen className="w-4 h-4" /> GED</button>
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

function ListEditor({ value, onChange, placeholder = 'Élément' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
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
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, ''])}><Plus className="w-4 h-4" /> Ajouter</button>
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: Array<{ q: string; a: string }>; onChange: (v: Array<{ q: string; a: string }>) => void }) {
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
            <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--ad-muted)' }}>Q{i + 1}</span>
            <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></button>
          </div>
          <input className="ad-input" placeholder="Question" value={item.q} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))} />
          <textarea className="ad-textarea" placeholder="Réponse" value={item.a} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, a: e.target.value } : v)))} />
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...value, { q: '', a: '' }])}><Plus className="w-4 h-4" /> Question</button>
    </div>
  );
}

function SpecsEditor({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value);
  const set = (next: Array<[string, string]>) => onChange(Object.fromEntries(next.filter(([k]) => k)));
  return (
    <div id="specs" className="space-y-2 scroll-mt-28">
      {entries.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>Aucune spécification. Ajoutez une ligne pour commencer.</p>
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
  const items = Array.isArray(value)
    ? value.map((it) => (typeof it === 'string' ? { time: '', title: it } : { time: String((it as { time?: string }).time || ''), title: String((it as { title?: string }).title || '') }))
    : [];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2">
          <input className="ad-input" placeholder="09:00" value={it.time} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
          <input className="ad-input" placeholder="Session" value={it.title} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange([...items, { time: '', title: '' }])}><Plus className="w-4 h-4" /> Session</button>
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
