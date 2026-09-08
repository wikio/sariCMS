#!/usr/bin/env node
/**
 * scripts/test-ged.mjs — la GED des contenus générés, jouée à plat.
 *
 * Ce que ces assertions protègent, en une phrase : un visuel produit par l'atelier
 * graphique doit se ranger tout seul, se retrouver, se ré-éditer sans casser les pages
 * qui l'affichent, et se supprimer sans laisser de débris.
 *
 * La première moitié teste la règle de nommage (les préfixes par type de contenu), la
 * seconde le magasin de fichiers sur un répertoire temporaire — sans Next, sans Nest,
 * sans base : `lib/ged/*.mjs` n'importe que `node:fs` et `node:path`, donc la règle est
 * vérifiée là même où elle est écrite, et non dans une copie libre d'en dériver.
 *
 *   node scripts/test-ged.mjs
 *
 * Le backend (`backend/src/modules/ged/`) rejoue les mêmes cas sur sa propre copie de
 * la table : c'est la garantie que les deux moitiés de l'application écrivent au même
 * endroit. Les deux jeux doivent rester identiques.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const prefix = await import('../lib/ged/prefix.mjs');
const manifest = await import('../lib/ged/manifest.mjs');
const store = await import('../lib/ged/store.mjs');

let done = 0;
let failed = 0;
const check = (label, fn) => {
  try {
    fn();
    done += 1;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failed += 1;
    process.exitCode = 1;
    console.log(`  ❌ ${label}\n     ${String(err.message).split('\n')[0]}`);
  }
};
const acheck = async (label, fn) => {
  try {
    await fn();
    done += 1;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failed += 1;
    process.exitCode = 1;
    console.log(`  ❌ ${label}\n     ${String(err.message).split('\n')[0]}`);
  }
};

console.log('\nUn préfixe par type de contenu');
check('la table déclare CANVA_ et IMG_', () => {
  assert.equal(prefix.PREFIX_TABLE.canvas.prefix, 'CANVA_');
  assert.equal(prefix.PREFIX_TABLE.image.prefix, 'IMG_');
  assert.equal(prefix.PREFIX_TABLE.canvas.module, 'canvas');
});
check('un type ajouté trouve son préfixe et son module', () => {
  const built = prefix.buildAssetName('logo', { name: 'Logo clinique', extension: 'svg', stamp: 'abc123' }, { logo: { prefix: 'LOGO_', module: 'brand' } });
  assert.equal(built.file, 'LOGO_abc123_logo-clinique.svg');
  assert.equal(built.module, 'brand');
});
check('sans préfixe connu, on retombe sur le module en capitales', () => {
  const built = prefix.buildAssetName('brochure', { name: 'Brochure été', stamp: 'zz9999', extension: 'pdf' });
  assert.equal(built.prefix, 'BROCHURE_');
  assert.equal(built.file, 'BROCHURE_zz9999_brochure-ete.pdf');
  assert.equal(built.module, 'brochure', 'sans module déclaré, le type devient le dossier');
});
check('un préfixe refusé est signalé, pas ignoré', () => {
  const problems = prefix.validateOverrides({ logo: { prefix: 'mauvais', module: 'A B' } });
  assert.equal(problems.length, 2, JSON.stringify(problems));
  assert.equal(prefix.validateOverrides({ logo: { prefix: 'LOGO_', module: 'brand' } }).length, 0);
});

console.log('\nLe nom d’un fichier se relit dans les trois écritures');
check('généré', () => {
  const parsed = prefix.parseAssetName('canvas/CANVA_lz5k1x9_post-campagne.png');
  assert.deepEqual(
    { module: parsed.module, kind: parsed.kind, prefix: parsed.prefix, stamp: parsed.stamp, label: parsed.label, version: parsed.version },
    { module: 'canvas', kind: 'canvas', prefix: 'CANVA_', stamp: 'lz5k1x9', label: 'post-campagne', version: 1 },
  );
});
check('historique (module_id_slug)', () => {
  const parsed = prefix.parseAssetName('product/1_echographe-check-up.png');
  assert.equal(parsed.module, 'product');
  // Le format historique ne porte pas de préfixe : le type vient de l'extension.
  assert.equal(parsed.prefix, '');
  assert.equal(parsed.kind, 'image');
});
check('posé à la main', () => {
  const parsed = prefix.parseAssetName('ged/photo.png');
  assert.equal(parsed.kind, 'image');
  assert.equal(parsed.title, 'Photo');
});
check('une version est lisible dans le nom', () => {
  assert.equal(prefix.parseAssetName('canvas/CANVA_a12345_post-v3.png').version, 3);
});
check('l’URL publique reste celle du module', () => {
  assert.equal(prefix.assetUrl('canvas', 'CANVA_a_b.png'), '/uploads/canvas/CANVA_a_b.png');
  assert.equal(prefix.assetUrl('canvas', 'canvas/CANVA_a_b.png'), '/uploads/canvas/CANVA_a_b.png');
});

console.log('\nLe manifeste tolère, fusionne et se relit');
check('un patch ne jette ni le passé ni l’inconnu', () => {
  const base = manifest.createManifest('canvas/CANVA_a1_post.png', { title: 'Post', alt: 'Avant', width: 1080, height: 1080 });
  const merged = manifest.mergeManifest(base, { alt: 'Après', tags: ['Campagne', 'été', 'été'], legendeChoix: 'droite' });
  assert.equal(merged.title, 'Post', 'une clé absente du patch est conservée');
  assert.equal(merged.alt, 'Après');
  assert.deepEqual(merged.tags, ['campagne', 'été']);
  assert.equal(merged.extra.legendeChoix, 'droite', 'une clé inconnue est gardée, pas perdue');
  assert.equal(merged.createdAt, base.createdAt);
});
check('un état éditable trop lourd part dans son fichier', () => {
  const units = Math.ceil(manifest.MAX_INLINE_STATE_BYTES / 60) + 20;
  const heavy = { ...manifest.createManifest('canvas/CANVA_a1_post.png'), editable: { format: 'fabric', inline: { objects: new Array(units).fill({ type: 'itext', text: 'x'.repeat(40) }) }, file: null, size: 0 } };
  const split = manifest.splitForWrite(heavy);
  assert.match(split.stateFile, /\.sari\.canvas\.json$/);
  assert.equal(split.manifest.editable.inline, null);
  const back = manifest.attachState(split.manifest, split.stateBody);
  assert.equal(back.editable.inline.objects.length, units);
});
check('un état léger reste inline', () => {
  const light = { ...manifest.createManifest('canvas/CANVA_a1_post.png'), editable: { format: 'fabric', inline: { objects: [] }, file: null, size: 0 } };
  const split = manifest.splitForWrite(light);
  assert.equal(split.stateFile, null);
  assert.deepEqual(split.manifest.editable.inline, { objects: [] });
});
check('l’historique est borné et sans doublon du courant', () => {
  const entries = Array.from({ length: 40 }, (_, i) => ({ file: `canvas/CANVA_a1_post-v${i + 2}.png` }));
  const clamped = manifest.clampHistory(entries, 'canvas/CANVA_a1_post.png');
  assert.equal(clamped.length, manifest.MAX_HISTORY);
  assert.equal(clamped.at(-1).file, 'canvas/CANVA_a1_post-v41.png');
  assert.equal(manifest.clampHistory([{ file: 'canvas/CANVA_a1_post.png' }], 'canvas/CANVA_a1_post.png').length, 0);
});
check('les fichiers annexes ne sont jamais des assets', () => {
  assert.equal(prefix.isManifestFile('x.sari.json'), true);
  assert.equal(prefix.isManifestFile('x.png'), false);
  assert.equal(manifest.isStateFile('x.sari.canvas.json'), true);
  assert.equal(manifest.isStateFile('x.json'), false);
});

/* ------------------------------------------------------------------ le magasin */

