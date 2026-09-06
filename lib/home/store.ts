/**
 * Lecture / écriture de la configuration des blocs, côté serveur.
 *
 * Le studio et la vitrine ne touchent jamais l'API du CMS directement : ils
 * passent par ces fonctions, qui appliquent la règle du projet — l'API fait
 * foi, et son défaut n'est pas une panne. Quand elle est injoignable, la
 * configuration est lue dans `data/{langue}/home.json` et enregistrée dans ce
 * même fichier (mode démon / hébergement sans base).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { CmsError, cmsFetch } from '@/lib/cms';
import {
  EMPTY_SELECTION,
  HOME_LANGS,
  HOME_REF_LOCALE,
  resolveHomeSections,
  type HomeFile,
  type HomeSectionConfig,
  type HomeOption,
  type HomeOptionResource,
  type HomeSectionKey,
  type HomeSections,
  type HomeSnapshot,
} from './config';

/**
 * Types des options proposées par la rampe de sélection : définis dans
 * `lib/home/config` (partagé avec l'administration, qui ne peut pas importer
 * un module reposant sur `fs`) et réexportés ici pour les appelants serveurs.
 */
export type { HomeOption, HomeOptionResource };

const DATA_DIR = path.join(process.cwd(), 'data');

function safeLocale(locale: string | undefined): string {
  return (HOME_LANGS as readonly string[]).includes(locale || '') ? String(locale) : HOME_REF_LOCALE;
}

function homeFile(locale: string) {
  return path.join(DATA_DIR, safeLocale(locale), 'home.json');
}

