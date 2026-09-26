import { timingSafeEqual } from 'crypto';

/**
 * Contrôle de la clé partagée entre le serveur Next.js et le backend.
 *
 * Les flux publics de la vitrine (contact, inscription, mot de passe oublié)
 * n'ont pas de session administrateur. Plutôt que de les exposer sans garde, ces
 * points d'entrée sont fermés par `MAIL_INTERNAL_KEY`, une clé que seul le
 * processus Next connaît — elle ne passe jamais dans le navigateur.
 *
 * Comparaison à temps constant : la clé ne doit pas se deviner octet par octet.
 *
 * @param given    valeur reçue dans l'en-tête `x-mail-internal-key`
 * @param expected valeur de `MAIL_INTERNAL_KEY` dans l'environnement
 * @returns false si la clé attendue n'est pas configurée, même face à une clé
 *          vide — une installation sans clé ne doit rien laisser passer.
 */
export function isInternalKey(given: string | undefined, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