const root = await mkdtemp(path.join(tmpdir(), 'sari-ged-'));
const uploadRoot = path.join(root, 'uploads');
const templateRoot = path.join(root, 'canvas');
const ged = store.createGedStore({ uploadRoot, templateRoot });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUg==', 'base64');

console.log('\nCréer → éditer → sauvegarder → réinsérer (sur disque)');

await acheck('un export d’atelier est rangé sous son préfixe et son module', async () => {
  const asset = await ged.saveAsset({
    kind: 'canvas',
    name: 'Post campagne',
    extension: 'png',
    buffer: png,
    manifest: { title: 'Post campagne', alt: 'Visuel carré', width: 1080, height: 1080, source: { origin: 'atelier' } },
  });
  assert.equal(asset.module, 'canvas');
  assert.match(asset.file, /^canvas\/CANVA_[0-9a-z]+_post-campagne\.png$/);
  assert.equal(asset.url, `/uploads/${asset.file}`);
  assert.equal(asset.kind, 'canvas');
  assert.equal(asset.prefix, 'CANVA_');
  assert.equal(asset.width, 1080);
  const listed = await readdir(uploadRoot);
  assert.ok(listed.includes('canvas'), JSON.stringify(listed));
  const files = await readdir(path.join(uploadRoot, 'canvas'));
  assert.ok(files.some((f) => f.endsWith('.sari.json')), 'le manifeste est écrit à côté');
  assert.ok(files.some((f) => f.endsWith('.png')), 'le visuel est écrit à côté de sa fiche');
});

