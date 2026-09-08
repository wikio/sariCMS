/**
 * lib/verification.ts — le socle du système de vérification de documents.
 *
 * La page publique `/{locale}/verification[/{code}/{hash}]` soumet un couple
 * (code, clé) après captcha ; cette requête est traitée par `/api/verification/check`,
 * qui interroge **l'API externe configurée dans l'administration** (Paramètres →
 * Vérification des documents) et traduit le code de retour de cette API en résultat
 * lisible grâce au **catalogue des codes de vérification** (admin → « Codes de
 * vérification »). Le catalogue est une donnée, pas du code : quand l'API externe
 * ajoute un code, l'administrateur l'ajoute ici et la vitrine le comprend sans
 * redéploiement.
 *
 * Deux garde-fous hérités de la conception d'origine du projet :
 *
 * 1. Tant que l'API n'est pas activée, la vérification retombe sur le registre
 *    local `data/<locale>/verification-codes.json` — la page existait avec ce mode,
 *    les codes de démonstration doivent continuer de répondre.
 * 2. Les réglages vivent dans un fichier lu côté serveur (`data/verification.json`,
 *    même convention que `lib/seo.ts`), JAMAIS dans le `localStorage` de
 *    l'administration : une route publique ne peut pas lire le navigateur de
 *    l'administrateur, et une clé d'API qui ne vit que dans un onglet ouvert
 *    disparaît à la fermeture du navigateur.
 */
import { promises as fs } from 'fs';
import path from 'path';

export const VERIFICATION_SEMANTICS = ['valid', 'forged', 'expired', 'revoked', 'neutral'] as const;
export type VerificationSemantic = (typeof VERIFICATION_SEMANTICS)[number];

export type VerificationLocale = 'fr' | 'en' | 'ar';

/** Libellés traduits : la langue de l'absence est celle de l'interface, avec repli FR. */
export type LabelMap = Partial<Record<VerificationLocale, string>> & { fr?: string };

/** Une ligne du catalogue : à quoi correspond tel code renvoyé par l'API externe. */
export interface VerificationCodeDef {
  id: string;
  /** La valeur brute renvoyée par l'API, comparée en chaîne (`"1"`, `"0"`, `"A12"`…). */
  code: string;
  /** Le comportement de la page : panneau vert/rouge/jaune/orange, ou neutre. */
  semantic: VerificationSemantic;
  labels: LabelMap;
  descriptions?: LabelMap;
  /** Afficher Type + Émetteur (un « révoqué » a rarement besoin du détail, un « valide » toujours). */
  showDetails: boolean;
  active: boolean;
  sortOrder: number;
}

export interface VerificationApiSettings {
  enabled: boolean;
  /** URL complète de l'endpoint de vérification (ex. `https://api.tiers.com/v1/verify`). */
  url: string;
  apiKey: string;
  /** Comment la clé voyagera : en en-tête `X-API-Key`, en `Authorization: Bearer`, ou pas d'auth. */
  authHeader: 'X-API-Key' | 'Authorization' | 'none';
  /** `GET` passe code et clé en query string ; `POST` en corps JSON. */
  method: 'GET' | 'POST';
  timeoutMs: number;
  /** Noms des paramètres côté API — certaines disent `numero`/`cle`. */
  codeParam: string;
  hashParam: string;
  /** Chemins (pointés) des champs dans la réponse JSON de l'API. */
  response: { code: string; type: string; issuer: string; message: string };
  /** Si l'API est injoignable, retomber sur le registre local plutôt qu'afficher une erreur. */
  fallbackToLocal: boolean;
}

export interface VerificationStore {
  api: VerificationApiSettings;
  codes: VerificationCodeDef[];
}

const FILE = path.join(process.cwd(), 'data', 'verification.json');

/**
 * Les quatre codes de l'API de référence. `sortOrder` pilote l'affichage du
 * catalogue, `semantic` pilote la couleur et l'icône de la page : ce sont les
 * seuls raccords entre l'interface et une API qui, elle, ne renvoie que `1`,
 * `0`, `2` ou `3`.
 */
