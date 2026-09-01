'use client';

import { useMemo, useState } from 'react';
import { FileText, ListOrdered, Plus, Trash2, Upload } from 'lucide-react';
import type { Quote, QuoteResponse, QuoteResponseLine } from '@/lib/crm-store';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import { money } from '@/lib/commerce-math';

/**
 * Composeur de réponse à une demande de devis (côté Admin).
 * Deux modes :
 *  - détaillé : reprise des lignes, prix unitaire, qté confirmée, remise & taux de taxe
 *    par ligne, remise globale, frais de livraison — totaux calculés automatiquement ;
 *  - fichier : document joint + commentaire en HTML riche.
 */
export default function QuoteResponseComposer({
  quote,
  onClose,
  onSave,
}: {
  quote: Quote;
  onClose: () => void;
  onSave: (response: QuoteResponse) => void;
}) {
  const [mode, setMode] = useState<'detailed' | 'file'>('detailed');
  const [lines, setLines] = useState<QuoteResponseLine[]>(
    (quote.items || []).map((it) => ({
      name: it.name,
      quantity: it.quantity || 1,
      unitPrice: it.price || 0,
      discount: it.discount || 0,
      taxRate: it.taxRate || 0,
    })),
  );
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [fileUrl, setFileUrl] = useState('');
  const [fileNote, setFileNote] = useState('<p></p>');

  const patchLine = (i: number, patch: Partial<QuoteResponseLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discount || 0) / 100), 0);
    const taxTotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discount || 0) / 100) * ((l.taxRate || 0) / 100), 0);
    const total = subtotal - globalDiscount + taxTotal + deliveryFee;
    return { subtotal, taxTotal, total };
  }, [lines, globalDiscount, deliveryFee]);



  const save = () => {
    if (mode === 'detailed') {
      onSave({
        mode: 'detailed',
        lines,
        subtotal: Math.round(totals.subtotal),
        discount: globalDiscount,
        taxTotal: Math.round(totals.taxTotal),
        deliveryFee,
        total: Math.round(totals.total),
        sentAt: new Date().toISOString(),
      });
    } else {
      onSave({ mode: 'file', fileUrl, fileNote, sentAt: new Date().toISOString() });
    }
  };

  return (
    <div className="ad-modal" onClick={onClose}>
      <div className="ad-modal-card space-y-3" style={{ width: 'min(820px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black flex items-center gap-2"><FileText className="w-4 h-4" /> Répondre au devis {quote.reference || `#${quote.id}`}</h2>

        <div className="flex gap-2">
          <button className={`ad-btn ${mode === 'detailed' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setMode('detailed')}>
            <ListOrdered className="w-4 h-4" /> Réponse détaillée
          </button>
          <button className={`ad-btn ${mode === 'file' ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setMode('file')}>
            <Upload className="w-4 h-4" /> Fichier + commentaire
          </button>
        </div>

        {mode === 'detailed' ? (
          <div className="space-y-3">
            <div className="ad-card overflow-x-auto">
              <table className="ad-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th className="w-24">Qté</th>
                    <th className="w-28">Prix unit. (DA)</th>
                    <th className="w-24">Remise %</th>
                    <th className="w-24">TVA %</th>
                    <th className="w-28 text-right">Total HT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td><input className="ad-input" value={l.name} onChange={(e) => patchLine(i, { name: e.target.value })} /></td>
                      <td><input className="ad-input" type="number" min={1} value={l.quantity} onChange={(e) => patchLine(i, { quantity: Number(e.target.value) })} /></td>
                      <td><input className="ad-input" type="number" min={0} value={l.unitPrice} onChange={(e) => patchLine(i, { unitPrice: Number(e.target.value) })} /></td>
                      <td><input className="ad-input" type="number" min={0} value={l.discount || 0} onChange={(e) => patchLine(i, { discount: Number(e.target.value) })} /></td>
                      <td><input className="ad-input" type="number" min={0} value={l.taxRate || 0} onChange={(e) => patchLine(i, { taxRate: Number(e.target.value) })} /></td>
                      <td className="text-right font-black tabular-nums">{Math.round((l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discount || 0) / 100)).toLocaleString()}</td>
                      <td><button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="ad-btn ad-btn-ghost" onClick={() => setLines((p) => [...p, { name: 'Article', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }])}>
              <Plus className="w-4 h-4" /> Ajouter une ligne
            </button>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Remise globale (DA)</span>
                <input className="ad-input" type="number" min={0} value={globalDiscount} onChange={(e) => setGlobalDiscount(Number(e.target.value))} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Frais de livraison (DA)</span>
                <input className="ad-input" type="number" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} />
              </label>
            </div>

            <div className="ad-card p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Sous-total HT</span><strong>{money(totals.subtotal)}</strong></div>
              {globalDiscount > 0 && <div className="flex justify-between text-green-600"><span>Remise globale</span><strong>- {money(globalDiscount)}</strong></div>}
              <div className="flex justify-between"><span>Total taxes (TVA)</span><strong>{money(totals.taxTotal)}</strong></div>
              {deliveryFee > 0 && <div className="flex justify-between"><span>Livraison</span><strong>{money(deliveryFee)}</strong></div>}
              <div className="flex justify-between text-base pt-2 font-black" style={{ borderTop: '1px solid var(--ad-line)' }}>
                <span>Total TTC</span>
                <span style={{ color: 'var(--ad-accent)' }}>{money(totals.total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Document de devis (PDF, image…)</span>
              <div className="flex items-center gap-2">
                <input type="file" className="hidden" id="qr-file" onChange={(e) => setFileUrl(e.target.files?.[0]?.name || '')} />
                <label htmlFor="qr-file" className="ad-btn ad-btn-ghost cursor-pointer"><Upload className="w-4 h-4" /> Choisir un fichier</label>
                {fileUrl && <span className="text-sm font-bold">{fileUrl}</span>}
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Commentaire / message au client</span>
              <HtmlEditor value={fileNote} onChange={setFileNote} placeholder="Rédigez le commentaire accompagnant le devis…" />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button className="ad-btn ad-btn-ghost" onClick={onClose}>Annuler</button>
          <button className="ad-btn ad-btn-primary" onClick={save}>Enregistrer et envoyer la réponse</button>
        </div>
      </div>
    </div>
  );
}
