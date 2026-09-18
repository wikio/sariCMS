/**
 * lib/mail-center-send.ts — l'envoi, côté serveur.
 *
 * C'est le **seul** endroit où un message quitte le CMS. Il enchaîne :
 *
 * 1. les garde-fous de `evaluateSendGate()` (interrupteur général, événement
 *    activé, dédoublonnage par clé, intervalle par destinataire, plafonds
 *    quotidiens, heures silencieuses) ;
 * 2. le rendu — fusion des `{{variables}}` dans l'objet et le corps, puis
 *    habillage par le gabarit choisi ;
 * 3. le transport : `POST {CMS_API_INTERNAL_URL}/mail/send` avec le jeton de
 *    l'administrateur pour les flux d'administration, ou
 *    `POST …/mail/internal/send` avec la clé partagée `MAIL_INTERNAL_KEY` pour
 *    les flux publics (contact, newsletter) qui n'ont aucune session ;
 * 4. l'écriture dans `data/mail/sent-log.json` — envoyé, échec, ou refusé avec
 *    son motif.
 *
 * **Serveur uniquement** (`fs` via `lib/mail-center-store`). Le navigateur passe
 * par `/api/admin/mail-center/send` ; un flux public appelle cette fonction
 * directement depuis sa route API, sans jamais exposer la clé interne.
 */
import { cmsServerBase } from './cms';
import { getConfig } from './data';
import {
  MAIL_EVENTS,
  mergeMailVars,
  renderMailHtml,
  unresolvedVars,
  type MailEventConfig,
} from './mail-center';
import {
  appendSentLog,
  evaluateSendGate,
  readLayouts,
  readModules,
  readPolicy,
  type SendBlockReason,
} from './mail-center-store';

export interface MailCenterSendInput {
  /** Identifiant d'événement du catalogue (`contact_received`, `order_confirmed`…). */
  event: string;
  to: string;
  toName?: string;
  vars?: Record<string, string | number>;
  /** Clé d'unicité, typiquement `${type}-${id}-${événement}`. */
  dedupeKey?: string;
  /** Jeton d'administration. Absent : envoi interne par clé partagée. */
  bearer?: string;
  /** Envoi de test depuis l'écran d'administration : ignore les plafonds. */
  test?: boolean;
  /** Contenu non enregistré, pour tester un brouillon (avec `test`). */
  override?: { subject?: string; body?: string; layoutId?: string };
}

export type MailCenterSendReason = SendBlockReason | 'transport_error' | 'internal_key_missing';

export interface MailCenterSendResult {
  sent: boolean;
  reason?: MailCenterSendReason;
  detail?: string;
  messageId?: string;
  subject?: string;
  /** Variables du modèle absentes (ou vides) dans l'appel. */
  missingVars?: string[];
}

