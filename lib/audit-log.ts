/**
 * lib/audit-log.ts — Journal d'audit de sécurité structuré (Node.js).
 *
 * Enregistre les événements de sécurité critiques pour détection d'intrusion,
 * conformité RGPD, et analyse post-incident.
 *
 * Format : JSON Lines (une ligne par événement) pour ingestion facile
 * dans ELK, Splunk, Datadog, Loki, etc.
 *
 * Utilise import dynamique pour fs/promises et path (compatible Edge si importé mais non utilisé).
 */
import type { AuditEventType, AuditEvent } from './audit-types';
import { NextRequest } from 'next/server';

// Détecter si on est en Edge Runtime
const isEdgeRuntime = typeof process === 'undefined' || !process.versions?.node;

let LOG_DIR = '';
let LOG_FILE = '';

async function getFs() {
  if (isEdgeRuntime) return null;
  const fs = await import('fs/promises');
  const path = await import('path');
  LOG_DIR = path.join(process.cwd(), 'logs', 'audit');
  LOG_FILE = path.join(LOG_DIR, `audit-${new Date().toISOString().slice(0, 10)}.log.jsonl`);
  return { fs, path };
}

let initialized = false;

async function ensureLogDir() {
  if (isEdgeRuntime || initialized) return;
  const mod = await getFs();
  if (mod) {
    await mod.fs.mkdir(mod.path.dirname(LOG_FILE), { recursive: true });
    initialized = true;
  }
}

function getClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || headers.get('x-real-ip') || 'unknown';
}

function getUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

function sanitizeDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'csrf'];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function writeAuditLog(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
  if (isEdgeRuntime) {
    // En Edge Runtime, logger vers console
    const fullEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      ...event,
      details: sanitizeDetails(event.details),
    };
    console.log('[AUDIT]', JSON.stringify(fullEvent));
    return;
  }

  await ensureLogDir();

  const fullEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    ...event,
    details: sanitizeDetails(event.details),
  };

  const line = JSON.stringify(fullEvent) + '\n';

  try {
    const mod = await getFs();
    if (mod) {
      await mod.fs.appendFile(LOG_FILE, line, 'utf8');
    }
  } catch (error) {
    // Fallback console si écriture fichier échoue
    console.error('[AUDIT LOG FAILED]', error, fullEvent);
  }
}

/**
 * Helpers pour les événements courants
 */