export async function readHomeFile(locale: string): Promise<HomeFile | null> {
  try {
    const raw = await fs.readFile(homeFile(locale), 'utf8');
    const parsed = JSON.parse(raw) as HomeFile;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Écriture atomique : la vitrine lit ce fichier à chaque rendu. */
async function writeHomeFile(locale: string, file: HomeFile): Promise<void> {
  const target = homeFile(locale);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(file, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

/** Lit la configuration API, sans jamais lever : `null` = indisponible. */
async function readApiRows(locale: string, token?: string | null) {
  try {
    const qs = `locale=${encodeURIComponent(locale)}`;
    const target = token ? `/home/sections?${qs}` : `/public/home/sections?${qs}`;
    const rows = await cmsFetch<unknown>(target, { token: token || undefined, timeoutMs: 4000 });
    const list = Array.isArray(rows)
      ? rows
      : Array.isArray((rows as { data?: unknown })?.data)
        ? ((rows as { data: unknown[] }).data as unknown[])
        : [];
    return list as Array<Partial<HomeSectionConfig> & { key: string; locale?: string }>;
  } catch {
    return null;
  }
}

/**
 * Configuration complète d'une langue, prête à être rendue ou éditée.
 *
 * `unavailable` signale que l'API n'a pas répondu : le studio l'affiche, pour
 * que l'administrateur sache qu'il écrit dans le fichier de secours et non en
 * base.
 */
export async function loadHome(locale: string, token?: string | null): Promise<HomeSnapshot> {
  const safe = safeLocale(locale);
  const ref = safe === HOME_REF_LOCALE ? null : await readHomeFile(HOME_REF_LOCALE);
  const current = await readHomeFile(safe);
  const apiRef = safe === HOME_REF_LOCALE ? null : await readApiRows(HOME_REF_LOCALE, token);
  const apiCurrent = await readApiRows(safe, token);

  const apiRows = [...(apiRef || []), ...(apiCurrent || [])];
  const resolved = resolveHomeSections({
    locale: safe,
    ref,
    current,
    apiRows,
  });

  return {
    locale: safe,
    ref: HOME_REF_LOCALE,
    api: apiRef !== null || apiCurrent !== null,
    ...resolved,
  };
}

/** Ce qu'on peut écrire pour une langue qui n'est pas la référence : les textes seulement. */
function payloadForLocale(locale: string, config: HomeSectionConfig) {
  const body = {
    locale,
    texts: config.texts || {},
    items: config.items || [],
    builder: { mode: config.builder?.mode || 'native', html: config.builder?.html || '', css: config.builder?.css || '' },
    status: config.status || 'published',
    enabled: config.enabled,
    sortOrder: config.sortOrder,
    selection: config.selection,
    settings: config.settings || {},
    style: config.style || {},
    label: null,
  };
  if (locale === HOME_REF_LOCALE) return body;

  const items = (config.items || []).map((item) => {
    const out: Record<string, unknown> = { id: item.id };
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
    return out;
  });
  return {
    locale,
    texts: config.texts || {},
    items,
    builder: { mode: config.builder?.mode || 'native', html: config.builder?.html || '' },
    status: config.status || 'published',
  };
}

/**
 * Écriture à travers l'API, avec repli sur les fichiers du projet.
 *
 * Un refus de l'API (session expirée, donnée rejetée) doit remonter à l'écran :
 * le masquer ferait croire à l'administrateur qu'il a enregistré en base alors
 * qu'il a écrit dans un fichier. Seule une API injoignable — processus arrêté,
 * extinction, 5xx — autorise le repli local, qui est le mode normal d'un
 * développement sans CMS.
 */
async function apiWrite<T>(call: () => Promise<T | null | undefined>): Promise<T | null> {
  try {
    return (await call()) ?? null;
  } catch (err) {
    if (err instanceof CmsError && err.status > 0 && err.status < 500) throw err;
    return null;
  }
}

export async function saveHomeSection(input: {
  key: HomeSectionKey;
  locale: string;
  config: HomeSectionConfig;
  token?: string | null;
}): Promise<{ stored: 'api' | 'file'; section: HomeSectionConfig }> {
  const locale = safeLocale(input.locale);
  const body = payloadForLocale(locale, input.config);

  const saved = await apiWrite(() =>
    cmsFetch<HomeSectionConfig>(`/home/sections/${encodeURIComponent(input.key)}`, {
      method: 'PUT',
      json: body,
      token: input.token || undefined,
      timeoutMs: 10000,
    }),
  );
  if (saved) {
    await touchStorefrontCache();
    return { stored: 'api', section: { ...input.config, updatedAt: new Date().toISOString() } };
  }

  await patchHomeFile(locale, input.key, input.config);
  await touchStorefrontCache();
  return { stored: 'file', section: { ...input.config, updatedAt: new Date().toISOString() } };
}

/** En secours, la configuration vit dans le fichier de la langue. */
async function patchHomeFile(locale: string, key: HomeSectionKey, config: HomeSectionConfig) {
  const file = (await readHomeFile(locale)) || { version: 1, sections: {} };
  const sections: HomeSections = { ...(file.sections || {}) };
  const payload: HomeSectionConfig =
    locale === HOME_REF_LOCALE
      ? config
      : {
          ...(sections[key] || config),
          key,
          texts: config.texts || {},
          items: config.items || [],
          builder: config.builder || { mode: 'native' },
          status: config.status || 'published',
        };
  sections[key] = payload;
  await writeHomeFile(locale, { ...file, version: 1, order: file.order, sections });
}

export async function reorderHome(input: { locale: string; order: HomeSectionKey[]; token?: string | null }) {
  const locale = safeLocale(input.locale);
  const done = await apiWrite(() =>
    cmsFetch('/home/sections/reorder', {
      method: 'POST',
      json: { locale, keys: input.order },
      token: input.token || undefined,
      timeoutMs: 10000,
    }),
  );
  if (done) {
    await touchStorefrontCache();
    return { stored: 'api' as const };
  }
  const file = (await readHomeFile(locale)) || { version: 1, sections: {} };
  const sections: HomeSections = { ...(file.sections || {}) };
  input.order.forEach((key, index) => {
    const previous = sections[key];
    sections[key] = {
      key,
      sortOrder: index,
      enabled: previous?.enabled ?? true,
      status: 'published',
      texts: previous?.texts || {},
      selection: previous?.selection || EMPTY_SELECTION,
      settings: previous?.settings || {},
      style: previous?.style || {},
      items: previous?.items || [],
      builder: previous?.builder || { mode: 'native' },
    };
  });
  await writeHomeFile(locale, { ...file, version: 1, order: input.order, sections });
  await touchStorefrontCache();
  return { stored: 'file' as const };
}

export async function copyHomeStructure(input: {
  from: string;
  to: string[];
  key?: HomeSectionKey;
  withTexts?: boolean;
  token?: string | null;
}) {
  const done = await apiWrite(() =>
    cmsFetch(input.key ? `/home/sections/${input.key}/copy` : '/home/sections/copy', {
      method: 'POST',
      json: { from: input.from, to: input.to, keys: input.key ? [input.key] : [], withTexts: Boolean(input.withTexts) },
      token: input.token || undefined,
      timeoutMs: 15000,
    }),
  );
  if (done) {
    await touchStorefrontCache();
    return { stored: 'api' as const, result: done };
  }

  const source = (await readHomeFile(safeLocale(input.from)))?.sections || {};
  let copied = 0;
  for (const target of input.to) {
    const locale = safeLocale(target);
    if (locale === input.from) continue;
    const file = (await readHomeFile(locale)) || { version: 1, sections: {} };
    const sections: HomeSections = { ...(file.sections || {}) };
    for (const [key, config] of Object.entries(source) as Array<[HomeSectionKey, HomeSectionConfig]>) {
      if (input.key && key !== input.key) continue;
      sections[key] = input.withTexts
        ? config
        : { ...config, texts: {}, builder: { mode: 'native' } };
      copied += 1;
    }
    await writeHomeFile(locale, { ...file, version: 1, order: file.order, sections });
  }
  await touchStorefrontCache();
  return { stored: 'file' as const, result: { copied } };
}

export async function resetHomeSection(input: { key: HomeSectionKey; locale: string; token?: string | null }) {
  const locale = safeLocale(input.locale);
  const cleared = await apiWrite(() =>
    cmsFetch<Record<string, unknown>>(`/home/sections/${encodeURIComponent(input.key)}?locale=${encodeURIComponent(locale)}`, {
      method: 'DELETE',
      token: input.token || undefined,
      timeoutMs: 10000,
    }),
  );
  if (cleared) {
    await touchStorefrontCache();
    return { stored: 'api' as const, ...cleared };
  }
  const file = (await readHomeFile(locale)) || { version: 1, sections: {} };
  const sections: HomeSections = { ...(file.sections || {}) };
  delete sections[input.key];
  await writeHomeFile(locale, { ...file, version: 1, sections });
  await touchStorefrontCache();
  return { stored: 'file' as const, reset: true };
}

/** Fiches proposées aux sélecteurs du studio. */
export async function homeOptions(resource: HomeOptionResource, locale: string, token?: string | null): Promise<HomeOption[]> {
  const safe = safeLocale(locale);
  if (token) {
    try {
      const payload = await cmsFetch<unknown>(
        `/${resource}?view=block&limit=200&filter=${encodeURIComponent(JSON.stringify({ locale: safe }))}`,
        { token, timeoutMs: 8000 },
      );
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: unknown[] }).data as unknown[])
          : [];
      if (rows.length) return rows.map(shapeOption);
    } catch {
      /* on tente la liste sans filtre de langue, puis les fichiers */
    }
  }
  return localOptions(safe, resource);
}

function shapeOption(row: unknown): HomeOption {
  const r = (row || {}) as Record<string, unknown>;
  const id = String(r.id ?? r.legacyId ?? r.slug ?? '');
  const title = String(r.title ?? r.name ?? r.label ?? r.question ?? id ?? '—');
  const meta = r.category ?? r.clinic ?? r.location ?? r.cta ?? r.subtitle ?? r.status ?? '';
  const image = r.image ?? r.logo ?? r.photo ?? '';
  return {
    id,
    title,
    meta: meta ? String(meta) : undefined,
    image: image ? String(image) : undefined,
    status: r.status ? String(r.status) : undefined,
    locale: r.locale ? String(r.locale) : undefined,
  };
}

/**
 * Repli sans API : les mêmes listes que la vitrine.
 *
 * Elles viennent des fichiers livrés avec le projet, ce qui rend le studio
 * utilisable sur une machine sans base — et permet de sélectionner des fiches
 * avant toute importation du catalogue.
 */
async function localOptions(locale: string, resource: HomeOptionResource): Promise<HomeOption[]> {
  const file =
    resource === 'hero' ? 'hero'
    : resource === 'products' ? 'products'
    : resource === 'testimonials' ? 'testimonials'
    : resource === 'events' ? 'events'
    : resource === 'news' ? 'news'
    : resource === 'partners' ? 'partners'
    : 'genericContent';
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, locale, `${file}.json`), 'utf8');
    const rows = JSON.parse(raw) as unknown[];
    return (Array.isArray(rows) ? rows : []).map(shapeOption);
  } catch {
    return [];
  }
}

