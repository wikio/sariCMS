/** Parcours réels liste/fiche/studio, sans dépendre du contenu d'une base ni d'un serveur Next. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  useRouter: () => ({ push }), useParams: () => ({ id: '1-article' }),
};
const tr = (key, params = {}) => key === 'noMatches' ? `${key}: ${params.value}` : key;
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
  assert.equal(select('category').value, 'Recherche');
  await act(async () => { select('tag').value = tag; select('tag').dispatchEvent(new window.Event('change', { bubbles: true })); });
  assert.equal(window.location.search, `?tag=${encodeURIComponent(tag)}`);
  assert.equal(select('category').value, '');
  assert.deepEqual(titles(), ['Article 1', 'Article 8']);
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
  assert.match(el.querySelector('[role="status"]').textContent, /ancien/);
  await click(el.querySelector('a[href="/fr/news"]'));
  assert.equal(titles().length, 6);
});

test('fiche montée : les tags de l’article et les tags populaires ouvrent une vraie liste localisée', async t => {
  push('/ar/news/1-article');
  const el = await mount(t, Detail);
  const hrefs = nodes => [...nodes].map(a => a.getAttribute('href'));
  const targets = [tag, 'تقنية'].map(value => `/ar/news?tag=${encodeURIComponent(value)}`);
  assert.deepEqual(hrefs(el.querySelectorAll('article a')), targets);
  const popular = [...el.querySelectorAll('h3')].find(h => h.textContent === 'popularTags').parentElement;
  assert.deepEqual(hrefs(popular.querySelectorAll('a')), targets);
  assert.ok(el.querySelector('a[href="/ar/news?type=Br%C3%A8ve"]'));
  await click(popular.querySelectorAll('a')[1]);
  const list = await mount(t, Page);
  assert.equal(list.querySelector('select[name="tag"]').value, 'تقنية');
  assert.deepEqual([...list.querySelectorAll('article h3')].map(el => el.textContent), ['Article 1']);
});

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
