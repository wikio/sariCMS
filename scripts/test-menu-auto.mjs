#!/usr/bin/env node
/**
 * Vérifie les sous-menus générés depuis le contenu, sans navigateur.
 *
 * Le besoin : un lien de menu (Solutions, Services…) doit pouvoir peupler son
 * sous-menu tout seul, en excluant les fiches archivées ou en brouillon, et en
 * restant à jour sans repasser par l'administration.
 *
 * Quatre volets :
 *   1. la résolution d'une règle (`lib/menu-auto.ts`) : filtrage, tri, limite,
 *      sélection manuelle ordonnée ;
 *   2. les URLs produites, qui doivent viser les vraies routes de la vitrine
 *      (`/solutions/[categoryKey]` et non un chemin deviné) ;
 *   3. `getLinkHref` du Header, qui ne doit pas re-préfixer la langue sur une
 *      URL déjà localisée ;
 *   4. le contrat backend : le DTO doit accepter `submenu` et `auto`, et
 *      l'endpoint public doit renvoyer `items`.
 *
 * Usage : node scripts/test-menu-auto.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

/* --------------------------------------------------------------------------
 * Réimplémentation de la résolution, alignée sur `lib/menu-auto.ts`.
 * Le fichier est en TypeScript : on rejoue ici les mêmes règles, et on vérifie
 * plus bas que la source n'a pas divergé sur les points sensibles.
 * ------------------------------------------------------------------------ */
const BASE_PATHS = {
  solutions: 'solutions',
  services: 'services',
  products: 'products',
  news: 'news',
  events: 'events',
};

function routeKey(entity) {
  const id = entity.id == null ? '' : String(entity.id);
  const slug = entity.slug ? String(entity.slug) : '';
  if (id && /^\d+$/.test(id)) return slug ? `${id}-${slug}` : id;
  return slug || id;
}

function isPublished(entity) {
  const status = entity.status == null ? '' : String(entity.status).trim().toLowerCase();
  return status === '' || status === 'published';
}

