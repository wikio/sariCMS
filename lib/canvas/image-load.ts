/**
 * lib/canvas/image-load.ts — charger une image sans se battre avec le CORS.
 *
 * Le besoin tient en une ligne : un visuel posé dans l'atelier doit s'afficher,
 * qu'il vienne de `public/uploads` (même origine) ou d'un CDN (origine différente).
 *
 * Et c'est précisément là que Fabric 6 est piégeux : `FabricImage.fromURL(url, options)`
 * fait `this.setOptions(options)` — donc `crossOrigin: undefined` n'est **pas** « ne pas
 * mettre d'attribut », c'est un `undefined` qui masque l'héritage et laisse l'élément
 * `<img>` sans CORS. Le canvas devient « souillé » (`tainted`), `toDataURL` de l'export
 * lève une SecurityError, et l'image disparaît de l'aperçu. À l'inverse, exiger
 * `crossOrigin: 'anonymous'` sur une image servie par le **même** serveur sans en-tête
 * `Access-Control-Allow-Origin` fait échouer le chargement — c'est le « Image non
 * chargeable » que produisaient les planches dont l'URL avait été reconstruite de
 * travers, et ce que produit encore tout média local chargé par un composant qui pose
 * l'attribut par défaut (`components/admin/ImageEditor.tsx` le faisait).
 *
 * Une règle unique, donc, déduite de l'URL :
 *
 * - **même origine** (chemin relatif, `blob:`, `data:` ou URL dont l'origine est la
 *   nôtre) → aucun attribut, aucun en-tête, aucun échec possible ;
 * - **origine différente** → `anonymous`, comme le veut un CDN qui renvoie
 *   `Access-Control-Allow-Origin: *`.
 */

/** L'origine d'un document, tolérante au serveur sans rendu (tests, SSG). */
function currentOrigin(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  return window.location.origin || null;
}

/** Une URL est-elle servie par la même origine que l'atelier (ou n'en sort-elle jamais) ? */
export function isSameOrigin(src: string): boolean {
  const value = String(src || '').trim();
  if (!value) return true;
  if (value.startsWith('data:') || value.startsWith('blob:')) return true;
  if (value.startsWith('//')) {
    // Protocole relatif : même origine que la page, par définition.
    return true;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return true; // `/uploads/...`, `photo.png`
  const origin = currentOrigin();
  if (!origin) return false; // pas de fenêtre : on suppose l'extérieur, plus sûr
  try {
    return new URL(value, origin).origin === origin;
  } catch {
    return false;
  }
}

/**
 * La valeur de `crossOrigin` à demander pour cette source, ou `undefined` pour ne rien
 * demander du tout. `undefined` n'est jamais passé explicitement à Fabric : le
 * composant omet la clé (voir le commentaire d'en-tête sur `setOptions`).
 */
export function crossOriginFor(src: string): 'anonymous' | 'use-credentials' | undefined {
  return isSameOrigin(src) ? undefined : 'anonymous';
}

/**
 * Les options d'un `FabricImage.fromURL`, prêtes à être éparpillées dans l'appel :
 * la clé `crossOrigin` n'existe que si elle a une valeur réelle.
 */
export function imageLoadHint(src: string): { crossOrigin?: 'anonymous' | 'use-credentials' } {
  const crossOrigin = crossOriginFor(src);
  return crossOrigin ? { crossOrigin } : {};
}

/**
 * Un `<img>` de DOM, chargé selon la même règle.
 *
 * Utilisé hors du canvas (mesure d'une image, prévisualisation) ; les promesses de
 * `FabricImage.fromURL` ne se rattrapent pas, celle-ci non plus, mais l'appelant garde
 * la main sur le message d'erreur.
 */
export function loadHtmlImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const crossOrigin = crossOriginFor(src);
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.decoding = 'async';
    const abort = () => {
      image.src = '';
      reject(new DOMException('aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
    }
    image.onload = () => {
      signal?.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new Error(`Image non chargeable : ${src}`));
    };
    image.src = src;
  });
}

/**
 * Nettoie un document sérialisé des exigences CORS inutiles.
 *
 * Un état enregistré garde la clé `crossOrigin` de chaque image (`toObject` la
 * sérialise) : rejouer sur un autre serveur — ou rejouer une image qui, entre-temps,
 * est servie en local — peut donc faire échouer `loadFromJSON` **entier**, sans un mot
 * sur l'objet fautif. On retire la clé pour toute source qui est aujourd'hui de la
 * même origine ; le reste garde ce qu'il avait demandé.
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

/**
 * Un document allégé de ses images : le plan de repli quand `loadFromJSON` a échoué.
 *
 * Pourquoi ce remède plutôt qu'un try/catch objet par objet : Fabric 6 ne fournit pas
 * de chargement sélectif — un seul objet d'image illisible fait rejeter la promesse du
 * document tout entier, et l'atelier se retrouve vide sans que rien ne dise quel
 * fichier est en cause. Perdre les visuels et garder les calques, les textes, les
 * masques et le format, c'est encore pouvoir travailler ; le message qui accompagne le
 * repli nomme l'étape, et l'utilisateur n'a plus qu'à re-poser les images.
 *
 * `keepBackground` : on peut vouloir garder le fond en dégradé ou en couleur — un fond
 * **image** est toujours retiré, c'est souvent lui qui casse.
 */
export function withoutImages<T>(value: T, options: { keepBackground?: boolean } = {}): { document: T; dropped: string[] } {
  const dropped: string[] = [];
  if (!value || typeof value !== 'object') return { document: value, dropped };
  const source = value as Record<string, unknown>;

  const walk = (nodes: unknown): unknown[] => {
    const kept: unknown[] = [];
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node || typeof node !== 'object') continue;
      const record = node as Record<string, unknown>;
      if (record.type === 'image') {
        dropped.push(String(record.src || '(sans source)'));
        continue; // un image de Fabric n'a pas d'enfants ; le groupe, si, est traité plus bas
      }
      const next: Record<string, unknown> = { ...record };
      if (Array.isArray(next.objects)) {
        const children = walk(next.objects);
        // Un groupe vidé de tous ses enfants n'a plus rien à peindre, et Fabric n'aime
        // pas les groupes vides : on le laisse tomber avec eux.
        if (!children.length) {
          dropped.push(String(record.type || 'groupe'));
          continue;
        }
        next.objects = children;
      }
      kept.push(next);
    }
    return kept;
  };

  const next: Record<string, unknown> = { ...source, objects: walk(source.objects) };
  if (!options.keepBackground) {
    delete next.backgroundImage;
    if (source.sariStudio && typeof source.sariStudio === 'object') {
      const studio = source.sariStudio as Record<string, unknown>;
      if (studio.background && typeof studio.background === 'object' && (studio.background as Record<string, unknown>).mode === 'image') {
        dropped.push(String((studio.background as Record<string, unknown>).src || '(fond sans source)'));
        next.sariStudio = { ...studio, background: { mode: 'solid', color: '#ffffff' } };
      }
    }
  }
  return { document: next as unknown as T, dropped };
}