export const auditLog = {
  authLoginSuccess: (data: { userId: string; email: string; role?: string; ip?: string; ua?: string; requestId?: string }) =>
    writeAuditLog({
      type: 'auth.login.success',
      severity: 'info',
      userId: data.userId,
      userEmail: data.email,
      userRole: data.role,
      ip: data.ip,
      userAgent: data.ua,
      requestId: data.requestId,
      outcome: 'success',
    }),

  authLoginFailure: (data: { email: string; ip?: string; ua?: string; reason: string; requestId?: string }) =>
    writeAuditLog({
      type: 'auth.login.failure',
      severity: 'warning',
      userEmail: data.email,
      ip: data.ip,
      userAgent: data.ua,
      requestId: data.requestId,
      outcome: 'failure',
      error: data.reason,
    }),

  authLogout: (data: { userId: string; email: string; ip?: string; ua?: string }) =>
    writeAuditLog({
      type: 'auth.logout',
      severity: 'info',
      userId: data.userId,
      userEmail: data.email,
      ip: data.ip,
      userAgent: data.ua,
      outcome: 'success',
    }),

  adminUserCreate: (data: { actorId: string; actorEmail: string; targetId: string; targetEmail: string; targetRole: string; ip?: string }) =>
    writeAuditLog({
      type: 'admin.user.create',
      severity: 'info',
      userId: data.actorId,
      userEmail: data.actorEmail,
      resource: 'user',
      resourceId: data.targetId,
      action: 'create',
      ip: data.ip,
      outcome: 'success',
      details: { targetEmail: data.targetEmail, targetRole: data.targetRole },
    }),

  adminUserUpdate: (data: { actorId: string; actorEmail: string; targetId: string; changes: string[]; ip?: string }) =>
    writeAuditLog({
      type: 'admin.user.update',
      severity: 'info',
      userId: data.actorId,
      userEmail: data.actorEmail,
      resource: 'user',
      resourceId: data.targetId,
      action: 'update',
      ip: data.ip,
      outcome: 'success',
      details: { changes: data.changes },
    }),

  adminUserDelete: (data: { actorId: string; actorEmail: string; targetId: string; targetEmail: string; ip?: string }) =>
    writeAuditLog({
      type: 'admin.user.delete',
      severity: 'warning',
      userId: data.actorId,
      userEmail: data.actorEmail,
      resource: 'user',
      resourceId: data.targetId,
      action: 'delete',
      ip: data.ip,
      outcome: 'success',
      details: { targetEmail: data.targetEmail },
    }),

  adminSettingsChange: (data: { actorId: string; actorEmail: string; setting: string; ip?: string }) =>
    writeAuditLog({
      type: 'admin.settings.change',
      severity: 'info',
      userId: data.actorId,
      userEmail: data.actorEmail,
      resource: 'settings',
      resourceId: data.setting,
      action: 'update',
      ip: data.ip,
      outcome: 'success',
    }),

  adminVerificationConfigChange: (data: { actorId: string; actorEmail: string; changes: string[]; ip?: string }) =>
    writeAuditLog({
      type: 'admin.verification.config.change',
      severity: 'warning',
      userId: data.actorId,
      userEmail: data.actorEmail,
      resource: 'verification',
      action: 'config_change',
      ip: data.ip,
      outcome: 'success',
      details: { changes: data.changes },
    }),

  fileUploadSuccess: (data: { userId: string; userEmail: string; fileName: string; mimeType: string; size: number; module: string; ip?: string }) =>
    writeAuditLog({
      type: 'file.upload.success',
      severity: 'info',
      userId: data.userId,
      userEmail: data.userEmail,
      resource: 'file',
      resourceId: data.fileName,
      action: 'upload',
      ip: data.ip,
      outcome: 'success',
      details: { mimeType: data.mimeType, size: data.size, module: data.module },
    }),

  fileUploadFailure: (data: { userId?: string; userEmail?: string; fileName: string; error: string; ip?: string }) =>
    writeAuditLog({
      type: 'file.upload.failure',
      severity: 'warning',
      userId: data.userId,
      userEmail: data.userEmail,
      resource: 'file',
      resourceId: data.fileName,
      action: 'upload',
      ip: data.ip,
      outcome: 'failure',
      error: data.error,
    }),

  fileUploadBlocked: (data: { userId?: string; userEmail?: string; fileName: string; reason: string; ip?: string }) =>
    writeAuditLog({
      type: 'file.upload.blocked',
      severity: 'critical',
      userId: data.userId,
      userEmail: data.userEmail,
      resource: 'file',
      resourceId: data.fileName,
      action: 'upload',
      ip: data.ip,
      outcome: 'blocked',
      error: data.reason,
    }),

  captchaFailure: (data: { ip: string; form: string; reason: string; ua?: string }) =>
    writeAuditLog({
      type: 'security.captcha.failure',
      severity: 'warning',
      ip: data.ip,
      userAgent: data.ua,
      resource: 'captcha',
      action: 'verify',
      outcome: 'failure',
      error: data.reason,
      details: { form: data.form },
    }),

  csrfFailure: (data: { ip: string; path: string; ua?: string }) =>
    writeAuditLog({
      type: 'api.csrf_failure',
      severity: 'critical',
      ip: data.ip,
      userAgent: data.ua,
      resource: 'api',
      resourceId: data.path,
      action: 'csrf_check',
      outcome: 'blocked',
    }),

  rateLimited: (data: { ip: string; path: string; ua?: string; limit: number }) =>
    writeAuditLog({
      type: 'api.rate_limited',
      severity: 'warning',
      ip: data.ip,
      userAgent: data.ua,
      resource: 'api',
      resourceId: data.path,
      action: 'rate_limit',
      outcome: 'blocked',
      details: { limit: data.limit },
    }),

  suspiciousRequest: (data: { ip: string; path: string; reason: string; ua?: string; payload?: unknown }) =>
    writeAuditLog({
      type: 'api.suspicious_request',
      severity: 'error',
      ip: data.ip,
      userAgent: data.ua,
      resource: 'api',
      resourceId: data.path,
      action: 'suspicious',
      outcome: 'blocked',
      error: data.reason,
      details: { payload: sanitizeDetails(data.payload as Record<string, unknown>) },
    }),
};

/**
 * Middleware helper pour logger automatiquement les erreurs CSRF et rate limit
 */
export function createAuditMiddleware() {
  return async (req: NextRequest, eventType: 'csrf' | 'rate_limit', details: { path: string; limit?: number; reason?: string }) => {
    const ip = getClientIp(req.headers);
    const ua = getUserAgent(req.headers);

    if (eventType === 'csrf') {
      await auditLog.csrfFailure({ ip, path: details.path, ua });
    } else {
      await auditLog.rateLimited({ ip, path: details.path, ua, limit: details.limit || 0 });
    }
  };
}