let editedRef = null;
await acheck('le PNG, le SVG et l’état éditable se relisent ensemble', async () => {
  const first = await ged.saveAsset({ kind: 'canvas', name: 'Story été', extension: 'png', buffer: png, manifest: { width: 1080, height: 1920 } });
  editedRef = first.file;
  const state = { version: '6.9.1', objects: [{ type: 'rect', left: 10, top: 10, fill: { type: 'radial', colorStops: [{ offset: 0, color: '#fff' }] } }], background: '#101820' };
  await ged.writeEditableState(first.file, state, 'fabric');
  const reread = await ged.readEditableState(first.file);
  assert.deepEqual(reread, state, 'le JSON rejouable revient à l’identique');
  const file = await ged.readAssetFile(first.file);
  assert.equal(file.buffer.length, png.length);
  assert.equal(file.mime, 'image/png');
  const manifestRead = await ged.readAssetManifest(first.file);
  assert.equal(manifestRead.editable.format, 'fabric');
  assert.equal(manifestRead.width, 1080);
});

await acheck('ré-éditer garde le nom et archive la version précédente', async () => {
  const before = await ged.readAssetManifest(editedRef);
  const state = before.editable.inline;
  const again = await ged.saveAsset({
    file: editedRef,
    overwrite: editedRef,
    kind: 'canvas',
    extension: 'png',
    buffer: Buffer.concat([png, png]),
    manifest: { title: 'Story été (retouchée)', width: 1080, height: 1920 },
  });
  assert.equal(again.file, editedRef, 'le lien posé dans les pages continue de pointer le visuel actif');
  assert.equal(again.version, 2, `version attendue 2, reçue ${again.version}`);
  assert.equal(path.basename(again.history[0].file), `${path.basename(editedRef, '.png')}-v2.png`);
  const archived = await ged.readAssetFile(again.history[0].file);
  assert.equal(archived.buffer.length, png.length, 'l’archive garde l’ancien contenu');
  const stillPlayable = await ged.readEditableState(editedRef);
  assert.deepEqual(stillPlayable, state, 'réenregistrer un rendu sans nouvel état ne perd pas le JSON éditable');
});

await acheck('un nom déjà pris est décalé, jamais écrasé', async () => {
  const a = await ged.saveAsset({ kind: 'image', file: 'ged/IMG_aaaaaa_meme-nom.png', buffer: png });
  const b = await ged.saveAsset({ kind: 'image', file: 'ged/IMG_aaaaaa_meme-nom.png', buffer: png });
  assert.notEqual(a.file, b.file);
  assert.match(b.file, /-aaaaaa\.png$/);
});

await acheck('la liste ignore les fichiers annexes et sait chercher', async () => {
  const all = await ged.listAssets({ limit: 100 });
  assert.ok(all.total >= 4, `total=${all.total}`);
  assert.ok(!all.items.some((asset) => asset.file.endsWith('.json')), 'aucun manifeste dans la liste');
  const bySearch = await ged.listAssets({ search: 'story été', limit: 100 });
  assert.ok(bySearch.items.some((asset) => asset.file === editedRef), JSON.stringify(bySearch.items.map((i) => i.file)));
  const byKind = await ged.listAssets({ kind: 'canvas', limit: 100 });
  assert.ok(byKind.items.length >= 2);
  assert.ok(byKind.items.every((asset) => asset.kind === 'canvas'));
  const byPrefix = await ged.listAssets({ prefix: 'IMG_', limit: 100 });
  assert.ok(byPrefix.items.length >= 2 && byPrefix.items.every((asset) => asset.prefix === 'IMG_'));
  assert.ok(all.items.every((asset) => asset.size > 0), 'la taille vient du disque');
});

await acheck('la pagination est stable et bornée', async () => {
  const page1 = await ged.listAssets({ limit: 2, page: 1 });
  const page2 = await ged.listAssets({ limit: 2, page: 2 });
  assert.equal(page1.items.length, 2);
  assert.ok(page1.total >= 4);
  assert.notDeepEqual(page1.items.map((i) => i.file), page2.items.map((i) => i.file));
  const huge = await ged.listAssets({ limit: 100000 });
  assert.equal(huge.limit, 200);
});

