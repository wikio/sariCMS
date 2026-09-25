/**
 * lib/settings-doc.ts — réglages d'écran partagés, en base.
 *
 * Cinq magasins vivaient uniquement dans le `localStorage` du poste qui les
 * avait saisis : les réglages de l'écran Paramètres, la configuration de la
 * boutique, les taxonomies, les devises et les modes de paiement. Un second
 * administrateur ne les voyait pas, un changement de poste les effaçait, et la
 * vitrine — qui lit ces formats de date et de code dans le même cache — ne
 * pouvait pas les connaître chez le visiteur.
 *
 * Le pont suit `lib/shop-sync.ts`, et pour la même raison : ces valeurs sont
 * lues **synchroniquement** par une vingtaine de composants. Tout passer en
 * `await` aurait touché la vitrine entière. On garde donc le cache local pour la
 * lecture, et la réplication part en arrière-plan.
 *
 * Le premier contact est le point sensible, et `decidePull()` est réutilisé
 * plutôt que redéveloppé : sur une base neuve, télécharger « rien » et l'écrire
 * dans le cache détruit ce qu'on vient de sauver — le défaut corrigé pour les
 * coupons. La règle est la même ici : la base fait autorité dès qu'une ligne y
 * figure ; sinon, si ce poste ne s'est jamais synchronisé, on pousse d'abord.
 */
import { cmsAdminFetch } from '@/lib/cms-admin';
import { decidePull } from '@/lib/shop-mapping';

export type DocKind = 'admin' | 'shop' | 'taxonomies' | 'currencies' | 'payments' | 'notify';

interface DocSpec {
  /** Clé `localStorage` du magasin existant — la source de vérité du poste. */
  cacheKey: string;
  /** `array` : le magasin stocke une liste nue, la base l'enveloppe. */
  shape: 'object' | 'array';
  /**
   * Champs qui ne quittent **pas** le navigateur.
   *
   * Le serveur les refuserait aussi (liste blanche dans
   * `settings-docs.service.ts`), mais ne pas les envoyer vaut mieux que les
   * envoyer pour qu'ils soient jetés à l'arrivée : `smtp.pass`, `erp.apiKey`,
   * `db.url` et `shop.importApi.apiKey` sont des identifiants, et la base de
   * données est copiée, sauvegardée, lisible par bien plus de monde que le
   * poste d'un opérateur.
   */
  strip: readonly string[];
}

export const DOC_SPECS: Record<DocKind, DocSpec> = {
  admin: { cacheKey: 'sari_admin_settings', shape: 'object', strip: ['smtp', 'db', 'erp'] },
  shop: { cacheKey: 'sari_shop_config', shape: 'object', strip: ['importApi'] },
  taxonomies: { cacheKey: 'sari_taxonomies', shape: 'object', strip: [] },
  currencies: { cacheKey: 'sari_currencies', shape: 'array', strip: [] },
  payments: { cacheKey: 'sari_payments', shape: 'array', strip: [] },
  notify: { cacheKey: 'sari_notify_messages', shape: 'array', strip: [] },
};

export const DOC_KINDS = Object.keys(DOC_SPECS) as DocKind[];

/**
 * Émis après toute écriture du cache depuis la base.
 *
 * Un écran qui copie le magasin dans son `useState` au montage ne relit **jamais**
 * sans s'y abonner : la base arrive une fraction de seconde après, et l'écran reste
 * sur ce que le navigateur contenait — vide sur un poste neuf, ou périmé. C'est le
 * symptôme remonté sur « Modes de paiement » : rien n'affiché alors que la base
 * était remplie. L'abonnement se fait par `useDocRefresh` (`lib/use-settings-doc.ts`),
 * une fois pour tous les écrans de réglages.
 */
export const DOC_EVENT = 'sari-settings-doc-changed';

/**
 * Événements propres à un magasin, à émettre en plus du générique.
 *
 * Les composants publics ne connaissent que leurs événements à eux (`sari-currencies`
 * pour les en-têtes de prix, `sari-payments-changed` pour le relevé) ; un
 * `writeCache` qui n'émettait que l'événement des écrans de réglages laissait ces
 * composants-là sur leur valeur du chargement.
 */
const EXTRA_EVENTS: Partial<Record<DocKind, string[]>> = {
  currencies: ['sari-currencies'],
  payments: ['sari-payments-changed'],
  taxonomies: ['sari-taxonomies'],
};

const syncedKey = (kind: DocKind) => `sari_doc_synced_${kind}`;
const backupKey = (kind: DocKind) => `sari_doc_backup_${kind}`;

