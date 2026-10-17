/**
 * lib/verification-link.ts — la lecture des segments d'URL de vérification.
 *
 * Le lien qu'embarque le QR, `/{locale}/verification/{code}/{hash}`, porte des
 * valeurs encodées : la clé est une suite base64, avec `+`, `/` et `=` — des
 * caractères qui voyagent mal dans un chemin d'URL et arrivent donc en `%2B`,
 * `%2F`, `%3D`. Les segments peuvent aussi être collés à la main avec des
 * espaces. Un décodage qui échoue n'est pas une erreur de page : le champ est
 * pré-rempli tel quel et l'utilisateur corrige — c'est le « et sinon, je tape
 * moi-même » de la page ouverte sans rien.
 */

/** Un seul segment, décodé et borné — jamais de contrôle, jamais de 4 Ko. */
export function decodeSegmentParam(value: string | string[] | undefined, max = 200): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';
  let out = raw;
  try {
    out = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    // `%` mal échappé : on garde la valeur brute, le contrôle signalera le format.
  }
  return out.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** Vrai si l'un des deux au moins est arrivé — l'écran affiche alors sa bannière. */
export function hasPrefill(code: string, hash: string): boolean {
  return code.length > 0 || hash.length > 0;
}
