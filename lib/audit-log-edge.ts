/**
 * lib/audit-log-edge.ts — Journal d'audit compatible Edge Runtime.
 *
 * Version simplifiée pour le middleware (Edge Runtime) : loggue vers console seulement.
 * Pour le logging fichier complet, utiliser lib/audit-log.ts dans les API routes (Node.js).
 */
import { NextRequest } from 'next/server';
import type { AuditEventType, AuditEvent } from './audit-types';

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
  const fullEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    ...event,
    details: sanitizeDetails(event.details),
  };
  console.log('[AUDIT]', JSON.stringify(fullEvent));
}

export const auditLog = {
  authLoginSuccess: (data: { userId: string; email: string; role?: string; ip?: string; ua?: string; requestId?: string }) =>
    writeAuditLog({ type: 'auth.login.success', severity: 'info', userId: data.userId, userEmail: data.email, userRole: data.role, ip: data.ip, userAgent: data.ua, requestId: data.requestId, outcome: 'success' }),

  authLoginFailure: (data: { email: string; ip?: string; ua?: string; reason: string; requestId?: string }) =>
    writeAuditLog({ type: 'auth.login.failure', severity: 'warning', userEmail: data.email, ip: data.ip, userAgent: data.ua, requestId: data.requestId, outcome: 'failure', error: data.reason }),

  authLogout: (data: { userId: string; email: string; ip?: string; ua?: string }) =>
    writeAuditLog({ type: 'auth.logout', severity: 'info', userId: data.userId, userEmail: data.email, ip: data.ip, userAgent: data.ua, outcome: 'success' }),

  adminUserCreate: (data: { actorId: string; actorEmail: string; targetId: string; targetEmail: string; targetRole: string; ip?: string }) =>
    writeAuditLog({ type: 'admin.user.create', severity: 'info', userId: data.actorId, userEmail: data.actorEmail, resource: 'user', resourceId: data.targetId, action: 'create', ip: data.ip, outcome: 'success', details: { targetEmail: data.targetEmail, targetRole: data.targetRole } }),

  adminUserUpdate: (data: { actorId: string; actorEmail: string; targetId: string; changes: string[]; ip?: string }) =>
    writeAuditLog({ type: 'admin.user.update', severity: 'info', userId: data.actorId, userEmail: data.actorEmail, resource: 'user', resourceId: data.targetId, action: 'update', ip: data.ip, outcome: 'success', details: { changes: data.changes } }),

  adminUserDelete: (data: { actorId: string; actorEmail: string; targetId: string; targetEmail: string; ip?: string }) =>
    writeAuditLog({ type: 'admin.user.delete', severity: 'warning', userId: data.actorId, userEmail: data.actorEmail, resource: 'user', resourceId: data.targetId, action: 'delete', ip: data.ip, outcome: 'success', details: { targetEmail: data.targetEmail } }),

  adminSettingsChange: (data: { actorId: string; actorEmail: string; setting: string; ip?: string }) =>
    writeAuditLog({ type: 'admin.settings.change', severity: 'info', userId: data.actorId, userEmail: data.actorEmail, resource: 'settings', resourceId: data.setting, action: 'update', ip: data.ip, outcome: 'success' }),

  adminVerificationConfigChange: (data: { actorId: string; actorEmail: string; changes: string[]; ip?: string }) =>
    writeAuditLog({ type: 'admin.verification.config.change', severity: 'warning', userId: data.actorId, userEmail: data.actorEmail, resource: 'verification', action: 'config_change', ip: data.ip, outcome: 'success', details: { changes: data.changes } }),

  fileUploadSuccess: (data: { userId: string; userEmail: string; fileName: string; mimeType: string; size: number; module: string; ip?: string }) =>
    writeAuditLog({ type: 'file.upload.success', severity: 'info', userId: data.userId, userEmail: data.userEmail, resource: 'file', resourceId: data.fileName, action: 'upload', ip: data.ip, outcome: 'success', details: { mimeType: data.mimeType, size: data.size, module: data.module } }),

  fileUploadFailure: (data: { userId?: string; userEmail?: string; fileName: string; error: string; ip?: string }) =>
    writeAuditLog({ type: 'file.upload.failure', severity: 'warning', userId: data.userId, userEmail: data.userEmail, resource: 'file', resourceId: data.fileName, action: 'upload', ip: data.ip, outcome: 'failure', error: data.error }),

  fileUploadBlocked: (data: { userId?: string; userEmail?: string; fileName: string; reason: string; ip?: string }) =>
    writeAuditLog({ type: 'file.upload.blocked', severity: 'critical', userId: data.userId, userEmail: data.userEmail, resource: 'file', resourceId: data.fileName, action: 'upload', ip: data.ip, outcome: 'blocked', error: data.reason }),

  captchaFailure: (data: { ip: string; form: string; reason: string; ua?: string }) =>
    writeAuditLog({ type: 'security.captcha.failure', severity: 'warning', ip: data.ip, userAgent: data.ua, resource: 'captcha', action: 'verify', outcome: 'failure', error: data.reason, details: { form: data.form } }),

  csrfFailure: (data: { ip: string; path: string; ua?: string }) =>
    writeAuditLog({ type: 'api.csrf_failure', severity: 'critical', ip: data.ip, userAgent: data.ua, resource: 'api', resourceId: data.path, action: 'csrf_check', outcome: 'blocked' }),

  rateLimited: (data: { ip: string; path: string; ua?: string; limit: number }) =>
    writeAuditLog({ type: 'api.rate_limited', severity: 'warning', ip: data.ip, userAgent: data.ua, resource: 'api', resourceId: data.path, action: 'rate_limit', outcome: 'blocked', details: { limit: data.limit } }),

  suspiciousRequest: (data: { ip: string; path: string; reason: string; ua?: string; payload?: unknown }) =>
    writeAuditLog({ type: 'api.suspicious_request', severity: 'error', ip: data.ip, userAgent: data.ua, resource: 'api', resourceId: data.path, action: 'suspicious', outcome: 'blocked', error: data.reason, details: { payload: sanitizeDetails(data.payload as Record<string, unknown>) } }),
};