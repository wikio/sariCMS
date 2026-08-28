'use client';

import type { Order, Quote } from '@/lib/crm-store';
import { amountInWords } from '@/lib/number-to-words';

export interface CompanyInfo {
  name: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string;
}

const money = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DA`;

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Structure commune : en-tête société + bloc client + tableau + totaux + montant en lettres + note. */
function documentShell(opts: {
  title: string;
  reference: string;
  date: string;
  validity?: string;
  company: CompanyInfo;
  client: { name: string; email: string; phone?: string; address?: string };
  headers: string[];
  rows: string[][];
  totalLabel: string;
  total: number;
  note?: string;
  status?: string;
}): string {
  const c = opts.company;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)} ${escapeHtml(opts.reference)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a202c; margin: 0; padding: 32px; }
  .page { max-width: 780px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d7a9e; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 44px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0d7a9e; }
  .brand .tag { font-size: 12px; color: #718096; }
  .head .ref { text-align: right; font-size: 12px; color: #4a5568; }
  .head .ref h1 { font-size: 22px; margin: 0 0 4px; color: #1a202c; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 20px 0; font-size: 13px; }
  .meta .box { flex: 1; }
  .meta .box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #0d7a9e; margin: 0 0 6px; }
  .meta .box div { color: #4a5568; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th { background: #edf2f7; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #4a5568; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 320px; margin-top: 16px; font-size: 13px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; color: #4a5568; }
  .totals .grand { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid #0d7a9e; padding-top: 8px; margin-top: 4px; color: #0d7a9e; }
  .letters { margin-top: 20px; padding: 12px 14px; border: 1px dashed #a0aec0; border-radius: 6px; font-size: 13px; }
  .letters b { color: #0d7a9e; }
  .note { margin-top: 16px; font-size: 12px; color: #4a5568; white-space: pre-wrap; }
  .foot { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #a0aec0; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div class="brand">
      ${c.logo ? `<img src="${escapeHtml(c.logo)}" alt="" />` : ''}
      <div>
        <div class="name">${escapeHtml(c.name)}</div>
        ${c.tagline ? `<div class="tag">${escapeHtml(c.tagline)}</div>` : ''}
      </div>
    </div>
    <div class="ref">
      <h1>${escapeHtml(opts.title)}</h1>
      <div>${escapeHtml(opts.reference)}</div>
      ${opts.status ? `<div>Statut : ${escapeHtml(opts.status)}</div>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <h3>Émetteur</h3>
      <div>
        ${escapeHtml(c.name)}<br/>
        ${escapeHtml(c.address || '')}<br/>
        ${c.phone ? `Tél : ${escapeHtml(c.phone)}<br/>` : ''}
        ${c.email ? escapeHtml(c.email) : ''}
      </div>
    </div>
    <div class="box">
      <h3>Client</h3>
      <div>
        ${escapeHtml(opts.client.name)}<br/>
        ${escapeHtml(opts.client.email)}<br/>
        ${opts.client.phone ? `Tél : ${escapeHtml(opts.client.phone)}<br/>` : ''}
        ${opts.client.address ? escapeHtml(opts.client.address) : ''}
      </div>
    </div>
    <div class="box">
      <h3>Document</h3>
      <div>
        Date : ${escapeHtml(opts.date)}<br/>
        ${opts.validity ? `Validité : ${escapeHtml(opts.validity)}<br/>` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead><tr>${opts.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>
      ${opts.rows.map((r) => `<tr>${r.map((cell, i) => `<td class="${i >= opts.headers.length - 1 || cell === '' ? '' : ''}">${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>

  <div class="totals">
    ${opts.totalLabel !== '' ? `<div class="grand"><span>${escapeHtml(opts.totalLabel)}</span><span>${money(opts.total)}</span></div>` : ''}
  </div>

  <div class="letters">
    Arrêté le présent document à la somme de : <b>${escapeHtml(amountInWords(opts.total))}</b>.
  </div>

  ${opts.note ? `<div class="note"><b>Note :</b> ${escapeHtml(opts.note)}</div>` : ''}

  <div class="foot">${escapeHtml(c.name)} — ${escapeHtml(c.address || '')} — Document généré par SARI CMS</div>
</div>
</body>
</html>`;
}

/** Template PDF pour un devis (utilise la réponse détaillée si présente, sinon les lignes de la demande). */
export function quotePdfHtml(quote: Quote, company: CompanyInfo): string {
  const source = quote.response?.mode === 'detailed' && quote.response.lines
    ? quote.response.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount || 0,
      }))
    : (quote.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        discount: it.discount || 0,
      }));

  const rows = source.map((l) => {
    const lineTotal = (l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discount || 0) / 100);
    return [
      escapeHtml(l.name),
      `<span class="num">${l.quantity}</span>`,
      `<span class="num">${money(l.unitPrice)}</span>`,
      `<span class="num">${l.discount ? `-${l.discount}%` : '—'}</span>`,
      `<span class="num">${money(lineTotal)}</span>`,
    ];
  });

  const total = quote.response?.total ?? quote.total ?? 0;

  return documentShell({
    title: 'Devis',
    reference: quote.reference || `DV #${quote.id}`,
    date: quote.date,
    validity: quote.validity || undefined,
    company,
    client: { name: quote.client, email: quote.email, phone: quote.phone, address: quote.address },
    headers: ['Article', 'Qté', 'Prix unit. HT', 'Remise', 'Total HT'],
    rows,
    totalLabel: 'Total TTC',
    total,
    note: quote.note,
    status: quote.status,
  });
}

/** Template PDF pour une commande. */
export function orderPdfHtml(order: Order, company: CompanyInfo): string {
  const rows = (order.items || []).map((it) => {
    const lineTotal = (it.quantity || 0) * (it.price || 0) * (1 - (it.discount || 0) / 100);
    return [
      escapeHtml(it.name),
      `<span class="num">${it.quantity}</span>`,
      `<span class="num">${money(it.price)}</span>`,
      `<span class="num">${it.discount ? `-${it.discount}%` : '—'}</span>`,
      `<span class="num">${money(lineTotal)}</span>`,
    ];
  });

  return documentShell({
    title: 'Commande',
    reference: order.code || `#${order.id}`,
    date: order.date,
    company,
    client: { name: order.client, email: order.email, phone: order.phone, address: order.address },
    headers: ['Article', 'Qté', 'Prix unit. HT', 'Remise', 'Total HT'],
    rows,
    totalLabel: 'Total TTC',
    total: order.total ?? 0,
    note: order.items?.find((i) => i.description)?.description,
    status: order.status,
  });
}

/** Ouvre une fenêtre et lance l'impression (enregistrer en PDF). */
export function printHtml(title: string, html: string): void {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  w.focus();
  setTimeout(() => w.print(), 350);
}
