// lib/home/legacy.ts
/**
 * Reprise du contenu déjà publié dans la configuration des blocs.
 *
 * La vitrine montre depuis toujours des fiches qui vivent ailleurs que dans le
 * studio : les diapositives de `data/{langue}/hero.json`, les produits, les
 * témoignages, les événements, les actualités et les partenaires des fichiers du
 * catalogue, les chiffres de `data/{langue}/config.json`, les libellés portés par
 * `messages/{langue}.json`. Le studio, lui, n'affichait que ce qui avait été
 * enregistré — blocs donc vides à la première ouverture, alors que la page, elle,
 * était pleine.
 *
 * Ce module lit ces mêmes sources et les **traduit en configuration de bloc** :
 * textes, éléments répétables et, pour les blocs qui puisent dans le catalogue,
 * la sélection des fiches dans l'ordre exact où la vitrine les affiche. Deux
 * conséquences :
 *
 * - l'onglet d'édition part du contenu réel au lieu du vide ;
 * - enregistrer un bloc ne change pas la page, puisque la configuration reprise
 *   est celle qui était déjà rendue.
 *
 * La sélection est calculée avec `applySelection`, la même fonction que les
 * blocs : si un réglage change plus tard (ordre, limite, tri), la reprise suit le
 * même chemin au lieu de deviner.
 *
 * Side serveur uniquement : ce module lit le disque. Il n'est jamais importé par
 * un composant client (`lib/home/config.ts` reste utilisable dans le navigateur).
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  HOME_DEFAULTS,
  applySelection,
  type HomeItem,
  type HomeLegacySections,
  type HomeSectionConfig,
  type HomeSectionKey,
} from './config';

type Row = Record<string, unknown>;
type Messages = Record<string, unknown>;

const EMPTY: HomeLegacySections = {};

/** Le répertoire `data` du dépôt, là où la vitrine puise déjà ses fichiers. */
function dataDir(locale: string) {
  return path.join(process.cwd(), 'data', locale);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function rowsOf(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (data && typeof data === 'object') {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as Row[];
  }
  return [];
}

/** Identifiant d'une fiche : `id` d'abord, puis `legacyId`, `slug`, ou sa position. */
function rowId(row: Row, index: number): string {
  const raw = row.id ?? row.legacyId ?? row.slug;
  return raw === undefined || raw === null || raw === '' ? String(index + 1) : String(raw);
}

function text(messages: Messages | null, namespace: string, key: string): string {
  const section = ((messages?.components as Messages | undefined)?.sections as Messages | undefined)?.[
    namespace
  ] as Messages | undefined;
  const value = section?.[key];
  return typeof value === 'string' ? value : '';
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (s) return s;
  }
  return '';
}

/**
 * Les fiches retenues par un bloc, telles qu'il les affiche aujourd'hui : on
 * applique sa sélection par défaut (mode, limite, tri, filtre) au contenu du
 * catalogue, et on note l'ordre obtenu comme sélection manuelle.
 */
function pickedFrom(
  rows: Row[],
  key: HomeSectionKey,
  options: Parameters<typeof applySelection>[2],
): Row[] {
  const fallback = HOME_DEFAULTS[key];
  const withLimit = {
    ...fallback.selection,
    // `limit: 0` signifie « tout » pour `applySelection` ; un bloc sans limite
    // enregistrée doit quand même reprendre ce que la vitrine montre.
    limit: fallback.selection.limit || rows.length,
  };
  return applySelection(
    rows.map((row, index) => ({ ...row, id: rowId(row, index) })),
    withLimit,
    options,
  ) as Row[];
}

function selectionOf(rows: Row[]): HomeSectionConfig['selection'] {
  return {
    mode: 'manual',
    ids: rows.map((row) => String(row.id)),
    limit: rows.length,
    sort: 'manual',
  };
}

/**
 * Images des trois visées du bloc « en alternance », telles qu'elles étaient
 * codées dans le composant avant son administration.
 */
const LEGACY_BLOCK_IMAGES = [
  'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800',
  'https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=800',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
];

