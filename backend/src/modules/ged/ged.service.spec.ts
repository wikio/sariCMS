import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { GedService } from './ged.service';

/**
 * Un PNG minimal, en base64 : 1×1 pixel transparent. Inutile de simulater un encodeur
 * — ce qui est testé ici est le nommage, la version, la fiche et l'état, pas le contenu.
 */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/1QAAAAANSUVORK5CYII=';

function makeService() {
  const root = mkdtempSync(path.join(tmpdir(), 'ged-'));
  // La racine des gabarits suit celle des médias (`<tmp>/canvas`) : `listTemplates`
  // doit taper le même arbre que les routes Next, jamais celui du dépôt de test.
  const config = { get: (key: string) => (key === 'GED_UPLOAD_DIR' ? root : key === 'GED_CANVAS_DIR' ? path.join(root, 'canvas') : undefined) } as never;
  return { root, service: new GedService(config) };
}

describe('GedService — export de l’atelier', () => {
  let tmp: { root: string; service: GedService } | null = null;

  afterEach(() => {
    if (tmp) rmSync(tmp.root, { recursive: true, force: true });
    tmp = null;
  });

  it('range une planche sous CANVA_ dans le dossier canvas', async () => {
    tmp = makeService();
    const { asset, url } = await tmp.service.exportCanvas({
      kind: 'canvas',
      name: 'affiche du printems',
      title: 'Affiche du printemps',
      width: 1080,
      height: 1080,
      png: PNG,
    } as never);

    expect(asset.module).toBe('canvas');
    expect(asset.prefix).toBe('CANVA_');
    expect(asset.file).toMatch(/^canvas\/CANVA_[a-z0-9]+_affiche-du-printems\.png$/);
    expect(url).toBe(`/uploads/${asset.file}`);
    expect(existsSync(path.join(tmp.root, asset.file))).toBe(true);
    expect(existsSync(path.join(tmp.root, `${asset.file}.sari.json`))).toBe(true);
  });

  it('une retouche part sous IMG_ dans le module des médias, et l’atelier garde CANVA_ à part', async () => {
    tmp = makeService();
    const image = await tmp.service.exportCanvas({ kind: 'image', name: 'recadrage', width: 800, height: 600, png: PNG } as never);
    const plan = await tmp.service.exportCanvas({ kind: 'canvas', name: 'recadrage', width: 800, height: 600, png: PNG } as never);

    // `ged` est le dossier que la table de l'interface attache à `image` — le miroir
    // backend ne peut pas en choisir un autre, sinon les deux écrans listeraient deux choses différentes.
    expect(image.asset.file.startsWith('ged/IMG_')).toBe(true);
    expect(plan.asset.file.startsWith('canvas/CANVA_')).toBe(true);
    expect(image.asset.file).not.toBe(plan.asset.file);
  });

  it('un type ajouté à la table devient son propre dossier et son propre préfixe', async () => {
    tmp = makeService();
    const { asset } = await tmp.service.exportCanvas({ kind: 'maquette', name: 'vitrine', width: 400, height: 300, png: PNG } as never);

    // Aucune clé `maquette` dans la table : la règle d'extension prend le relais, sans
    // modification de schéma ni migration.
    expect(asset.module).toBe('maquette');
    expect(asset.file).toMatch(/^maquette\/MAQUETTE_[a-z0-9]+_vitrine\.png$/);
  });

  it('réécrire la même planche archive la version précédente et garde l’URL', async () => {
    tmp = makeService();
    const first = await tmp.service.exportCanvas({ kind: 'canvas', name: 'banniere', width: 1600, height: 640, png: PNG } as never);
    const second = await tmp.service.exportCanvas({ kind: 'canvas', file: first.asset.file, name: 'banniere', width: 1600, height: 640, png: PNG } as never);

    expect(second.asset.url).toBe(first.asset.url);
    expect(second.version).toBe(2);
    expect(second.asset.history[0].file).toBe(`${first.asset.module}/${first.asset.name.replace(/\.png$/, '-v2.png')}`);
    expect(existsSync(path.join(tmp.root, second.asset.history[0].file))).toBe(true);
  });

  it('écrit l’état éditable dans la fiche, et à côté quand il est lourd', async () => {
    tmp = makeService();
    const light = await tmp.service.exportCanvas({ kind: 'canvas', name: 'leger', width: 100, height: 100, png: PNG, state: { version: '6.9.1', objects: [] } } as never);
    const manifest = JSON.parse(readFileSync(path.join(tmp.root, `${light.asset.file}.sari.json`), 'utf8'));
    expect(manifest.editable.inline.version).toBe('6.9.1');
    expect(light.asset.stateFile).toBeNull();

    const heavy = await tmp.service.exportCanvas({
      kind: 'canvas',
      name: 'lourd',
      width: 100,
      height: 100,
      png: PNG,
      state: { version: '6.9.1', objects: [{ type: 'rect', fill: 'x'.repeat(300_000) }] },
    } as never);
    expect(heavy.asset.stateFile).toMatch(/\.sari\.canvas\.json$/);
    expect(existsSync(path.join(tmp.root, heavy.asset.stateFile as string))).toBe(true);
    const replayed = (await tmp.service.readState(heavy.asset.file)) as { objects?: unknown[] } | null;
    expect(replayed?.objects).toHaveLength(1);
  });

  it('refuse une écriture hors du dépôt de fichiers', async () => {
    tmp = makeService();
    const first = await tmp.service.exportCanvas({ kind: 'canvas', name: 'cible', width: 100, height: 100, png: PNG } as never);
    await expect(tmp.service.exportCanvas({ kind: 'canvas', file: '../../etc/passwd', width: 100, height: 100, png: PNG } as never)).rejects.toThrow(/hors de la GED/);
    expect(existsSync(path.join(tmp.root, first.asset.file))).toBe(true);
  });

  it('liste les visuels sans jamais exposer les fichiers d’à-côté', async () => {
    tmp = makeService();
    mkdirSync(path.join(tmp.root, 'media'), { recursive: true });
    writeFileSync(path.join(tmp.root, 'media', 'IMG_00000000_pose-a-la-main.png'), Buffer.from('x'));
    const written = await tmp.service.exportCanvas({ kind: 'canvas', name: 'planche', width: 200, height: 120, png: PNG, tags: ['campagne'] } as never);

    const all = await tmp.service.list({});
    expect(all.total).toBe(2);
    expect(all.items.map((item) => item.file).sort()).toEqual([written.asset.file, 'media/IMG_00000000_pose-a-la-main.png'].sort());
    expect(all.items.every((item) => !item.name.endsWith('.json'))).toBe(true);
    expect(all.tags).toContain('campagne');

    const only = await tmp.service.list({ kind: 'canvas' });
    expect(only.items.map((item) => item.file)).toEqual([written.asset.file]);
  });

  it('retrouve une planche par son nom, son étiquette ou sa légende', async () => {
    tmp = makeService();
    await tmp.service.exportCanvas({ kind: 'canvas', name: 'offre-echo', title: 'Offre échographie', tags: ['vedette'], width: 300, height: 200, png: PNG } as never);

    expect((await tmp.service.list({ search: 'ÉCHO' })).total).toBe(1);
    expect((await tmp.service.list({ search: 'introuvable' })).total).toBe(0);
    expect((await tmp.service.list({ tag: 'vedette' })).total).toBe(1);
    expect((await tmp.service.list({ prefix: 'CANVA_' })).total).toBe(1);
    expect((await tmp.service.list({ prefix: 'DOC_' })).total).toBe(0);
  });
});

