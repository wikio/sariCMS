/**
 * Question anti-spam du formulaire d'inscription à la newsletter.
 *
 * Un formulaire ouvert au public reçoit des robots : ils remplissent le champ
 * visible et cochent la case. Deux defenses, toutes deux server-side :
 *
 * 1. le piège à miel (`website`, déjà en place) ;
 * 2. une question dont la réponse n'est pas dans le code source de la page —
 *    seule son empreinte est conservée ici, le navigateur ne reçoit jamais la
 *    réponse attendue.
 *
 * Les questions sont émises en mémoire, avec une durée de vie courte et un seul
 * usage : une réponse volée ne sert pas deux fois, et un redémarrage du serveur
 * vide simplement le carnet — le formulaire en redemande une.
 */
import { createHash, randomUUID } from 'crypto';

export interface CaptchaIssue {
  id: string;
  question: string;
  expiresIn: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ISSUED = 800;

interface Entry {
  hash: string;
  expiresAt: number;
}

/** Sur `globalThis` : le module est rechargé à chaque modification en dev. */
declare global {
  // eslint-disable-next-line no-var
  var __sariNewsletterCaptcha: Map<string, Entry> | undefined;
}

function book(): Map<string, Entry> {
  const g = globalThis as typeof globalThis & { __sariNewsletterCaptcha?: Map<string, Entry> };
  if (!g.__sariNewsletterCaptcha) g.__sariNewsletterCaptcha = new Map<string, Entry>();
  return g.__sariNewsletterCaptcha;
}

function prune(entries: Map<string, Entry>) {
  const now = Date.now();
  for (const [id, entry] of entries) if (entry.expiresAt <= now) entries.delete(id);
  while (entries.size > MAX_ISSUED) {
    const oldest = entries.keys().next().value as string | undefined;
    if (!oldest) break;
    entries.delete(oldest);
  }
}

function digit(len: number) {
  return Math.floor(Math.random() * 9 * 10 ** (len - 1)) + 10 ** (len - 1);
}

/**
 * Les questions possibles. Réponses courtes, sans accent ni casse à deviner :
 * ce qui compte est de bloquer un robot, pas de piéger un humain.
 */
function pickQuestion(): { question: string; answer: string } {
  const kind = Math.floor(Math.random() * 4);
  if (kind === 0) {
    const a = digit(1) + 2;
    const b = Math.floor(a / 2);
    return { question: `Combien font ${a} moins ${b} ?`, answer: String(a - b) };
  }
  if (kind === 1) {
    const a = 2 + Math.floor(Math.random() * 7);
    const b = 2 + Math.floor(Math.random() * 7);
    return { question: `Combien font ${a} × ${b} ?`, answer: String(a * b) };
  }
  if (kind === 2) {
    const words = ['clinique', 'rapport', 'imagerie', 'bloc', 'stock', 'formation'];
    const word = words[Math.floor(Math.random() * words.length)];
    return { question: `Écris le mot « ${word.toUpperCase()} » en minuscules.`, answer: word };
  }
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet'];
  const index = Math.floor(Math.random() * (months.length - 1));
  return {
    question: `Quel mois vient juste après « ${months[index]} » ?`,
    answer: months[index + 1],
  };
}

/** Comparaison tolérante : casse, espaces, accents et points de suspension en moins. */
export function normalizeCaptchaAnswer(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s.'’"«»]/g, '');
}

function fingerprint(answer: string): string {
  return createHash('sha256').update(normalizeCaptchaAnswer(answer)).digest('hex');
}

export function issueCaptcha(): CaptchaIssue {
  const entries = book();
  prune(entries);
  const { question, answer } = pickQuestion();
  const id = randomUUID();
  entries.set(id, { hash: fingerprint(answer), expiresAt: Date.now() + TTL_MS });
  return { id, question, expiresIn: Math.floor(TTL_MS / 1000) };
}

/** Vrai si la réponse est attendue, correcte et pas encore utilisée. */
export function verifyCaptcha(id: string, answer: string): boolean {
  const entries = book();
  const key = String(id || '').trim();
  if (!key) return false;
  const entry = entries.get(key);
  if (!entry) return false;
  const ok = entry.expiresAt > Date.now() && entry.hash === fingerprint(answer);
  // Un jeton ne sert qu'une fois : après une réponse juste, il est brûlé, que
  // l'inscription aboutisse ou non — un robot ne peut pas le rejouer.
  if (ok) entries.delete(key);
  return ok;
}

/**
 * Garde-fou de débit : quelques inscriptions par minute et par adresse, pour
 * qu'une boucle automatisée ne sature pas la liste.
 */
declare global {
  // eslint-disable-next-line no-var
  var __sariNewsletterRate: Map<string, { count: number; windowStart: number }> | undefined;
}

export function rateLimited(ip: string, limit = 6, windowMs = 5 * 60 * 1000): boolean {
  const g = globalThis as typeof globalThis & {
    __sariNewsletterRate?: Map<string, { count: number; windowStart: number }>;
  };
  if (!g.__sariNewsletterRate) g.__sariNewsletterRate = new Map();
  const entries = g.__sariNewsletterRate;
  const key = String(ip || 'inconnu');
  const now = Date.now();
  const hit = entries.get(key);
  if (!hit || now - hit.windowStart > windowMs) {
    entries.set(key, { count: 1, windowStart: now });
    if (entries.size > 2000) entries.clear();
    return false;
  }
  hit.count += 1;
  return hit.count > limit;
}