await acheck('les métadonnées se corrigeent sans toucher au fichier', async () => {
  const patched = await ged.patchAsset({ file: editedRef, alt: 'Story verticale pour l’été', tags: ['campagne', 'été'] });
  assert.equal(patched.alt, 'Story verticale pour l’été');
  assert.deepEqual(patched.tags, ['campagne', 'été']);
  const manifestAfter = await ged.readAssetManifest(editedRef);
  assert.equal(manifestAfter.title, 'Story été (retouchée)', 'le patch partiel ne doit rien effacer');
  const untouched = await ged.readAssetFile(editedRef);
  assert.ok(untouched.buffer.length > png.length);
});

await acheck('renommer déplace le manifeste et l’état éditable', async () => {
  const state = { version: '6.9.1', objects: [{ type: 'itext', text: 'Bonjour' }] };
  await ged.writeEditableState(editedRef, state, 'fabric');
  const renamed = await ged.renameAsset(editedRef, 'story-ete-2026.png');
  assert.equal(renamed.file, 'canvas/story-ete-2026.png');
  assert.deepEqual(await ged.readEditableState(renamed.file), state);
  assert.equal((await ged.readAssetManifest(renamed.file)).title, 'Story été (retouchée)');
  const leftovers = await readdir(path.join(uploadRoot, 'canvas'));
  assert.ok(!leftovers.some((f) => f.includes('story-ete.png.sari.json') && !f.startsWith('story-ete-2026')), JSON.stringify(leftovers));
  editedRef = renamed.file;
});

await acheck('un chemin de sortie est refusé', async () => {
  for (const bad of ['../../etc/passwd', '/etc/passwd', 'canvas/../../../package.json']) {
    await assert.rejects(() => ged.readAssetFile(bad), /CHEMIN_REFUSÉ|INTROUVABLE/, bad);
  }
  await assert.rejects(() => ged.saveAsset({ kind: 'canvas', file: '../escape.png', buffer: png }), /CHEMIN_REFUSÉ|EXTENSION/);
  await assert.rejects(() => ged.saveAsset({ kind: 'canvas', name: 'x', extension: 'png', buffer: Buffer.alloc(0) }), /VIDE/);
  await assert.rejects(() => ged.saveAsset({ kind: 'canvas', name: 'x', extension: 'exe', buffer: png }), /Extension refusée/);
});

await acheck('supprimer nettoie la fiche et, à la demande, les versions', async () => {
  const files = await ged.saveAsset({ kind: 'canvas', name: 'Bannière', extension: 'png', buffer: png });
  await ged.writeEditableState(files.file, { objects: [] }, 'fabric');
  await ged.saveAsset({ file: files.file, overwrite: files.file, kind: 'canvas', extension: 'png', buffer: png });
  const folder = path.join(uploadRoot, 'canvas');
  const simple = await ged.deleteAsset(files.file);
  assert.ok(simple.removed.includes(files.file));
  let listed = await readdir(folder);
  assert.ok(!listed.some((f) => f === 'CANVA_x.png.sari.json'), 'la fiche suit le fichier');
  assert.ok(listed.some((f) => f.includes('-v2.png')), 'la version archivée survit à une suppression simple');
  // Deuxième aller-retour, cette fois avec la purge : les archives partent aussi.
  const second = await ged.saveAsset({ kind: 'canvas', name: 'Purge', extension: 'png', buffer: png });
  await ged.saveAsset({ file: second.file, overwrite: second.file, kind: 'canvas', extension: 'png', buffer: png });
  const withHistory = await ged.readAssetManifest(second.file);
  const archived = withHistory.history[0].file;
  await ged.deleteAsset(second.file, { purgeHistory: true });
  listed = await readdir(folder);
  assert.ok(!listed.includes(path.basename(archived)), 'purgeHistory emporte les versions');
  assert.ok(!listed.some((f) => f.includes('purge')), 'et la fiche avec');
});

await acheck('un fichier posé à la main reste un asset exploitable', async () => {
  await writeFile(path.join(uploadRoot, 'ged', 'photo-salon.png'), png);
  const listed = await ged.listAssets({ module: 'ged', search: 'photo-salon', limit: 50 });
  assert.equal(listed.items.length, 1, JSON.stringify(listed.items));
  const asset = listed.items[0];
  assert.equal(asset.kind, 'image');
  assert.equal(asset.title, 'photo-salon'.replace('-', ' ').replace(/^./, (c) => c.toUpperCase()));
  assert.equal(asset.editable, false, 'sans fiche, rien à rejouer');
  assert.equal(asset.version, 1);
});