export const DEFAULT_VERIFICATION_CODES: VerificationCodeDef[] = [
  {
    id: 'valid',
    code: '1',
    semantic: 'valid',
    labels: { fr: 'Document valide', en: 'Valid document', ar: 'مستند صالح' },
    descriptions: {
      fr: 'Le document est authentique et son intégrité est confirmée par l\'émetteur.',
      en: 'The document is authentic and its integrity is confirmed by the issuer.',
      ar: 'المستند أصلي وسلامته مؤكدة من الجهة المُصدرة.',
    },
    showDetails: true,
    active: true,
    sortOrder: 1,
  },
  {
    id: 'forged',
    code: '0',
    semantic: 'forged',
    labels: { fr: 'Document falsifié', en: 'Forged document', ar: 'مستند مزوّر' },
    descriptions: {
      fr: 'Le couple code / clé ne correspond à aucun document émis, ou correspond à un document altéré.',
      en: 'The code / key pair matches no issued document, or matches an altered one.',
      ar: 'الزوج رمز/مفتاح لا يطابق أي مستند مُصدر، أو يطابق مستندًا معدّلاً.',
    },
    showDetails: true,
    active: true,
    sortOrder: 2,
  },
  {
    id: 'expired',
    code: '2',
    semantic: 'expired',
    labels: { fr: 'Document expiré', en: 'Expired document', ar: 'مستند منتهي الصلاحية' },
    descriptions: {
      fr: 'Le document était valide ; sa durée de vérification est dépassée.',
      en: 'The document was valid; its verification window has elapsed.',
      ar: 'كان المستند صالحًا؛ انتهت مدة التحقق منه.',
    },
    showDetails: true,
    active: true,
    sortOrder: 3,
  },
  {
    id: 'revoked',
    code: '3',
    semantic: 'revoked',
    labels: { fr: 'Document révoqué', en: 'Revoked document', ar: 'مستند مسحوب' },
    descriptions: {
      fr: 'L\'émetteur a retiré ce document ; il ne doit plus être accepté.',
      en: 'The issuer withdrew this document; it must no longer be accepted.',
      ar: 'سحبت الجهة المُصدرة هذا المستند؛ يجب عدم قبوله بعد الآن.',
    },
    showDetails: true,
    active: true,
    sortOrder: 4,
  },
];

export const DEFAULT_VERIFICATION_API: VerificationApiSettings = {
  enabled: false,
  url: '',
  apiKey: '',
  authHeader: 'X-API-Key',
  method: 'GET',
  timeoutMs: 15000,
  codeParam: 'code',
  hashParam: 'hash',
  response: { code: 'code', type: 'type', issuer: 'issuer', message: 'message' },
  fallbackToLocal: true,
};

export function defaultVerificationStore(): VerificationStore {
  return { api: { ...DEFAULT_VERIFICATION_API, response: { ...DEFAULT_VERIFICATION_API.response } }, codes: DEFAULT_VERIFICATION_CODES.map((c) => ({ ...c })) };
}

/** Les codes machine de la vérification — la page les traduit, le journal les lit. */
export type VerificationErrorCode =
  | 'PARAMETRES'
  | 'CAPTCHA'
  | 'TROP_DE_TENTATIVES'
  | 'FORMAT_CODE'
  | 'FORMAT_KEY'
  | 'INTROUVABLE'
  | 'API_INJOIGNABLE'
  | 'REPONSE_API'
  | 'NON_CONFIGUREE';

/** Une erreur de vérification avec son code machine. */
export class VerificationError extends Error {
  readonly code: VerificationErrorCode;
  constructor(message: string, code: VerificationErrorCode) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
  }
}

