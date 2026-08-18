'use client';

import { useState } from 'react';
import {
  AtSign, Banknote, Check, GripVertical, ImagePlus, Link2, Mail, Phone, Plus, Star, Trash2, Upload,
} from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { FieldSpec } from '@/lib/cms-modules';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';

const CURRENCIES = [
  { code: 'DZD', symbol: 'DA' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'MAD', symbol: 'DH' },
  { code: 'TND', symbol: 'DT' },
];

export function FieldLabel({ spec, children }: { spec: FieldSpec; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1.5 ${spec.wide ? 'md:col-span-2' : ''}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{spec.label}</span>
      {children}
      {spec.hint && <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{spec.hint}</span>}
    </label>
  );
}

export function renderField(spec: FieldSpec, value: unknown, onChange: (v: unknown) => void, record: Record<string, unknown>) {
  switch (spec.kind) {
    case 'html':
      return <FieldLabel spec={spec}><HtmlEditor value={String(value || '')} onChange={onChange} /></FieldLabel>;
    case 'slug':
      return (
        <FieldLabel spec={spec}>
          <div className="flex gap-2">
            <span className="ad-input !w-auto flex items-center text-xs" style={{ color: 'var(--ad-muted)' }}>/</span>
            <input className="ad-input font-mono" value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => onChange(slugify(String(record[spec.slugFrom || 'title'] || record.name || '')))}>Auto</button>
          </div>
        </FieldLabel>
      );
    case 'email':
      return (
        <FieldLabel spec={spec}>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-accent)' }} />
            <input className="ad-input pl-9" type="email" value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        </FieldLabel>
      );
    case 'phone':
      return (
        <FieldLabel spec={spec}>
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-accent)' }} />
            <input className="ad-input pl-9" value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        </FieldLabel>
      );
    case 'url':
      return (
        <FieldLabel spec={spec}>
          <div className="relative">
            <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-accent)' }} />
            <input className="ad-input pl-9" value={String(value || '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        </FieldLabel>
      );
    case 'price':
      return <PriceField spec={spec} value={String(value || '')} onChange={onChange} />;
    case 'select':
      return (
        <FieldLabel spec={spec}>
          <select className="ad-select" value={String(value || '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(spec.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FieldLabel>
      );
    case 'radio':
      return (
        <FieldLabel spec={spec}>
          <div className="flex flex-wrap gap-2">
            {(spec.options || []).map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`ad-btn ${String(value) === o.value ? 'ad-btn-primary' : 'ad-btn-ghost'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </FieldLabel>
      );
    case 'toggle':
      return (
        <FieldLabel spec={spec}>
          <button type="button" onClick={() => onChange(!value)} className={`ad-btn ${value ? 'ad-btn-lime' : 'ad-btn-ghost'}`}>
            {value ? <Check className="w-4 h-4" /> : null} {value ? 'Oui' : 'Non'}
          </button>
        </FieldLabel>
      );
    case 'textarea':
      return <FieldLabel spec={spec}><textarea className="ad-textarea min-h-[90px]" value={String(value || '')} onChange={(e) => onChange(e.target.value)} /></FieldLabel>;
    case 'image':
      return <FieldLabel spec={spec}><MediaPicker value={String(value || '')} onChange={onChange} /></FieldLabel>;
    case 'gallery':
      return <FieldLabel spec={spec}><GalleryEditor value={asStringArray(value)} onChange={onChange} /></FieldLabel>;
    case 'faq':
      return <FieldLabel spec={spec}><FaqEditor value={asFaq(value)} onChange={onChange} /></FieldLabel>;
    case 'list':
      return <FieldLabel spec={spec}><ListEditor value={asStringArray(value)} onChange={onChange} /></FieldLabel>;
    case 'tags':
      return <FieldLabel spec={spec}><ListEditor value={asStringArray(value)} onChange={onChange} placeholder="Tag" /></FieldLabel>;
    case 'specs':
      return <FieldLabel spec={spec}><SpecsEditor value={asRecord(value)} onChange={onChange} /></FieldLabel>;
    case 'options':
      return <FieldLabel spec={spec}><OptionsEditor value={asOptions(value)} onChange={onChange} /></FieldLabel>;
    case 'agenda':
      return <FieldLabel spec={spec}><AgendaEditor value={value} onChange={onChange} /></FieldLabel>;
    case 'slides':
    case 'sections':
      return <FieldLabel spec={spec}><BlocksEditor value={asBlocks(value)} onChange={onChange} /></FieldLabel>;
    case 'rating':
      return (
        <FieldLabel spec={spec}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => onChange(n)}>
                <Star className="w-5 h-5" fill={n <= Number(value || 0) ? 'var(--ad-warn)' : 'transparent'} color="var(--ad-warn)" />
              </button>
            ))}
          </div>
        </FieldLabel>
      );
    case 'icon':
    case 'text':
    default:
      return (
        <FieldLabel spec={spec}>
          <div className="relative">
            {spec.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--ad-muted)' }}>{spec.prefix}</span>}
            <input className={`ad-input ${spec.prefix ? 'pl-12' : ''} ${spec.suffix ? 'pr-12' : ''}`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
            {spec.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--ad-muted)' }}>{spec.suffix}</span>}
          </div>
        </FieldLabel>
      );
  }
}

function PriceField({ spec, value, onChange }: { spec: FieldSpec; value: string; onChange: (v: string) => void }) {
  const match = value.match(/^([\d\s.,]+)\s*(.*)$/);
  const amount = match?.[1]?.trim() || '';
  const curr = CURRENCIES.find((c) => value.includes(c.symbol) || value.includes(c.code)) || CURRENCIES[0];
  return (
    <FieldLabel spec={spec}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Banknote className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-accent-2)' }} />
          <input className="ad-input pl-9" value={amount} onChange={(e) => onChange(`${e.target.value} ${curr.symbol}`.trim())} placeholder="0" />
        </div>
        <select
          className="ad-select w-28"
          value={curr.code}
          onChange={(e) => {
            const next = CURRENCIES.find((c) => c.code === e.target.value) || curr;
            onChange(`${amount} ${next.symbol}`.trim());
          }}
        >
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
        </select>
      </div>
    </FieldLabel>
  );
}

export function MediaPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const json = await res.json();
      if (json.url) onChange(json.url);
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
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {value && (
        <div className="h-32 rounded-xl overflow-hidden pixel-frame">
          <img src={value} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

function GalleryEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {value.map((src, i) => (
          <div key={`${src}-${i}`} className="relative group pixel-frame rounded-lg overflow-hidden h-24">
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
    <div className="space-y-2">
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