await acheck('un fichier posé à la RACINE garde l’URL de la racine', async () => {
  // Le cas qui cassait la retouche et l'atelier : un média sans dossier de module
  // (import ancien, fichier déposé à la main, `1787…-e4bafdda.jpg` d'un export) ne
  // vit dans aucun dossier — lui coller `ged/` dans son URL suffisait à répondre
  // « image non chargeable » côté écran.
  await writeFile(path.join(uploadRoot, 'visuel-racine.png'), png);
  const listed = await ged.listAssets({ search: 'visuel-racine', limit: 50 });
  assert.equal(listed.items.length, 1, JSON.stringify(listed.items.map((i) => i.file)));
  const root = listed.items[0];
  assert.equal(root.file, 'visuel-racine.png');
  assert.equal(root.url, '/uploads/visuel-racine.png', `URL reconstruite : ${root.url}`);
  const read = await ged.readAssetFile(root.file);
  assert.equal(read.buffer.length, png.length, 'le fichier lu est bien celui pointé par l’URL');
});

await acheck('ré-éditer un fichier de la racine ne le déménage pas', async () => {
  const saved = await ged.saveAsset({ kind: 'image', file: 'IMG_aaaaaa_racine.png', buffer: png, manifest: { title: 'Racine' } });
  assert.equal(saved.file, 'IMG_aaaaaa_racine.png', 'un `file` explicite sans dossier désigne la racine, et n’est pas déménagé');
  assert.equal(saved.url, '/uploads/IMG_aaaaaa_racine.png');
  const placed = await ged.saveAsset({ kind: 'image', module: 'product', name: 'Vue atelier', buffer: png });
  assert.equal(placed.module, 'product', 'le module demandé fait foi, pas celui de la table des préfixes');
  assert.match(placed.file, /^product\/IMG_[0-9a-z]+_vue-atelier\.png$/, placed.file);
  assert.ok(placed.url === `/uploads/${placed.file}`, `${placed.url} ≠ /uploads/${placed.file}`);
  const listed = await ged.listAssets({ module: 'product', limit: 50 });
  assert.ok(listed.items.some((asset) => asset.file === placed.file), 'rangé sous `product/`, donc retrouvé en filtrant `product`');
  // Un fichier posé à la main, hors de tout module — le cas des imports anciens.
  await writeFile(path.join(uploadRoot, 'racine-bump.png'), png);
  const loose = (await ged.listAssets({ search: 'racine-bump', limit: 10 })).items[0];
  assert.equal(loose.file, 'racine-bump.png');
  const again = await ged.saveAsset({ kind: 'image', file: loose.file, overwrite: loose.file, buffer: Buffer.concat([png, png]) });
  assert.equal(again.file, 'racine-bump.png', 'le nom actif ne change pas');
  assert.equal(again.url, '/uploads/racine-bump.png');
  const files = await readdir(uploadRoot);
  assert.ok(files.some((name) => name.startsWith('racine-bump-v')), `archive restée à la racine : ${files.filter((n) => n.startsWith('racine-bump'))}`);
  const renamed = await ged.renameAsset('racine-bump.png', 'renomme-racine.png');
  assert.equal(renamed.file, 'renomme-racine.png', 'un renommage ne déménage pas le fichier');
  assert.equal(renamed.url, '/uploads/renomme-racine.png');
});

await acheck('les fichiers de service ne sont pas des assets', async () => {
  await writeFile(path.join(uploadRoot, '.gitkeep'), Buffer.alloc(0));
  await writeFile(path.join(uploadRoot, 'notes.txt'), Buffer.from('bonjour'));
  const all = await ged.listAssets({ limit: 200 });
  assert.ok(!all.items.some((asset) => asset.file === '.gitkeep' || asset.file === 'notes.txt'), JSON.stringify(all.items.map((i) => i.file)));
});

/* ------------------------------------------------------------------- gabarits */