function resolve_(rule, entities, locale) {
  const visible = entities.filter(isPublished);
  let selected;
  if (rule.mode === 'pick') {
    selected = (rule.ids || [])
      .map(String)
      .map((id) => visible.find((e) => String(e.id) === id || String(e.legacyId ?? '') === id))
      .filter(Boolean);
  } else {
    selected = [...visible].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  const limit = Number(rule.limit) || 0;
  if (limit > 0) selected = selected.slice(0, limit);
  return selected.map((e) => ({
    label: String(e.title ?? e.name ?? ''),
    href: `/${locale}/${BASE_PATHS[rule.source]}/${routeKey(e)}`,
  }));
}

const CATS = [
  { id: 'diagnostic', slug: 'diagnostic-imagerie', title: 'Diagnostic & Imagerie', status: 'published', sortOrder: 2 },
  { id: 'cardiology', slug: 'cardiologie', title: 'Cardiologie', status: 'published', sortOrder: 3 },
  { id: 'surgery', slug: 'chirurgie', title: 'Chirurgie', status: 'archived', sortOrder: 1 },
  { id: 'draft1', slug: 'brouillon', title: 'Brouillon', status: 'draft', sortOrder: 0 },
  { id: 'lab', slug: 'laboratoire', title: 'Laboratoire', sortOrder: 1 },
];

console.log('\n— Résolution des règles —');

{
  const out = resolve_({ source: 'solutions', mode: 'all' }, CATS, 'fr');
  check('mode « toutes » : archivées et brouillons exclus', out.length === 3, `${out.length} entrée(s)`);
  check(
    'tri par sortOrder',
    out.map((o) => o.label).join(' < ') === 'Laboratoire < Diagnostic & Imagerie < Cardiologie',
    out.map((o) => o.label).join(' < '),
  );
  // Un statut absent = fiche héritée des jeux JSON, considérée publiée.
  check('statut absent traité comme publié', out.some((o) => o.label === 'Laboratoire'));
}

{
  const out = resolve_({ source: 'solutions', mode: 'all', limit: 2 }, CATS, 'fr');
  check('limite respectée', out.length === 2, `${out.length}`);
  const none = resolve_({ source: 'solutions', mode: 'all', limit: 0 }, CATS, 'fr');
  check('limite 0 = pas de limite', none.length === 3, `${none.length}`);
}

{
  const out = resolve_(
    { source: 'solutions', mode: 'pick', ids: ['cardiology', 'diagnostic', 'surgery'] },
    CATS,
    'fr',
  );
  check("mode « sélection » : l'ordre choisi prime", out.map((o) => o.label).join(',') === 'Cardiologie,Diagnostic & Imagerie', out.map((o) => o.label).join(','));
  check('une fiche archivée sélectionnée est ignorée', out.length === 2, `${out.length}`);
}

{
  const empty = resolve_({ source: 'solutions', mode: 'all' }, [{ id: 'x', slug: 'x', title: 'X', status: 'archived' }], 'fr');
  check('tout archivé : aucun sous-lien', empty.length === 0);
}

console.log('\n— URLs générées —');

{
  const out = resolve_({ source: 'solutions', mode: 'all', limit: 1 }, CATS, 'fr');
  check('URL localisée', out[0].href.startsWith('/fr/'), out[0].href);
  const ar = resolve_({ source: 'solutions', mode: 'all', limit: 1 }, CATS, 'ar');
  check('URL suit la langue', ar[0].href.startsWith('/ar/'), ar[0].href);

  // La page de détail des solutions est `[categoryKey]`, pas `[id]` : un
  // chemin deviné (`/solutions/imaging`) donnerait un 404.
  const numeric = resolve_({ source: 'solutions', mode: 'all' }, [{ id: 12, slug: 'imagerie', title: 'Imagerie' }], 'fr');
  check('id numérique préfixe le slug', numeric[0].href === '/fr/solutions/12-imagerie', numeric[0].href);
  const textual = resolve_({ source: 'solutions', mode: 'all' }, [{ id: 'diagnostic', slug: 'diagnostic-imagerie', title: 'D' }], 'fr');
  check('id textuel : slug seul', textual[0].href === '/fr/solutions/diagnostic-imagerie', textual[0].href);
}

console.log('\n— Header : pas de double préfixe de langue —');

{
  const locales = new Set(['fr', 'en', 'ar']);
  const locale = 'fr';
  const getLinkHref = (href) => {
    const raw = String(href || '');
    if (/^(https?:)?\/\//i.test(raw) || /^(mailto|tel):/i.test(raw)) return raw;
    const cleanPath = raw.replace(/^[#/]+/, '');
    if (/^[a-z]{2}(-[A-Za-z]{2})?(\/|$)/.test(cleanPath)) {
      const [first, ...rest] = cleanPath.split('/');
      if (locales.has(first)) return `/${locale}/${rest.join('/')}`.replace(/\/+$/, '') || `/${locale}`;
    }
    return `/${locale}/${cleanPath}`;
  };

  check('URL déjà localisée non re-préfixée', getLinkHref('/fr/solutions/diagnostic-imagerie') === '/fr/solutions/diagnostic-imagerie', getLinkHref('/fr/solutions/diagnostic-imagerie'));
  check('lien relatif préfixé', getLinkHref('/solutions') === '/fr/solutions');
  check('ancre préfixée', getLinkHref('#contact') === '/fr/contact');
  check('autre langue ramenée à la langue courante', getLinkHref('/ar/news/12-t') === '/fr/news/12-t');
  check('lien externe intact', getLinkHref('https://example.com') === 'https://example.com');
  check('mailto intact', getLinkHref('mailto:a@b.c') === 'mailto:a@b.c');

  const headerSrc = readFileSync(resolve(ROOT, 'components/layout/Header.tsx'), 'utf8');
  check('le Header applique bien ce garde-fou', /LOCALE_SEGMENTS\.has\(first\)/.test(headerSrc));
}

console.log('\n— Contrat backend —');

{
  const dto = readFileSync(resolve(ROOT, 'backend/src/modules/menus/dto/menu.dto.ts'), 'utf8');
  // `forbidNonWhitelisted: true` rejette tout champ non déclaré : `submenu`
  // était absent, donc l'enregistrement d'un sous-menu échouait en 400.
  check('le DTO accepte submenu', /submenu\?: MenuItemDto\[\]/.test(dto));
  check('le DTO accepte auto', /auto\?: MenuAutoDto \| null/.test(dto));
  check('les sources auto sont énumérées', /AUTO_SOURCES = \['solutions', 'services', 'products', 'news', 'events'\]/.test(dto));
  check('children conservé pour les menus existants', /children\?: MenuItemDto\[\]/.test(dto));

  const ctrl = readFileSync(resolve(ROOT, 'backend/src/modules/menus/public-menus.controller.ts'), 'utf8');
  // La valeur par défaut de `view` est `list`, dont la projection omet `items`.
  check("l'endpoint public force view: 'block'", /view: 'block'/.test(ctrl));
}

console.log('\n— Résolution côté vitrine —');

{
  const dataSrc = readFileSync(resolve(ROOT, 'lib/data.ts'), 'utf8');
  check('getMenu développe les règles', /return expandAutoMenus\(menu, locale\)/.test(dataSrc));
  check('les modules non référencés ne sont pas chargés', /if \(!sources\.length\) return menu;/.test(dataSrc));

  const autoSrc = readFileSync(resolve(ROOT, 'lib/menu-auto.ts'), 'utf8');
  check('un sous-menu vide reste undefined', /resolved\.length \? resolved : undefined/.test(autoSrc));
  check('le filtre publié est appliqué', /export function isPublished/.test(autoSrc));

  const studioSrc = readFileSync(resolve(ROOT, 'components/admin/MenuStudio.tsx'), 'utf8');
  // Enregistrer la liste résolue la figerait : les fiches archivées ensuite
  // resteraient affichées.
  check(
    "l'administration n'enregistre pas la liste résolue",
    /submenu: it\.auto \? \[\] :/.test(studioSrc),
  );
}

console.log('\n— Options d’affichage du sous-menu (description / icône) —');

{
  const autoSrc = readFileSync(resolve(ROOT, 'lib/menu-auto.ts'), 'utf8');

  // Rétrocompatibilité : les menus déjà en base n'ont ni showDesc ni showIcon.
  // La description doit rester visible, l'icône rester masquée.
  check(
    'description affichée par défaut (showDesc absent = vrai)',
    /const showDesc = rule\.showDesc !== false;/.test(autoSrc),
  );
  check(
    'icône masquée par défaut (showIcon absent = faux)',
    /const showIcon = rule\.showIcon === true;/.test(autoSrc),
  );
  check(
    'la description est conditionnée à showDesc',
    /desc: showDesc && entity\.shortDesc \? String\(entity\.shortDesc\) : undefined/.test(autoSrc),
  );
  check(
    "l'icône est conditionnée à showIcon",
    /icon: showIcon && entity\.icon \? String\(entity\.icon\) : undefined/.test(autoSrc),
  );
  check('AutoEntity expose icon', /^\s*icon\?: string;/m.test(autoSrc));
  check(
    'les modules porteurs d’icône sont déclarés',
    /SOURCES_WITH_ICON[^=]*=\s*\['solutions', 'services'\]/.test(autoSrc),
  );

  // Le DTO doit accepter les deux champs, sinon forbidNonWhitelisted rejette
  // l'enregistrement avec « property showDesc should not exist ».
  const dto = readFileSync(
    resolve(ROOT, 'backend/src/modules/menus/dto/menu.dto.ts'),
    'utf8',
  );
  check('le DTO accepte showDesc', /@IsBoolean\(\)\s*\n\s*showDesc\?: boolean;/.test(dto));
  check('le DTO accepte showIcon', /@IsBoolean\(\)\s*\n\s*showIcon\?: boolean;/.test(dto));

  const types = readFileSync(resolve(ROOT, 'types/index.ts'), 'utf8');
  check(
    'MenuAutoRule porte les deux options',
    /showDesc\?: boolean;/.test(types) && /showIcon\?: boolean;/.test(types),
  );

  // Rendu vitrine : les deux affichages doivent être conditionnels, et les
  // versions desktop et mobile doivent se comporter pareil.
  const header = readFileSync(resolve(ROOT, 'components/layout/Header.tsx'), 'utf8');
  check("le Header importe IconMark", /import IconMark from '@\/components\/admin\/IconMark';/.test(header));
  check(
    "l'icône du sous-lien est rendue quand elle existe",
    (header.match(/sub\.icon (?:&&|\?) \(?\s*<IconMark/g) || []).length >= 2,
    'desktop et mobile doivent tous deux rendre l’icône',
  );
  check(
    'la description reste conditionnelle',
    (header.match(/sub\.desc &&/g) || []).length >= 2,
    'desktop et mobile doivent tous deux rendre la description',
  );

  // Éditeur : les interrupteurs, et le garde-fou sur les modules sans icône.
  const picker = readFileSync(
    resolve(ROOT, 'components/admin/AutoSubmenuPicker.tsx'),
    'utf8',
  );
  check('l’éditeur propose l’interrupteur description', /setRule\(\{ showDesc: !showDesc \}\)/.test(picker));
  check('l’éditeur propose l’interrupteur icône', /setRule\(\{ showIcon: !showIcon \}\)/.test(picker));
  check(
    'l’interrupteur icône est désactivé pour les modules sans icône',
    /disabled=\{!sourceHasIcon(?: \|\| isGroups)?\}/.test(picker),
  );
  check(
    'l’aperçu de l’admin rend aussi l’icône',
    /node\.icon \?/.test(picker) && /<IconMark/.test(picker),
  );

  // Les libellés doivent exister dans les trois langues.
  for (const loc of ['fr', 'en', 'ar']) {
    const msgs = JSON.parse(readFileSync(resolve(ROOT, `messages/${loc}.json`), 'utf8'));
    const node = msgs?.admin?.menus ?? {};
    check(
      `libellés d’affichage présents en ${loc}`,
      ['displayTitle', 'showDesc', 'showIcon', 'iconUnsupported', 'iconMissingNotice']
        .every((k) => typeof node[k] === 'string' && node[k].length > 0),
    );
  }
}

console.log('\n— Sous-menus par catégories et vignettes —');

{
  const autoSrc = readFileSync(resolve(ROOT, 'lib/menu-auto.ts'), 'utf8');

  check('le mode groups existe', /'all' \| 'pick' \| 'groups'/.test(autoSrc));
  check(
    'le champ de regroupement est déclaré par module',
    /groupField\?: 'category' \| 'type'/.test(autoSrc),
  );
  check(
    'events regroupe par type, news et products par catégorie',
    /news: \{[^}]*groupField: 'category'/.test(autoSrc) &&
      /products: \{[^}]*groupField: 'category'/.test(autoSrc) &&
      /events: \{[^}]*groupField: 'type'/.test(autoSrc),
  );
  check(
    'solutions et services restent sans regroupement',
    !/solutions: \{[^}]*groupField/.test(autoSrc) &&
      !/services: \{[^}]*groupField/.test(autoSrc),
    'ces modules sont déjà des rubriques',
  );
  check(
    'seules les fiches publiées alimentent les catégories',
    /export function collectGroups[\s\S]{0,320}if \(!isPublished\(entity\)\) continue;/.test(autoSrc),
  );
  check(
    "l'URL de catégorie encode la valeur",
    /encodeURIComponent\(String\(group\)\.trim\(\)\)/.test(autoSrc),
  );
  check(
    "l'URL de catégorie vise la liste filtrée",
    /\$\{locale\}\/\$\{basePath\}\?\$\{groupParam\(source\)\}=\$\{value\}/.test(autoSrc),
  );
  check(
    'sélection de catégories vide = toutes',
    /wanted\.length\s*\n?\s*\? wanted\.filter/.test(autoSrc),
  );
  check(
    'la vignette est conditionnée à showImage',
    /image: showImage && entity\.image \? String\(entity\.image\) : undefined/.test(autoSrc),
  );
  check('AutoEntity expose image, category et type',
    /^\s*image\?: string;/m.test(autoSrc) &&
    /^\s*category\?: string;/m.test(autoSrc) &&
    /^\s*type\?: string;/m.test(autoSrc));

  // Le mode groupes sort avant la résolution des fiches : une catégorie n'a ni
  // description, ni icône, ni image propres.
  const groupsBlock = autoSrc.slice(
    autoSrc.indexOf("if (rule.mode === 'groups')"),
    autoSrc.indexOf('let selected: AutoEntity[];'),
  );
  check(
    'une entrée de catégorie ne porte aucun visuel de fiche',
    !/\bicon:/.test(groupsBlock) && !/\bimage:/.test(groupsBlock) && !/\bdesc:/.test(groupsBlock),
  );

  const dto = readFileSync(
    resolve(ROOT, 'backend/src/modules/menus/dto/menu.dto.ts'),
    'utf8',
  );
  check("le DTO accepte le mode groups", /IsIn\(\['all', 'pick', 'groups'\]\)/.test(dto));
  check('le DTO accepte showImage', /@IsBoolean\(\)\s*\n\s*showImage\?: boolean;/.test(dto));

  const types = readFileSync(resolve(ROOT, 'types/index.ts'), 'utf8');
  check('MenuAutoRule connaît groups et showImage',
    /'all' \| 'pick' \| 'groups'/.test(types) && /showImage\?: boolean;/.test(types));
  check('MenuLink transporte une image', /^\s*image\?: string;/m.test(types));

  // Rendu : la vignette prime sur l'icône, sinon les deux se disputeraient la
  // même gouttière. Vérifié sur les deux rendus, desktop et mobile.
  const header = readFileSync(resolve(ROOT, 'components/layout/Header.tsx'), 'utf8');
  check(
    'la vignette est rendue avant l’icône',
    (header.match(/\{sub\.image \? \([\s\S]*?\) : sub\.icon \? \(/g) || []).length >= 2,
    'desktop et mobile doivent tous deux donner la priorité à la vignette',
  );
  check('les vignettes sont chargées paresseusement',
    (header.match(/loading="lazy"/g) || []).length >= 2);

  // Sans lecture du paramètre d'URL, un lien de catégorie serait inerte.
  const hook = readFileSync(resolve(ROOT, 'lib/use-group-filter.ts'), 'utf8');
  check('le hook lit le paramètre d’URL', /useSearchParams\(\)/.test(hook));
  check('la correspondance ignore casse et espaces',
    /function foldValue[\s\S]{0,140}\.trim\(\)\.toLowerCase\(\)/.test(hook) &&
      /foldValue\(value\) === target/.test(hook));
  // Une navigation vers la même route ne démonte pas le composant : un simple
  // booléen « déjà appliqué » figeait la première catégorie et rendait le
  // deuxième clic inopérant. On mémorise la valeur traitée.
  check('le filtre suit chaque nouvelle valeur d’URL',
    /handled\.current === wanted/.test(hook) && !/if \(applied\.current\) return;/.test(hook));
  check('la valeur n’est retenue qu’une fois la liste chargée',
    /if \(!list\.length\) return;[\s\S]{0,80}handled\.current = wanted;/.test(hook));
  check('les accents composés sont normalisés',
    /normalize\('NFC'\)/.test(hook));
  check('la pagination est remise à la première page',
    /resetPageRef\.current\?\.\(\)/.test(hook));
  check('listes et rappels passent par des refs (pas de boucle d’effet)',
    /availableRef\.current = available;/.test(hook) && /applyRef\.current = apply;/.test(hook));
  check('une catégorie inconnue laisse la liste complète',
    /if \(!match\) return;/.test(hook));

  for (const [page, param] of [
    ['app/[locale]/news/page.tsx', 'category'],
    ['app/[locale]/events/page.tsx', 'type'],
    ['app/[locale]/products/page.tsx', 'category'],
  ]) {
    const src = readFileSync(resolve(ROOT, page), 'utf8');
    const mod = page.split('/')[2];
    check(
      `${mod} applique le filtre d’URL (${param})`,
      new RegExp(`useGroupFilter\\('${param}'`).test(src),
    );
    // Sans remise à zéro, arriver depuis la page 2 donne un écran vide.
    check(
      `${mod} revient à la première page en filtrant`,
      new RegExp(`useGroupFilter\\('${param}'[^;]*setCurrentPage\\(1\\)`).test(src) ||
        /useEffect\(\(\) => \{\s*setCurrentPage\(1\);\s*\}, \[[^\]]*selectedCategory/.test(src),
    );
  }

  for (const loc of ['fr', 'en', 'ar']) {
    const msgs = JSON.parse(readFileSync(resolve(ROOT, `messages/${loc}.json`), 'utf8'));
    const node = msgs?.admin?.menus ?? {};
    check(
      `libellés catégories/vignette présents en ${loc}`,
      ['modeGroups', 'groupsHint', 'groupsEmpty', 'groupsNoVisual', 'showImage'].every(
        (k) => typeof node[k] === 'string' && node[k].length > 0,
      ),
    );
  }
}

console.log('\n— Choix de la cible d’un lien (SlugPicker) —');

{
  const picker = readFileSync(resolve(ROOT, 'components/admin/SlugPicker.tsx'), 'utf8');

  // Un lien libre doit rester saisissable à la main.
  check(
    'le mode « lien libre » expose un champ URL éditable',
    /kind === 'free' \? \([\s\S]{0,400}placeholder="\/chemin-ou-url"/.test(picker),
  );

  // Chaque module doit pouvoir viser sa page liste OU une fiche précise.
  check(
    'chaque module propose sa page liste',
    /const MODULE_INDEX/.test(picker) &&
      ['products', 'services', 'solutions', 'news', 'events', 'careers'].every((k) =>
        new RegExp(`${k}: \\{ path: '/${k}'`).test(picker),
      ),
  );
  check(
    'la page liste est proposée avant les fiches',
    /setHits\(\[\.\.\.indexHit\(query\), \.\.\.rows/.test(picker),
  );
  check(
    'la page liste reste proposée si les fiches sont inaccessibles',
    /catch \{[\s\S]{0,200}setHits\(indexHit\(query\)\);/.test(picker),
  );
  check(
    'les libellés annoncent le double choix liste/fiche',
    (picker.match(/— liste ou/g) || []).length >= 5,
  );

  // Un chemin proposé par l'admin doit exister dans l'app.
  check(
    '/legal (404, la route est legal/[type]) n’est plus proposé',
    !/path: '\/legal',/.test(picker),
  );
  check(
    'les trois pages légales réelles sont proposées',
    ['/legal/mentions', '/legal/privacy', '/legal/conditions'].every((p) =>
      picker.includes(`path: '${p}'`),
    ),
  );

  const appDir = resolve(ROOT, 'app/[locale]');
  const staticPaths = [...picker.matchAll(/\{ path: '([^']+)'/g)].map((m) => m[1]);
  const missing = staticPaths.filter((p) => {
    if (p === '/') return false;
    const segs = p.slice(1).split('/');
    // Une page d'index doit exister ; sinon la route n'est servie que par un
    // segment dynamique et le lien renvoie 404.
    if (segs.length === 1) return !existsSync(resolve(appDir, segs[0], 'page.tsx'));
    return !existsSync(resolve(appDir, segs[0]));
  });
  check(
    'tous les chemins statiques proposés existent dans l’app',
    missing.length === 0,
    missing.length ? `introuvables : ${missing.join(', ')}` : 'aucun lien mort',
  );

  // Rouvrir un lien existant doit resélectionner le bon onglet.
  check(
    'une URL de page liste rouvre son module',
    /const idx = \(Object\.keys\(MODULE_INDEX\)[\s\S]{0,160}if \(idx\) return idx;/.test(picker),
  );

  // L'ancienne fiche générique n'éditait aucun lien : elle doit rediriger.
  const legacy = readFileSync(
    resolve(ROOT, 'app/[locale]/admin/menus/[id]/page.tsx'),
    'utf8',
  );
  check(
    'la fiche générique d’un menu redirige vers l’éditeur complet',
    /router\.replace\(`\/\$\{locale\}\/admin\/menus/.test(legacy),
  );
  check(
    'la redirection ouvre l’onglet du menu visé',
    /\?location=\$\{encodeURIComponent\(location\)\}/.test(legacy),
  );

  const studio = readFileSync(resolve(ROOT, 'components/admin/MenuStudio.tsx'), 'utf8');
  check(
    'l’éditeur accepte un emplacement via l’URL',
    /searchParams\.get\('location'\)/.test(studio),
  );
  check(
    'useSearchParams est enveloppé dans Suspense',
    /<Suspense[\s\S]{0,200}<MenuStudioInner \/>/.test(studio),
  );

  // Le panneau de résultats est en position absolue : il se cale sur le plus
  // proche ancêtre positionné. Ancré au seul champ de recherche, il n'occupait
  // que le reliquat de largeur laissé par le select (224 px fixes), d'où un
  // affichage écrasé sur desktop — correct en mobile où la rangée s'empile.
  check(
    'la rangée sert de repère au panneau de résultats',
    /<div className="relative flex flex-col sm:flex-row gap-2">/.test(picker),
  );
  check(
    'le select occupe la moitié de la largeur',
    /className="ad-select sm:w-1\/2 sm:min-w-0 shrink-0"/.test(picker),
  );
  check(
    'la recherche occupe l’autre moitié',
    /<div className="sm:w-1\/2 min-w-0">\s*\n\s*<div className="ad-search">/.test(picker),
  );
  check(
    'le champ de lien libre occupe aussi la moitié',
    /className="ad-search sm:w-1\/2 min-w-0"/.test(picker),
  );
  check(
    'le champ de recherche n’enferme plus le panneau',
    !/<div className="relative flex-1">/.test(picker),
    'sinon le panneau retombe sur la largeur résiduelle',
  );

  // Un id de lien créé dans l'admin n'a pas de clé i18n : ne pas la demander.
  const header = readFileSync(resolve(ROOT, 'components/layout/Header.tsx'), 'utf8');
  const footer = readFileSync(resolve(ROOT, 'components/layout/Footer.tsx'), 'utf8');
  check(
    'le header ne traduit un id que si la clé existe',
    /tNav\.has\?\.\(item\.id\)/.test(header),
  );
  check(
    'le pied de page ne traduit un id que si la clé existe',
    /if \(!lookup\.has\?\.\(id\)\) continue;/.test(footer),
  );

  // Les menus sont enregistrés par langue : le titre saisi fait autorité.
  // Sinon renommer une entrée dont l'id correspond à une ancienne clé restait
  // sans effet, la traduction écrasant le nouveau titre.
  check(
    'le titre saisi l’emporte sur la clé (header)',
    /if \(typeof item\.label === 'string' && item\.label\.trim\(\)\) return item\.label;/.test(header),
  );
  check(
    'le titre saisi l’emporte sur la clé (pied de page)',
    (footer.match(/if \(item\.label\?\.trim\(\)\) return item\.label;/g) || []).length === 2,
    'navigation et légal',
  );

  // Les replis légaux passent par plusieurs espaces de noms : aucun ne doit
  // lever d'exception si la clé manque (pages.legal.legal, .terms n'existent pas).
  check(
    'les replis légaux sont tentés dans l’ordre sans lever',
    /translateId\(item\.id, tLegal, t\)/.test(footer) && /catch \{/.test(footer),
  );

  // Une entrée sans titre doit encore pouvoir s'appuyer sur sa clé historique.
  for (const [loc] of [['fr'], ['en'], ['ar']]) {
    const msgs = JSON.parse(readFileSync(resolve(ROOT, `messages/${loc}.json`), 'utf8'));
    const nav = msgs?.common?.nav ?? {};
    check(
      `les ids du menu statique restent traduisibles en ${loc}`,
      ['home', 'about', 'products', 'services', 'news', 'events', 'careers', 'contact'].every(
        (k) => typeof nav[k] === 'string' && nav[k].length > 0,
      ),
    );
  }
}

console.log(
  failures === 0
    ? '\n✅ Tous les contrôles passent.\n'
    : `\n❌ ${failures} contrôle(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
