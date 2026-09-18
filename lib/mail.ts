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

/* ---------------------------------------------------------------------------
 * Centre de courrier — les envois pilotés par la configuration
 * (`data/mail/*.json`, écran Paramètres → « Emails & notifications »).
 *
 * `sendModuleMail` ne décide rien : il transmet l'événement et ses variables à
 * `/api/admin/mail-center/send`, qui applique la politique (interrupteur général,
 * événement activé, dédoublonnage, plafonds, heures silencieuses), rend le
 * message avec son gabarit et le confie au transport. Un refus n'est pas une
 * erreur : le résultat dit pourquoi, et l'appelant décide d'en informer ou non.
 * ------------------------------------------------------------------------- */

export type MailSendBlockReason =
  | 'master_off'
  | 'disabled'
  | 'no_recipient'
  | 'unknown_event'
  | 'duplicate'
  | 'daily_cap'
  | 'recipient_cap'
  | 'quiet_hours'
  | 'transport_error';

export interface SendModuleMailInput {
  /** Identifiant d'événement du catalogue (`order_confirmed`, `quote_sent`…). */
  event: string;
  to: string;
  toName?: string;
  vars?: Record<string, string | number>;
  /**
   * Clé d'unicité, typiquement `${type}-${id}-${événement}` : c'est elle qui
   * empêche de renvoyer deux fois le même message pour la même fiche.
   */
  dedupeKey?: string;
  /** Envoi de test depuis l'écran d'administration : ignore les plafonds. */
  test?: boolean;
  /** Contenu non enregistré, pour tester un brouillon (avec `test`). */
  override?: { subject?: string; body?: string; layoutId?: string };
}

export interface SendModuleMailResult {
  sent: boolean;
  reason?: MailSendBlockReason;
  detail?: string;
  messageId?: string;
  subject?: string;
  /** Variables du modèle absentes de l'appel — à corriger dans le modèle ou l'appel. */
  missingVars?: string[];
}

/** Envoie (ou refuse d'envoyer) le message d'un module selon la configuration. */
export async function sendModuleMail(input: SendModuleMailInput): Promise<SendModuleMailResult> {
  const res = await fetch('/api/admin/mail-center/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => null)) as (SendModuleMailResult & { error?: string }) | null;
  if (!json) return { sent: false, reason: 'transport_error', detail: `Réponse illisible (HTTP ${res.status}).` };
  if (!res.ok && !json.reason) {
    return { sent: false, reason: 'transport_error', detail: json.error || `HTTP ${res.status}` };
  }
  return json;
}

/** Historique des emails envoyés (admin). */
export async function loadOutbox(): Promise<{ smtpConfigured: boolean; items: OutboxEntry[] }> {
  try {
    return await cmsAdminFetch<{ smtpConfigured: boolean; items: OutboxEntry[] }>('/mail/outbox', { timeoutMs: 8000 });
  } catch {
    return { smtpConfigured: false, items: [] };
  }
}