const NAVIGATION_TILES: Array<{ id: string; icon: string; href: string; image: string }> = [
  { id: 'solutions', icon: 'stethoscope', href: '/solutions', image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800' },
  { id: 'services', icon: 'wrench', href: '/services', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800' },
  { id: 'products', icon: 'package', href: '/products', image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800' },
  { id: 'events', icon: 'calendar', href: '/events', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800' },
  { id: 'news', icon: 'newspaper', href: '/news', image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800' },
  { id: 'careers', icon: 'users', href: '/careers', image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800' },
];

/**
 * Configuration reprise du contenu du site pour une langue.
 *
 * Une clé absente de l'objet renvoyé = rien à reprendre pour ce bloc (données
 * manquantes, ou contenu déjà entièrement porté par les traductions).
 */
export async function legacyHomeConfig(locale: string): Promise<HomeLegacySections> {
  const dir = dataDir(locale);
  const [messages, heroFile, productsFile, testimonialsFile, eventsFile, newsFile, partnersFile, siteConfig] =
    await Promise.all([
      readJson<Messages>(path.join(process.cwd(), 'messages', `${locale}.json`)),
      readJson(path.join(dir, 'hero.json')),
      readJson(path.join(dir, 'products.json')),
      readJson(path.join(dir, 'testimonials.json')),
      readJson(path.join(dir, 'events.json')),
      readJson(path.join(dir, 'news.json')),
      readJson(path.join(dir, 'partners.json')),
      readJson<Record<string, unknown>>(path.join(dir, 'config.json')),
    ]);

  const out: HomeLegacySections = { ...EMPTY };
  const partners = rowsOf(partnersFile);

  // ── Slider ────────────────────────────────────────────────────────────────
  const heroRows = rowsOf(heroFile);
  if (heroRows.length) {
    const picked = pickedFrom(heroRows, 'hero', { titleKey: 'title' });
    out.hero = {
      selection: selectionOf(picked),
      // Une entrée par diapositive : le studio pourra en masquer une, changer son
      // titre ou son bouton sans toucher au fichier du catalogue.
      items: picked.map<HomeItem>((slide) => ({
        id: String(slide.id),
        title: first(slide.title),
        subtitle: first(slide.subtitle),
        description: first(slide.description),
        image: first(slide.image),
        cta: first(slide.cta),
        ctaLink: first(slide.ctaLink),
        enabled: true,
      })),
    };
  }

  // ── Bandeau défilant des partenaires ─────────────────────────────────────
  if (partners.length) {
    // Le bandeau lit son nombre de marques dans `selection.limit` (comme la
    // vitrine, via `limitOf`) : lire un `settings.limit` qui n'existe pas lui
    // faisait reprendre huit noms sur douze.
    const limit = Number(HOME_DEFAULTS['partners-marquee'].selection.limit) || 12;
    const marqueeRows = partners.slice(0, limit > 0 ? limit : partners.length);
    out['partners-marquee'] = {
      texts: { label: text(messages, 'MarqueePartners', 'label') },
      selection: selectionOf(marqueeRows),
      // Le bandeau lit ses logos dans `items` dès qu'une sélection manuelle existe :
      // on y remet donc nom et logo, pour que la reprise soit modifiable telle quelle.
      items: marqueeRows.map<HomeItem>((partner, index) => ({
        id: rowId(partner, index),
        label: first(partner.name),
        image: first(partner.logo),
        enabled: true,
      })),
    };
  }

  // ── Grille des univers ────────────────────────────────────────────────────
  out.navigation = {
    texts: {
      subtitle: text(messages, 'NavigationGrid', 'subtitle'),
      title: text(messages, 'NavigationGrid', 'title'),
      description: text(messages, 'NavigationGrid', 'description'),
    },
    items: NAVIGATION_TILES.map<HomeItem>((tile) => ({
      id: tile.id,
      icon: tile.icon,
      title: text(messages, 'NavigationGrid', tile.id),
      description: text(messages, 'NavigationGrid', `${tile.id}Desc`),
      href: tile.href,
      image: tile.image,
      enabled: true,
    })),
  };

  // ── Notre mission ─────────────────────────────────────────────────────────
  out.mission = {
    texts: {
      subtitle: text(messages, 'ParallaxSection', 'defaultSubtitle'),
      title: text(messages, 'ParallaxSection', 'defaultTitle'),
      description: text(messages, 'ParallaxSection', 'defaultDescription'),
      ctaLabel: text(messages, 'ParallaxSection', 'defaultCta'),
    },
  };

  // ── Produits phares ───────────────────────────────────────────────────────
  const productRows = rowsOf(productsFile);
  if (productRows.length) {
    const picked = pickedFrom(productRows, 'products', { titleKey: 'name' });
    out.products = {
      texts: {
        subtitle: text(messages, 'FeaturedProducts', 'subtitle'),
        title: text(messages, 'FeaturedProducts', 'title'),
        description: text(messages, 'FeaturedProducts', 'description'),
        viewAllLabel: text(messages, 'FeaturedProducts', 'viewAll'),
      },
      selection: selectionOf(picked),
    };
  }

  // ── Blocs en alternance ───────────────────────────────────────────────────
  const legacyBlocks: HomeItem[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const title = text(messages, 'AlternatingSections', `block${i}Title`);
    if (!title) continue;
    legacyBlocks.push({
      id: `block${i}`,
      badge: text(messages, 'AlternatingSections', `block${i}Subtitle`),
      title,
      description: text(messages, 'AlternatingSections', `block${i}Desc`),
      image: LEGACY_BLOCK_IMAGES[i - 1] || '',
      ctaLabel: text(messages, 'AlternatingSections', `block${i}Cta`),
      ctaHref: text(messages, 'AlternatingSections', `block${i}Link`) || '/solutions',
      position: i === 2 ? 'image-right' : 'image-left',
      enabled: true,
    });
  }
  if (legacyBlocks.length) out.blocks = { items: legacyBlocks };

  // ── Chiffres clés ─────────────────────────────────────────────────────────
  const stats = (siteConfig?.stats || {}) as Record<string, unknown>;
  const statDefs: Array<[string, string, string, string]> = [
    // [champ de config.json, libellé, valeur numérique, suffixe]
    ['clients', 'activeClients', '500', '+'],
    ['experience', 'yearsExperience', '15', ''],
    ['support', 'techSupport', '', ''],
    ['satisfaction', 'satisfiedClients', '98', '%'],
  ];
  const statItems: HomeItem[] = [];
  for (const [field, labelKey, fallbackValue, fallbackSuffix] of statDefs) {
    const label = text(messages, 'StatsSection', labelKey);
    if (!label) continue;
    const raw = first(stats[field]);
    if (!raw) continue;
    const numeric = parseInt(raw, 10);
    // On rend exactement ce que la vitrine calcule aujourd'hui : nombre animé si
    // la valeur commence par des chiffres, texte brut sinon (« 24/7 »).
    statItems.push(
      Number.isFinite(numeric)
        ? { id: field, value: String(numeric), suffix: raw.replace(String(numeric), '').trim() || fallbackSuffix, label, enabled: true }
        : { id: field, value: raw, suffix: '', label, enabled: true },
    );
    void fallbackValue;
  }
  if (statItems.length) {
    out.stats = {
      texts: {
        subtitle: text(messages, 'StatsSection', 'subtitle'),
        title: text(messages, 'StatsSection', 'title'),
      },
      items: statItems,
    };
  }

  // ── Témoignages ───────────────────────────────────────────────────────────
  const testimonialRows = rowsOf(testimonialsFile);
  if (testimonialRows.length) {
    const picked = pickedFrom(testimonialRows, 'testimonials', {
      titleKey: 'name',
      ratingKey: 'rating',
    });
    out.testimonials = {
      texts: {
        subtitle: text(messages, 'TestimonialsSlider', 'subtitle'),
        title: text(messages, 'TestimonialsSlider', 'title'),
        description: text(messages, 'TestimonialsSlider', 'description'),
      },
      selection: selectionOf(picked),
    };
  }

  // ── Événements et actualités ──────────────────────────────────────────────
  const eventRows = rowsOf(eventsFile);
  if (eventRows.length) {
    const picked = pickedFrom(eventRows, 'events', {
      dateOf: (event) => first((event as Row).startDate, (event as Row).date) || undefined,
      titleKey: 'title',
    });
    out.events = {
      texts: {
        subtitle: text(messages, 'LatestEvents', 'subtitle'),
        title: text(messages, 'LatestEvents', 'title'),
        description: text(messages, 'LatestEvents', 'description'),
        viewAllLabel: text(messages, 'LatestEvents', 'viewAll'),
      },
      selection: selectionOf(picked),
    };
  }
  const newsRows = rowsOf(newsFile);
  if (newsRows.length) {
    const picked = pickedFrom(newsRows, 'news', {
      dateOf: (item) => first((item as Row).publicationDate, (item as Row).date) || undefined,
      titleKey: 'title',
    });
    out.news = {
      texts: {
        subtitle: text(messages, 'LatestNews', 'subtitle'),
        title: text(messages, 'LatestNews', 'title'),
        description: text(messages, 'LatestNews', 'description'),
        viewAllLabel: text(messages, 'LatestNews', 'viewAll'),
      },
      selection: selectionOf(picked),
    };
  }

  // ── Newsletter : libellés et arguments du bandeau ─────────────────────────
  // Pas de `subtitle` : le bandeau d'origine n'en affichait pas, et le bloc
  // n'en montre un que saisi dans le studio.
  const newsletterTexts: Record<string, string> = {
    title: text(messages, 'NewsletterSection', 'title'),
    description: text(messages, 'NewsletterSection', 'description'),
    placeholder: text(messages, 'NewsletterSection', 'placeholder'),
    submit: text(messages, 'NewsletterSection', 'subscribe'),
    legal: text(messages, 'NewsletterSection', 'legalText'),
    successTitle: text(messages, 'NewsletterSection', 'successTitle'),
    successDesc: text(messages, 'NewsletterSection', 'successDesc'),
  };
  const featureIcons = ['newspaper', 'gift', 'shield'];
  const featureItems: HomeItem[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const title = text(messages, 'NewsletterSection', `feature${i}Title`);
    if (!title) continue;
    featureItems.push({
      id: `argument-${i}`,
      kind: 'argument',
      title,
      description: text(messages, 'NewsletterSection', `feature${i}Desc`),
      icon: featureIcons[i - 1],
      enabled: true,
    });
  }
  out.newsletter = { texts: newsletterTexts, items: featureItems };

  // ── Partenaires en vedette ────────────────────────────────────────────────
  if (partners.length) {
    const picked = pickedFrom(partners, 'partners', { titleKey: 'name' });
    out.partners = {
      texts: {
        subtitle: text(messages, 'PartnersSection', 'subtitle'),
        title: text(messages, 'PartnersSection', 'title'),
        description: text(messages, 'PartnersSection', 'description'),
      },
      selection: selectionOf(picked),
    };
  }

  // ── Appel à l'action ──────────────────────────────────────────────────────
  out.cta = {
    texts: {
      title: text(messages, 'CTASection', 'defaultTitle'),
      description: text(messages, 'CTASection', 'defaultDescription'),
      primaryLabel: text(messages, 'CTASection', 'primaryLabel'),
      secondaryLabel: text(messages, 'CTASection', 'secondaryLabel'),
    },
  };

  // Les textes vides n'apportent rien et écraseraient le repli sur les
  // traductions : on les retire avant de renvoyer.
  for (const key of Object.keys(out) as HomeSectionKey[]) {
    const patch = out[key] as Partial<HomeSectionConfig>;
    if (patch.texts) {
      const kept = Object.fromEntries(Object.entries(patch.texts).filter(([, value]) => String(value || '').trim()));
      if (Object.keys(kept).length) patch.texts = kept;
      else delete patch.texts;
    }
    if (!patch.items?.length) delete patch.items;
  }
  return out;
}