console.log('\nLe catalogue de gabarits');
await acheck('déposer un fichier et son entrée suffit', async () => {
  await mkdir(path.join(templateRoot, 'templates'), { recursive: true });
  await writeFile(path.join(templateRoot, 'templates', 'index.json'), JSON.stringify({ version: 1, templates: [{ id: 'post-carre', title: 'Post carré', file: 'templates/post-carre.json', category: 'social', format: { width: 1080, height: 1080, name: 'Carré 1080', orientation: 'carré' }, palette: ['#0f172a'], preview: null, version: 1, tags: ['réseaux'], updatedAt: '2026-01-01T00:00:00.000Z', slots: [] }] }), 'utf8');
  await writeFile(path.join(templateRoot, 'templates', 'post-carre.json'), JSON.stringify({ background: '#f7f5f2', objects: [] }), 'utf8');
  const catalog = await ged.listTemplates();
  assert.equal(catalog.templates.length, 1);
  const read = await ged.readTemplate('post-carre');
  assert.equal(read.meta.title, 'Post carré');
  assert.equal(read.template.background, '#f7f5f2');
});
await acheck('un fichier retiré à la main disparaît du sélecteur', async () => {
  await rm(path.join(templateRoot, 'templates', 'post-carre.json'));
  const catalog = await ged.listTemplates();
  assert.equal(catalog.templates.length, 0);
  await assert.rejects(() => ged.readTemplate('post-carre'), /Gabarit inconnu/);
});
await acheck('publier un gabarit écrit le fichier et l’index', async () => {
  const meta = await ged.saveTemplate({ id: 'story-ete', meta: { title: 'Story été', category: 'social', format: { width: 1080, height: 1920, name: 'Story', orientation: 'portrait' } }, template: { background: '#fff', objects: [{ type: 'itext' }] } });
  assert.equal(meta.version, 1);
  const onDisk = JSON.parse(await readFile(path.join(templateRoot, 'templates', 'story-ete.json'), 'utf8'));
  assert.equal(onDisk.id, 'story-ete');
  const index = JSON.parse(await readFile(path.join(templateRoot, 'templates', 'index.json'), 'utf8'));
  assert.ok(index.templates.filter((entry) => entry.id === 'story-ete').length === 1);
  assert.ok(index.templates.some((entry) => entry.id === 'post-carre'), 'un fichier absent reste déclaré tant qu’on ne l’a pas retiré');
  const again = await ged.saveTemplate({ id: 'story-ete', meta: { title: 'Story été v2' }, template: { background: '#000' } });
  assert.equal(again.version, 2);
  assert.equal((await ged.listTemplates()).templates.length, 1, 'mettre à jour ne duplique pas');
  await ged.deleteTemplate('story-ete');
  assert.equal((await ged.listTemplates()).templates.length, 0);
});
await acheck('un identifiant de gabarit refusé ne sort pas de la racine', async () => {
  await assert.rejects(() => ged.saveTemplate({ id: '../../evil', template: {} }), /GABARIT/);
  await assert.rejects(() => ged.saveTemplate({ id: 'A_VEC_DES_MAJUSCULES', template: {} }), /GABARIT/);
});
await acheck('la GED refuse une extension qui n’est pas un média', async () => {
  for (const bad of ['exe', 'html', 'js', 'sh', 'svg\u0000.svg']) {
    await assert.rejects(() => ged.saveAsset({ kind: 'canvas', name: 'x', extension: bad, buffer: png }), /EXTENSION|Extension refusée/);
  }
  assert.equal(prefix.isWritableExtension('svg'), true);
  assert.equal(prefix.isWritableExtension('png'), true);
});

await acheck('le catalogue livré est jouable tel quel', async () => {
  // Les cinq gabarits de `public/canvas/templates` sont du code committé : une entrée
  // d'index sans fichier, ou un JSON qui ne porte ni position ni type d'objet, se
  // voit ici et non dans l'atelier d'un utilisateur.
  const catalog = path.resolve('public/canvas/templates');
  const index = JSON.parse(await readFile(path.join(catalog, 'index.json'), 'utf8'));
  assert.ok(index.templates.length >= 5, `au moins cinq gabarits livrés, ${index.templates.length} trouvé(s)`);
  for (const entry of index.templates) {
    const body = JSON.parse(await readFile(path.join(catalog, path.basename(String(entry.file))), 'utf8'));
    assert.ok(Array.isArray(body.objects) && body.objects.length > 0, `${entry.id} : aucun objet`);
    assert.ok(body.sariStudio?.width > 0 && body.sariStudio?.height > 0, `${entry.id} : plan de travail absent`);
    assert.equal(body.sariStudio.width, entry.format.width, `${entry.id} : largeur du plan ≠ fiche`);
    assert.equal(body.sariStudio.height, entry.format.height, `${entry.id} : hauteur du plan ≠ fiche`);
    for (const object of body.objects) {
      assert.ok(typeof object.type === 'string', `${entry.id} : un objet sans type`);
      assert.ok(Number.isFinite(object.left) && Number.isFinite(object.top), `${entry.id} : un objet sans position`);
    }
    const slots = body.objects.filter((object) => object.slotId);
    assert.ok(slots.length > 0, `${entry.id} : aucune zone modifiable`);
    for (const object of slots) assert.ok(object.slotLabel, `${entry.id} : zone ${object.slotId} sans libellé`);
    const files = await readdir(catalog);
    assert.ok(files.includes(`${entry.id}.json`), `${entry.id} : déclaré à l’index, absent du disque`);
  }
});