export function verificationStatus(code: VerificationErrorCode): number {
  switch (code) {
    case 'INTROUVABLE':
      return 404;
    case 'TROP_DE_TENTATIVES':
      return 429;
    case 'API_INJOIGNABLE':
    case 'REPONSE_API':
      return 502;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// Le magasin de réglages — même convention que lib/seo.ts : un fichier JSON du
// dépôt `data/`, relu à chaque requête (une vérification est un événement rare,
// le cache n'a rien à gagner ici, et une retouche admin doit être immédiate).
// ---------------------------------------------------------------------------

export async function readVerificationStore(): Promise<VerificationStore> {
  const fallback = defaultVerificationStore();
  let raw: string;
  try {
    raw = await fs.readFile(FILE, 'utf8');
  } catch {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<VerificationStore>;
    const store: VerificationStore = {
      api: {
        ...fallback.api,
        ...(parsed.api || {}),
        response: { ...fallback.api.response, ...(parsed.api?.response || {}) },
      },
      codes: Array.isArray(parsed.codes) && parsed.codes.length ? parsed.codes.map(normalizeCodeDef) : fallback.codes,
    };
    store.codes.sort((a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(String(b.code)));
    return store;
  } catch {
    // Un JSON tronqué ne doit pas empêcher de vérifier un document : on repart des
    // réglages par défaut, et l'écran d'administration réécrira un fichier propre.
    return fallback;
  }
}

export async function writeVerificationStore(store: VerificationStore): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), 'utf8');
}

function text(value: unknown, max: number, fallback = ''): string {
  const s = value == null ? '' : String(value).trim();
  return s ? s.slice(0, max) : fallback;
}

function localeLabels(value: unknown): LabelMap {
  const src = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const out: LabelMap = {};
  if (src.fr) out.fr = text(src.fr, 160);
  if (src.en) out.en = text(src.en, 160);
  if (src.ar) out.ar = text(src.ar, 160);
  return out;
}

/** Nettoie une entrée du catalogue : tout arrive de l'administration, rien n'est fiable. */
export function normalizeCodeDef(entry: Partial<VerificationCodeDef> & { code?: unknown }, index = 0): VerificationCodeDef {
  const semantic = VERIFICATION_SEMANTICS.includes(entry.semantic as VerificationSemantic)
    ? (entry.semantic as VerificationSemantic)
    : 'neutral';
  return {
    id: text(entry.id, 40, `code-${index + 1}`),
    code: text(entry.code, 24),
    semantic,
    labels: localeLabels(entry.labels),
    descriptions: localeLabels(entry.descriptions),
    showDetails: entry.showDetails !== false,
    active: entry.active !== false,
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Math.round(Number(entry.sortOrder)) : index + 1,
  };
}

