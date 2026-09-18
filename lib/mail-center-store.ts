/**
 * lib/mail-center-store.ts — le stockage du centre de courrier.
 *
 * Tout vit dans `data/mail/` sous forme de fichiers JSON, conformément à la
 * convention du projet (`data/seo.json`, `data/verification.json`,
 * `data/newsletter.json`) : **aucune table, aucune migration, aucune base de
 * données**. Les fichiers sont créés au premier enregistrement et restent
 * lisibles et éditables à la main sur le serveur.
 *
 * Ce module est **serveur uniquement** (`fs`) — l'écran d'administration y
 * accède par `/api/admin/mail-center`, jamais directement.
 *
 * Trois garde-fous d'écriture :
 * 1. chaque écriture passe par un fichier temporaire puis `rename` — un
 *    processus interrompu ne laisse jamais un JSON tronqué ;
 * 2. toute valeur entrante est bornée (longueurs, plafonds) — un écran
 *    d'administration ne peut pas écrire un fichier de 50 Mo ;
 * 3. l'historique est élagué à chaque lecture selon `logRetentionDays`.
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_LAYOUT,
  DEFAULT_POLICY,
  defaultEventConfig,
  MAIL_EVENTS,
  type MailBlock,
  type MailEventConfig,
  type MailLayout,
  type MailPolicy,
  type MailSentEntry,
} from './mail-center';

const DIR = path.join(process.cwd(), 'data', 'mail');
const FILE_POLICY = path.join(DIR, 'policy.json');
const FILE_MODULES = path.join(DIR, 'modules.json');
const FILE_LAYOUTS = path.join(DIR, 'layouts.json');
const FILE_LOG = path.join(DIR, 'sent-log.json');

/** Plafonds d'écriture — un réglage n'a aucune raison de dépasser ces tailles. */
const MAX_SUBJECT = 255;
const MAX_BODY = 200_000;
const MAX_LAYOUTS = 40;
const MAX_BLOCKS = 40;
const MAX_LOG_ROWS = 5_000;
const MAX_NAME = 120;

export class MailCenterError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'MailCenterError';
  }
}

/* ------------------------------------------------------------------ I/O */

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Compteur de fichier temporaire — voir `writeJson`. */
let tmpSeq = 0;

/**
 * Écriture atomique : fichier temporaire dans le même dossier, puis rename.
 *
 * Le nom temporaire porte un compteur, pas seulement le PID : une diffusion
 * envoie plusieurs messages en parallèle depuis le même processus, et deux
 * écritures visant `sent-log.json.<pid>.tmp` se marchaient dessus — la première
 * renommait le fichier, la seconde échouait en `ENOENT` et laissait le journal
 * tronqué.
 */
