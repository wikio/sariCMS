/**
 * Statistiques d'activité d'un compte, calculées côté navigateur.
 *
 * Les commandes, devis et candidatures vivent dans le stockage local
 * (`sari_orders`, `sari_applications`) tant que la reprise MySQL n'est pas
 * généralisée. Cette couche les agrège par compte pour la liste des
 * utilisateurs, sans dupliquer la logique dans chaque écran.
 *
 * Toutes les fonctions renvoient des compteurs à zéro côté serveur : elles
 * lisent `localStorage`, absent du rendu serveur.
 */

export interface ClientStats {
  orders: number;
  quotes: number;
  paid: number;
  pending: number;
  revenue: number;
}

export interface CandidateStats {
  applications: number;
  accepted: number;
  rejected: number;
  pending: number;
}

function lireJson<T>(cle: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const brut = window.localStorage.getItem(cle);
    const parsed = brut ? JSON.parse(brut) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Comparaison d'adresses e-mail : casse et espaces ignorés. */
function memeEmail(a: unknown, b: unknown): boolean {
  const x = String(a ?? '').trim().toLowerCase();
  const y = String(b ?? '').trim().toLowerCase();
  return Boolean(x) && x === y;
}

/** Commandes, devis et chiffre d'affaires d'un client ou d'un partenaire. */
export function clientStats(email: string, userId?: string | number): ClientStats {
  type Commande = {
    userId?: string | null;
    customerEmail?: string;
    isQuote?: boolean;
    status?: string;
    grandTotal?: number;
    totalAmount?: number;
  };
  const toutes = lireJson<Commande>('sari_orders');
  const miennes = toutes.filter(
    (o) => memeEmail(o.customerEmail, email) || (userId != null && String(o.userId ?? '') === String(userId)),
  );

  // Un devis est marqué `isQuote`, ou porte le statut `quote_requested` selon
  // le chemin de création : les deux doivent être comptés comme devis.
  const estDevis = (o: Commande) => Boolean(o.isQuote) || o.status === 'quote_requested';
  const commandes = miennes.filter((o) => !estDevis(o));

  return {
    orders: commandes.length,
    quotes: miennes.filter(estDevis).length,
    paid: commandes.filter((o) => ['paid', 'shipped', 'delivered'].includes(String(o.status))).length,
    pending: commandes.filter((o) => ['pending', 'pending_payment'].includes(String(o.status))).length,
    // Seules les commandes réglées comptent : additionner les paniers en
    // attente gonflerait artificiellement le chiffre d'affaires.
    revenue: commandes
      .filter((o) => ['paid', 'shipped', 'delivered'].includes(String(o.status)))
      .reduce((somme, o) => somme + Number(o.grandTotal ?? o.totalAmount ?? 0), 0),
  };
}

/** Candidatures d'un candidat et leur issue. */
export function candidateStatsFor(email: string): CandidateStats {
  type Candidature = { email?: string; status?: string };
  const miennes = lireJson<Candidature>('sari_applications').filter((a) => memeEmail(a.email, email));
  return {
    applications: miennes.length,
    accepted: miennes.filter((a) => a.status === 'accepted').length,
    rejected: miennes.filter((a) => a.status === 'rejected').length,
    pending: miennes.filter((a) => ['new', 'reviewed', 'interview'].includes(String(a.status))).length,
  };
}

/**
 * Code lisible d'un compte, du type `CLI-000042`.
 *
 * La base n'expose qu'un identifiant numérique, peu parlant au téléphone ou
 * sur un document. Le préfixe rappelle le type et le numéro reste celui de la
 * base, donc la correspondance est immédiate.
 */
export function userCode(type: unknown, id: unknown): string {
  const prefixes: Record<string, string> = {
    admin: 'ADM',
    client: 'CLI',
    partner: 'PRT',
    candidate: 'CND',
  };
  const prefixe = prefixes[String(type ?? '')] || 'USR';
  const brut = String(id ?? '').trim();
  if (!brut) return `${prefixe}-------`;
  // Identifiant numérique : on complète à six chiffres. UUID : on garde les
  // huit premiers caractères, suffisants pour distinguer les comptes.
  const numero = /^\d+$/.test(brut) ? brut.padStart(6, '0') : brut.slice(0, 8).toUpperCase();
  return `${prefixe}-${numero}`;
}