/** Validé et sérialisable : ce que `PUT /api/admin/verification` accepterait. */
export function sanitizeCodes(input: unknown): VerificationCodeDef[] {
  if (!Array.isArray(input)) throw new VerificationError('Le catalogue attendu est une liste.', 'PARAMETRES');
  const seen = new Set<string>();
  const out: VerificationCodeDef[] = [];
  for (const [i, raw] of input.entries()) {
    const def = normalizeCodeDef((raw || {}) as Partial<VerificationCodeDef>, i);
    if (!def.code) continue; // une ligne vide dans le formulaire n'est pas un code
    const key = def.code.toLowerCase();
    if (seen.has(key)) throw new VerificationError(`Le code « ${def.code} » est défini deux fois.`, 'PARAMETRES');
    seen.add(key);
    out.push(def);
  }
  if (!out.some((c) => c.semantic === 'valid')) {
    throw new VerificationError('Le catalogue doit contenir au moins un code au comportement « valide ».', 'PARAMETRES');
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out;
}

export function sanitizeApiSettings(input: Record<string, unknown> | null | undefined): VerificationApiSettings {
  const base = defaultVerificationStore().api;
  if (!input || typeof input !== 'object') return base;
  const url = text(input.url, 400);
  if (url && !/^https?:\/\//i.test(url)) {
    throw new VerificationError("L'URL de l'API doit commencer par http:// ou https://.", 'PARAMETRES');
  }
  const timeout = Number(input.timeoutMs);
  return {
    enabled: input.enabled === true,
    url,
    apiKey: text(input.apiKey, 300),
    authHeader: input.authHeader === 'Authorization' || input.authHeader === 'none' ? input.authHeader : 'X-API-Key',
    method: input.method === 'POST' ? 'POST' : 'GET',
    timeoutMs: Number.isFinite(timeout) ? Math.min(Math.max(Math.round(timeout), 2000), 60000) : base.timeoutMs,
    codeParam: text(input.codeParam, 40, base.codeParam),
    hashParam: text(input.hashParam, 40, base.hashParam),
    response: {
      code: text((input.response as Record<string, unknown>)?.code, 60, base.response.code),
      type: text((input.response as Record<string, unknown>)?.type, 60, base.response.type),
      issuer: text((input.response as Record<string, unknown>)?.issuer, 60, base.response.issuer),
      message: text((input.response as Record<string, unknown>)?.message, 60, base.response.message),
    },
    fallbackToLocal: input.fallbackToLocal !== false,
  };
}

// ---------------------------------------------------------------------------
// Le dialogue avec l'API externe
// ---------------------------------------------------------------------------

/** Un chemin de réponse, pointé : `data.result.code` lit `raw.data.result.code`. */
export function pickPath(source: unknown, dotted: string): unknown {
  const trail = String(dotted || '').trim();
  // Un chemin vide n'est pas « la racine » : c'est un champ non configuré, et
  // renvoyer l'objet entier le ferait passer pour une valeur.
  if (!trail) return undefined;
  let current = source;
  for (const part of trail.split('.')) {
    if (!part) continue;
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function verificationApiHeaders(api: VerificationApiSettings): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (api.apiKey && api.authHeader === 'X-API-Key') headers['X-API-Key'] = api.apiKey;
  if (api.apiKey && api.authHeader === 'Authorization') headers.Authorization = `Bearer ${api.apiKey}`;
  return headers;
}

export interface RemoteAnswer {
  raw: unknown;
  codeValue: string;
  type?: string;
  issuer?: string;
  message?: string;
}

/** Appelle l'API externe et en extrait le code de retour + les champs affichables. */
export async function callVerificationApi(
  api: VerificationApiSettings,
  code: string,
  hash: string,
): Promise<RemoteAnswer> {
  const headers = verificationApiHeaders(api);
  let res: Response;
  const timeout = AbortSignal.timeout(Math.min(Math.max(api.timeoutMs || 15000, 2000), 60000));
  try {
    if (api.method === 'POST') {
      res = await fetch(api.url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [api.codeParam]: code, [api.hashParam]: hash }),
        signal: timeout,
      });
    } else {
      const target = new URL(api.url);
      target.searchParams.set(api.codeParam, code);
      target.searchParams.set(api.hashParam, hash);
      res = await fetch(target.toString(), { headers, signal: timeout });
    }
  } catch {
    throw new VerificationError(
      "Le service de vérification est injoignable (réseau, délai dépassé ou URL injoignable).",
      'API_INJOIGNABLE',
    );
  }
  if (res.status === 404) {
    throw new VerificationError('Le document demandé est introuvable auprès du service de vérification.', 'INTROUVABLE');
  }
  if (!res.ok) {
    throw new VerificationError(`Le service de vérification a répondu ${res.status}.`, 'REPONSE_API');
  }
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new VerificationError('La réponse du service de vérification n\'est pas un JSON lisible.', 'REPONSE_API');
  }
  const raw = parsed as Record<string, unknown> | null;
  const codeValue = String(pickPath(raw, api.response.code) ?? '').trim();
  if (!codeValue) {
    throw new VerificationError('La réponse du service ne contient pas de code de vérification.', 'REPONSE_API');
  }
  const asText = (v: unknown) => {
    if (v == null) return undefined;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  return {
    raw,
    codeValue,
    type: asText(pickPath(raw, api.response.type)),
    issuer: asText(pickPath(raw, api.response.issuer)),
    message: asText(pickPath(raw, api.response.message)),
  };
}

// ---------------------------------------------------------------------------
// Le catalogue et son résultat
// ---------------------------------------------------------------------------

export interface VerificationOutcome {
  /** La valeur renvoyée par l'API (ou le code du repli local), telle quelle. */
  code: string;
  semantic: VerificationSemantic;
  label?: string;
  description?: string;
  showDetails: boolean;
}

