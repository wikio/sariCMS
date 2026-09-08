/**
 * Règle commune des passerelles de l'administration : l'API du CMS fait foi,
 * son absence n'est pas une panne.
 *
 * Un refus de l'API (401, 403, validation) doit remonter à l'écran — le
 * masquer ferait croire à un enregistrement réussi alors que la session est
 * morte ou la donnée refusée. Une API injoignable (processus arrêté, timeout,
 * 5xx) est en revanche une situation normale en développement : on rend alors
 * le repli local, et l'appelant prévient l'utilisateur d'où il écrit.
 */
import { CmsError } from '@/lib/cms';

export async function cmsOr<T>(call: () => Promise<T | null | undefined>, fallback: () => Promise<T>): Promise<{ value: T; via: 'api' | 'local' }> {
  try {
    const value = await call();
    if (value !== null && value !== undefined) return { value, via: 'api' };
  } catch (err) {
    if (err instanceof CmsError && err.status > 0 && err.status < 500) throw err;
  }
  return { value: await fallback(), via: 'local' };
}

/** Le porteur du jeton d'administration, transmis par l'écran. */
export function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

export function forwardedIp(req: Request): string {
  const headers = req.headers;
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return String(fwd).split(',')[0].trim();
  return String(headers.get('x-real-ip') || '');
}

export function userAgent(req: Request): string {
  return String(req.headers.get('user-agent') || '');
}