interface DocStatus {
  kind?: string;
  document?: unknown;
  payload?: unknown;
  source?: 'db' | 'default';
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Contenu du poste, sans les champs confidentiels. */
export function readLocalDoc(kind: DocKind): unknown {
  const spec = DOC_SPECS[kind];
  const raw = readJson<unknown>(spec.cacheKey, spec.shape === 'array' ? [] : {});
  if (spec.shape === 'array') return Array.isArray(raw) ? raw : [];
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(source)) {
    if (!spec.strip.includes(field)) out[field] = value;
  }
  return out;
}

/** Vrai si le poste a quelque chose qui mérite d'être monté. */
function localHasContent(kind: DocKind): boolean {
  const local = readLocalDoc(kind);
  if (Array.isArray(local)) return local.length > 0;
  return !!local && typeof local === 'object' && Object.keys(local).length > 0;
}

function writeCache(kind: DocKind, payload: unknown): void {
  if (payload === undefined || payload === null) return;
  localStorage.setItem(DOC_SPECS[kind].cacheKey, JSON.stringify(payload));
  // Les en-têtes et les autres postes s'abonnent à ces événements ; les écrans de
  // réglages aussi, via `useDocRefresh`. Sans émission, le composant qui a déjà lu
  // le magasin garde sa copie et le changement ne se voit qu'au rechargement.
  window.dispatchEvent(new CustomEvent(DOC_EVENT, { detail: { kind } }));
  for (const name of EXTRA_EVENTS[kind] ?? []) window.dispatchEvent(new Event(name));
}

/** Envoie le contenu du poste et renvoie ce que la base contient après. */
async function pushDoc(kind: DocKind, payload: unknown): Promise<unknown> {
  const status = await cmsAdminFetch<DocStatus>(`/settings/doc/${kind}`, {
    method: 'PUT',
    json: payload,
    timeoutMs: 12000,
  });
  return status?.payload;
}

/**
 * Télécharge un réglage et remplit le cache — sans écraser le poste au passage.
 */
export async function pullDoc(kind: DocKind): Promise<{ seeded: boolean }> {
  const status = await cmsAdminFetch<DocStatus>(`/settings/doc/${kind}`, { timeoutMs: 8000 });
  if (typeof window === 'undefined') return { seeded: false };

  const serverPresent = status?.source === 'db';
  const hasLocal = localHasContent(kind);
  const decision = decidePull({
    serverCount: serverPresent ? 1 : 0,
    localCount: hasLocal ? 1 : 0,
    hasSyncedBefore: localStorage.getItem(syncedKey(kind)) !== null,
  });

  // Copie avant toute réécriture : `setItem` est définitif.
  if (hasLocal) localStorage.setItem(backupKey(kind), JSON.stringify(readLocalDoc(kind)));
  localStorage.setItem(syncedKey(kind), new Date().toISOString());

  if (decision === 'seed') {
    const pushed = await pushDoc(kind, readLocalDoc(kind)).catch(() => undefined);
    writeCache(kind, pushed ?? readLocalDoc(kind));
    return { seeded: true };
  }
  if (decision === 'overwrite') writeCache(kind, status?.payload);
  return { seeded: false };
}

/**
 * Amorçage des écrans concernés : tire la base, et branche la réplication sur
 * `saveAdminSettings()`. Les échecs sont tolérés — hors ligne, le cache local
 * rend l'écran utilisable et la synchronisation reprend au chargement suivant.
 */
export type DocsHydration = { seeded: DocKind[] };

export async function hydrateDocs(): Promise<DocsHydration> {
  const result: DocsHydration = { seeded: [] };
  if (typeof window === 'undefined') return result;
  await Promise.all(
    DOC_KINDS.map((kind) =>
      pullDoc(kind)
        .then(({ seeded }) => {
          if (seeded) result.seeded.push(kind);
        })
        .catch(() => undefined),
    ),
  );
  return result;
}

/**
 * À appeler après un enregistrement local : la page vient d'écrire dans son
 * cache, on envoie le contenu complet du poste. Une seule fonction pour les cinq
 * écrans, parce qu'un oubli ici se voit des semaines plus tard, chez quelqu'un
 * d'autre.
 */
export function syncDoc(kind: DocKind): void {
  if (typeof window === 'undefined') return;
  void pushDoc(kind, readLocalDoc(kind))
    .then((after) => {
      // Les listes nues seulement, et pour une raison précise : la réponse d'un
      // objet est la projection de la liste blanche du serveur. Repartir d'elle
      // effacerait du cache tout ce que le serveur ne connaît pas encore —
      // `smtp`, `db`, `erp`, mais aussi un champ d'écran ajouté côté navigateur
      // avant d'entrer dans `DOC_SPECS` côté backend. L'adoption d'une projection
      // est une perte de données poliment présentée.
      if (DOC_SPECS[kind].shape === 'array' && after !== undefined && after !== null) {
        writeCache(kind, after);
      }
    })
    .catch(() => {
      /* hors ligne : le cache local reste, le prochain chargement repoussera */
    });
}
