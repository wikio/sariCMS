'use client';

import type { Order, Quote } from '@/lib/crm-store';
import { amountInWords } from '@/lib/number-to-words';
import { defaultCurrency } from '@/lib/currencies';

export interface CompanyInfo {
  name: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo?: string;
}

function currencyWord(): string {
  const [word] = defaultCurrency().name.trim().toLowerCase().split(/\s+/);
  return word || 'dinar';
}

const money = (n: number) => {
  const v = Number(n) || 0;
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${defaultCurrency().symbol}`;
};

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Génère un barcode SVG simple (Code128-like visuel) à partir du code complet */
function barcodeSvg(code: string): string {
  const c = String(code || '').trim() || 'CODE';
  // Pattern binaire basé sur les charCodes
  let bits = '';
  for (let i = 0; i < c.length; i++) {
    const cc = c.charCodeAt(i);
    for (let b = 7; b >= 0; b--) bits += ((cc >> b) & 1) ? '1' : '0';
  }
  // assure au moins 96 bits pour un rendu stable
  bits = bits.padEnd(96, '1010').slice(0, 96);
  const barW = 2;
  const W = bits.length * barW;
  const H = 42;
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code-barres ${escapeHtml(c)}">`;
  svg += `<rect width="${W}" height="${H}" fill="white"/>`;
  let x = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') svg += `<rect x="${x}" y="6" width="${barW}" height="${H - 14}" fill="#0f172a"/>`;
    x += barW;
  }
  svg += `<text x="${W/2}" y="${H - 1}" text-anchor="middle" font-size="7" font-family="monospace" fill="#334155">${escapeHtml(c)}</text>`;
  svg += `</svg>`;
  return svg;
}