const entryId = () => `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TRANSPORT_TIMEOUT_MS = 20_000;

/** Envoie un message d'un module, ou explique pourquoi il ne part pas. */
export async function sendMailCenterEvent(input: MailCenterSendInput): Promise<MailCenterSendResult> {
  const eventId = String(input.event || '').trim();
  const event = MAIL_EVENTS[eventId];
  if (!event) {
    return { sent: false, reason: 'unknown_event', detail: `Événement inconnu : « ${eventId} ».` };
  }

  const to = String(input.to || '').trim();
  const dedupeKey = String(input.dedupeKey || '').trim();
  const vars: Record<string, string | number> = {
    ...(input.vars && typeof input.vars === 'object' ? input.vars : {}),
  };

  const [modules, layouts, policy] = await Promise.all([readModules(), readLayouts(), readPolicy()]);
  const config: MailEventConfig = modules[eventId];

  // — Garde-fous (un envoi de test doit rester possible avant activation) —
  if (!input.test) {
    const gate = await evaluateSendGate({ eventId, to, dedupeKey });
    if (!gate.allowed) {
      await appendSentLog(
        {
          id: entryId(),
          at: new Date().toISOString(),
          module: event.module,
          event: eventId,
          to,
          subject: mergeMailVars(config?.subject || event.label, vars),
          dedupeKey,
          status: 'skipped',
          reason: gate.reason,
          error: gate.detail,
        },
        policy.logRetentionDays,
      );
      return { sent: false, reason: gate.reason, detail: gate.detail };
    }
  }

  const subject = mergeMailVars(
    input.test && input.override?.subject !== undefined ? input.override.subject : config?.subject || event.label,
    vars,
  ).slice(0, 255);
  const bodyHtml = input.test && input.override?.body !== undefined ? input.override.body : config?.body || '';
  const layoutId = input.test && input.override?.layoutId !== undefined ? input.override.layoutId : config?.layoutId || '';
  const layout = layouts.find((l) => l.id === layoutId) || null;
  const html = renderMailHtml({ bodyHtml, layout, vars });

  // Variables utilisées par le modèle mais absentes de l'appel : elles
  // partiraient en blanc dans le message.
  const missingVars = [
    ...new Set([...unresolvedVars(config?.subject || event.label), ...unresolvedVars(bodyHtml)]),
  ].filter((key) => {
    const value = vars[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  // — Transport —
  const base = cmsServerBase().replace(/\/$/, '');
  const internalKey = String(process.env.MAIL_INTERNAL_KEY || '');
  const useInternal = !input.bearer;
  if (useInternal && !internalKey) {
    const detail = 'MAIL_INTERNAL_KEY non défini côté Next.js : les flux publics ne peuvent pas envoyer.';
    await appendSentLog(
      {
        id: entryId(),
        at: new Date().toISOString(),
        module: event.module,
        event: eventId,
        to,
        subject,
        dedupeKey,
        status: 'failed',
        reason: 'internal_key_missing',
        error: detail,
      },
      policy.logRetentionDays,
    );
    return { sent: false, reason: 'internal_key_missing', detail, subject, missingVars };
  }

  const target = useInternal ? `${base}/mail/internal/send` : `${base}/mail/send`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSPORT_TIMEOUT_MS);

  let status: 'sent' | 'failed' = 'failed';
  let messageId: string | undefined;
  let errorText = '';

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.bearer ? { Authorization: `Bearer ${input.bearer}` } : {}),
        ...(useInternal ? { 'x-mail-internal-key': internalKey } : {}),
      },
      body: JSON.stringify({ to, toName: input.toName || undefined, subject, html }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as
      | { messageId?: string; error?: string; message?: string }
      | null;
    if (!res.ok) {
      errorText = json?.error || json?.message || `Transport SMTP : HTTP ${res.status}`;
    } else {
      status = 'sent';
      messageId = json?.messageId;
    }
  } catch (err) {
    errorText = err instanceof Error ? err.message : String(err);
    if (errorText.includes('aborted')) {
      errorText = `Délai dépassé (${TRANSPORT_TIMEOUT_MS / 1000} s) — le serveur SMTP n’a pas répondu.`;
    }
  } finally {
    clearTimeout(timer);
  }

  await appendSentLog(
    {
      id: entryId(),
      at: new Date().toISOString(),
      module: event.module,
      event: eventId,
      to,
      subject,
      dedupeKey,
      status,
      reason: input.test ? 'test' : undefined,
      messageId,
      error: status === 'failed' ? errorText : undefined,
    },
    policy.logRetentionDays,
  );

  return {
    sent: status === 'sent',
    reason: status === 'sent' ? undefined : 'transport_error',
    detail: status === 'sent' ? undefined : errorText,
    messageId,
    subject,
    missingVars,
  };
}

/**
 * Variables « société » d'un message : reprises des coordonnées publiées du site
 * (`getConfig`), pas d'une valeur codée en dur. Un échec de lecture ne bloque
 * jamais l'envoi — les variables partent vides plutôt que de perdre le message.
 */
export async function companyVars(locale: string, origin: string): Promise<Record<string, string>> {
  const cfg = await getConfig(locale || 'fr').catch(() => null);
  return {
    nom_societe: cfg?.meta.companyName || '',
    adresse_societe: cfg?.meta.address || '',
    telephone_societe: cfg?.meta.phone || '',
    email_societe: cfg?.meta.email || '',
    site_societe: origin,
  };
}

/** Origine absolue d'une requête — derrière un proxy, l'en-tête prime. */
export function requestOrigin(req: { url: string; headers: { get(name: string): string | null } }): string {
  const forwarded = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || '');
  if (forwarded) {
    const proto = String(req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
    return `${proto}://${forwarded}`;
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}
