'use client';

import { loadAdminSettings } from '@/lib/admin-settings';

export interface ErpInvoice {
  number: string;
  url?: string;
  fileName?: string;
}

/**
 * Connecteur ERP externe (facturation). L'URL de base, la clé d'API et
 * l'activation se configurent dans Paramètres → Commerce → Facturation & ERP.
 */

function baseUrl(): string {
  const s = loadAdminSettings();
  return (s.erp.apiUrl || '').trim().replace(/\/+$/, '');
}

function headers(): Record<string, string> {
  const s = loadAdminSettings();
  return {
    Accept: 'application/json',
    ...(s.erp.apiKey ? { 'X-API-Key': s.erp.apiKey, Authorization: `Bearer ${s.erp.apiKey}` } : {}),
  };
}

/** Vérifie que l'ERP est configuré, sinon lève une erreur explicite. */
export function erpConfigured(): boolean {
  const s = loadAdminSettings();
  return s.erp.enabled && !!baseUrl();
}

/** Récupère (ou crée) la facture d'une commande depuis l'ERP externe. */
export async function fetchInvoiceFromErp(orderCode: string, orderId: number): Promise<ErpInvoice> {
  if (!erpConfigured()) {
    throw new Error("ERP non configuré. Renseignez l'URL et la clé API dans les paramètres.");
  }
  const url = `${baseUrl()}/invoices?order=${encodeURIComponent(orderCode)}&orderId=${encodeURIComponent(String(orderId))}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Impossible de joindre l'ERP (timeout / réseau).");
  }
  if (!res.ok) {
    throw new Error(`L'ERP a répondu ${res.status}.`);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const invoice = (data.invoice || data) as Partial<ErpInvoice>;
  if (!invoice.number && !data.number) {
    throw new Error("L'ERP n'a retourné aucune facture pour cette commande.");
  }
  return {
    number: String(invoice.number || data.number || ''),
    url: invoice.url ? String(invoice.url) : undefined,
    fileName: invoice.fileName ? String(invoice.fileName) : undefined,
  };
}

/** Teste la connexion à l'ERP (ping d'un endpoint de santé). */
export async function testErpConnection(): Promise<{ ok: boolean; message: string }> {
  if (!erpConfigured()) {
    return { ok: false, message: "ERP non configuré (activé + URL requises)." };
  }
  try {
    const res = await fetch(`${baseUrl()}/health`, { headers: headers(), signal: AbortSignal.timeout(10000) });
    return res.ok
      ? { ok: true, message: `Connecté (${res.status}).` }
      : { ok: false, message: `Réponse ${res.status}.` };
  } catch {
    return { ok: false, message: 'Connexion impossible (réseau / CORS).' };
  }
}
