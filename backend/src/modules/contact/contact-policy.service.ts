import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { SETTING_REPOSITORY } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import {
  ContactPolicy,
  isSingleMailbox,
  ReviewReason,
  Route,
  SUBJECTS,
  Subject,
  Violation,
} from './contact-contract';

const KEY = 'contact_triage';
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exactly = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(v, k));
const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

export function defaultPolicy(): ContactPolicy {
  return {
    minConfidence: 90,
    spam: 'review',
    inappropriate: 'review',
    mismatch: 'review',
    penaltyPoints: 0,
    routes: Object.fromEntries(SUBJECTS.map((s) => [s, { mode: 'company' }])) as Record<Subject, Route>,
  };
}

/** Valide aussi la relecture : une règle corrompue ne doit jamais ouvrir un transfert. */
export function parsePolicy(raw: unknown): ContactPolicy {
  if (
    !isObject(raw) ||
    !exactly(raw, ['minConfidence', 'spam', 'inappropriate', 'mismatch', 'penaltyPoints', 'routes']) ||
    !inRange(raw.minConfidence, 50, 100) ||
    !inRange(raw.penaltyPoints, 0, 100) ||
    (raw.spam !== 'review' && raw.spam !== 'discard') ||
    (raw.inappropriate !== 'review' && raw.inappropriate !== 'discard') ||
    (raw.mismatch !== 'review' && raw.mismatch !== 'reclassify') ||
    !isObject(raw.routes) ||
    !exactly(raw.routes, SUBJECTS)
  ) {
    throw new BadRequestException('Règles de tri du contact invalides.');
  }
  const routes = {} as ContactPolicy['routes'];
  for (const s of SUBJECTS) {
    const r = raw.routes[s];
    if (isObject(r) && (r.mode === 'inbox' || r.mode === 'company') && exactly(r, ['mode']))
      routes[s] = { mode: r.mode };
    else if (
      isObject(r) &&
      r.mode === 'external' &&
      exactly(r, ['mode', 'email']) &&
      typeof r.email === 'string' &&
      isSingleMailbox(r.email) &&
      isEmail(r.email)
    )
      routes[s] = { mode: 'external', email: r.email };
    else throw new BadRequestException(`Destination invalide : ${s}. Une seule adresse est admise.`);
  }
  return {
    minConfidence: raw.minConfidence,
    spam: raw.spam,
    inappropriate: raw.inappropriate,
    mismatch: raw.mismatch,
    penaltyPoints: raw.penaltyPoints,
    routes,
  };
}

@Injectable()
export class ContactPolicyService {
  private writes: Promise<void> = Promise.resolve();
  constructor(@Inject(SETTING_REPOSITORY) private readonly repo: ICrudRepository<BaseEntity>) {}
  async read(): Promise<ContactPolicy> {
    const row = await this.repo.findOne({ key: KEY });
    return row ? parsePolicy(row.value) : defaultPolicy();
  }
  async save(raw: unknown, actorId?: number): Promise<ContactPolicy> {
    const value = parsePolicy(raw);
    // Deux premiers enregistrements simultanés ne doivent pas créer deux règles dans le magasin JSON.
    const write = this.writes.then(async () => {
      const row = await this.repo.findOne({ key: KEY }, true);
      const data = { key: KEY, group: 'contact', value, updatedBy: actorId, deletedAt: null };
      if (row) await this.repo.update(row.id, data);
      else await this.repo.create({ ...data, createdBy: actorId });
    });
    this.writes = write.catch(() => undefined);
    await write;
    return value;
  }
}

export interface Verdict {
  spam: boolean;
  inappropriate: boolean;
  matchesSubject: boolean;
  suggestedSubject: Subject | null;
  confidence: number;
}
export type Decision =
  | { action: 'discard'; reason: Violation }
  | { action: 'review'; reason: ReviewReason }
  | { action: 'accept'; reason: 'matched' | 'mismatch'; subject: Subject };

export function decide(policy: ContactPolicy, selected: Subject, verdict: Verdict | null): Decision {
  if (!verdict) return { action: 'review', reason: 'ai_unavailable' };
  if (verdict.confidence < policy.minConfidence) return { action: 'review', reason: 'uncertain' };
  // Un signal de contenu abusif prime sur un changement de catégorie, jamais de transfert dans ce cas.
  for (const reason of ['spam', 'inappropriate'] as const) {
    if (verdict[reason]) return { action: policy[reason], reason };
  }
  if (verdict.matchesSubject) return { action: 'accept', subject: selected, reason: 'matched' };
  if (policy.mismatch === 'reclassify' && verdict.suggestedSubject && verdict.suggestedSubject !== selected) {
    return { action: 'accept', subject: verdict.suggestedSubject, reason: 'mismatch' };
  }
  return { action: 'review', reason: 'mismatch' };
}