describe('GedService — lire, corriger et renommer une fiche', () => {
  let tmp: { root: string; service: GedService } | null = null;

  afterEach(() => {
    if (tmp) rmSync(tmp.root, { recursive: true, force: true });
    tmp = null;
  });

  it('un fichier posé à la racine garde l’URL de la racine', async () => {
    tmp = makeService();
    writeFileSync(path.join(tmp.root, '1787106474890-e4bafdda.jpg'), Buffer.from('x'));
    writeFileSync(path.join(tmp.root, '.gitkeep'), Buffer.from(''));

    const listed = await tmp.service.list({});
    expect(listed.items.map((item) => item.file)).toEqual(['1787106474890-e4bafdda.jpg']);
    expect(listed.items[0].url).toBe('/uploads/1787106474890-e4bafdda.jpg');
    // Une URL reconstruite depuis un module deviné pointerait un fichier absent :
    // c'est exactement ce qui faisait dire à la retouche « image non chargeable ».
    expect(listed.items[0].url).not.toContain('/ged/');
  });

  it('la fiche se corrige, et l’URL suit le renommage', async () => {
    tmp = makeService();
    const written = await tmp.service.exportCanvas({ kind: 'canvas', name: 'carte', width: 1063, height: 638, png: PNG } as never);
    const file = written.asset.file;

    const patched = await tmp.service.patchAsset({ file, title: 'Carte de visite', alt: 'Recto', tags: ['client'] } as never);
    expect(patched.asset.title).toBe('Carte de visite');
    expect(patched.asset.alt).toBe('Recto');
    expect(patched.asset.url).toBe(written.asset.url);

    const renamed = await tmp.service.renameAsset({ file, newName: 'CANVA_000000_carte-recto.png' } as never);
    expect(renamed.file).toBe(`${file.split('/')[0]}/CANVA_000000_carte-recto.png`);
    expect(renamed.url).toBe(`/uploads/${renamed.file}`);
    expect(existsSync(path.join(tmp.root, renamed.file))).toBe(true);
    expect(existsSync(path.join(tmp.root, `${renamed.file}.sari.json`))).toBe(true);
    expect(existsSync(path.join(tmp.root, `${file}.sari.json`))).toBe(false);
    expect((await tmp.service.readAsset(renamed.file)).found).toBe(true);
  });

  it('un asset sans fiche répond « pas d’état », et non une erreur', async () => {
    tmp = makeService();
    mkdirSync(path.join(tmp.root, 'media'), { recursive: true });
    writeFileSync(path.join(tmp.root, 'media', 'photo.png'), Buffer.from('x'));

    // L'atelier enchaîne `readGedAssetState` et `readGedAsset` : une 404 ici
    // empêchait d'ouvrir une simple image de la médiathèque.
    await expect(tmp.service.readState('media/photo.png')).resolves.toBeNull();
    const { asset, state, found } = await tmp.service.readAsset('/uploads/media/photo.png');
    expect(found).toBe(false);
    expect(state).toBeNull();
    expect(asset.url).toBe('/uploads/media/photo.png');
    await expect(tmp.service.readState('media/introuvable.png')).rejects.toThrow(/absent/);
  });

  it('supprimer emporte la fiche, et les versions sur demande', async () => {
    tmp = makeService();
    const first = await tmp.service.exportCanvas({ kind: 'canvas', name: 'story', width: 1080, height: 1920, png: PNG } as never);
    await tmp.service.exportCanvas({ kind: 'canvas', file: first.asset.file, name: 'story', width: 1080, height: 1920, png: PNG } as never);
    const before = (await tmp.service.readAsset(first.asset.file)).manifest as { history?: unknown[] };
    expect((before.history || []).length).toBeGreaterThan(0);

    const removed = await tmp.service.deleteAsset(first.asset.file, true);
    expect(existsSync(path.join(tmp.root, first.asset.file))).toBe(false);
    expect(existsSync(path.join(tmp.root, `${first.asset.file}.sari.json`))).toBe(false);
    expect(removed.removed.length).toBeGreaterThanOrEqual(1);
  });

  it('écrit un asset encodé dans le module demandé, sous le préfixe du type', async () => {
    tmp = makeService();
    const saved = await tmp.service.saveAsset({ dataUrl: `data:image/png;base64,${PNG}`, kind: 'image', module: 'product', name: 'retouche', title: 'Retouchée', width: 800, height: 600 } as never);
    expect(saved.asset.module).toBe('product');
    expect(saved.file).toMatch(/^product\/IMG_[a-z0-9]+_retouche\.png$/);
    expect(saved.url).toBe(`/uploads/${saved.file}`);
    expect(existsSync(path.join(tmp.root, saved.file))).toBe(true);

    const listed = await tmp.service.list({ module: 'product' });
    expect(listed.items.map((item) => item.file)).toContain(saved.file);
  });

  it('le catalogue de gabarits se relit depuis le disque', async () => {
    tmp = makeService();
    const canvasRoot = path.join(tmp.root, 'canvas', 'templates');
    mkdirSync(canvasRoot, { recursive: true });
    writeFileSync(path.join(canvasRoot, 'index.json'), JSON.stringify({ version: 1, templates: [{ id: 'post-carre', title: 'Post carré', file: 'templates/post-carre.json', format: { width: 1080, height: 1080 } }] }), 'utf8');
    writeFileSync(path.join(canvasRoot, 'post-carre.json'), JSON.stringify({ version: '6.9.1', objects: [{ type: 'text' }] }), 'utf8');

    const catalog = await tmp.service.listTemplates();
    expect(catalog.templates).toHaveLength(1);
    const { meta, template } = await tmp.service.readTemplate('post-carre');
    expect(meta.title).toBe('Post carré');
    expect((template as { objects: unknown[] }).objects).toHaveLength(1);

    // Un fichier posé sans entrée à l'index n'est pas proposé : l'index fait foi.
    writeFileSync(path.join(canvasRoot, 'sans-fiche.json'), '{}', 'utf8');
    expect((await tmp.service.listTemplates()).templates).toHaveLength(1);
    await expect(tmp.service.readTemplate('sans-fiche')).rejects.toThrow(/Gabarit inconnu/);

    const published = await tmp.service.saveTemplate({ id: 'ma-planche', template: { objects: [] }, meta: { title: 'Ma planche' } } as never);
    expect(published.file).toBe('templates/ma-planche.json');
    expect((await tmp.service.listTemplates()).templates).toHaveLength(2);
    expect((await tmp.service.deleteTemplate('ma-planche')).removed).toBe('templates/ma-planche.json');
    expect((await tmp.service.listTemplates()).templates).toHaveLength(1);
  });

  it('un état éditable peut être relu puis rattaché sans nouveau rendu', async () => {
    tmp = makeService();
    const written = await tmp.service.exportCanvas({ kind: 'canvas', name: 'brouillon', width: 400, height: 300, png: PNG } as never);
    await tmp.service.writeState({ file: written.file, state: { version: '6.9.1', objects: [{ type: 'i-text' }] } } as never);
    const state = (await tmp.service.readState(written.file)) as { objects?: unknown[] } | null;
    expect(state?.objects).toHaveLength(1);
    const { asset } = await tmp.service.readAsset(written.file);
    expect(asset.editable).toBe(true);
    expect(asset.editableFormat).toBe('fabric');
  });
});
