/**
 * Tests unitaires du moteur analytique et du moteur d'export
 * (`lib/analytics-engine.ts` + `lib/analytics-export.ts`).
 *
 * Exécution : `node scripts/test-analytics.mjs`
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

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
      const base = path.resolve(path.dirname(abs), spec);
      if (fs.existsSync(base) && base.endsWith('.mjs')) {
        // Stub minimal gedStore when loaded synchronously from CJS test runner
        if (base.endsWith(path.join('ged', 'store.mjs'))) {
          return {
            gedStore: {
              assetInventory: async () => ({
                items: [
                  {
                    file: 'logo/IMG_test-logo.png',
                    name: 'IMG_test-logo.png',
                    url: '/uploads/logo/IMG_test-logo.png',
                    kind: 'image',
                    module: 'logo',
                    bytes: 42000,
                    size: 42000,
                    version: 2,
                    editable: false,
                    createdAt: new Date().toISOString(),
                    source: { origin: 'media' },
                    history: [{ version: 1 }],
                  },
                  {
                    file: 'canvas/CANVA_banner.png',
                    name: 'CANVA_banner.png',
                    url: '/uploads/canvas/CANVA_banner.png',
                    kind: 'canvas',
                    module: 'canvas',
                    bytes: 128000,
                    size: 128000,
                    version: 1,
                    editable: true,
                    createdAt: new Date().toISOString(),
                    source: { origin: 'atelier' },
                    history: [],
                  },
                ],
                total: 2,
              }),
            },
          };
        }
      }
      const candidate = base.endsWith('.ts') ? base : `${base}.ts`;
      if (fs.existsSync(candidate)) return loadTsModule(candidate, cache);
    }
    return require(spec);
  };
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled.outputText);
  fn(localRequire, mod, mod.exports, abs, path.dirname(abs));
  return mod.exports;
}

const cache = new Map();
const engine = loadTsModule('lib/analytics-engine.ts', cache);
const exporter = loadTsModule('lib/analytics-export.ts', cache);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('— Tests du moteur analytique & export de rapports —');

await check('listes CMS : 100 lignes maximum par requête, filtre conservé et lecture bornée', async () => {
  const originalFetch = globalThis.fetch;
  const pages = [];
  globalThis.fetch = async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('limit'), '100'); assert.equal(query.get('locale'), 'fr');
    const page = Number(query.get('page'));
    pages.push(page);
    const data = Array.from({ length: 100 }, (_, i) => (page - 1) * 100 + i);
    return Response.json({ success: true, data: { data, meta: { totalPages: 8 } } });
  };
  try {
    const { cmsPagedList } = loadTsModule('lib/cms.ts', cache);
    const rows = await cmsPagedList('/news?locale=fr', 135, {});
    assert.deepEqual(pages, [1, 2]); assert.equal(rows.length, 135); assert.equal(rows[134], 134);
  } finally { globalThis.fetch = originalFetch; }
});

await check('parseFlexibleDate supporte ISO, DD/MM/YYYY et dates FR textuelles', () => {
  const iso = engine.parseFlexibleDate('2026-11-16T10:00:00Z');
  assert.equal(iso.getUTCFullYear(), 2026);
  const fr1 = engine.parseFlexibleDate('15-18 Mars 2024');
  assert.equal(fr1.getUTCFullYear(), 2024);
  assert.equal(fr1.getUTCMonth(), 2);
  assert.equal(fr1.getUTCDate(), 15);
  const fr2 = engine.parseFlexibleDate('22 Février 2024');
  assert.equal(fr2.getUTCMonth(), 1);
  assert.equal(engine.parseFlexibleDate('invalide'), null);
});

await check('resolveFilters & bucketForDate (day / week / month)', () => {
  const f1 = engine.resolveFilters(new URLSearchParams('range=30d&locale=fr'));
  assert.equal(f1.range, '30d');
  assert.equal(f1.locale, 'fr');
  assert.equal(f1.granularity, 'day');
  assert.ok(f1.from && f1.to && f1.from <= f1.to);

  const f2 = engine.resolveFilters(new URLSearchParams('range=custom&from=2026-01-01&to=2026-06-30&granularity=week'));
  assert.equal(f2.from, '2026-01-01');
  assert.equal(f2.to, '2026-06-30');
  assert.equal(f2.granularity, 'week');

  const dt = new Date('2026-03-15T00:00:00Z');
  assert.equal(engine.bucketForDate(dt, 'day').bucket, '2026-03-15');
  assert.equal(engine.bucketForDate(dt, 'month').bucket, '2026-03');
  assert.ok(engine.bucketForDate(dt, 'week').bucket.startsWith('2026-W'));
});

await check('buildAnalyticsSnapshot agrège participations événements multi-statuts, emplois, articles, auteurs, newsletter, GED et files équipe', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sari-an-'));
  const regFile = path.join(tmpDir, 'event-registrations.json');
  const nowIso = new Date().toISOString();
  fs.writeFileSync(
    regFile,
    JSON.stringify({
      version: 1,
      rows: [
        { id: '1', eventId: 'evt-1', eventTitle: 'Salon Médical', firstName: 'A', lastName: 'B', fullName: 'A B', email: 'a@t.dz', phone: '0550000001', phoneNormalized: '+213550000001', locale: 'fr', status: 'confirmed', source: 'frontend', createdAt: nowIso, updatedAt: nowIso },
        { id: '2', eventId: 'evt-1', eventTitle: 'Salon Médical', firstName: 'C', lastName: 'D', fullName: 'C D', email: 'c@t.dz', phone: '0550000002', phoneNormalized: '+213550000002', locale: 'fr', status: 'attended', clientUserId: 'cli-1', source: 'frontend', createdAt: nowIso, updatedAt: nowIso },
        { id: '3', eventId: 'evt-1', eventTitle: 'Salon Médical', firstName: 'E', lastName: 'F', fullName: 'E F', email: 'e@t.dz', phone: '0550000003', phoneNormalized: '+213550000003', locale: 'fr', status: 'pending', source: 'frontend', createdAt: nowIso, updatedAt: nowIso },
        { id: '4', eventId: 'evt-2', eventTitle: 'Formation', firstName: 'G', lastName: 'H', fullName: 'G H', email: 'g@t.dz', phone: '0550000004', phoneNormalized: '+213550000004', locale: 'fr', status: 'waitlist', source: 'frontend', createdAt: nowIso, updatedAt: nowIso },
        { id: '5', eventId: 'evt-2', eventTitle: 'Formation', firstName: 'I', lastName: 'J', fullName: 'I J', email: 'i@t.dz', phone: '0550000005', phoneNormalized: '+213550000005', locale: 'fr', status: 'rejected', source: 'frontend', createdAt: nowIso, updatedAt: nowIso },
      ],
    }),
    'utf8',
  );

  const prevReg = process.env.EVENT_REGISTRATIONS_FILE;
  process.env.EVENT_REGISTRATIONS_FILE = regFile;
  try {
    const filters = engine.resolveFilters(new URLSearchParams('range=all&locale=fr'));
    const snap = await engine.buildAnalyticsSnapshot(null, filters);

    // Participations événements multi-statuts
    assert.equal(snap.eventRegistrations.total, 5);
    assert.equal(snap.eventRegistrations.confirmed, 1);
    assert.equal(snap.eventRegistrations.attended, 1);
    assert.equal(snap.eventRegistrations.approved, 2);
    assert.equal(snap.eventRegistrations.pending, 1);
    assert.equal(snap.eventRegistrations.waitlist, 1);
    assert.equal(snap.eventRegistrations.toProcess, 2);
    assert.equal(snap.eventRegistrations.rejected, 1);
    assert.equal(snap.eventRegistrations.linkedClients, 1);
    assert.equal(snap.eventRegistrations.approvalRate, 40);
    assert.equal(snap.eventRegistrations.attendanceRate, 50);
    assert.equal(snap.eventRegistrations.byEvent.length, 2);

    // Contenu & Emplois (data/fr/*.json)
    assert.ok(snap.jobs.total > 0);
    assert.equal(snap.jobs.active + snap.jobs.completed + snap.jobs.draft, snap.jobs.total);
    assert.ok(snap.articles.total > 0);
    assert.ok(snap.events.total > 0);
    assert.ok(snap.authors.total > 0);
    assert.ok(snap.authors.active > 0);

    // GED (stubbed 2 files)
    assert.equal(snap.ged.totalFiles, 2);
    assert.equal(snap.ged.totalBytes, 170000);
    assert.equal(snap.ged.editableCount, 1);
    assert.equal(snap.ged.versionedCount, 1);
    assert.equal(snap.ged.byKind.length, 2);

    // Files de traitement équipe
    assert.ok(snap.team.queues.length >= 6);
    const evQueue = snap.team.queues.find((q) => q.key === 'eventRegistrations');
    assert.equal(evQueue.remaining, 2);
    assert.equal(evQueue.completed, 3);
    assert.equal(evQueue.completionRate, 60);

    // Exports CSV & HTML
    const csv = exporter.buildAnalyticsCsv(snap, 'all');
    assert.ok(csv.includes('=== CANDIDATURES ÉVÉNEMENTS ==='));
    assert.ok(csv.includes('=== GED & FICHIERS ==='));
    assert.ok(csv.includes('=== EMPLOYÉS, ADMINISTRATEURS & CHARGE DE TRAITEMENT ==='));
    assert.ok(csv.includes('Salon Médical'));

    const html = exporter.buildAnalyticsHtmlReport(snap, 'Rapport Test <script>x</script>');
    assert.ok(!html.includes('<script>x</script>'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(html.includes('Salon Médical'));
  } finally {
    if (prevReg === undefined) delete process.env.EVENT_REGISTRATIONS_FILE;
    else process.env.EVENT_REGISTRATIONS_FILE = prevReg;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

await check('escapeCsvCell neutralise les injections de formules Excel (=, +, -, @)', () => {
  assert.equal(exporter.escapeCsvCell('=CMD|calc'), "'=CMD|calc");
  assert.equal(exporter.escapeCsvCell('+1+1'), "'+1+1");
  assert.equal(exporter.escapeCsvCell('-2+3'), "'-2+3");
  assert.equal(exporter.escapeCsvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(exporter.escapeCsvCell('A;B'), '"A;B"');
});

await check('formatBytes formate proprement o / Ko / Mo', () => {
  assert.equal(exporter.formatBytes(0), '0 o');
  assert.equal(exporter.formatBytes(512), '512 o');
  assert.equal(exporter.formatBytes(2048), '2.0 Ko');
  assert.equal(exporter.formatBytes(1048576), '1.0 Mo');
});

await check('Persistance atomique des préférences dashboard (readDashboardPrefs / writeDashboardPrefs)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sari-prefs-'));
  const pFile = path.join(tmpDir, 'analytics-prefs.json');
  const prev = process.env.ANALYTICS_PREFS_FILE;
  process.env.ANALYTICS_PREFS_FILE = pFile;
  try {
    const def = await engine.readDashboardPrefs();
    assert.equal(def.animationsEnabled, true);
    assert.deepEqual(def.hiddenWidgets, []);

    const saved = await engine.writeDashboardPrefs({
      hiddenWidgets: ['catalogTiles', 'actionsAndLogs'],
      defaultRange: '90d',
      defaultChartType: 'donut',
      animationsEnabled: false,
    });
    assert.deepEqual(saved.hiddenWidgets, ['catalogTiles', 'actionsAndLogs']);
    assert.equal(saved.defaultRange, '90d');
    assert.equal(saved.defaultChartType, 'donut');
    assert.equal(saved.animationsEnabled, false);

    const reloaded = await engine.readDashboardPrefs();
    assert.deepEqual(reloaded, saved);
  } finally {
    if (prev === undefined) delete process.env.ANALYTICS_PREFS_FILE;
    else process.env.ANALYTICS_PREFS_FILE = prev;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\n✅ ${passed}/${passed} vérifications analytiques & export réussies.`);