/* ------------------------------------------------- l'atelier : ni vide, ni figé */

console.log('\nL\'atelier ouvre une planche même abîmée');

await acheck('un document dont une image est morte se rejoue sans ses visuels', async () => {
  // LA panne : `loadFromJSON` est « tout ou rien » — un seul `src` introuvable (fichier
  // nettoyé du disque, URL reconstruite de travers) faisait rejeter le document entier,
  // et l\'atelier ouvrait une fenêtre blanche sur un gabarit « vide ». Le repli perd les
  // images, garde le reste, et le dit.
  const load = await import('../lib/canvas/image-load.ts').catch(() => null);
  const withoutImages = load?.withoutImages;
  assert.ok(typeof withoutImages === 'function', 'image-load.ts doit exporter withoutImages');
  const document = {
    version: '6.9.1',
    objects: [
      { type: 'rect', left: 10, top: 10, width: 100, height: 40 },
      { type: 'image', left: 0, top: 0, src: '/uploads/canvas/vole.png' },
      { type: 'group', objects: [{ type: 'image', src: '/uploads/ged/absente.png' }, { type: 'textbox', text: 'Titre' }] },
      { type: 'group', objects: [{ type: 'image', src: '/uploads/ged/absente2.png' }] },
    ],
    sariStudio: { width: 1080, height: 1080, background: { mode: 'image', src: '/uploads/fond-mort.png' } },
  };
  const stripped = withoutImages(document);
  assert.equal(stripped.document.objects.length, 2, 'le rectangle et le groupe encore vivant restent');
  assert.equal(stripped.document.objects[1].objects.length, 1, 'un groupe garde ses enfants non-images');
  // 3 images + le fond + le groupe vidé de son unique enfant : le compte doit tout nommer.
  assert.equal(stripped.dropped.length, 5, `${stripped.dropped.length} visuel(s) signalé(s), 5 attendus`);
  assert.ok(stripped.dropped.includes('/uploads/fond-mort.png'), 'le fond en image est signalé aussi');
  assert.deepEqual(stripped.document.sariStudio.background, { mode: 'solid', color: '#ffffff' }, 'le fond de repli est blanc');
  assert.ok(document.objects.length === 4, 'le document d\'origine n\'est pas mutilé');
});

