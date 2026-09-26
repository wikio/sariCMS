/**
 * Appel du backend avec la clé partagée `MAIL_INTERNAL_KEY`.
 *
 * Certains points d'entrée du backend ne doivent être atteignables que par le
 * serveur Next.js : ils renvoient de quoi agir au nom d'un utilisateur (un jeton
 * de réinitialisation) ou envoient un email. Les ouvrir au navigateur
 * reviendrait à les ouvrir à tout le monde. Ils sont donc fermés par la même clé
 * que `POST /mail/internal/send`, que seul ce processus connaît.
 *
 * **Serveur uniquement.** Ne jamais renvoyer la clé au navigateur.
 */
import { cmsServerBase, unwrap } from '../cms';

const TIMEOUT_MS = 15_000;

export interface InternalCallResult<T> {
  ok: boolean;
  /** HTTP 503 si la clé n'est pas configurée côté Next. */
  status: number;
  data?: T;
  error?: string;
}

/**
 * POST vers le backend avec l'en-tête `x-mail-internal-key`.
 *
 * Ne lève jamais d'exception : un appelant public doit pouvoir répondre poliment
 * au visiteur même quand le backend est absent.
 */
export async function internalPost<T>(path: string, body: unknown): Promise<InternalCallResult<T>> {
  const key = String(process.env.MAIL_INTERNAL_KEY || '');
  if (!key) {
    return {
      ok: false,
      status: 503,
      error: 'MAIL_INTERNAL_KEY non défini côté Next.js.',
    };
  }

  const target = `${cmsServerBase().replace(/\/$/, '')}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mail-internal-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    if (!res.ok) {
      return { ok: false, status: res.status, error: json?.message || `HTTP ${res.status}` };
    }
    // Le backend renvoie `{ success, data }` : sans ce dépliage, `data.found`
    // resterait `undefined` et l'appelant croirait à tort qu'aucun compte
    // n'existe — le jeton serait créé en base sans qu'aucun email ne parte.
    return { ok: true, status: res.status, data: unwrap<T>(json) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 502,
      error: message.includes('aborted') ? `Délai dépassé (${TIMEOUT_MS / 1000} s).` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}
