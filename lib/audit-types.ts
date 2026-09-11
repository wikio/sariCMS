/**
 * lib/audit-types.ts — Types partagés pour l'audit logging.
 */
export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.session.expired'
  | 'auth.2fa.challenge'
  | 'auth.2fa.success'
  | 'auth.2fa.failure'
  | 'auth.password.reset.request'
  | 'auth.password.reset.success'
  | 'auth.password.change'
  | 'admin.user.create'
  | 'admin.user.update'
  | 'admin.user.delete'
  | 'admin.user.role.change'
  | 'admin.settings.change'
  | 'admin.verification.config.change'
  | 'admin.upload'
  | 'admin.delete'
  | 'api.rate_limited'
  | 'api.csrf_failure'
  | 'api.suspicious_request'
  | 'file.upload.success'
  | 'file.upload.failure'
  | 'file.upload.blocked'
  | 'file.delete'
  | 'security.captcha.failure'
  | 'security.scan.warning';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'blocked';
  details?: Record<string, unknown>;
  error?: string;
}