/**
 * Le rendu serveur met les données en cache (voir `lib/data.ts`) : après une
 * écriture, on préviendrait mal le visiteur si la page continuait de servir
 * l'ancien réglage trente secondes. L'invalidation est best-effort — un process
 * différent (production multi-instances) rattrape de lui-même à l'échéance.
 */
function touchStorefrontCache() {
  clearHomeCache();
  // Le cache du rendu est une optimisation : son échec n'est pas une erreur.
  return import('@/lib/data')
    .then((mod) => mod.clearCache())
    .catch(() => undefined);
}

/**
 * Lecture utilisée par la vitrine : le snapshot complet d'une langue, en cache.
 *
 * Le cache vit ici (module serveur) et non dans `lib/data.ts` : la page d'accueil
 * est le seul consommateur, et `lib/data.ts` est importé par des composants
 * client — y référencer ce module ferait entrer `fs` dans le bundle navigateur.
 */
const HOME_TTL_MS = Number(process.env.HOME_CACHE_TTL_MS ?? 30_000);
const homeCache = new Map<string, { value: HomeSnapshot; expiresAt: number }>();

export function clearHomeCache(): void {
  homeCache.clear();
}

export async function getHomeSnapshot(locale: string): Promise<HomeSnapshot> {
  if (!Number.isFinite(HOME_TTL_MS) || HOME_TTL_MS <= 0) return loadHome(locale);
  const key = safeLocale(locale);
  const hit = homeCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loadHome(key);
  homeCache.set(key, { value, expiresAt: Date.now() + HOME_TTL_MS });
  return value;
}

/** Un seul bloc, déjà fusionné avec la langue de référence. */
export async function getHomeSectionConfig(locale: string, key: HomeSectionKey): Promise<HomeSectionConfig> {
  const home = await getHomeSnapshot(locale);
  return (home.sections[key] || { key, enabled: true, sortOrder: 0, texts: {}, selection: { ...EMPTY_SELECTION }, settings: {}, style: {}, items: [], builder: { mode: 'native' }, status: 'published' }) as HomeSectionConfig;
}
