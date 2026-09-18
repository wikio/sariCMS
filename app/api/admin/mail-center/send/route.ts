/**
 * /api/admin/mail-center/send — envoyer un message d'un module.
 *
 * C'est **ici** que la politique d'envoi est appliquée, pas dans le navigateur :
 * interrupteur général, événement activé, dédoublonnage par clé, intervalle
 * minimal par destinataire, plafond quotidien global et par destinataire, heures
 * silencieuses. Un écran d'administration contourné ne change rien à ces
 * compteurs, car ils sont lus dans `data/mail/sent-log.json`.
 *
 * Le message est rendu côté serveur (fusion des `{{variables}}` + gabarit), puis
 * transmis au transport unique du CMS — `POST {CMS_API_INTERNAL_URL}/mail/send`
 * (`backend/src/modules/mail/mail.service.ts`) — avec le jeton de
 * l'administrateur relayé depuis son cookie. Rien n'est écrit en base :
 * l'historique est un fichier JSON.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsServerBase } from '@/lib/cms';
import {
  MAIL_EVENTS,
  mergeMailVars,
  renderMailHtml,
  unresolvedVars,
  type MailEventConfig,
} from '@/lib/mail-center';
import {
  appendSentLog,
  evaluateSendGate,
  readLayouts,
  readModules,
  readPolicy,
} from '@/lib/mail-center-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendBody {
  event?: string;
  to?: string;
  toName?: string;
  vars?: Record<string, string | number>;
  dedupeKey?: string;
  /** Envoi de test : ignore les plafonds et accepte un contenu non enregistré. */
  test?: boolean;
  override?: { subject?: string; body?: string; layoutId?: string };
}

const entryId = () => `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps JSON attendu.', code: 'PARAMETRES' }, { status: 400 });
  }

  const eventId = String(body.event || '').trim();
  const event = MAIL_EVENTS[eventId];
  if (!event) {
    return NextResponse.json(
      { sent: false, reason: 'unknown_event', detail: `Événement inconnu : « ${eventId} ».` },
      { status: 400 },
    );
  }

  const to = String(body.to || '').trim();
  const dedupeKey = String(body.dedupeKey || '').trim();
  const vars: Record<string, string | number> = {
    ...(body.vars && typeof body.vars === 'object' ? body.vars : {}),
  };

  const [modules, layouts, policy] = await Promise.all([readModules(), readLayouts(), readPolicy()]);
  const config: MailEventConfig = modules[eventId];

  // — Garde-fous (sauf envoi de test, qui doit rester possible avant activation) —
  if (!body.test) {
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
      return NextResponse.json({ sent: false, reason: gate.reason, detail: gate.detail });
    }
  }

  const subject = mergeMailVars(
    body.test && body.override?.subject !== undefined ? body.override.subject : config?.subject || event.label,
    vars,
  ).slice(0, 255);
  const bodyHtml = body.test && body.override?.body !== undefined ? body.override.body : config?.body || '';
  const layoutId = body.test && body.override?.layoutId !== undefined ? body.override.layoutId : config?.layoutId || '';
  const layout = layouts.find((l) => l.id === layoutId) || null;

  const html = renderMailHtml({ bodyHtml, layout, vars });
  // Variables utilisées par le modèle mais absentes (ou vides) dans l'appel :
  // ce sont elles qui partiraient en blanc dans le message.
  const missing = [...new Set([...unresolvedVars(config?.subject || event.label), ...unresolvedVars(bodyHtml)])]
    .filter((key) => {
      const value = vars[key];
      return value === undefined || value === null || String(value).trim() === '';
    });

  // — Transport : le jeton admin est relayé depuis le cookie httpOnly posé par le middleware —
  const token = req.cookies.get('sari_admin_access')?.value;
  const target = `${cmsServerBase().replace(/\/$/, '')}/mail/send`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let status: 'sent' | 'failed' = 'failed';
  let messageId: string | undefined;
  let errorText = '';

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to, toName: body.toName || undefined, subject, html }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { messageId?: string; error?: string; message?: string } | null;
    if (!res.ok) {
      errorText = json?.error || json?.message || `Transport SMTP : HTTP ${res.status}`;
    } else {
      status = 'sent';
      messageId = json?.messageId;
    }
  } catch (err) {
    errorText = err instanceof Error ? err.message : String(err);
    if (errorText.includes('aborted')) errorText = 'Délai dépassé (20 s) — le serveur SMTP n’a pas répondu.';
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
      reason: body.test ? 'test' : undefined,
      messageId,
      error: status === 'failed' ? errorText : undefined,
    },
    policy.logRetentionDays,
  );

  return NextResponse.json({
    sent: status === 'sent',
    reason: status === 'sent' ? undefined : 'transport_error',
    detail: status === 'sent' ? undefined : errorText,
    messageId,
    subject,
    /** Variables présentes dans le modèle mais absentes de l'appel — à corriger. */
    missingVars: missing,
  });
}