async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  tmpSeq += 1;
  const tmp = `${file}.${process.pid}.${tmpSeq}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}

/**
 * File d'écriture du journal.
 *
 * `appendSentLog` est un lire-modifier-écrire : deux envois simultanés lisaient
 * le même contenu et le dernier écrasait l'entrée de l'autre. Les ajouts sont
 * donc mis bout à bout. Chaîne de promesses et non verrou : rien à libérer, et
 * un rejet n'empêche pas l'écriture suivante.
 */
let logQueue: Promise<void> = Promise.resolve();

const str = (value: unknown, max: number, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, max);
};

const num = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

/* -------------------------------------------------------------- Politique */

export function sanitizePolicy(input: unknown): MailPolicy {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<MailPolicy>;
  const quiet = (raw.quietHours && typeof raw.quietHours === 'object' ? raw.quietHours : {}) as Partial<MailPolicy['quietHours']>;
  const hhmm = (value: unknown, fallback: string): string => {
    const text = String(value ?? '');
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
  };
  return {
    masterEnabled: raw.masterEnabled !== false,
    dailyCap: num(raw.dailyCap, 1, 10_000, DEFAULT_POLICY.dailyCap),
    perRecipientDailyCap: num(raw.perRecipientDailyCap, 1, 1_000, DEFAULT_POLICY.perRecipientDailyCap),
    dedupeWindowMinutes: num(raw.dedupeWindowMinutes, 0, 10_080, DEFAULT_POLICY.dedupeWindowMinutes),
    quietHours: {
      enabled: !!quiet.enabled,
      from: hhmm(quiet.from, DEFAULT_POLICY.quietHours.from),
      to: hhmm(quiet.to, DEFAULT_POLICY.quietHours.to),
    },
    logRetentionDays: num(raw.logRetentionDays, 1, 730, DEFAULT_POLICY.logRetentionDays),
  };
}

export async function readPolicy(): Promise<MailPolicy> {
  return sanitizePolicy(await readJson<MailPolicy>(FILE_POLICY));
}

export async function writePolicy(policy: MailPolicy): Promise<void> {
  await writeJson(FILE_POLICY, policy);
}

/* ---------------------------------------------------------------- Modules */

function sanitizeEventConfig(eventId: string, input: unknown): MailEventConfig {
  const base = defaultEventConfig(eventId);
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<MailEventConfig>;
  return {
    enabled: !!raw.enabled,
    subject: str(raw.subject ?? base.subject, MAX_SUBJECT, base.subject),
    body: str(raw.body ?? base.body, MAX_BODY, base.body),
    layoutId: str(raw.layoutId ?? base.layoutId, 80, ''),
    bcc: str(raw.bcc ?? '', 255, '').trim(),
    minIntervalHours: num(raw.minIntervalHours, 0, 8_760, base.minIntervalHours),
  };
}

/**
 * Une configuration inconnue (événement retiré du catalogue) est écartée, et un
 * événement absent du fichier reçoit sa valeur par défaut : ajouter un événement
 * au catalogue ne casse jamais les réglages existants.
 */
export function sanitizeModules(input: unknown): Record<string, MailEventConfig> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, MailEventConfig> = {};
  for (const eventId of Object.keys(MAIL_EVENTS)) {
    out[eventId] = sanitizeEventConfig(eventId, raw[eventId]);
  }
  return out;
}

export async function readModules(): Promise<Record<string, MailEventConfig>> {
  return sanitizeModules(await readJson<Record<string, MailEventConfig>>(FILE_MODULES));
}

export async function writeModules(modules: Record<string, MailEventConfig>): Promise<void> {
  await writeJson(FILE_MODULES, modules);
}

/* --------------------------------------------------------------- Gabarits */

const BLOCK_TYPES: MailBlock['type'][] = ['logo', 'title', 'text', 'button', 'divider', 'image', 'content', 'footer'];

function sanitizeBlock(input: unknown, index: number): MailBlock {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<MailBlock>;
  const type = BLOCK_TYPES.includes(raw.type as MailBlock['type']) ? (raw.type as MailBlock['type']) : 'text';
  const align = (['left', 'center', 'right'] as const).includes(raw.align as 'left') ? raw.align : 'left';
  return {
    id: str(raw.id, 40, `b${index + 1}`),
    type,
    text: str(raw.text ?? '', 4_000),
    href: str(raw.href ?? '', 2_000),
    align,
  };
}

export function sanitizeLayout(input: unknown, index = 0): MailLayout {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<MailLayout>;
  const theme = { ...DEFAULT_LAYOUT.theme, ...(raw.theme && typeof raw.theme === 'object' ? raw.theme : {}) };
  const color = (value: unknown, fallback: string) =>
    /^#[0-9a-f]{3,8}$/i.test(String(value ?? '')) ? String(value) : fallback;
  const blocks = Array.isArray(raw.blocks) ? raw.blocks.slice(0, MAX_BLOCKS) : DEFAULT_LAYOUT.blocks;
  return {
    id: str(raw.id, 80, `layout-${Date.now()}`),
    name: str(raw.name, MAX_NAME, `Gabarit ${index + 1}`),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    theme: {
      ...theme,
      background: color(theme.background, DEFAULT_LAYOUT.theme.background),
      card: color(theme.card, DEFAULT_LAYOUT.theme.card),
      accent: color(theme.accent, DEFAULT_LAYOUT.theme.accent),
      text: color(theme.text, DEFAULT_LAYOUT.theme.text),
      muted: color(theme.muted, DEFAULT_LAYOUT.theme.muted),
      radius: num(theme.radius, 0, 40, DEFAULT_LAYOUT.theme.radius),
      logoUrl: str(theme.logoUrl, 500, ''),
      company: str(theme.company, 160, ''),
      address: str(theme.address, 300, ''),
      phone: str(theme.phone, 60, ''),
      email: str(theme.email, 160, ''),
      showLegal: theme.showLegal !== false,
      legalText: str(theme.legalText, 2_000, ''),
      showUnsubscribe: !!theme.showUnsubscribe,
      unsubscribeUrl: str(theme.unsubscribeUrl, 500, ''),
    },
    blocks: blocks.map(sanitizeBlock),
  };
}

export function sanitizeLayouts(input: unknown): MailLayout[] {
  const rows = Array.isArray(input) ? input : [];
  const out = rows.slice(0, MAX_LAYOUTS).map(sanitizeLayout);
  // Le gabarit par défaut doit toujours exister : les messages y font référence.
  if (!out.some((l) => l.id === DEFAULT_LAYOUT.id)) out.push(DEFAULT_LAYOUT);
  return out;
}

export async function readLayouts(): Promise<MailLayout[]> {
  return sanitizeLayouts(await readJson<MailLayout[]>(FILE_LAYOUTS));
}

export async function writeLayouts(layouts: MailLayout[]): Promise<void> {
  await writeJson(FILE_LAYOUTS, layouts);
}

/* ---------------------------------------------------------------- Registre */

/** Historique d'envoi — sert à la fois de journal et de compteur de plafonds. */
export async function readSentLog(): Promise<MailSentEntry[]> {
  const rows = await readJson<MailSentEntry[]>(FILE_LOG);
  return Array.isArray(rows) ? rows : [];
}

export function appendSentLog(entry: MailSentEntry, retentionDays: number): Promise<void> {
  const run = logQueue.then(async () => {
    const rows = await readSentLog();
    const cutoff = Date.now() - retentionDays * 86_400_000;
    const kept = rows.filter((row) => Date.parse(row.at || '') >= cutoff);
    kept.unshift(entry);
    await writeJson(FILE_LOG, kept.slice(0, MAX_LOG_ROWS));
  });
  // On enchaîne sur une version qui ne rejette pas : sinon un échec d'écriture
  // empoisonnerait la file et plus aucune entrée ne serait journalisée.
  logQueue = run.catch(() => undefined);
  return run;
}

/* ----------------------------------------------------------------- Lecture */

export interface MailCenterSnapshot {
  policy: MailPolicy;
  modules: Record<string, MailEventConfig>;
  layouts: MailLayout[];
  /** Fichiers effectivement présents sur le disque — utile pour l'écran admin. */
  files: { policy: boolean; modules: boolean; layouts: boolean; log: boolean };
  sent: { today: number; last7Days: number; last: MailSentEntry[] };
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readMailCenter(): Promise<MailCenterSnapshot> {
  const [policy, modules, layouts, log] = await Promise.all([
    readPolicy(),
    readModules(),
    readLayouts(),
    readSentLog(),
  ]);
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sent = {
    today: log.filter((row) => Date.parse(row.at) >= startOfDay.getTime() && row.status === 'sent').length,
    last7Days: log.filter((row) => now - Date.parse(row.at) <= 7 * 86_400_000 && row.status === 'sent').length,
    last: log.slice(0, 25),
  };
  return {
    policy,
    modules,
    layouts,
    files: {
      policy: await exists(FILE_POLICY),
      modules: await exists(FILE_MODULES),
      layouts: await exists(FILE_LAYOUTS),
      log: await exists(FILE_LOG),
    },
    sent,
  };
}

/* ------------------------------------------------------- Garde-fous d'envoi */

export type SendBlockReason =
  | 'master_off'
  | 'disabled'
  | 'no_recipient'
  | 'unknown_event'
  | 'duplicate'
  | 'daily_cap'
  | 'recipient_cap'
  | 'quiet_hours';

export interface SendGate {
  allowed: boolean;
  reason?: SendBlockReason;
  detail?: string;
}

/** Heures silencieuses : entre `from` et `to`, franchissement de minuit compris. */
export function inQuietHours(policy: MailPolicy, at = new Date()): boolean {
  if (!policy.quietHours.enabled) return false;
  const minutes = at.getHours() * 60 + at.getMinutes();
  const [fh, fm] = policy.quietHours.from.split(':').map(Number);
  const [th, tm] = policy.quietHours.to.split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/**
 * Décide si un envoi peut partir. Tous les compteurs sont lus depuis
 * `data/mail/sent-log.json` : le navigateur ne peut pas les contourner, et un
 * redémarrage du serveur ne remet pas les compteurs à zéro.
 */
export async function evaluateSendGate(opts: {
  eventId: string;
  to: string;
  dedupeKey: string;
}): Promise<SendGate> {
  const { eventId, to, dedupeKey } = opts;
  const event = MAIL_EVENTS[eventId];
  if (!event) return { allowed: false, reason: 'unknown_event', detail: `Événement inconnu : ${eventId}` };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { allowed: false, reason: 'no_recipient', detail: 'Adresse de destination absente ou invalide.' };
  }

  const [policy, modules, log] = await Promise.all([readPolicy(), readModules(), readSentLog()]);
  if (!policy.masterEnabled) return { allowed: false, reason: 'master_off', detail: 'Interrupteur général des emails coupé.' };

  const config = modules[eventId];
  if (!config?.enabled) return { allowed: false, reason: 'disabled', detail: `« ${event.label} » est désactivé.` };

  const now = Date.now();
  const sentRows = log.filter((row) => row.status === 'sent');

  if (dedupeKey && policy.dedupeWindowMinutes > 0) {
    const windowMs = policy.dedupeWindowMinutes * 60_000;
    const twin = sentRows.find((row) => row.dedupeKey === dedupeKey && now - Date.parse(row.at) <= windowMs);
    if (twin) {
      return {
        allowed: false,
        reason: 'duplicate',
        detail: `Déjà envoyé le ${new Date(twin.at).toLocaleString('fr-FR')} (clé ${dedupeKey}).`,
      };
    }
  }

  if (config.minIntervalHours > 0) {
    const windowMs = config.minIntervalHours * 3_600_000;
    const recent = sentRows.find(
      (row) => row.event === eventId && row.to.toLowerCase() === to.toLowerCase() && now - Date.parse(row.at) <= windowMs,
    );
    if (recent) {
      return {
        allowed: false,
        reason: 'duplicate',
        detail: `« ${event.label} » déjà envoyé à cette adresse il y a moins de ${config.minIntervalHours} h.`,
      };
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayRows = sentRows.filter((row) => Date.parse(row.at) >= startOfDay.getTime());
  if (todayRows.length >= policy.dailyCap) {
    return { allowed: false, reason: 'daily_cap', detail: `Plafond quotidien atteint (${policy.dailyCap}).` };
  }
  const forRecipient = todayRows.filter((row) => row.to.toLowerCase() === to.toLowerCase());
  if (forRecipient.length >= policy.perRecipientDailyCap) {
    return {
      allowed: false,
      reason: 'recipient_cap',
      detail: `Plafond par destinataire atteint (${policy.perRecipientDailyCap}/jour).`,
    };
  }

  if (inQuietHours(policy)) {
    return {
      allowed: false,
      reason: 'quiet_hours',
      detail: `Heures silencieuses (${policy.quietHours.from} → ${policy.quietHours.to}).`,
    };
  }

  return { allowed: true };
}
