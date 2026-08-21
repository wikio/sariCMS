'use client';

import { cmsAdminFetch } from '@/lib/cms-admin';
import type { NotifyMessage } from '@/lib/notify-store';

export interface MailPayload {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface OutboxEntry extends MailPayload {
  id: string;
  sentAt: string;
  provider: 'smtp' | 'file';
  messageId?: string;
  error?: string;
}

/** Remplace les variables de fusion `{{cle}}` d'un texte. */
export function mergeVars(text: string, vars: Record<string, string | number>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value));
  }
  return out;
}

/** Rend un modèle de notification (sujet + corps) avec ses variables. */
export function renderTemplate(
  template: NotifyMessage,
  vars: Record<string, string | number>,
): { subject: string; html: string } {
  return {
    subject: mergeVars(template.subject, vars),
    html: mergeVars(template.body, vars),
  };
}

/** Envoie un email via le backend (`POST /api/v1/mail/send`). */
export async function sendMail(payload: MailPayload): Promise<OutboxEntry> {
  return cmsAdminFetch<OutboxEntry>('/mail/send', {
    method: 'POST',
    json: payload,
    timeoutMs: 20000,
  });
}

/** Historique des emails envoyés (admin). */
export async function loadOutbox(): Promise<{ smtpConfigured: boolean; items: OutboxEntry[] }> {
  try {
    return await cmsAdminFetch<{ smtpConfigured: boolean; items: OutboxEntry[] }>('/mail/outbox', { timeoutMs: 8000 });
  } catch {
    return { smtpConfigured: false, items: [] };
  }
}
