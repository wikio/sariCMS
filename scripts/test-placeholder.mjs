/**
 * Tests unitaires du moteur & stockage du générateur d'images / logos
 * (`lib/placeholder-engine.ts` + `lib/placeholder-settings.ts`).
 *
 * Exécution : `node scripts/test-placeholder.mjs`
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Permet d'importer les modules TypeScript locaux avec tsx ou via transpileModule
const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTsModule(relPath, cache = new Map()) {
  const abs = path.resolve(process.cwd(), relPath);
  if (cache.has(abs)) return cache.get(abs).exports;
  const source = fs.readFileSync(abs, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: abs,
  });
  const mod = { exports: {} };
  cache.set(abs, mod);
  const localRequire = (spec) => {
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const candidate = path.resolve(path.dirname(abs), spec.endsWith('.ts') ? spec : `${spec}.ts`);
      if (fs.existsSync(candidate)) return loadTsModule(candidate, cache);
    }
    return require(spec);
  };
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled.outputText);
  fn(localRequire, mod, mod.exports, abs, path.dirname(abs));
  return mod.exports;
}

const engine = loadTsModule('lib/placeholder-engine.ts');
const store = loadTsModule('lib/placeholder-settings.ts');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('— Tests du générateur d’images & logos —');

await check('Compatibilité directe /150x80/169EC9/FFFFFF?text=SURGICARE', () => {
  const sp = new URLSearchParams('text=SURGICARE');
  const spec = engine.parsePlaceholderRequest(['150x80', '169EC9', 'FFFFFF'], sp);
  assert.equal(spec.width, 150);
  assert.equal(spec.height, 80);
  assert.equal(spec.bg, '#169EC9');
  assert.equal(spec.fg, '#FFFFFF');
  assert.equal(spec.text, 'SURGICARE');
  const svg = engine.renderPlaceholderSvg(spec);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="150" height="80"'));
  assert.ok(svg.includes('SURGICARE'));
});

await check('Forme carrée courte /300 + contraste automatique WCAG', () => {
  const dark = engine.parsePlaceholderRequest(['300', '111111'], new URLSearchParams());
  assert.equal(dark.width, 300);
  assert.equal(dark.height, 300);
  assert.equal(dark.fg, '#FFFFFF');

  const light = engine.parsePlaceholderRequest(['240', 'F8FAFC'], new URLSearchParams());
  assert.equal(light.fg, '#1F2937');
});

await check('Couleurs hex courtes 3 chiffres (/169/fff)', () => {
  const spec = engine.parsePlaceholderRequest(['200x100', '169', 'fff'], new URLSearchParams('text=OK'));
  assert.equal(spec.bg, '#116699');
  assert.equal(spec.fg, '#FFFFFF');
});

await check('Mode query-string complet avec icône, sous-titre, badge, dégradé et motif', () => {
  const sp = new URLSearchParams(
    'w=600&h=300&bg=169EC9&bg2=0B5F86&grad=diagonal&fg=FFFFFF&accent=C6DA34&text=SURGICARE&sub=Medical&badge=PRO&icon=heart-pulse&iconBg=1&pattern=dots&radius=16&border=2&shadow=1',
  );
  const spec = engine.parsePlaceholderRequest([], sp);
  assert.equal(spec.width, 600);
  assert.equal(spec.height, 300);
  assert.equal(spec.gradientDir, 'diagonal');
  assert.equal(spec.icon, 'heart-pulse');
  assert.equal(spec.iconBg, true);
  assert.equal(spec.pattern, 'dots');
  assert.equal(spec.badge, 'PRO');
  assert.equal(spec.shadow, true);

  const svg = engine.renderPlaceholderSvg(spec);
  assert.ok(svg.includes('<linearGradient id="bgGrad"'));
  assert.ok(svg.includes('<pattern id="pat"'));
  assert.ok(svg.includes('SURGICARE'));
  assert.ok(svg.includes('Medical'));
  assert.ok(svg.includes('PRO'));
  assert.ok(svg.includes('<path d="'));
});

await check('Bornage strict des dimensions selon la configuration admin', () => {
  const cfg = { ...engine.DEFAULT_PLACEHOLDER_CONFIG, maxWidth: 1000, maxHeight: 800 };
  const huge = engine.parsePlaceholderRequest(['99999x50000'], new URLSearchParams(), cfg);
  assert.equal(huge.width, 1000);
  assert.equal(huge.height, 800);

  const tiny = engine.parsePlaceholderRequest(['5x2'], new URLSearchParams(), cfg);
  assert.equal(tiny.width, 32);
  assert.equal(tiny.height, 32);
});

await check('Toutes les 28 icônes vectorielles génèrent des chemins SVG valides', () => {
  assert.ok(engine.PLACEHOLDER_ICONS.length >= 25);
  for (const icon of engine.PLACEHOLDER_ICONS) {
    const spec = engine.parsePlaceholderRequest(['200x100'], new URLSearchParams(`text=Test&icon=${icon.id}`));
    const svg = engine.renderPlaceholderSvg(spec);
    assert.ok(svg.includes('<path d="'), `Icône manquante: ${icon.id}`);
  }
});

await check('Tous les motifs d’arrière-plan (dots, grid, diagonal, waves, rings, mesh) sont rendus', () => {
  for (const pat of ['dots', 'grid', 'diagonal', 'waves', 'rings', 'mesh']) {
    const spec = engine.parsePlaceholderRequest(['300x150'], new URLSearchParams(`pattern=${pat}&text=Pat`));
    const svg = engine.renderPlaceholderSvg(spec);
    assert.ok(svg.includes('id="pat"') || svg.includes('id="mesh1"') || svg.includes('<circle') || svg.includes('<path'), `Motif ${pat}`);
  }
});

await check('Neutralisation XSS / échappement XML strict sur text, sub et badge', () => {
  const sp = new URLSearchParams();
  sp.set('text', '<script>alert(1)</script>');
  sp.set('sub', '"><img src=x onerror=alert(2)>');
  sp.set('badge', '<b>X</b>');
  const spec = engine.parsePlaceholderRequest(['400x200'], sp);
  const svg = engine.renderPlaceholderSvg(spec);
  assert.ok(!svg.includes('<script>'));
  assert.ok(!svg.includes('<img '));
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});

await check('Détection automatique RTL pour le texte arabe', () => {
  const spec = engine.parsePlaceholderRequest(['400x200'], new URLSearchParams('text=ساري+الطبي'));
  const svg = engine.renderPlaceholderSvg(spec);
  assert.ok(svg.includes('direction="rtl"'));
});

await check('Aller-retour buildPlaceholderUrl → parsePlaceholderRequest', () => {
  const orig = {
    ...engine.parsePlaceholderRequest(['320x160', '169EC9', 'FFFFFF'], new URLSearchParams('text=SURGICARE')),
    sub: 'Solutions',
    badge: 'ISO',
    icon: 'stethoscope',
    iconPos: 'top',
    iconBg: true,
    gradientDir: 'radial',
    bg2: '#0B5F86',
    pattern: 'rings',
    radius: 20,
    border: 3,
    shadow: true,
  };
  const url = engine.buildPlaceholderUrl(orig, 'https://vitrine.sari.test');
  assert.ok(url.startsWith('https://vitrine.sari.test/api/placeholder/320x160/169EC9/FFFFFF?'));
  const parsedUrl = new URL(url);
  const segs = parsedUrl.pathname.replace(/^\/api\/placeholder\//, '').split('/');
  const roundtrip = engine.parsePlaceholderRequest(segs, parsedUrl.searchParams);
  assert.equal(roundtrip.width, 320);
  assert.equal(roundtrip.height, 160);
  assert.equal(roundtrip.bg, '#169EC9');
  assert.equal(roundtrip.fg, '#FFFFFF');
  assert.equal(roundtrip.text, 'SURGICARE');
  assert.equal(roundtrip.sub, 'Solutions');
  assert.equal(roundtrip.badge, 'ISO');
  assert.equal(roundtrip.icon, 'stethoscope');
  assert.equal(roundtrip.iconPos, 'top');
  assert.equal(roundtrip.iconBg, true);
  assert.equal(roundtrip.gradientDir, 'radial');
  assert.equal(roundtrip.pattern, 'rings');
  assert.equal(roundtrip.radius, 20);
  assert.equal(roundtrip.border, 3);
  assert.equal(roundtrip.shadow, true);
});

await check('Validation sanitizePlaceholderConfig (rejette javascript: et borne les champs)', () => {
  const clean = engine.sanitizePlaceholderConfig({
    baseUrl: 'javascript:alert(1)',
    maxWidth: 999999,
    maxHeight: 10,
    cacheMaxAge: -50,
    defaultBg: 'not-a-color',
    palette: [],
    sizePresets: [],
  });
  assert.equal(clean.baseUrl, '');
  assert.equal(clean.maxWidth, 4096);
  assert.equal(clean.maxHeight, 200);
  assert.equal(clean.cacheMaxAge, 0);
  assert.equal(clean.defaultBg, engine.DEFAULT_PLACEHOLDER_CONFIG.defaultBg);
  assert.ok(clean.palette.length >= 1);
  assert.ok(clean.sizePresets.length >= 1);
});

await check('Persistance atomique readPlaceholderConfig / writePlaceholderConfig', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sari-ph-'));
  const tmpFile = path.join(tmpDir, 'placeholder-settings.json');
  const prev = process.env.PLACEHOLDER_SETTINGS_FILE;
  process.env.PLACEHOLDER_SETTINGS_FILE = tmpFile;
  try {
    const initial = await store.readPlaceholderConfig();
    assert.equal(initial.enabled, true);

    const updated = await store.writePlaceholderConfig({
      baseUrl: 'https://shop.sari.example/',
      defaultBg: '#0F766E',
      defaultText: 'DEMO',
      allowExternalReferer: false,
    });
    assert.equal(updated.baseUrl, 'https://shop.sari.example');
    assert.equal(updated.defaultBg, '#0F766E');
    assert.equal(updated.allowExternalReferer, false);

    const reloaded = await store.readPlaceholderConfig();
    assert.deepEqual(reloaded, updated);
  } finally {
    if (prev === undefined) delete process.env.PLACEHOLDER_SETTINGS_FILE;
    else process.env.PLACEHOLDER_SETTINGS_FILE = prev;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

await check('Aucune dépendance via.placeholder.com restante dans data/{fr,en,ar}/partners.json', () => {
  for (const loc of ['fr', 'en', 'ar']) {
    const list = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', loc, 'partners.json'), 'utf8'));
    assert.ok(list.length >= 6);
    for (const p of list) {
      assert.ok(!String(p.logo).includes('via.placeholder.com'), `${loc}: ${p.logo}`);
      assert.ok(String(p.logo).startsWith('/api/placeholder/'), `${loc}: ${p.logo}`);
    }
  }
});

console.log(`\n✅ ${passed}/${passed} vérifications du générateur d’images & logos réussies.`);
