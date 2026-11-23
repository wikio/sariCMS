/** Même vocabulaire pour la vitrine, les liens de fiche et le studio de menus. */
export const NEWS_GROUPS = ['category', 'tag', 'type'] as const;
export type NewsGroupBy = (typeof NEWS_GROUPS)[number];
export type NewsFilter = { by: NewsGroupBy; value: string };

type ArticleGroups = { category?: string; tags?: string[]; classification?: string };

/** On ignore la casse, les espaces de bord et la forme Unicode, mais pas les accents. */
export function groupKey(value: string): string {
  return value.trim().toLowerCase().normalize('NFC');
}

/** Garde le premier libellé lisible et son ordre, même si plusieurs articles le portent. */
export function distinctGroups(values: unknown[]): string[] {
  const groups = new Map<string, string>();
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().normalize('NFC');
    const key = groupKey(value);
    if (key && !groups.has(key)) groups.set(key, value);
  }
  return [...groups.values()];
}

export function newsGroupValues(article: ArticleGroups, by: NewsGroupBy): string[] {
  if (by === 'tag') return distinctGroups(Array.isArray(article.tags) ? article.tags : []);
  return distinctGroups([by === 'type' ? article.classification : article.category]);
}

export function collectNewsGroups(articles: ArticleGroups[], by: NewsGroupBy): string[] {
  return distinctGroups(articles.flatMap((article) => newsGroupValues(article, by)));
}

/** Tags du panneau latéral, classés par nombre d’articles (une voix par article). */
export function popularNewsTags(articles: ArticleGroups[], limit = 8): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const article of articles) {
    for (const label of newsGroupValues(article, 'tag')) {
      const key = groupKey(label);
      const hit = counts.get(key);
      if (hit) hit.count += 1;
      else counts.set(key, { label, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit).map(({ label }) => label);
}

/** Un seul filtre à la fois ; priorité stable si une URL manuelle en combine plusieurs. */
export function readNewsFilter(params: Pick<URLSearchParams, 'get'>): NewsFilter | null {
  for (const by of NEWS_GROUPS) {
    const value = params.get(by)?.trim();
    if (value) return { by, value };
  }
  return null;
}

export function newsListHref(locale: string, filter?: NewsFilter | null, page = 1): string {
  const query: string[] = [];
  if (filter) query.push(`${filter.by}=${encodeURIComponent(filter.value.trim().normalize('NFC'))}`);
  if (page > 1) query.push(`page=${page}`);
  return `/${locale}/news${query.length ? `?${query.join('&')}` : ''}`;
}
