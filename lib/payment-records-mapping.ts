/**
 * lib/payment-records-mapping.ts — conversions écran ↔ API pour les encaissements,
 * et calcul des retraits.
 *
 * Module volontairement pur : aucun import exécuté, aucun `localStorage`, aucun
 * `window`. C'est ce qui permet de le tester avec `node --experimental-strip-types`
 * (`npm run payments:test`), comme `lib/shop-mapping.ts` pour les coupons. Ce qui
 * se joue ici est précisément le genre de conversion qui casse en silence : un
 * montant qui repart en chaîne depuis un champ nombre, une date que le serveur
 * refuse, un retrait oublié qui laisse un encaissement fantôme dans les totaux.
 */
import type { PaymentRecord } from '@/lib/payments';

type Row = Record<string, unknown>;

/** Ligne du navigateur → corps d'API. `id` local devient `externalId`. */
export function recordToApi(row: PaymentRecord): Row {
  const body: Row = {
    externalId: String(row.id),
    client: String(row.client ?? '').trim(),
    method: String(row.method ?? 'transfer'),
    amount: Number(row.amount) || 0,
    status: row.status === 'validated' || row.status === 'rejected' ? row.status : 'pending',
    date: String(row.date ?? new Date().toISOString()),
  };
  // Un `null` explicite écrase la valeur en base ; une clé absente la laisse.
  // Distinction importante ici : `orderId = null` veut dire « non rattaché »,
  // alors que l'omettre veut dire « je ne sais pas » — envoyer `null` par
  // inattention détacherait un paiement de sa commande.
  if (row.orderId !== undefined) body.orderId = row.orderId;
  if (row.orderCode !== undefined) body.orderCode = row.orderCode;
  if (row.email !== undefined) body.email = row.email;
  if (row.methodName !== undefined) body.methodName = row.methodName;
  if (row.note !== undefined) body.note = row.note;
  // Le magasin écrit toujours les deux champs ; une ligne ancienne ou reprise à la
  // main peut ne porter que le masque. Le récupérer coûte trois lignes et évite
  // qu'un poste qui a la bonne carte n'envoie rien.
  const fromMask = /(\d{4})\s*$/.exec(String(row.cardMasked ?? ''))?.[1];
  const last4 = row.cardLast4 || fromMask;
  if (last4) body.cardLast4 = last4;
  if (row.validatedAt) body.validatedAt = row.validatedAt;
  // L'identifiant de base, quand le poste le connaît : un `PATCH` ciblé plutôt
  // qu'une réappariement par `externalId`, et surtout la garantie qu'une ligne
  // retrouvée n'est pas recréée si l'`externalId` local a été égaré (cache vidé à
  // moitié, reprise manuelle).
  if (typeof row.dbId === 'number' && Number.isInteger(row.dbId) && row.dbId > 0) {
    body.id = row.dbId;
  }
  return body;
}

/** Ligne d'API → forme que l'écran manipulait avant la mise en base. */
export function recordFromApi(row: Row): PaymentRecord {
  const status = row.status === 'validated' || row.status === 'rejected' ? row.status : 'pending';
  const cardLast4 = typeof row.cardLast4 === 'string' ? row.cardLast4 : undefined;
  return {
    // Le cache local garde l'identifiant du navigateur quand il existe : c'est
    // celui que les actions de l'écran (valider, refuser, supprimer) manipulent.
    // Sans lui, on retombe sur celui de la base, devenu l'identifiant stable.
    id: String(row.externalId || row.id || ''),
    // Les deux sont conservés, et pour des raisons distinctes : `id` pour les
    // gestes de l'écran et l'appariement à l'envoi, `dbId` pour adresser la ligne
    // côté serveur sans repasser par une recherche.
    dbId: Number.isInteger(Number(row.id)) && Number(row.id) > 0 ? Number(row.id) : undefined,
    orderId: row.orderId === null || row.orderId === undefined ? null : Number(row.orderId),
    orderCode: typeof row.orderCode === 'string' ? row.orderCode : undefined,
    client: String(row.client ?? ''),
    email: String(row.email ?? ''),
    method: (String(row.method ?? 'transfer') as PaymentRecord['method']),
    methodName: String(row.methodName ?? ''),
    amount: Number(row.amount) || 0,
    status,
    cardLast4,
    cardMasked: cardLast4 ? `**** **** **** ${cardLast4}` : undefined,
    note: typeof row.note === 'string' ? row.note : undefined,
    date: String(row.date ?? ''),
    validatedAt: row.validatedAt ? String(row.validatedAt) : undefined,
  };
}

/**
 * `externalId` des lignes disparues entre deux états du cache.
 *
 * Le seul chemin par lequel une suppression d'encaissement atteint la base : le
 * serveur ignore les absences (un poste partiellement à jour effacerait otherwise
 * des lignes enregistrées ailleurs), donc un retrait doit être nommé.
 *
 * Deux précautions, toutes deux tirées du défaut corrigé sur les coupons :
 *
 * - une liste `next` **vide** n'est pas un tas de retraits si le poste n'a jamais
 *   synchronisé : `previous` est alors vide aussi, et l'ensemble ne produit rien ;
 * - l'appariement se fait sur `id` local, qui est l'`externalId` en base — jamais
 *   sur un index de tableau, qui décalerait les retraits à la première ligne
 *   ajoutée.
 */
export function planPaymentRemoved(previous: PaymentRecord[], next: PaymentRecord[]): string[] {
  // `trim()` des deux côtés : un identifiant lu dans un champ texte peut garder sa
  // espace, et le déclarer « retiré » pour si peu effacerait une écriture réelle.
  const key = (row: PaymentRecord) => String(row?.id ?? '').trim();
  const kept = new Set(next.map(key).filter(Boolean));
  const out: string[] = [];
  for (const row of previous) {
    const id = key(row);
    if (!id || kept.has(id)) continue;
    out.push(id);
  }
  return out;
}
