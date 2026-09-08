import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { GedController } from './ged.controller';
import { GedService } from './ged.service';

/**
 * La passerelle HTTP de la GED, jouée sans serveur.
 *
 * `lib/ged/client.ts` (le front) appelle onze routes ; le service, lui, en sait faire
 * bien plus. Ce fichier vérifie que CHAQUE appel du client tombe sur une méthode du
 * contrôleur avec les bons arguments — c'est exactement là que la panne se glissait :
 * le backend répondait au `health`, donc le front passait par lui, et les routes
 * absentes cassaient l'atelier et la médiathèque (404) alors que les fichiers, eux,
 * étaient là. Le repli sur les routes Next (`request()` dans `client.ts`) rend
 * désormais l'absence tolérable ; ce test, lui, rend l'absence visible.
 */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/1QAAAAANSUVORK5CYII=';

function makeController() {
  const root = mkdtempSync(path.join(tmpdir(), 'ged-ctl-'));
  const config = { get: (key: string) => (key === 'GED_UPLOAD_DIR' ? root : key === 'GED_CANVAS_DIR' ? path.join(root, 'canvas') : undefined) } as never;
  const service = new GedService(config);
  return { root, controller: new GedController(service) };
}

describe('GedController — la surface attendue par le front', () => {
  let tmp: { root: string; controller: GedController } | null = null;

  afterEach(() => {
    if (tmp) rmSync(tmp.root, { recursive: true, force: true });
    tmp = null;
  });

  it('répond à chaque route appelée par lib/ged/client.ts', async () => {
    tmp = makeController();
    const c = tmp.controller;

    const exported = await c.export({ kind: 'canvas', name: 'planche', width: 1080, height: 1080, png: PNG, state: { version: '6.9.1', objects: [{ type: 'textbox', left: 0, top: 0, text: 'Titre' }] } } as never);
    expect(exported.asset.file).toMatch(/^canvas\/CANVA_[a-z0-9]+_planche\.png$/);
    // `file` est lu par l'atelier pour sa prochaine réédition : absent, il écrirait un
    // asset neuf à côté de l'ancien et laisserait les pages sur la version d'avant.
    expect(exported.file).toBe(exported.asset.file);

    const list = await c.list({});
    expect(list.items.map((item) => item.file)).toContain(exported.asset.file);

    const detail = await c.asset(exported.asset.file);
    expect(detail.found).toBe(true);
    expect(detail.asset.url).toBe(exported.url);
    expect(detail.state).toBeTruthy();

    const state = await c.state(exported.asset.file);
    expect(state.file).toBe(exported.asset.file);
    expect((state.state as { objects?: unknown[] }).objects).toBeTruthy();

    const patched = await c.patch({ file: exported.asset.file, title: 'Relue', alt: 'Test', tags: ['ged'] } as never);
    expect(patched.asset.title).toBe('Relue');

    const written = await c.writeState({ file: exported.asset.file, state: { version: '6.9.1', objects: [{ type: 'rect', left: 0, top: 0, width: 10, height: 10 }] } } as never);
    expect(written.file).toBe(exported.asset.file);

    const saved = await c.save({ dataUrl: `data:image/png;base64,${PNG}`, kind: 'image', name: 'retouche', width: 100, height: 100 } as never);
    expect(saved.asset.prefix).toBe('IMG_');
    expect(existsSync(path.join(tmp.root, saved.file))).toBe(true);

    const renamed = await c.rename({ file: saved.file, newName: 'IMG_000000_renommee.png' } as never);
    expect(renamed.url).toBe(`/uploads/${renamed.file}`);
    expect(existsSync(path.join(tmp.root, renamed.file))).toBe(true);

    const removed = await c.remove({ file: renamed.file, history: undefined });
    expect(removed.removed).toContain(renamed.file);
  });

  it('sert le catalogue de gabarits, sinon le front retombe sur Next', async () => {
    tmp = makeController();
    const canvasRoot = path.join(tmp.root, 'canvas', 'templates');
    mkdirSync(canvasRoot, { recursive: true });
    writeFileSync(path.join(canvasRoot, 'index.json'), JSON.stringify({ version: 1, templates: [{ id: 'post-carre', title: 'Post carré', file: 'templates/post-carre.json', format: { width: 1080, height: 1080 } }] }), 'utf8');
    writeFileSync(path.join(canvasRoot, 'post-carre.json'), JSON.stringify({ version: '6.9.1', sariStudio: { width: 1080, height: 1080 }, objects: [{ type: 'textbox', left: 0, top: 0, text: 'Titre' }] }), 'utf8');

    expect((await tmp.controller.templates()).templates).toHaveLength(1);
    const { meta, template } = await tmp.controller.template('post-carre');
    expect(meta.title).toBe('Post carré');
    expect((template as { objects: unknown[] }).objects).toHaveLength(1);

    const published = await tmp.controller.saveTemplate({ id: 'ma-planche', template: { objects: [] }, meta: { title: 'Ma planche' } } as never);
    expect(published.file).toBe('templates/ma-planche.json');
    expect(existsSync(path.join(canvasRoot, 'ma-planche.json'))).toBe(true);
    expect((await tmp.controller.templates()).templates).toHaveLength(2);

    expect((await tmp.controller.removeTemplate('ma-planche')).removed).toBe('templates/ma-planche.json');
    expect(existsSync(path.join(canvasRoot, 'ma-planche.json'))).toBe(false);
    const index = JSON.parse(readFileSync(path.join(canvasRoot, 'index.json'), 'utf8')) as { templates: unknown[] };
    expect(index.templates).toHaveLength(1);
  });
});
