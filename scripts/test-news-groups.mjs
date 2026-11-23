/** Parcours réels liste/fiche/studio, sans dépendre du contenu d'une base ni d'un serveur Next. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, createElement as h, useState, useSyncExternalStore } from 'react';
import { JSDOM } from 'jsdom';
import { load } from './test-support/load-tsx.mjs';

const groups = load('lib/news-groups.ts');
const slug = load('lib/slugify.ts');
const entity = load('lib/entity-url.ts', { '@/lib/slugify': slug });
const auto = load('lib/menu-auto.ts', {
  '@/lib/news-groups': groups, '@/lib/slugify': slug, '@/lib/entity-url': entity,
});
const ids = load('lib/ids.ts');
const tag = 'Santé & IA/+ #1';
const articles = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, title: `Article ${i + 1}`, category: i < 7 ? 'Recherche' : 'Industrie',
  classification: i === 7 ? 'Entretien' : 'Brève',
  tags: i === 0 ? [tag, '  ', 'تقنية', tag.toLowerCase()] : i === 7 ? [tag.toUpperCase().normalize('NFD')] : [],
}));
const records = [...articles, { id: 98, tags: ['Brouillon'], status: 'draft' }, { id: 99, tags: ['Archives'], status: 'archived' }];
const rule = { source: 'news', mode: 'groups' };

test('sous-menu : catégories historiques, tags multiples, types, statuts, ordre et limite', () => {
  const menu = (patch, rows = records) => auto.resolveAutoSubmenu({ ...rule, ...patch }, rows, 'ar');
  assert.deepEqual(menu({}).map(x => x.href), ['/ar/news?category=Recherche', '/ar/news?category=Industrie']);
  assert.deepEqual(menu({ groupBy: 'type' }).map(x => x.label), ['Brève', 'Entretien']);
  const tags = menu({ groupBy: 'tag', ids: [] });
  assert.deepEqual(tags.map(x => x.label), [tag, 'تقنية']);
  assert.deepEqual(tags.map(x => x.href), [tag, 'تقنية'].map(v => `/ar/news?tag=${encodeURIComponent(v)}`));
  assert.deepEqual(menu({ groupBy: 'tag', ids: ['Archives', 'تقنية', tag], limit: 1 }), [tags[1]]);
  assert.deepEqual(menu({ groupBy: 'tag', ids: [`  ${tag.toLowerCase().normalize('NFD')} `, tag] }), [tags[0]]);
  assert.equal(new Set(menu({ groupBy: 'tag' }, [{ tags: ['C#', 'C++'] }]).map(x => x.id)).size, 2);
  assert.equal(auto.applyAutoMenus([{ auto: { ...rule, groupBy: 'tag' } }], { news: [{ tags: [] }] }, 'en')[0].submenu, undefined);
  for (const [source, query] of [['events', 'type=Congr%C3%A8s'], ['products', 'category=Sant%C3%A9']]) {
    const [node] = auto.resolveAutoSubmenu({ source, mode: 'groups' }, [{ type: 'Congrès', category: 'Santé' }], 'fr');
    assert.equal(node.href, `/fr/${source}?${query}`);
  }
});

test('tags populaires : une voix par article, aucun lien sans tag réel', () => {
  assert.deepEqual(groups.popularNewsTags([{ tags: ['rare', ' RARE ', 'Commun'] }, {}, { tags: ['commun'] }], 1), ['Commun']);
  assert.deepEqual(groups.popularNewsTags([{ tags: [' ', ''] }, {}]), []);
});

test('reprise MySQL : les tags des JSON sont conservés dans le SQL livré, sans écraser ceux du CMS', t => {
  const dir = mkdtempSync(join(tmpdir(), 'sari-news-sql-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = join(dir, 'import.sql');
  const sqlDir = new URL('../backend/sql/', import.meta.url);
  execFileSync(process.execPath, [fileURLToPath(new URL('migrate-data.mjs', sqlDir)), '--out', out]);
  const newsBlock = file => readFileSync(file, 'utf8').match(/INSERT INTO `news_articles`[\s\S]+?ON DUPLICATE KEY UPDATE[\s\S]+?;/)?.[0];
  const generated = newsBlock(out);
  assert.match(generated, /`tags` = COALESCE\(`tags`, VALUES\(`tags`\)\)/);
  assert.equal(newsBlock(new URL('migrate-data.mysql.sql', sqlDir)), generated);
  for (const locale of ['fr', 'en', 'ar']) {
    const src = JSON.parse(readFileSync(new URL(`../data/${locale}/news.json`, import.meta.url), 'utf8'));
    for (const article of src.filter(a => a.tags?.length)) {
      const row = generated.split('\n').find(line => line.includes(`'${locale}', '${article.slug}'`));
      assert.ok(row?.includes(`'${JSON.stringify(article.tags).replaceAll("'", "''")}'`), `${locale}/${article.slug}`);
    }
  }
});

test('le menu public résout aussi un tag et une classification après le 100e article', async (t) => {
  const cms = load('lib/cms.ts');
  const data = load('lib/data.ts', {
    '@/lib/cms': cms, '@/lib/builder-doc': {}, '@/lib/legal-docs': {}, '@/lib/fiche-i18n': {},
    '@/lib/ids': ids, '@/lib/entity-url': entity, '@/lib/menu-auto': auto,
  });
  const expected = { ...articles[7], id: 101 };
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (path) => {
    const { pathname, searchParams } = new URL(path, 'https://site.test');
    seen.push([pathname, ...['locale', 'page', 'limit', 'view'].map(k => searchParams.get(k))]);
    const rows = searchParams.get('page') === '1' ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })) : [expected];
    return Response.json({ success: true, data: { data: rows, meta: { totalPages: 2 } } });
  });
  const { mainMenu } = await data.expandAutoMenus({ mainMenu: ['tag', 'type'].map(groupBy => ({ auto: { ...rule, groupBy } })) }, 'en');
  assert.deepEqual(seen, ['1', '2'].map(page => ['/api/v1/public/news', 'en', page, '100', 'block']));
  assert.equal(mainMenu[0].submenu[0].href, `/en/news?tag=${encodeURIComponent(expected.tags[0].normalize('NFC'))}`);
  assert.equal(mainMenu[1].submenu[0].href, '/en/news?type=Entretien');
});

const dom = new JSDOM('<body></body>', { url: 'https://site.test/fr/news' });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
window.scrollTo = () => {};
const push = (href) => { window.history.pushState({}, '', href); window.dispatchEvent(new window.Event('popstate')); };
const subscribe = cb => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); };
const nav = {
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  useRouter: () => ({ push }), useParams: () => ({ id: window.location.pathname.split('/').at(-1) }),
};
const tr = (key, params = {}) => params.value !== undefined ? `${key}: ${params.value}` : key === 'resultCount' ? `${params.count}` : key;
const intl = { useTranslations: () => tr, useLocale: () => window.location.pathname.split('/')[1] };
const ignored = { default: () => null };
const front = {
  'next/navigation': nav, 'next-intl': intl,
  'next/link': { default: ({ href, children }) => h('a', { href, onClick(e) { e.preventDefault(); push(href); } }, children) },
  '@/lib/data': { getNews: async () => articles, getArticleAuthor: async () => null, getDefaultAuthor: async () => null },
  '@/lib/news-groups': groups, '@/lib/slugify': slug, '@/lib/ids': ids,
  '@/lib/translation-utils': load('lib/translation-utils.ts'),
  '@/lib/use-date-format': { useDateUtils: () => ({ formatDate: () => '', hasTime: () => false }) },
  '@/components/shared/PageVisibilityGuard': { default: ({ children }) => children },
  '@/components/ui/Pagination': { default: load('components/ui/Pagination.tsx', { 'next-intl': intl }).default },
  '@/components/ui/ImageWithFallback': ignored, '@/components/ui/LanguageIndicator': ignored,
  '@/components/shared/NewsletterSignup': ignored, '@/components/ui/Breadcrumb': ignored,
};
front['@/components/news/NewsFilters'] = load('components/news/NewsFilters.tsx', front);
front['@/components/news/NewsTags'] = load('components/news/NewsTags.tsx', front);
const Page = load('app/[locale]/news/page.tsx', front).default;
const Detail = load('app/[locale]/news/[id]/page.tsx', front).default;
async function mount(t, Component) {
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  t.after(async () => { await act(async () => root.unmount()); el.remove(); });
  await act(async () => root.render(h(Component)));
  return el;
}
const click = el => act(async () => { assert.ok(el); el.click(); });

// Une seule instance de la liste : pas de remontage artificiel entre deux URL.
test('liste montée : changer de filtre, paginer, effacer et revenir en arrière', async t => {
  push('/fr/news?category=recherche&page=2');
  const el = await mount(t, Page);
  const titles = () => [...el.querySelectorAll('article h3')].map(node => node.textContent);
  const select = name => el.querySelector(`select[name="${name}"]`);
  assert.deepEqual(titles(), ['Article 7']);
  const count = () => el.querySelector('[aria-labelledby="news-filters-title"] [role="status"]').textContent;
  assert.equal(count(), '7'); // nombre d’articles filtrés, pas la taille de la page courante
  assert.equal(select('type').labels[0].textContent, 'filterType');
  assert.equal(select('category').labels[0].textContent, 'filterCategory');
  assert.equal(select('category').value, 'Recherche');
  await act(async () => { select('tag').value = tag; select('tag').dispatchEvent(new window.Event('change', { bubbles: true })); });
  assert.equal(window.location.search, `?tag=${encodeURIComponent(tag)}`);
  assert.equal(select('category').value, '');
  assert.deepEqual(titles(), ['Article 1', 'Article 8']);
  assert.equal(count(), '2');
  // Lien venant du sous-menu sur la même route.
  const [byType] = auto.resolveAutoSubmenu({ ...rule, groupBy: 'type', ids: ['Entretien'] }, records, 'fr');
  await act(async () => push(byType.href));
  assert.deepEqual(titles(), ['Article 8']);
  assert.equal(select('tag').value, '');
  await click(el.querySelector('a[href="/fr/news"]'));
  assert.equal(titles().length, 6);
  await click(el.querySelector('button[aria-label="nextPage"]'));
  assert.equal(window.location.search, '?page=2');
  assert.deepEqual(titles(), ['Article 7', 'Article 8', 'Article 9']);
  await click(el.querySelector('article a[href="/fr/news?category=Recherche"]'));
  assert.equal(titles()[0], 'Article 1');
  await act(async () => {
    const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
    window.history.back(); await popped;
  });
  assert.deepEqual(titles(), ['Article 7', 'Article 8', 'Article 9']);
  await act(async () => push('/fr/news?tag=ancien'));
  assert.deepEqual(titles(), []);
  assert.equal(count(), '0');
  assert.match(el.querySelector('p[role="status"]').textContent, /ancien/);
  await click(el.querySelector('a[href="/fr/news"]'));
  assert.equal(titles().length, 6);
});

test('fiche montée : les tags de l’article et les tags populaires ouvrent une vraie liste localisée', async t => {
  push('/ar/news/1-article');
  const el = await mount(t, Detail);
  const hrefs = nodes => [...nodes].map(a => a.getAttribute('href'));
  const targets = [tag, 'تقنية'].map(value => `/ar/news?tag=${encodeURIComponent(value)}`);
  assert.deepEqual(hrefs(el.querySelectorAll('article a')), targets);
  const popular = el.querySelector('[aria-labelledby="popular-tags-title"]');
  assert.deepEqual(hrefs(popular.querySelectorAll('a')), targets);
  assert.ok(el.querySelector('a[href="/ar/news?type=Br%C3%A8ve"]'));
  await click(popular.querySelectorAll('a')[1]);
  const list = await mount(t, Page);
  assert.equal(list.querySelector('select[name="tag"]').value, 'تقنية');
  assert.deepEqual([...list.querySelectorAll('article h3')].map(el => el.textContent), ['Article 1']);
});

test('article sans tags : le module propose de vrais tags d’autres articles sans les attribuer à la fiche', async t => {
  push('/fr/news/2-article');
  const el = await mount(t, Detail);
  const section = el.querySelector('[aria-labelledby="article-tags-title"]');
  assert.match(section.textContent, /suggestedTags/);
  const suggestion = section.querySelector('a');
  assert.equal(suggestion.getAttribute('href'), `/fr/news?tag=${encodeURIComponent(tag)}`);
  await click(suggestion);
  const list = await mount(t, Page);
  assert.deepEqual([...list.querySelectorAll('article h3')].map(node => node.textContent), ['Article 1', 'Article 8']);
});

for (const [category, classification, expected] of [
  ['R&D', 'Dossier', '?category=R%26D'], ['', 'Dossier', '?type=Dossier'], ['', '', ''],
]) {
  test(`catalogue sans tags : modules visibles et repli vers ${expected || 'la liste'}`, async t => {
    t.mock.method(front['@/lib/data'], 'getNews', async () => [{ ...articles[0], tags: [' ', ''], category, classification }]);
    push('/en/news/1-article');
    const el = await mount(t, Detail);
    const own = el.querySelector('[aria-labelledby="article-tags-title"]');
    const popular = el.querySelector('[aria-labelledby="popular-tags-title"]');
    assert.match(own.textContent, /noArticleTags/);
    assert.match(popular.textContent, /noPopularTags/);
    assert.equal(own.querySelector('a').getAttribute('href'), `/en/news${expected}`);
    assert.equal(popular.querySelector('a').getAttribute('href'), '/en/news');
    assert.equal(el.querySelectorAll('a[href*="?tag="]').length, 0, 'aucun tag inventé');
  });
}

test('studio monté : locale éditée, passage catégorie → tag → type, sélection et aperçu', async t => {
  push('/fr/admin/menus');
  let saved;
  const requests = [];
  const Picker = load('components/admin/AutoSubmenuPicker.tsx', {
    'next-intl': intl, '@/lib/cms': load('lib/cms.ts'), '@/lib/menu-auto': auto, '@/lib/news-groups': groups,
    '@/components/admin/IconMark': ignored, '@/lib/cms-admin': { cmsAdminList: async (source, query) => {
      requests.push({ source, query }); return records;
    } },
  }).default;
  function Studio() {
    const [value, set] = useState({ ...rule, ids: ['Recherche'] });
    return h(Picker, { locale: 'ar', value, onChange(next) { saved = next; set(next); } });
  }
  const el = await mount(t, Studio);
  const button = label => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === label);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].source, 'news');
  assert.deepEqual(JSON.parse(requests[0].query.filter), { locale: 'ar' });
  assert.equal(requests[0].query.view, 'card');
  assert.match(el.querySelector('ul').textContent, /\/ar\/news\?category=Recherche/);
  await click(button('modeTags'));
  assert.deepEqual(saved, { ...rule, groupBy: 'tag', ids: [] });
  assert.equal(el.querySelectorAll('li').length, 2);
  assert.equal(button('Brouillon'), undefined);
  await click(button('تقنية'));
  assert.deepEqual(saved.ids, ['تقنية']);
  assert.match(el.querySelector('li').textContent, new RegExp(encodeURIComponent('تقنية')));
  assert.equal(el.querySelectorAll('li').length, 1);
  await click(button('allGroupValues'));
  assert.deepEqual(saved.ids, []);
  assert.equal(el.querySelectorAll('li').length, 2);
  await click(button(tag));
  await click(button('modeNewsTypes'));
  assert.deepEqual(saved, { ...rule, groupBy: 'type', ids: [] });
  assert.match(el.querySelector('ul').textContent, /\/ar\/news\?type=Entretien/);
});