function statusLabel(raw?: string): string {
  if (!raw) return '';
  const k = String(raw).trim().toLowerCase();
  const map: Record<string, string> = {
    pending: 'En attente',
    pending_payment: 'Paiement en attente',
    processing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    paid: 'Payée',
    draft: 'Brouillon',
    submitted: 'Soumis',
    replied: 'Répondu',
    revision: 'Révision demandée',
    accepted: 'Accepté',
    rejected: 'Refusé',
    transformed: 'Transformé en commande',
    expired: 'Expiré',
  };
  return map[k] || String(raw);
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
  breakdown?: Array<{ label: string; value: number; muted?: boolean }>;
  note?: string;
  status?: string;
  paymentLabel?: string;
}): string {
  const c = opts.company;
  const breakdownHtml = (opts.breakdown || [])
    .map(
      (b) =>
        `<div class="row${b.muted ? ' muted' : ''}"><span>${escapeHtml(b.label)}</span><span class="num">${b.value < 0 ? '-' : ''}${money(Math.abs(b.value))}</span></div>`
    )
    .join('');
  const barcode = barcodeSvg(opts.reference);
  const statutFr = opts.status ? statusLabel(opts.status) : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)} ${escapeHtml(opts.reference)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a202c; margin: 0; padding: 32px; }
  .page { max-width: 780px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d7a9e; padding-bottom: 16px; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 44px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0d7a9e; }
  .brand .tag { font-size: 12px; color: #718096; }
  .head .ref { text-align: right; font-size: 12px; color: #4a5568; max-width: 280px; }
  .head .ref h1 { font-size: 22px; margin: 0 0 4px; color: #1a202c; }
  .head .ref .code { font-family: monospace; font-size: 11px; color: #0d7a9e; background: #edf2f7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; word-break: break-all; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 20px 0; font-size: 13px; }
  .meta .box { flex: 1; }
  .meta .box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #0d7a9e; margin: 0 0 6px; }
  .meta .box div { color: #4a5568; line-height: 1.6; }
  .meta .box .barcode { margin-top: 10px; }
  .meta .box .barcode svg { max-width: 100%; height: auto; display: block; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th { background: #edf2f7; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #4a5568; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-left: auto; width: 360px; margin-top: 16px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; color: #4a5568; border-bottom: 1px dashed #e2e8f0; }
  .totals .row.muted { color: #718096; font-size: 12px; }
  .totals .row:last-child { border-bottom: none; }
  .totals .grand { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid #0d7a9e; padding-top: 8px; margin-top: 6px; color: #0d7a9e; }
  .letters { margin-top: 20px; padding: 12px 14px; border: 1px dashed #a0aec0; border-radius: 6px; font-size: 13px; }
  .letters b { color: #0d7a9e; }
  .note { margin-top: 16px; font-size: 12px; color: #4a5568; white-space: pre-wrap; }
  .foot { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #a0aec0; text-align: center; }
  @media print { body { padding: 0; } .totals { background: white; } }
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
      <div class="code">${escapeHtml(opts.reference)}</div>
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
        Réf. : ${escapeHtml(opts.reference)}<br/>
        ${opts.validity ? `Validité : ${escapeHtml(opts.validity)}<br/>` : ''}
        ${statutFr ? `Statut : ${escapeHtml(statutFr)}<br/>` : ''}
        ${opts.paymentLabel ? `Mode paiement : ${escapeHtml(opts.paymentLabel)}<br/>` : ''}
        <div class="barcode">${barcode}</div>
      </div>
    </div>
  </div>

  <table>
    <thead><tr>${opts.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>
      ${opts.rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>

  <div class="totals">
    ${breakdownHtml}
    ${opts.totalLabel !== '' ? `<div class="grand"><span>${escapeHtml(opts.totalLabel)}</span><span>${money(opts.total)}</span></div>` : ''}
  </div>

  <div class="letters">
    Arrêté le présent document à la somme de : <b>${escapeHtml(amountInWords(opts.total, currencyWord()))}</b>.
  </div>

  ${opts.note ? `<div class="note"><b>Note :</b> ${escapeHtml(opts.note)}</div>` : ''}

  <div class="foot">${escapeHtml(c.name)} — ${escapeHtml(c.address || '')} — Document généré par SARI CMS — ${escapeHtml(opts.reference)}</div>
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
        discount: (it as any).discountValue ?? it.discount ?? 0,
        discountType: (it as any).discountType || 'percent',
      }));

  const rows = source.map((l: any) => {
    const discVal = Number(l.discount || 0);
    const discType = l.discountType || 'percent';
    const lineTotal =
      discType === 'fixed'
        ? (l.quantity || 0) * (l.unitPrice || 0) - discVal * (l.quantity || 0)
        : (l.quantity || 0) * (l.unitPrice || 0) * (1 - discVal / 100);
    const discLabel = discVal ? (discType === 'fixed' ? `-${money(discVal)}` : `-${discVal}%`) : '—';
    return [
      escapeHtml(l.name),
      `<span class="num">${l.quantity}</span>`,
      `<span class="num">${money(l.unitPrice)}</span>`,
      `<span class="num">${discLabel}</span>`,
      `<span class="num">${money(Math.max(0, lineTotal))}</span>`,
    ];
  });

  const total = quote.response?.total ?? (quote as any).total ?? 0;
  const reference = quote.reference || `DV #${quote.id}`;
  const qAny = quote as any;
  const breakdown: Array<{ label: string; value: number; muted?: boolean }> = [];
  if (typeof qAny.subtotal === 'number') breakdown.push({ label: 'Sous-total HT', value: qAny.subtotal });
  if (typeof qAny.discountTotal === 'number' && qAny.discountTotal > 0) breakdown.push({ label: 'Remises', value: -qAny.discountTotal, muted: true });
  else if (typeof qAny.discount === 'number' && qAny.discount > 0) breakdown.push({ label: 'Remise', value: -qAny.discount, muted: true });
  if (typeof qAny.taxTotal === 'number' && qAny.taxTotal > 0) breakdown.push({ label: 'TVA / Taxes', value: qAny.taxTotal, muted: true });
  if (Array.isArray(qAny.taxLines) && qAny.taxLines.length) {
    qAny.taxLines.forEach((tl: any) => breakdown.push({ label: `${tl.name} ${tl.rate ? `${tl.rate}%` : ''}`, value: tl.amount, muted: true }));
  }
  if (typeof qAny.shippingFee === 'number' && qAny.shippingFee > 0) breakdown.push({ label: 'Livraison', value: qAny.shippingFee });
  if (typeof qAny.globalDiscount === 'number' && qAny.globalDiscount > 0) breakdown.push({ label: 'Remise globale', value: -qAny.globalDiscount, muted: true });

  return documentShell({
    title: 'Devis',
    reference,
    date: quote.date,
    validity: quote.validity || undefined,
    company,
    client: { name: quote.client, email: quote.email, phone: quote.phone, address: quote.address },
    headers: ['Article', 'Qté', 'Prix unit. HT', 'Remise', 'Total HT'],
    rows,
    totalLabel: 'Total TTC',
    total,
    breakdown,
    note: quote.note,
    status: quote.status,
  });
}

/** Template PDF pour une commande. */
export function orderPdfHtml(order: Order, company: CompanyInfo): string {
  const rows = (order.items || []).map((it: any) => {
    const discVal = Number(it.discountValue ?? it.discount ?? 0);
    const discType = it.discountType || 'percent';
    const base = (it.quantity || 0) * (it.price || 0);
    const lineTotal = discType === 'fixed' ? base - discVal * (it.quantity || 0) : base * (1 - discVal / 100);
    const discLabel = discVal ? (discType === 'fixed' ? `-${money(discVal)}` : `-${discVal}%`) : '—';
    return [
      escapeHtml(it.name),
      `<span class="num">${it.quantity}</span>`,
      `<span class="num">${money(it.price)}</span>`,
      `<span class="num">${discLabel}</span>`,
      `<span class="num">${money(Math.max(0, lineTotal))}</span>`,
    ];
  });

  const oAny = order as any;
  const reference = order.code || `#${order.id}`;
  const breakdown: Array<{ label: string; value: number; muted?: boolean }> = [];
  const subtotal = typeof oAny.subtotal === 'number' ? oAny.subtotal : (order.items || []).reduce((s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  breakdown.push({ label: 'Sous-total HT', value: subtotal });
  if (typeof oAny.productDiscount === 'number' && oAny.productDiscount > 0) breakdown.push({ label: 'Remises produits', value: -oAny.productDiscount, muted: true });
  if (typeof oAny.globalDiscount === 'number' && oAny.globalDiscount > 0) breakdown.push({ label: 'Remise globale', value: -oAny.globalDiscount, muted: true });
  if (typeof oAny.couponDiscount === 'number' && oAny.couponDiscount > 0) breakdown.push({ label: `Coupon ${oAny.coupon || ''}`.trim(), value: -oAny.couponDiscount, muted: true });
  if (typeof oAny.discountTotal === 'number' && oAny.discountTotal > 0 && !oAny.productDiscount && !oAny.globalDiscount) breakdown.push({ label: 'Remises', value: -oAny.discountTotal, muted: true });
  else if (typeof oAny.discount === 'number' && oAny.discount > 0 && !oAny.productDiscount) breakdown.push({ label: 'Remise', value: -oAny.discount, muted: true });
  if (oAny.productShipping > 0) breakdown.push({ label: 'Livraison articles', value: oAny.productShipping });
  if (oAny.globalShipping > 0) breakdown.push({ label: 'Livraison zone', value: oAny.globalShipping });
  if (oAny.shippingFee !== undefined && oAny.shipping > 0 && !oAny.productShipping && !oAny.globalShipping) breakdown.push({ label: 'Livraison', value: oAny.shippingFee ?? oAny.shipping });
  else if (oAny.shipping > 0 && !oAny.productShipping && !oAny.globalShipping) breakdown.push({ label: 'Livraison', value: oAny.shipping });
  if (typeof oAny.shipping === 'number' && oAny.shipping === 0) breakdown.push({ label: 'Livraison offerte', value: 0 });
  if (Array.isArray(oAny.taxLines) && oAny.taxLines.length) {
    oAny.taxLines.forEach((tl: any) => breakdown.push({ label: `${tl.name} ${tl.included ? '(incl.)' : ''} ${tl.rate ? `${tl.rate}%` : ''}`.trim(), value: tl.amount, muted: true }));
  } else if (typeof oAny.taxTotal === 'number' && oAny.taxTotal > 0) {
    breakdown.push({ label: 'TVA / Taxes', value: oAny.taxTotal, muted: true });
  }

  const total = oAny.total ?? 0;
  // Résout le label paiement pour affichage dans le PDF
  let paymentLabel: string | undefined;
  try {
    const raw = oAny.payment;
    if (raw) {
      const map: Record<string,string> = { 'card-intl':'Carte internationale','cib':'Carte CIB','transfer':'Virement','virement':'Virement','paypal':'PayPal','check':'Chèque','cod':'Paiement à la livraison','pending':'En attente','other':'Autre' };
      paymentLabel = map[String(raw).toLowerCase()] || String(raw);
    }
  } catch {}

  return documentShell({
    title: 'Commande',
    reference,
    date: order.date,
    company,
    client: { name: order.client, email: order.email, phone: order.phone, address: order.address },
    headers: ['Article', 'Qté', 'Prix unit. HT', 'Remise', 'Total HT'],
    rows,
    totalLabel: 'Total TTC',
    total,
    breakdown,
    note: oAny.adminNotes || oAny.notes || order.items?.find((i: any) => i.description)?.description,
    status: order.status,
    paymentLabel,
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