await acheck('l\'atelier ne recharge jamais un document en dur quand un média peut manquer', async () => {
  // Le repli ne sert à rien si l\'appelant ignore qu\'il existe : chaque lecture d\'un état
  // ou d\'un gabarit doit passer par `loadResilient`, sinon l\'erreur remonte à l\'effet
  // d\'ouverture et l\'écran tombe en « L\'atelier n\'a pas pu démarrer ».
  const engine = await readFile('lib/canvas/engine.ts', 'utf8');
  assert.match(engine, /loadResilient,/, 'le moteur doit exposer loadResilient');
  const studio = await readFile('components/canvas/CanvasStudio.tsx', 'utf8');
  const hard = [...studio.matchAll(/instance\.load\(/g)].length;
  assert.equal(hard, 0, `${hard} rechargement(s) sans repli dans CanvasStudio`);
  assert.ok((studio.match(/instance\.loadResilient\(/g) || []).length >= 4, 'les quatre lectures (asset, gabarit, import, page) doivent être tolérantes');
});

await acheck('un média importé se pose là où est le pointeur, et reste saisissable', async () => {
  // Deux plaintes d\'un même geste : l\'image tombait centrée, pleine taille, et ne se
  // laissait plus déplacer si l\'outil actif n\'était pas « Sélection » (applyTool rend
  // alors tous les objets non sélectionnables). La fabrication reprend donc l\'outil,
  // pose au pointeur, et garde une marge pour qu\'on puisse attraper les poignées.
  const engine = await readFile('lib/canvas/engine.ts', 'utf8');
  assert.match(engine, /function ensureSelectTool\(\)/, 'le moteur doit ramener l\'outil « select »');
  assert.match(engine, /ensureSelectTool\(\);\n\s*object\.set\(\{ originX/, 'place() doit rendre l\'objet saisissable');
  assert.match(engine, /insetSize\s*\?\s*\{ width: Math\.round\(canvas\.getWidth\(\) \* 0\.8\)/, 'un posé par défaut doit garder une marge');
  const studio = await readFile('components/canvas/CanvasStudio.tsx', 'utf8');
  assert.ok((studio.match(/insetSize: true/g) || []).length >= 3, 'les importations (GED, poste, réédition d\'un rendu) doivent utiliser la marge');
  const pose = /const at = instance\.pointer\(\);[\s\S]{0,220}addImage\(asset\.url, \{[^}]*\bat[^}]*\}\)/;
  assert.ok(pose.test(studio), 'le média choisi dans la liste se pose au pointeur');
});

await acheck('la liste des médias ne peut pas produire deux clés identiques', async () => {
  // Deux fichiers `1788887908123.png` et `.jpg` portent le même `name` : une liste clavée
  // sur ce champ dupliquait et supprimait des vignettes au gré des rendus.
  const studio = await readFile('app/[locale]/admin/media/page.tsx', 'utf8');
  assert.match(studio, /key=\{f\.file \|\| f\.url \|\| i\}/, 'l\'écran Médias doit clavier sur le chemin');
  const picker = await readFile('components/admin/GedPicker.tsx', 'utf8');
  assert.match(picker, /key=\{f\.file \|\| f\.url \|\| i\}/, 'le sélecteur de la page doit clavier sur le chemin');
  // Et le nom affiché vient du chemin complet, plus de `split('_')` approximatif.
  const route = await readFile('app/api/admin/upload/route.ts', 'utf8');
  assert.match(route, /function mediaRowFromName/, 'la lecture d\'un nom de fichier passe par un seul endroit');
});

/* ------------------------------------------------- le contrat front ↔ backend */

console.log('\nLes routes NestJS rendues par le module ged');
await acheck('toute surface `cms:` appelée par le front a sa route chez Nest', async () => {
  // La panne, vraie et silencieuse : le front choisit l'API métier dès qu'elle répond
  // au `health`. Si une route manque côté backend, l'atelier, la médiathèque et les
  // gabarits tombent en 404 ALORS QUE les fichiers sont là. Ce garde-fou lit les deux
  // fichiers et refuse le désaccord — textuellement, sans import : `backend/` est un
  // projet CJS distinct, et un `await import()` casserait le jeu pour un motif sans
  // rapport avec la règle testée.
  const client = await readFile(new URL('../lib/ged/client.ts', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../backend/src/modules/ged/ged.controller.ts', import.meta.url), 'utf8');

  const clean = (value) => {
    const head = String(value || '').split('${')[0].split('?')[0];
    const withSlash = head.startsWith('/') ? head : `/${head}`;
    return withSlash.replace(/\/+$/, '');
  };

  // 1. Ce que le front demande : chaque `cms: '/ged/…'`, avec le verbe de l'appel.
  const wanted = new Set();
  for (const match of client.matchAll(/cms:\s*['"`]\/ged/g)) {
    const path = clean(/\/ged([^'"`,]*)/.exec(client.slice(match.index + 6, match.index + 120))?.[1] ?? '');
    // `method` vit dans le troisième argument, après le chemin ; à défaut, c'est un GET.
    const verb = /method:\s*'(\w+)'/.exec(client.slice(match.index, match.index + 420))?.[1]?.toUpperCase() || 'GET';
    wanted.add(`${verb} /ged${path === '' ? '' : path}`);
  }
  assert.ok(wanted.size >= 8, `le front ne déclare que ${wanted.size} routes Nest`);

  // 2. Ce que le contrôleur rend (le préfixe `@Controller('ged')` est appliqué ici).
  const declared = new Set();
  for (const match of controller.matchAll(/@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)/g)) {
    declared.add(`${match[1].toUpperCase()} /ged${clean(match[2]) === '' ? '' : clean(match[2])}`);
  }
  assert.ok(declared.size >= 10, `le contrôleur ged ne déclare que ${declared.size} routes`);

  for (const needle of wanted) {
    const [verb, route] = needle.split(' ');
    // Un `:id` du backend accepte n'importe quel segment envoyé par le front.
    const found = [...declared].some((entry) => {
      const [entryVerb, entryRoute] = entry.split(' ');
      return entryVerb === verb && new RegExp(`^${entryRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`).test(route);
    });
    assert.ok(found, `route manquante côté backend : ${needle}`);
  }

  // 3. Un front qui n'aurait AUCUNE route Next n'aurait plus de repli : interdit.
  for (const match of client.matchAll(/request<[^>]*>\(\s*\{([^}]+)\}/g)) {
    assert.ok(match[1].includes('next:'), 'un appel GED sans route Next perd le repli en cas de backend partiel');
  }
});

await rm(root, { recursive: true, force: true });

console.log(`\n${failed ? '❌' : '✅'} ${done} assertions jouées${failed ? `, ${failed} en échec` : ''}\n`);
