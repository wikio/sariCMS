/**
 * lib/canvas/image-load.ts — charger une image de la GED sans la rendre injouable.
 *
 * Le besoin, en une phrase : une image posée dans l'atelier (fond, planche ouverte
 * depuis la médiathèque, détourage) doit se CHARGER, et son rendu doit pouvoir être
 * exporté en PNG. Les deux tiennent à un seul attribut, `crossOrigin`, et il est
 * mal aisé de le mettre bien :
 *
 * - le mettre alors que le fichier est servi par le même serveur — ce qui est le cas
 *   de tout `public/uploads/…` — ajoute une exigence de en-têtes CORS à une requête
 *   qui n'en a pas besoin. Un proxy d'admin, un `localhost` vs `127.0.0.1`, un
 *   hôtes de dev qui changent de port, et l'image ne répond plus : « image non
 *   chargeable », alors que le `<img>` de la page, lui, s'affiche très bien ;
 * - ne pas le mettre sur une image VRAIMENT distante tache le canvas : `toDataURL`
 *   lève et l'export devient impossible.
 *
 * La règle est donc tranchée à un seul endroit : même origine ⇒ on ne demande pas
 * CORS (rien à tacher, rien à refuser) ; origine différente ⇒ `anonymous`, et on le
 * dit à l'utilisateur quand l'image refuse de se charger.
 */

/** Une URL est-elle servie par le même serveur que la page ? (chemin relatif compris) */
export function isSameOrigin(src: string): boolean {
  if (typeof window === 'undefined') return true;
  const raw = String(src || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return true;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return true; // `/uploads/…`, `./x.png`
  try {
    return new URL(raw, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * La valeur de `crossOrigin` à demander pour `src` : `null` = ne rien demander,
 * ce qu'il faut pour un fichier du même serveur.
 */
export function crossOriginFor(src: string): 'anonymous' | 'use-credentials' | null {
  return isSameOrigin(src) ? null : 'anonymous';
}

/**
 * Un message d'erreur qui dit quoi faire, plutôt que « non chargeable ».
 *
 * Les trois causes réelles d'un échec sur un média du projet sont faciles à confondre
 * depuis le navigateur ; les distinguer est ce qui fait gagner le temps.
 */
export function imageLoadHint(src: string, status?: number): string {
  const raw = String(src || '');
  if (!raw) return 'Aucune adresse d’image à charger.';
  if (/^https?:\/\//i.test(raw) && !isSameOrigin(raw)) {
    return `Image distante : ${raw.slice(0, 80)} n’autorise pas la lecture par le canvas (CORS). Copie-la dans la GED pour la retoucher.`;
  }
  if (status === 404 || status === 403) {
    return `Image introuvable sur le serveur (${status}) : ${raw}. Le fichier a été renommé ou déplacé — vérifie le chemin dans la GED.`;
  }
  return `Image introuvable ou illisible : ${raw}. Si le fichier vit hors de public/uploads, dépose-le d’abord dans la GED.`;
}

/**
 * Charger une image en demandant le compte pour savoir ce qui a cassé.
 *
 * `HTMLImageElement` ne dit pas pourquoi il a échoué — et un 404 derrière un proxy
 * renvoie parfois du HTML, ce qui n'est pas davantage lisible. On suit donc la même
 * piste qu'un navigateur : d'abord une `GET` (qui voit le code HTTP), puis le décodage
 * par l'`<img>` lui-même.
 */
export async function loadHtmlImage(src: string): Promise<{ image: HTMLImageElement; status: number | null }> {
  let status: number | null = null;
  if (!src.startsWith('data:') && !src.startsWith('blob:')) {
    try {
      const head = await fetch(src, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' });
      status = head.status;
    } catch {
      status = null;
    }
  }
  const image = new Image();
  const crossOrigin = crossOriginFor(src);
  if (crossOrigin) image.crossOrigin = crossOrigin;
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(imageLoadHint(src, status ?? undefined)));
    image.src = src;
  });
  return { image, status };
}

/**
 * Un document (JSON Fabric) dont on retire la mention de CORS des images du serveur.
 *
 * Fabric écrit `crossOrigin: "anonymous"` dans le JSON de toute image chargée avec
 * cet attribut — et le relit tel quel. Conséquence vérifiée : un gabarit livré avec
 * son logo `/canvas/placeholder.svg` devient CHARGÉ-D'ÉCHEC chez quiconque sert le
 * site derrière un proxy ou sous un autre nom d'hôte, et `loadFromJSON` rejette le
 * document entier (tous les gabarits « ne marchent pas », sans un mot d'erreur).
 * Une image locale n'a rien à négocier : on purge la clé à l'entrée et à la sortie.
 */
export function normalizeDocumentCrossOrigin<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    const next: Record<string, unknown> = { ...record };
    if (typeof next.src === 'string' && isSameOrigin(next.src)) delete next.crossOrigin;
    if (next.objects) next.objects = walk(next.objects);
    return next;
  };
  return walk(value) as T;
}