/** `"01"` vaut `"1"` quand les deux sont numériques ; sinon on compare les chaînes. */
export function codeValuesMatch(a: string, b: string): boolean {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (x.toLowerCase() === y.toLowerCase()) return true;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

export function findCodeDef(codes: VerificationCodeDef[], rawValue: string): VerificationCodeDef | null {
  return codes.find((c) => c.active && codeValuesMatch(c.code, rawValue)) || null;
}

export function findCodeDefBySemantic(codes: VerificationCodeDef[], semantic: VerificationSemantic): VerificationCodeDef | null {
  return codes.find((c) => c.active && c.semantic === semantic) || null;
}

export function pickLabel(map: LabelMap | undefined, locale: string): string | undefined {
  if (!map) return undefined;
  const key = locale === 'en' || locale === 'ar' ? locale : 'fr';
  return map[key] || map.fr;
}

export function outcomeFromDef(def: VerificationCodeDef, locale: string): VerificationOutcome {
  return {
    code: def.code,
    semantic: def.semantic,
    label: pickLabel(def.labels, locale),
    description: pickLabel(def.descriptions, locale),
    showDetails: def.showDetails,
  };
}

// ---------------------------------------------------------------------------
// Le repli local — le registre `data/<locale>/verification-codes.json` qui a
// vu naître la page. Il répond quand l'API n'est pas activée, et quand elle
// tombe. Les documents y portent déjà un statut ; on le raccorde au catalogue
// par le sémantisme, pour que les libellés personnalisés de l'admin s'appliquent
// aussi en mode démo.
// ---------------------------------------------------------------------------

export interface LocalDocument {
  code: string;
  key: string;
  type: string;
  status: 'valid' | 'invalid' | 'revoked' | 'expired';
  issuer?: string;
  invalidReason?: string;
  revocationReason?: string;
  validUntil?: string;
}

export async function readLocalRegistry(locale: string): Promise<LocalDocument[]> {
  const safe = locale === 'en' || locale === 'ar' ? locale : 'fr';
  for (const candidate of [safe, 'fr']) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), 'data', candidate, 'verification-codes.json'), 'utf8');
      const rows = JSON.parse(raw);
      if (Array.isArray(rows)) return rows as LocalDocument[];
    } catch {
      // fichier absent ou illisible : on tente le repli FR, puis le registre vide.
    }
  }
  return [];
}

export interface LocalAnswer {
  outcome: VerificationOutcome;
  document: { type?: string; issuer?: string; message?: string };
}

/** `null` = couple inconnu du registre → la page affiche « introuvable ». */
export async function verifyLocally(locale: string, code: string, hash: string, codes: VerificationCodeDef[]): Promise<LocalAnswer | null> {
  const rows = await readLocalRegistry(locale);
  const wanted = code.trim().toLowerCase();
  const wantedKey = hash.trim().toLowerCase();
  // Deux lectures possibles : la clé est soit un champ séparé (`key`), soit la
  // valeur encodée que le QR promène dans l'URL. Les deux comptent.
  const found = rows.find(
    (r) => String(r.code || '').trim().toLowerCase() === wanted &&
      String(r.key || '').trim().toLowerCase() === wantedKey,
  );
  if (!found) return null;
  const semantic: VerificationSemantic = found.status === 'valid' ? 'valid' : found.status === 'expired' ? 'expired' : found.status === 'revoked' ? 'revoked' : 'forged';
  const def = findCodeDefBySemantic(codes, semantic);
  const outcome: VerificationOutcome = def
    ? outcomeFromDef(def, locale)
    : { code: String(found.status), semantic, showDetails: true, label: undefined, description: undefined };
  const reason = found.status === 'revoked' ? found.revocationReason : found.status === 'invalid' ? found.invalidReason : undefined;
  return {
    outcome: { ...outcome, description: outcome.description || reason || undefined },
    document: { type: found.type, issuer: found.issuer, message: reason },
  };
}

// ---------------------------------------------------------------------------
// Le mode d'emploi lu par la page (pour annoncer « API externe » vs « démo »).
// ---------------------------------------------------------------------------

export async function publicVerificationStatus() {
  const store = await readVerificationStore();
  return {
    enabled: store.api.enabled && !!store.api.url,
    fallbackToLocal: store.api.fallbackToLocal,
    method: store.api.method,
  };
}
