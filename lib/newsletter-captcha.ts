/**
 * Captcha d'image du formulaire d'inscription à la newsletter.
 *
 * Un formulaire ouvert au public reçoit des robots : ils remplissent le champ
 * visible et cochent la case. Trois gardes, toutes côté serveur :
 *
 * 1. le piège à miel (`website`, champ que l'interface ne montre pas) ;
 * 2. une limite de débit par adresse ;
 * 3. un **code dessiné dans une image** : le texte n'apparaît nulle part dans le
 *    HTML — ni la réponse, ni l'empreinte lisible — seule sa somme de contrôle
 *    est conservée ici. Le navigateur ne reçoit qu'un identifiant et l'image.
 *
 * Les codes sont émis en mémoire, avec une durée de vie courte et un seul usage :
 * un code volé ne sert pas deux fois, et un redémarrage du serveur vide
 * simplement le carnet — le formulaire en redemande.
 */
import { createHash, randomBytes, randomUUID } from 'crypto';

export interface CaptchaIssue {
  id: string;
  /** Le fichier d'image, servi par la route du site (même origine, donc). */
  imageUrl: string;
  expiresIn: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ISSUED = 800;
const CODE_LENGTH = 5;
/** Sans `I`, `L`, `O`, `0`, `1` : ces glyphes se confondent à l'écran. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

interface Entry {
  /** Empreinte du code attendu — la comparaison se fait dessus. */
  hash: string;
  /** Image rendue à l'émission : recharger la page ne change pas le code. */
  svg: string;
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

function makeCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Le code comparé « à l'oreille » : casse et espaces ignorés, les deux glyphes
 * qui se ressemblent le plus tolérés (`S`/`5`, `B`/`8` ne le sont pas — ils sont
 * distincts dans l'image). Une réponse en minuscules passe donc.
 */
export function normalizeCaptchaAnswer(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function fingerprint(code: string): string {
  return createHash('sha256').update(normalizeCaptchaAnswer(code)).digest('hex');
}

/**
 * Image SVG du code : lettres inclinées et espacées irrégulièrement, ligne de
 * bruit, points épars, sans trame régulière qu'un robot pourrait soustraire.
 * Du SVG et pas de PNG parce qu'aucune dépendance graphique n'est nécessaire
 * et que le rendu reste net sur un écran haute densité.
 */
export function renderCaptchaSvg(code: string): string {
  const bytes = randomBytes(code.length * 6 + 24);
  let cursor = 0;
  const take = (max: number) => {
    const value = bytes[cursor % bytes.length] / 255 * max;
    cursor += 1;
    return value;
  };

  const width = 200;
  const height = 68;
  const parts: string[] = [];

  // Fond : deux bandes lavées, pour casser la platitude du blanc.
  parts.push(`<rect width="${width}" height="${height}" fill="#f4f7fb"/>`);
  parts.push(`<rect y="${take(20) + 6}" width="${width}" height="${take(18) + 10}" fill="#e6efff" opacity=".7"/>`);

  // Lettres.
  const step = (width - 34) / Math.max(1, code.length);
  for (let i = 0; i < code.length; i += 1) {
    const x = 16 + i * step + take(6) - 3;
    const y = 40 + take(12) - 6;
    const rotate = take(34) - 17;
    const size = 30 + take(8);
    const hue = 205 + Math.round(take(60)) - 30;
    parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="ui-monospace, 'Courier New', monospace" ` +
        `font-size="${size.toFixed(1)}" font-weight="700" fill="hsl(${hue} 62% 30%)" ` +
        `transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`,
    );
  }

  // Gabarit de confusion : deux courbes et des points, dessinés après les
  // lettres pour les recouper partiellement.
  for (let i = 0; i < 2; i += 1) {
    const y0 = take(height);
    const y1 = take(height);
    parts.push(
      `<path d="M0 ${y0.toFixed(1)} C ${(width / 3).toFixed(1)} ${y1.toFixed(1)}, ${(2 * width / 3).toFixed(1)} ${y0.toFixed(1)}, ${width} ${y1.toFixed(1)}" ` +
        `stroke="hsl(${Math.round(take(360))} 45% 55%)" stroke-width="1.4" fill="none" opacity=".65"/>`,
    );
  }
  const dots: string[] = [];
  for (let i = 0; i < 90; i += 1) dots.push(`${take(width).toFixed(0)},${take(height).toFixed(0)}`);
  parts.push(`<g fill="#5b6b86" opacity=".5">${dots.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="1"/>`).join('')}</g>`);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `role="img" aria-label="Code de verification">` +
    `<title>Code de verification</title>${parts.join('')}</svg>`
  );
}

export function issueCaptcha(): CaptchaIssue {
  const entries = book();
  prune(entries);
  const code = makeCode();
  const id = randomUUID();
  entries.set(id, {
    hash: fingerprint(code),
    svg: renderCaptchaSvg(code),
    expiresAt: Date.now() + TTL_MS,
  });
  return { id, imageUrl: `/api/newsletter/captcha?id=${encodeURIComponent(id)}`, expiresIn: Math.floor(TTL_MS / 1000) };
}

/**
 * Image d'un code émis, `null` si l'identifiant est inconnu ou périmé.
 *
 * Le code en clair n'est jamais conservé : l'image a été dessinée à
 * l'émission, et seule son empreinte sert à la comparaison. Recharger l'image
 * (bouton « Nouveau code » du formulaire, ou simple rechargement de la page)
 * montre donc toujours le même code, tant que le jeton vit.
 */
export function captchaImage(id: string): string | null {
  const entry = book().get(String(id || '').trim());
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.svg;
}

/** Vrai si la réponse est attendue, correcte et pas encore utilisée. */
export function verifyCaptcha(id: string, answer: string): boolean {
  const entries = book();
  const key = String(id || '').trim();
  if (!key) return false;
  const entry = entries.get(key);
  if (!entry) return false;
  const ok = entry.expiresAt > Date.now() && entry.hash === fingerprint(answer);
  // Un code ne sert qu'une fois : après une réponse juste, il est brûlé, que
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
