'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle, ArrowLeft, Calendar, Check, ChevronLeft, ChevronRight, Copy, FileText,
  MapPin, Package, Plus, Search, Send, Trash2, Mail, Phone, Globe, ShoppingCart, Upload,
} from 'lucide-react';
import { getProducts } from '@/lib/data';
import type { Product } from '@/types';
import type { User } from '@/contexts/AuthContext';
import {
  loadQuotes, saveQuotes, type CommerceItem, type Quote,
} from '@/lib/crm-store';
import {
  QUOTE_NATURES, QUOTE_UNITS, generateQuoteReference, loadClientQuotes, nextQuoteId,
  quoteStatusColor, quoteStatusLabel,
} from '@/lib/quote-requests';
import { loadAdminSettings } from '@/lib/admin-settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

type Line = CommerceItem;

export default function QuoteRequestModule({ user, locale }: { user: User; locale: string }) {
  const t = useTranslations('pages.quoteRequest');
  const [view, setView] = useState<'list' | 'wizard' | 'detail'>('list');
  const [requests, setRequests] = useState<Quote[]>([]);
  const [detail, setDetail] = useState<Quote | null>(null);

  const refresh = () => setRequests(loadClientQuotes(user.email));

  useEffect(() => { refresh(); }, [user.email]);

  if (view === 'wizard') {
    return (
      <QuoteWizard
        user={user}
        locale={locale}
        onCancel={() => setView('list')}
        onDone={() => { refresh(); setView('list'); }}
      />
    );
  }

  if (view === 'detail' && detail) {
    return <QuoteDetail quote={detail} onBack={() => setView('list')} onRefresh={refresh} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
            <FileText className="w-6 h-6 text-sari-blue" /> {t('title')} ({requests.length})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <button onClick={() => setView('wizard')} className="btn-primary text-white px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('newRequest')}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noRequests')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('noRequestsDesc')}</p>
          <button onClick={() => setView('wizard')} className="btn-primary text-white px-6 py-3 inline-block font-semibold rounded-lg">
            {t('newRequest')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((q) => (
            <div key={q.id} className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-mono text-xs text-gray-400">{q.reference || `#${q.id}`} · {new Date(q.date).toLocaleDateString()}</div>
                  <div className="font-bold text-sari-dark dark:text-white">{q.items.length} {t('lines')}</div>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${quoteStatusColor(q.status)}`}>{quoteStatusLabel(q.status)}</span>
              </div>
              {q.nature && <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('nature')} : {q.nature === 'autre' ? q.natureOther : q.nature}</div>}
              <div className="flex gap-2">
                <button onClick={() => { setDetail(q); setView('detail'); }} className="text-sari-blue font-semibold hover:underline text-sm">{t('view')}</button>
                <button onClick={() => {
                  const copy: Quote = { ...q, id: nextQuoteId(), reference: generateQuoteReference(loadQuotes()), status: 'draft', date: new Date().toISOString().slice(0, 10), history: [{ status: 'draft', at: new Date().toISOString(), note: t('duplicatedFrom') }] };
                  saveQuotes([...loadQuotes(), copy]);
                  refresh();
                }} className="text-sari-blue font-semibold hover:underline text-sm inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> {t('duplicate')}</button>
                {['draft', 'submitted'].includes(q.status) && (
                  <button onClick={() => { saveQuotes(loadQuotes().map((x) => x.id === q.id ? { ...x, status: 'cancelled', history: [...(x.history || []), { status: 'cancelled', at: new Date().toISOString() }] } : x)); refresh(); }} className="text-red-500 hover:underline text-sm">{t('cancel')}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ Wizard ============================ */

function QuoteWizard({ user, locale, onCancel, onDone }: { user: User; locale: string; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations('pages.quoteRequest');
  const [step, setStep] = useState(1);

  // Produits
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogQ, setCatalogQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  // Détails
  const [nature, setNature] = useState('');
  const [natureOther, setNatureOther] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [note, setNote] = useState('');

  // Coordonnées
  const [contact, setContact] = useState({
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || '',
    country: user.country || 'Algérie',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProducts(locale).then(setProducts);
  }, [locale]);

  const catalogResults = useMemo(() => {
    const q = catalogQ.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 12);
  }, [products, catalogQ]);

  const maxLines = loadAdminSettings().quote.maxLines;
  const limitReached = maxLines > 0 && lines.length >= maxLines;

  const addCatalog = (p: Product) => {
    setLines((prev) => {
      const existing = prev.find((l) => String(l.id) === String(p.id));
      if (existing) return prev.map((l) => String(l.id) === String(p.id) ? { ...l, quantity: l.quantity + 1 } : l);
      if (maxLines > 0 && prev.length >= maxLines) { setErrors((e) => ({ ...e, step1: t('errLineLimit') })); return prev; }
      return [...prev, { id: p.id, name: p.name, quantity: 1, price: 0, category: p.category, unit: 'pièce', description: '' }];
    });
    setCatalogQ('');
  };

  const addSpecial = () => {
    if (maxLines > 0 && lines.length >= maxLines) { setErrors((e) => ({ ...e, step1: t('errLineLimit') })); return; }
    setLines((prev) => [...prev, { id: `sp-${Date.now()}`, name: '', quantity: 1, price: 0, category: 'special', unit: 'pièce', description: '' }]);
  };

  const patchLine = (id: number | string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => String(l.id) === String(id) ? { ...l, ...patch } : l));
  };

  const removeLine = (id: number | string) => setLines((prev) => prev.filter((l) => String(l.id) !== String(id)));

  const validateStep = (s: number): Record<string, string> => {
    const out: Record<string, string> = {};
    if (s === 1) {
      if (lines.length === 0) out.step1 = t('errNoLines');
      else lines.forEach((l, i) => {
        if (!String(l.name || '').trim()) out[`line-${i}-name`] = t('errNameRequired');
        if (!l.quantity || l.quantity < 1) out[`line-${i}-qty`] = t('errQty');
        if (l.category === 'special' && loadAdminSettings().quote.requireAttachment && !l.attachment) out[`line-${i}-att`] = t('errAttachment');
      });
    }
    if (s === 2) {
      if (!nature) out.nature = t('errNature');
      if (nature === 'autre' && !natureOther.trim()) out.natureOther = t('errNatureOther');
    }
    if (s === 3) {
      if (contact.phone && !PHONE_RE.test(contact.phone.trim())) out.phone = t('errPhone');
      if (!EMAIL_RE.test(contact.email.trim())) out.email = t('errEmail');
    }
    return out;
  };

  const next = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  };

  const back = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const persist = (status: Quote['status']): Quote => {
    const quote: Quote = {
      id: nextQuoteId(),
      client: user.name,
      email: contact.email,
      phone: contact.phone,
      company: user.company,
      date: new Date().toISOString().slice(0, 10),
      status,
      total: 0,
      validity: '',
      items: lines.map((l) => ({ ...l })),
      reference: generateQuoteReference(loadQuotes()),
      nature,
      natureOther: nature === 'autre' ? natureOther : undefined,
      note,
      desiredDate,
      address: contact.address,
      country: contact.country,
      history: [{ status, at: new Date().toISOString(), note: status === 'draft' ? t('savedAsDraft') : t('submitted') }],
    };
    saveQuotes([...loadQuotes(), quote]);
    return quote;
  };

  const submit = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    persist('submitted');
    setTimeout(() => { setSaving(false); onDone(); }, 400);
  };

  const saveDraft = () => {
    persist('draft');
    onDone();
  };

  const inputCls = (key: string) =>
    `w-full px-4 py-3 border rounded-lg outline-none transition-colors dark:bg-[#111111] dark:text-white ${errors[key] ? 'border-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-sari-blue'}`;

  const FieldError = ({ k }: { k: string }) => errors[k] ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors[k]}</p>
  ) : null;

  const stepsLabels = [t('stepProducts'), t('stepDetails'), t('stepContact'), t('stepRecap')];

  return (
    <div className="space-y-6">
      {/* Progression */}
      <div>
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-gray-500 hover:text-sari-dark dark:hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </button>
        <div className="flex items-center gap-2">
          {stepsLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-sari-blue text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                    {done ? <Check className="w-4 h-4" /> : n}
                  </span>
                  <span className={`text-xs font-semibold hidden sm:inline ${active ? 'text-sari-blue' : 'text-gray-500'}`}>{label}</span>
                </div>
                {n < 4 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-1">{t('stepProducts')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('stepProductsDesc')}</p>
            </div>

            {/* Recherche catalogue */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={catalogQ} onChange={(e) => setCatalogQ(e.target.value)} placeholder={t('searchCatalog')}
                className="pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg w-full outline-none focus:border-sari-blue" />
              {catalogQ.trim() && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                  {catalogResults.length === 0 && <div className="p-3 text-sm text-gray-500">{t('noResults')}</div>}
                  {catalogResults.map((p) => (
                    <button key={p.id} onClick={() => addCatalog(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3">
                      {p.image ? <img src={p.image} alt="" className="w-9 h-9 object-cover rounded" /> : <Package className="w-9 h-9 text-gray-400" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-sari-dark dark:text-white truncate">{p.name}</span>
                        <span className="block text-xs text-gray-500">{p.category} · {p.price}</span>
                      </span>
                      <Plus className="w-4 h-4 text-sari-blue shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lignes */}
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={String(l.id)} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-sari-blue shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{l.category === 'special' ? t('special') : t('catalog')}</span>
                    <button onClick={() => removeLine(l.id)} className="ml-auto text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <input value={l.name} onChange={(e) => patchLine(l.id, { name: e.target.value })} placeholder={t('productName')}
                        className={inputCls(`line-${i}-name`)} />
                      <FieldError k={`line-${i}-name`} />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input type="number" min={1} value={l.quantity} onChange={(e) => patchLine(l.id, { quantity: Number(e.target.value) })}
                          placeholder={t('quantity')} className={inputCls(`line-${i}-qty`)} />
                        <FieldError k={`line-${i}-qty`} />
                      </div>
                      <select value={l.unit || 'pièce'} onChange={(e) => patchLine(l.id, { unit: e.target.value })} className="ad-select w-28">
                        {QUOTE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <input value={l.description || ''} onChange={(e) => patchLine(l.id, { description: e.target.value })} placeholder={t('description')} className="ad-input" />
                  {l.category === 'special' && (
                    <div>
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <input type="file" className="hidden" onChange={(e) => { patchLine(l.id, { attachment: e.target.files?.[0]?.name || '' }); setErrors((p) => { const { [`line-${i}-att`]: _x, ...rest } = p; return rest; }); }} />
                        {l.attachment || t('attachFile')}
                      </label>
                      <FieldError k={`line-${i}-att`} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addSpecial} className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg py-3 text-gray-500 hover:border-sari-blue hover:text-sari-blue transition-colors inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> {t('addSpecial')}
            </button>
            <FieldError k="step1" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-sari-dark dark:text-white">{t('stepDetails')}</h3>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('nature')} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUOTE_NATURES.map((n) => (
                  <button key={n.value} onClick={() => { setNature(n.value); setErrors((p) => { const { nature: _n, ...r } = p; return r; }); }}
                    className={`p-3 border-2 rounded-lg text-sm font-semibold transition-colors ${nature === n.value ? 'border-sari-blue bg-sari-blue/5 text-sari-blue' : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-sari-blue'}`}>
                    {n.label}
                  </button>
                ))}
              </div>
              <FieldError k="nature" />
              {nature === 'autre' && (
                <div className="mt-2">
                  <input value={natureOther} onChange={(e) => setNatureOther(e.target.value)} placeholder={t('natureOther')} className={inputCls('natureOther')} />
                  <FieldError k="natureOther" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-sari-blue" /> {t('desiredDate')}</label>
              <input type="date" value={desiredDate} onChange={(e) => setDesiredDate(e.target.value)} className="ad-input" />
            </div>
            <div>
              <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2">{t('note')}</label>
              <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} className="ad-textarea" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-sari-dark dark:text-white">{t('stepContact')}</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2"><Phone className="w-4 h-4 text-sari-blue" /> {t('phone')}</label>
                <input value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); setErrors((p) => { const { phone: _n, ...r } = p; return r; }); }} className={inputCls('phone')} />
                <FieldError k="phone" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2"><Mail className="w-4 h-4 text-sari-blue" /> {t('email')} <span className="text-red-500">*</span></label>
                <input type="email" value={contact.email} onChange={(e) => { setContact({ ...contact, email: e.target.value }); setErrors((p) => { const { email: _n, ...r } = p; return r; }); }} className={inputCls('email')} />
                <FieldError k="email" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-sari-blue" /> {t('address')}</label>
                <input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} className="ad-input" />
              </div>
              <div>
                <label className="block text-sm font-bold text-sari-dark dark:text-white mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-sari-blue" /> {t('country')}</label>
                <input value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value })} className="ad-input" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-sari-dark dark:text-white">{t('stepRecap')}</h3>
            {/* Récapitulatif */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-3 py-2">{t('product')}</th>
                    <th className="text-right px-3 py-2">{t('quantity')}</th>
                    <th className="text-left px-3 py-2">{t('unit')}</th>
                    <th className="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={String(l.id)} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 text-sari-dark dark:text-white">{l.name}</td>
                      <td className="px-3 py-2 text-right">{l.quantity}</td>
                      <td className="px-3 py-2">{l.unit}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => { setStep(1); }} className="text-sari-blue text-xs hover:underline">{t('edit')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('nature')} :</span> <strong>{nature === 'autre' ? natureOther : nature}</strong></div>
              <div><span className="text-gray-500">{t('desiredDate')} :</span> <strong>{desiredDate || '—'}</strong></div>
              <div><span className="text-gray-500">{t('email')} :</span> <strong>{contact.email}</strong></div>
              <div><span className="text-gray-500">{t('phone')} :</span> <strong>{contact.phone || '—'}</strong></div>
            </div>
            {note && <p className="text-sm text-gray-500"><span className="font-bold">{t('note')} :</span> {note}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-5 border-t border-gray-200 dark:border-gray-800 mt-5">
          <button onClick={back} disabled={step === 1} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> {t('previous')}
          </button>
          <div className="flex gap-2">
            {step === 4 && (
              <button onClick={saveDraft} className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">{t('saveDraft')}</button>
            )}
            {step < 4 ? (
              <button onClick={next} className="inline-flex items-center gap-2 bg-sari-blue text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-sari-blue/90">
                {t('next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 bg-sari-lime text-sari-dark px-6 py-2.5 rounded-lg font-semibold disabled:opacity-50">
                <Send className="w-4 h-4" /> {saving ? '…' : t('send')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ Détail ============================ */

function QuoteDetail({ quote, onBack, onRefresh }: { quote: Quote; onBack: () => void; onRefresh: () => void }) {
  const t = useTranslations('pages.quoteRequest');

  const action = (status: Quote['status'], note?: string) => {
    saveQuotes(loadQuotes().map((q) => q.id === quote.id ? { ...q, status, history: [...(q.history || []), { status, at: new Date().toISOString(), note }] } : q));
    onRefresh();
  };

  const printQuote = () => {
    const resp = quote.response;
    const linesHtml = resp?.mode === 'detailed' && resp.lines
      ? resp.lines.map((l) => `<tr><td>${l.name}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${(l.unitPrice || 0).toFixed(2)}</td><td style="text-align:right">${((l.quantity || 0) * (l.unitPrice || 0)).toFixed(2)}</td></tr>`).join('')
      : '';
    const totalsHtml = resp?.mode === 'detailed'
      ? `<div style="margin-top:12px;text-align:right">
           <div>Sous-total HT : ${(resp.subtotal || 0).toFixed(2)} DA</div>
           ${resp.discount ? `<div>Remise : -${(resp.discount).toFixed(2)} DA</div>` : ''}
           <div>Taxes : ${(resp.taxTotal || 0).toFixed(2)} DA</div>
           ${resp.deliveryFee ? `<div>Livraison : ${(resp.deliveryFee).toFixed(2)} DA</div>` : ''}
           <div style="font-weight:bold;font-size:18px;margin-top:8px">Total TTC : ${(resp.total || 0).toFixed(2)} DA</div>
         </div>`
      : '';
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${quote.reference || `Devis #${quote.id}`}</title>
      <style>body{font-family:sans-serif;color:#111;padding:32px;max-width:760px;margin:auto}h1{font-size:22px}h2{font-size:15px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ddd;padding:6px 8px;font-size:13px}th{background:#f4f4f4;text-align:left}.meta{color:#555;font-size:13px}</style></head><body>
      <h1>${quote.reference || `Devis #${quote.id}`}</h1>
      <div class="meta">${quote.client} · ${quote.email}<br/>Date : ${quote.date}</div>
      ${resp?.mode === 'detailed' ? `<h2>Détail de l'offre</h2><table><thead><tr><th>Article</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr></thead><tbody>${linesHtml}</tbody></table>${totalsHtml}` : ''}
      ${resp?.mode === 'file' ? `<h2>Commentaire</h2><div>${resp.fileNote || ''}</div>` : ''}
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-sari-dark dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> {t('back')}
      </button>
      <div className="bg-white dark:bg-[#1a1a1a] p-6 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="font-mono text-xs text-gray-400">{quote.reference || `#${quote.id}`}</div>
            <h3 className="text-xl font-bold text-sari-dark dark:text-white">{t('title')}</h3>
          </div>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${quoteStatusColor(quote.status)}`}>{quoteStatusLabel(quote.status)}</span>
        </div>

        {/* Réponse Admin */}
        {quote.response && (quote.status === 'replied' || quote.status === 'revision' || quote.status === 'accepted' || quote.status === 'rejected') && (
          <div className="mb-5 border border-sari-blue/30 rounded-lg p-4 bg-sari-blue/5">
            <h4 className="font-bold text-sari-dark dark:text-white mb-2">{t('response')}</h4>
            {quote.response.mode === 'detailed' && quote.response.lines ? (
              <div className="space-y-3">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-left">
                    <tr><th>{t('product')}</th><th className="text-right">{t('quantity')}</th><th className="text-right">{t('unitPrice')}</th><th className="text-right">{t('lineTotal')}</th></tr>
                  </thead>
                  <tbody>
                    {quote.response.lines.map((l, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-1.5 text-sari-dark dark:text-white">{l.name}</td>
                        <td className="py-1.5 text-right">{l.quantity}</td>
                        <td className="py-1.5 text-right">{l.unitPrice.toFixed(2)}</td>
                        <td className="py-1.5 text-right font-semibold">{(l.quantity * l.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-sm space-y-1 border-t border-gray-200 dark:border-gray-800 pt-2">
                  <div className="flex justify-between"><span className="text-gray-500">{t('subtotal')}</span><span>{(quote.response.subtotal || 0).toFixed(2)}</span></div>
                  {quote.response.discount ? <div className="flex justify-between text-green-600"><span>{t('discount')}</span><span>-{(quote.response.discount).toFixed(2)}</span></div> : null}
                  <div className="flex justify-between"><span className="text-gray-500">{t('taxes')}</span><span>{(quote.response.taxTotal || 0).toFixed(2)}</span></div>
                  {quote.response.deliveryFee ? <div className="flex justify-between"><span className="text-gray-500">{t('delivery')}</span><span>{(quote.response.deliveryFee).toFixed(2)}</span></div> : null}
                  <div className="flex justify-between font-bold text-lg text-sari-dark dark:text-white pt-1"><span>{t('totalTtc')}</span><span className="text-sari-lime">{(quote.response.total || 0).toFixed(2)}</span></div>
                </div>
                <button onClick={printQuote} className="btn-primary text-white px-4 py-2 text-sm rounded-lg">{t('downloadPdf')}</button>
              </div>
            ) : (
              <div className="space-y-2">
                {quote.response.fileNote && <div className="prose dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: quote.response.fileNote }} />}
                {quote.response.fileUrl && <a href={quote.response.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-white px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2"><FileText className="w-4 h-4" /> {t('downloadFile')}</a>}
              </div>
            )}
          </div>
        )}

        {/* Lignes de la demande */}
        <div className="space-y-1 mb-4">
          {quote.items.map((it) => (
            <div key={String(it.id)} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-sari-dark dark:text-white">{it.name}{it.unit ? <span className="text-gray-400 text-xs"> · {it.unit}</span> : null}</span>
              <span className="text-gray-500">× {it.quantity}</span>
            </div>
          ))}
        </div>

        {quote.note && <p className="text-sm text-gray-500 mb-3"><span className="font-bold">{t('note')} :</span> {quote.note}</p>}

        {/* Actions */}
        {quote.status === 'replied' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => action('accepted')} className="btn-primary text-white px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2"><Check className="w-4 h-4" /> {t('accept')}</button>
            <button onClick={() => action('rejected')} className="px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-500 rounded-lg text-sm">{t('refuse')}</button>
            <button onClick={() => action('revision', t('revisionAsked'))} className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm">{t('requestRevision')}</button>
          </div>
        )}

        {/* Historique */}
        {(quote.history?.length || 0) > 0 && (
          <div className="mt-5">
            <h4 className="font-bold text-sari-dark dark:text-white mb-2 text-sm">{t('history')}</h4>
            <ul className="space-y-1 text-sm text-gray-500">
              {quote.history!.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400">{new Date(h.at).toLocaleString()}</span>
                  <span className="font-semibold">{quoteStatusLabel(h.status as Quote['status'])}</span>
                  {h.note && <span>· {h.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
