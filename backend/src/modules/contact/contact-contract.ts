/** Contrat partagé par Nest et la vitrine. Aucun secret, client HTTP ou import Nest ici. */
export const SUBJECTS = ['devis', 'technique', 'commercial', 'rh', 'partenaire', 'client'] as const;
export type Subject = (typeof SUBJECTS)[number];
export const isSubject = (v: unknown): v is Subject => SUBJECTS.some((s) => s === v);
export const CONTACT_STATUSES = ['review', 'new', 'read', 'archived'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type Violation = 'spam' | 'inappropriate';
export type Route = { mode: 'inbox' } | { mode: 'company' } | { mode: 'external'; email: string };
/** Une seule boîte, sans nom d'affichage ni séparateur de destinataires. Nest valide aussi le format e-mail. */
export const isSingleMailbox = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 254 && /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(v);
export type RoutingPlan =
  | { mode: 'inbox' }
  | { mode: 'company'; email: string | null }
  | { mode: 'external'; email: string };
export interface ContactPolicy {
  minConfidence: number;
  spam: 'review' | 'discard';
  inappropriate: 'review' | 'discard';
  mismatch: 'review' | 'reclassify';
  penaltyPoints: number;
  routes: Record<Subject, Route>;
}
export type ReviewReason = Violation | 'mismatch' | 'uncertain' | 'ai_unavailable' | 'policy_unavailable';
export interface ContactMeta {
  locale?: string;
  company?: string;
  selectedSubject?: Subject;
  suggestedSubject?: Subject;
  reason?: ReviewReason | 'matched';
  route?: RoutingPlan;
  followUp?: string;
  confidence?: number;
}
/** Réponse serveur à serveur uniquement. Aucune décision détaillée dans la réponse publique. */
export type IntakeResult =
  | { decision: 'discard' | 'review' }
  | { decision: 'accept'; id: number; subject: Subject; route: RoutingPlan };
/** L’API accepte éventuellement une nouvelle clé, mais aucun état renvoyé ne la contient. */
export interface ContactAiDraft {
  url: string;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
}
export interface ContactAiStatus {
  configured: boolean;
  model: string;
  source: 'admin' | 'env' | 'none' | 'unreadable';
  overrides: { url: string; model: string; hasKey: boolean; systemPrompt: string; userPromptTemplate: string };
}
export type ContactAiTestCode = 'ok' | 'incomplete' | 'auth' | 'unavailable' | 'invalidResponse';
export interface ContactPolicyState {
  policy: ContactPolicy;
  ai: ContactAiStatus;
}
export interface ContactDossier {
  score: number;
  total: number;
  notes: { id: number; points: number; reason: Violation; createdAt: string }[];
}
