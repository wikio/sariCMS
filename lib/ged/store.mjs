/**
 * lib/ged/store.mjs — lire et écrire la GED, du côté qui sert les fichiers.
 *
 * La GED de sariCMS est un système de fichiers : `public/uploads/<module>/<fichier>`,
 * servi statiquement par Next et listé par `app/api/admin/upload/route.ts`. Ce module
 * ajoute ce qui manquait aux contenus générés — les métadonnées et l'état éditable —
 * sans changer le rangement, la politique de noms ni la surface publique.
 *
 * Deux règles structurelles commandent le reste :
 *
 * 1. **Le fichier reste la source de vérité.** Un asset sans manifeste `.sari.json`
 *    est listé, affiché, insérable et supprimable. Un fichier déposé à la main dans
 *    `public/uploads/canvas/` fonctionne donc immédiatement, et une suppression ne
 *    laisse rien derrière elle.
 * 2. **Tout se passe sous `public/`, écrit par Next.** Le backend peut tourner dans un
 *    autre conteneur que le frontend ; le magasin est donc paramétrable par racine
 *    (`SARI_GED_ROOT`, `SARI_CANVAS_ROOT`) et l'API NestJS relit le même arbre avec sa
 *    propre copie de la règle de nommage. La table des préfixes est la seule chose
 *    partagée entre les deux moitiés, et les deux ont le même jeu de cas pour la
 *    verrouiller (`scripts/test-ged.mjs`, `ged-prefix.policy.spec.ts`).
 *
 * Pas de cache, pas de base : parcourir quelques centaines de fichiers coûte moins
 * cher que maintenir une indexation, et un cache périmé est exactement le genre de bug
 * qu'on ne veut pas sur des visuels déjà publiés.
 *
 * Le module est écrit en JavaScript nu (`node:fs`, `node:path`, rien d'autre) pour que
 * `node scripts/test-ged.mjs` le joue contre un répertoire temporaire, sans Next, sans
 * serveur et sans base — c'est là que l'aller-retour « créer → éditer → sauvegarder →
 * réinsérer » est vérifié.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  assetUrl,
  folderOf,
  buildAssetName,
  extensionOf,
  isManifestFile,
  isVisual,
  isWritableExtension,
  manifestName,
  mimeOf,
  parseAssetName,
  slugifyModule,
} from './prefix.mjs';
import {
  attachState,
  createManifest,
  isStateFile,
  looksLikeManifest,
  mergeManifest,
  pushHistory,
  splitForWrite,
  summarizeManifest,
} from './manifest.mjs';

/** Au-delà, on refuse de charger le fichier en mémoire. */
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

export class GedStoreError extends Error {
  constructor(code, message) {
    // Le code est repris dans le message : c'est ce que voient les écrans et les
    // journaux, et un « GED indisponible » sans code ne se dépanne pas.
    super(`${code} — ${message}`);
    this.name = 'GedStoreError';
    this.code = code;
  }
}

/**
 * Un magasin sur une racine donnée.
 *
 * @param {{ uploadRoot?: string, templateRoot?: string, maxBytes?: number }} [options]
 */
export function createGedStore(options = {}) {
  const uploadRoot = path.resolve(options.uploadRoot || process.env.SARI_GED_ROOT || path.join(process.cwd(), 'public', 'uploads'));
  const templateRoot = path.resolve(options.templateRoot || process.env.SARI_CANVAS_ROOT || path.join(process.cwd(), 'public', 'canvas'));
  const maxBytes = Number(options.maxBytes || MAX_ASSET_BYTES);

  /** Un chemin demandé ne sort jamais de la racine : ni `..`, ni absolu, ni `\0`. */
  function inside(root, relative) {
    const base = path.resolve(root);
    const segments = String(relative)
      .split(/[\\/]+/)
      .map((segment) => segment.replace(/\0/g, ''))
      .filter((segment) => segment && segment !== '.');
    const target = path.resolve(base, ...segments);
    if (target !== base && !target.startsWith(base + path.sep)) {
      throw new GedStoreError('CHEMIN_REFUSÉ', `Chemin hors de la GED : ${relative}`);
    }
    return target;
  }

  const assetPath = (ref) => inside(uploadRoot, toAssetRef(ref));
  const templatePath = (ref) => inside(templateRoot, toTemplateRef(ref));

  async function statOrNull(target) {
    try {
      return await fs.stat(target);
    } catch {
      return null;
    }
  }

  async function readJson(target) {
    try {
      return JSON.parse(await fs.readFile(target, 'utf8'));
    } catch {
      return null;
    }
  }

  async function writeJson(target, value) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(value, null, 2), 'utf8');
  }

  /* ------------------------------------------------------------------- assets */

  /**
   * Le manifeste d'un asset, état éditable rechargé au passage quand il vit dans
   * son propre fichier. `null` quand il n'y a rien à lire : c'est le cas normal
   * pour les fichiers importés avant ce module.
   */
  async function readAssetManifest(ref) {
    const relative = toAssetRef(ref);
    if (!relative) return null;
    const stored = await readJson(`${assetPath(relative)}.sari.json`);
    if (!looksLikeManifest(stored)) return null;
    const shape = { ...createManifest(relative), ...stored, file: relative };
    if (!shape.editable?.file) return shape;
    const state = await readJson(assetPath(shape.editable.file));
    return state ? attachState(shape, state) : shape;
  }

  /** Écrit un manifeste, en externalisant l'état éditable au-dessus de la borne inline. */
  async function writeAssetManifest(manifest) {
    const { manifest: lean, stateFile, stateBody } = splitForWrite(manifest);
    const target = assetPath(manifest.file);
    await writeJson(`${target}.sari.json`, lean);
    if (stateFile && stateBody) {
      await writeJson(assetPath(stateFile), JSON.parse(stateBody));
    }
    return lean;
  }

  async function decorate(ref, forcedModule) {
    const relative = toAssetRef(ref);
    const parsed = parseAssetName(relative);
    // Le dossier réel du fichier, pas celui que le nom laisserait deviner : c'est
    // lui qui décide de l'URL, et donc de ce que la retouche et l'atelier chargeront.
    const onDisk = folderOf(relative);
    const folder = forcedModule || onDisk || parsed.module || 'ged';
    const manifest = await readAssetManifest(relative);
    const summary = summarizeManifest(manifest, relative);
    const stats = await statOrNull(assetPath(relative));
    const size = stats?.size || 0;
    return {
      ...summary,
      file: relative,
      module: folder,
      name: parsed.label || parsed.name,
      title: summary.title || parsed.title,
      kind: summary.kind || parsed.kind,
      prefix: summary.prefix || parsed.prefix,
      url: assetUrl(onDisk, parsed.name),
      size,
      // La liste historique de `/api/admin/upload` ne renvoyait jamais de taille :
      // les écrans affichaient « — ». Ici elle vient du disque, pas du manifeste,
      // pour rester juste même sur un fichier posé à la main.
      bytes: summary.bytes || size,
      mime: mimeOf(parsed.extension || extensionOf(relative)),
      isVisual: isVisual(relative),
      createdAt: summary.createdAt || stats?.birthtime?.toISOString?.() || '',
      updatedAt: summary.updatedAt || stats?.mtime?.toISOString?.() || '',
    };
  }

  async function listModuleFolders() {
    const items = await fs.readdir(uploadRoot, { withFileTypes: true }).catch(() => []);
    return items.filter((item) => item.isDirectory() && !item.name.startsWith('.')).map((item) => item.name);
  }

  /**
   * Liste la GED avec recherche, filtres et pagination.
   *
   * Le parcours reprend celui de `GET /api/admin/upload` — les dossiers de modules
   * puis les fichiers posés à la racine — pour que les deux écrants montrent le même
   * inventaire, avec trois corrections qui n'existaient pas : les fichiers annexes
   * (`.sari.json`, `.sari.canvas.json`) sont retirés de la liste, la taille réelle
   * est renvoyée, et `kind`/`prefix`/`tag` deviennent filtrables.
   *
   * @param {{module?:string,kind?:string,prefix?:string,tag?:string,search?:string,page?:number,limit?:number}} [query]
   */
  async function listAssets(query = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const search = String(query.search || '').trim().toLowerCase();
    const entries = [];
    // Un fichier ne doit être vu qu'une fois : la racine et les dossiers sont
    // parcourus séparément et un même nom peut se rencontrer deux fois.
    const seen = new Set();
    const add = (asset) => {
      if (!asset || seen.has(asset.file)) return;
      seen.add(asset.file);
      entries.push(asset);
    };

    // Un fichier de la GED est un média : `.gitkeep`, `.DS_Store`, un `README.md`
    // oublié ou un dossier de cache ne doivent pas encombrent le sélecteur de
    // l'atelier ni devenir des « images » cliquables. La liste blanche suit
    // l'extension, comme l'écriture (`isWritableExtension`) : ce qui ne peut pas
    // être déposé ne peut pas être listé.
    const listable = (name) =>
      !name.startsWith('.') && !isManifestFile(name) && !isStateFile(name) && isWritableExtension(extensionOf(name));

    const modules = query.module ? [slugifyModule(query.module)] : await listModuleFolders();
    for (const folder of modules) {
      const items = await fs.readdir(path.join(uploadRoot, folder), { withFileTypes: true }).catch(() => []);
      for (const item of items) {
        if (!item.isFile() || !listable(item.name)) continue;
        add(await decorate(`${folder}/${item.name}`, folder));
      }
    }

    if (!query.module) {
      const loose = await fs.readdir(uploadRoot, { withFileTypes: true }).catch(() => []);
      for (const item of loose) {
        if (!item.isFile() || !listable(item.name)) continue;
        // Racine : module vide, donc `decorate` garde l'URL `/uploads/<fichier>`,
        // la seule qui existe pour un fichier posé là.
        add(await decorate(item.name, ''));
      }
    }

    const kind = query.kind ? String(query.kind) : '';
    const prefix = query.prefix ? String(query.prefix).toUpperCase() : '';
    const tag = query.tag ? String(query.tag).toLowerCase() : '';
    const filtered = entries.filter((asset) => {
      if (kind === 'visual' && !asset.isVisual) return false;
      if (kind && kind !== 'visual' && asset.kind !== kind) return false;
      if (prefix && asset.prefix !== (prefix.endsWith('_') ? prefix : `${prefix}_`)) return false;
      if (tag && !(asset.tags || []).includes(tag)) return false;
      if (search) {
        const haystack = `${asset.name} ${asset.title} ${asset.alt} ${(asset.tags || []).join(' ')} ${asset.module} ${asset.file}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    // Le plus récent d'abord : un utilisateur cherche ce qu'il vient de poser.
    filtered.sort((a, b) => String(b.updatedAt || b.file).localeCompare(String(a.updatedAt || a.file)));

    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      kinds: [...new Set(entries.map((entry) => entry.kind).filter(Boolean))].sort(),
      modules: [...new Set(entries.map((entry) => entry.module).filter(Boolean))].sort(),
      tags: [...new Set(entries.flatMap((entry) => entry.tags || []))].sort(),
    };
  }

  /** Un fichier de la GED, lu en entier (l'atelier en a besoin pour le rejouer). */
  async function readAssetFile(ref) {
    const target = assetPath(ref);
    const stats = await statOrNull(target);
    if (!stats) throw new GedStoreError('INTROUVABLE', `Fichier absent : ${toAssetRef(ref)}`);
    if (stats.size > maxBytes) {
      throw new GedStoreError('TROP_LOURD', `Fichier trop lourd pour l'API (${stats.size} octets).`);
    }
    return { buffer: await fs.readFile(target), mime: mimeOf(extensionOf(toAssetRef(ref))), size: stats.size };
  }

  /**
   * Écrit un asset dans la GED, avec son manifeste.
   *
   * Deux modes, et c'est toute la politique de versionnage (§ C du besoin) :
   *
   * - **nouvel asset** — `kind` + `name` fabriquent le nom via la table des
   *   préfixes, et le manifeste naît ;
   * - **ré-édition** — `overwrite` porte la référence à remplacer. L'ancien contenu
   *   est archivé à côté sous `<nom>-v<n>.<extension>` et rangé dans `history` du
   *   manifeste réécrit ; le fichier actif garde son nom quand l'appelant le demande
   *   (`file` = `overwrite`).
   *
   * Pourquoi archiver plutôt que créer un asset lié : la GED n'a pas de table, donc
   * pas d'identifiant stable, et le seul lien possible entre deux versions serait le
   * nom du fichier — or les pages stockent un `content` de HTML brut où chaque URL est
   * écrite en dur. Un asset « v2 » indépendant laisserait donc derrière lui des liens
   * pointant vers une image périmée, sans aucun moyen de les retrouver. En gardant le
   * nom courant comme visuel actif, une ré-édition ne casse aucun lien existant, et les
   * versions restent des fichiers réels — visibles, téléchargeables et supprimables par
   * les écrans qui ignorent ce module.
   *
   * Un écrasement ne supprime jamais l'ancien fichier.
   *
   * @param {{module?:string,kind?:string,name?:string,file?:string,prefix?:string,buffer:Buffer,extension?:string,manifest?:object,overwrite?:string}} input
   */
  async function saveAsset(input) {
    const extension = String(input.extension || extensionOf(input.file || input.name || '') || 'png')
      .toLowerCase()
      .replace(/^\./, '');
    if (!isWritableExtension(extension)) {
      throw new GedStoreError('EXTENSION', `Extension refusée : ${extension} (la GED n'écrit que des images, des SVG et des PDF).`);
    }
    if (!input.buffer || !input.buffer.length) {
      throw new GedStoreError('VIDE', 'Contenu vide : rien à écrire dans la GED.');
    }
    if (input.buffer.length > maxBytes) {
      throw new GedStoreError('TROP_LOURD', `Contenu trop lourd (${input.buffer.length} octets).`);
    }

    const kind = input.kind || 'canvas';
    // Un module demandé par l'appelant fait foi : `buildAssetName` ne connaît que la
    // table des préfixes, et `image` y vit dans `ged`. Sans ce rappel, un import
    // « product » ou « media » atterrissait dans le dossier du type, et la fiche
    // média — qui range par module — ne le revoyait plus.
    const wantedModule = input.module ? slugifyModule(input.module) : '';
    let relative = input.file ? toAssetRef(input.file) : '';
    if (!relative) {
      const built = buildAssetName(kind, { name: input.name || kind, extension, prefix: input.prefix });
      relative = `${wantedModule || built.module}/${built.file}`;
    } else if (!relative.includes('/') && !input.file) {
      relative = `${wantedModule || slugifyModule(kind)}/${relative}`;
    }
    // Un `file` explicite sans dossier désigne la RACINE de `public/uploads` : c'est
    // le langage de `GET /api/admin/upload`, qui liste les deux. Lui adjoindre le
    // module du type déménagerait l'asset à chaque réédition — et laisserait derrière
    // lui, dans chaque page construite, une URL pointant l'ancien emplacement.

    let target = assetPath(relative);
    const replacing = input.overwrite ? toAssetRef(input.overwrite) === relative : false;
    if (!replacing && (await statOrNull(target))) {
      // Deux écritures simultanées ne doivent pas se marcher dessus : on décale le
      // nom, et l'appelant reçoit celui qui a gagné — c'est lui qu'il met dans sa page.
      const parsed = parseAssetName(relative);
      const stem = parsed.name.replace(new RegExp(`\\.${extension}$`), '');
      relative = `${parsed.module}/${stem}-${parsed.stamp || Date.now().toString(36)}.${extension}`;
      target = assetPath(relative);
    }

    let manifest = mergeManifest(createManifest(relative, { ...(input.manifest || {}), kind, bytes: input.buffer.length }), input.manifest || {});
    manifest = { ...manifest, file: relative, bytes: input.buffer.length };

    if (input.overwrite) {
      const previousRef = toAssetRef(input.overwrite);
      const previous = await readAssetManifest(previousRef);
      const archived = await archiveVersion(previousRef, previous);
      if (archived) {
        manifest = pushHistory(manifest, { ...archived, updatedAt: previous?.updatedAt, by: previous?.author?.email });
        // Ré-enregistrer sans nouvel état éditable ne doit pas jeter celui de la
        // version précédente (un export PNG seul ne remplace que le rendu).
        if (previous?.editable && !input.manifest?.editable) {
          manifest = { ...manifest, editable: previous.editable };
        }
      }
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.buffer);
    await writeAssetManifest(manifest);
    return decorate(manifest.file);
  }

  /** Copie le fichier courant en `<nom>-v<n>.<ext>` ; renvoie sa référence archivée. */
  async function archiveVersion(ref, previous) {
    const relative = toAssetRef(ref);
    const source = assetPath(relative);
    if (!(await statOrNull(source))) return null;
    const parsed = parseAssetName(relative);
    const folder = folderOf(relative);
    const extension = parsed.extension || extensionOf(relative) || 'png';
    const history = previous?.history || [];
    const siblings = await fs.readdir(path.join(uploadRoot, folder)).catch(() => []);
    let version = 2 + history.length;
    while ([...siblings, ...history.map((entry) => entry.file)].some((name) => String(name).includes(`-v${version}.${extension}`))) {
      version += 1;
    }
    const stem = parsed.name.replace(new RegExp(`\\.${extension}$`), '');
    const archived = `${folder ? `${folder}/` : ''}${stem}-v${version}.${extension}`;
    await fs.copyFile(source, assetPath(archived));
    if (previous) {
      // L'archive garde sa propre fiche : c'est elle qu'on relirait si on la
      // remontait dans l'atelier, et elle ne doit rien pointer d'autre.
      await writeAssetManifest({
        ...previous,
        file: archived,
        history: [],
        editable: previous.editable?.inline ? previous.editable : { ...previous.editable, file: null },
        render: { ...previous.render, png: archived, svg: '', webp: '' },
      }).catch(() => undefined);
    }
    return {
      file: archived,
      url: assetUrl(folder, path.basename(archived)),
      label: `version ${version}`,
      width: previous?.width || 0,
      height: previous?.height || 0,
      extension,
    };
  }

  /** Attache ou remplace l'état éditable rejouable d'un asset. */
  async function writeEditableState(ref, state, format = 'fabric') {
    const relative = toAssetRef(ref);
    if (!(await statOrNull(assetPath(relative)))) {
      throw new GedStoreError('INTROUVABLE', `Aucun asset à relier : ${relative}`);
    }
    const manifest = (await readAssetManifest(relative)) || createManifest(relative, {});
    const next = { ...manifest, editable: { format: format === 'svg' ? 'svg' : 'fabric', inline: state, file: null, size: 0 } };
    await writeAssetManifest(next);
    return { file: relative, stateFile: next.editable.file, inlined: !next.editable.file };
  }

  async function readEditableState(ref) {
    const manifest = await readAssetManifest(ref);
    if (!manifest?.editable) return null;
    if (manifest.editable.inline) return manifest.editable.inline;
    if (!manifest.editable.file) return null;
    return readJson(assetPath(manifest.editable.file));
  }

  /**
   * Le tour complet, utilisé par l'écran de la médiathèque et par le plugin
   * GrapesJS : `GET` renvoie le manifeste, `PATCH` fusionne un patch, `DELETE`
   * nettoie les fichiers liés.
   */
  async function patchAsset(input) {
    const relative = toAssetRef(input.file);
    const current = await readAssetManifest(relative);
    const base = current || createManifest(relative, {});
    const next = mergeManifest(base, { ...input, file: relative });
    await writeAssetManifest(next);
    return decorate(relative);
  }

  /** Renomme un asset, son manifeste et son état éditable. */
  async function renameAsset(from, newName) {
    const relative = toAssetRef(from);
    const source = assetPath(relative);
    // On renomme là où le fichier est : un posé à la racine y reste, il ne
    // déménage pas dans `ged/` sous prétexte que son nom ne porte pas de module.
    const folder = folderOf(relative);
    const targetName = path.basename(String(newName || ''));
    if (!targetName || targetName === '.' || targetName === '..') {
      throw new GedStoreError('NOM', `Nom de fichier refusé : ${newName}`);
    }
    if (targetName === relative.split('/').pop()) return { file: relative, url: assetUrl(folder, targetName), unchanged: true };
    const target = assetPath(`${folder ? `${folder}/` : ''}${targetName}`);
    if (!(await statOrNull(source))) throw new GedStoreError('INTROUVABLE', `Fichier absent : ${relative}`);
    if (await statOrNull(target)) throw new GedStoreError('EXISTANT', 'Un fichier porte déjà ce nom.');
    await fs.rename(source, target);
    const nextRef = `${folder ? `${folder}/` : ''}${targetName}`;
    const manifest = await readAssetManifest(relative);
    await fs.rm(`${source}.sari.json`, { force: true });
    if (manifest) {
      const nextStateRef = nextRef.replace(/\.[^.]+$/, '') + '.sari.canvas.json';
      if (manifest.editable?.file && !manifest.editable.inline) {
        await fs.rename(assetPath(manifest.editable.file), assetPath(nextStateRef)).catch(() => undefined);
        manifest.editable = { ...manifest.editable, file: nextStateRef };
      }
      await writeAssetManifest({ ...manifest, file: nextRef });
    }
    return { file: nextRef, url: assetUrl(folder, targetName) };
  }

  /** Supprime un asset, sa fiche, son état éditable et — sur demande — ses versions. */
  async function deleteAsset(ref, options = {}) {
    const relative = toAssetRef(ref);
    const target = assetPath(relative);
    const manifest = await readAssetManifest(relative);
    const removed = [];
    if (await statOrNull(target)) {
      await fs.rm(target, { force: true });
      removed.push(relative);
    }
    await fs.rm(`${target}.sari.json`, { force: true });
    if (manifest?.editable?.file) {
      await fs.rm(assetPath(manifest.editable.file), { force: true }).catch(() => undefined);
      removed.push(manifest.editable.file);
    } else {
      await fs.rm(`${target}.sari.canvas.json`, { force: true }).catch(() => undefined);
    }
    for (const entry of options.purgeHistory ? manifest?.history || [] : []) {
      if (!entry.file) continue;
      await fs.rm(assetPath(entry.file), { force: true }).catch(() => undefined);
      await fs.rm(`${assetPath(entry.file)}.sari.json`, { force: true }).catch(() => undefined);
      removed.push(entry.file);
    }
    // Rien ne doit rester si le visuel n'existe plus : la liste saute le fichier
    // orphelin, mais un `.sari.json` perdu dans le dossier finirait par surprendre.
    return { removed, file: relative };
  }

  /* ------------------------------------------------------------------- gabarits */

  async function readTemplateIndex() {
    const index = await readJson(path.join(templateRoot, 'templates', 'index.json'));
    if (index && Array.isArray(index.templates)) return index;
    return { version: 1, templates: [] };
  }

  /**
   * Le catalogue des gabarits.
   *
   * `public/canvas/templates/index.json` porte les fiches (titre, format, palette,
   * zones modifiables) ; le gabarit lui-même est un JSON Fabric posé à côté. L'index
   * fait foi — un fichier non déclaré n'est pas proposé — mais il est recalé sur le
   * disque à chaque lecture : déposer un JSON et son entrée dans l'index suffit à
   * publier un gabarit, et un fichier retiré à la main ne laisse pas une entrée morte
   * dans le sélecteur.
   */
  async function listTemplates() {
    const index = await readTemplateIndex();
    const files = await fs.readdir(path.join(templateRoot, 'templates')).catch(() => []);
    const present = new Set(files.filter((name) => name.endsWith('.json') && name !== 'index.json'));
    const templates = index.templates
      .filter((entry) => present.has(`${entry.id}.json`) || present.has(path.basename(String(entry.file || ''))))
      .map((entry) => ({ ...entry, file: entry.file || `templates/${entry.id}.json` }));
    return { version: index.version || 1, templates };
  }

  /** Le JSON d'un gabarit, prêt pour `loadFromJSON`, avec sa fiche. */
  async function readTemplate(id) {
    const catalog = await listTemplates();
    const entry = catalog.templates.find((template) => template.id === id);
    if (!entry) throw new GedStoreError('GABARIT', `Gabarit inconnu : ${id}`);
    const body = await readJson(templatePath(entry.file));
    if (!body) throw new GedStoreError('GABARIT', `Fichier de gabarit illisible : ${entry.file}`);
    return { meta: entry, template: body };
  }

  /** Publier un gabarit : son JSON sous `public/canvas/templates/` et sa fiche dans l'index. */
  async function saveTemplate(input) {
    const id = slugifyModule(input.id);
    // L'identifiant est un nom de fichier : on l'exige déjà sous la forme admise,
    // plutôt que de « réparer » en silence ce qui ressemble à une évasion de chemin.
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(input.id || '')) || id !== input.id) {
      throw new GedStoreError('GABARIT', `Identifiant de gabarit refusé : ${input.id} (lettres minuscules, chiffres, tirets).`);
    }
    const folder = path.join(templateRoot, 'templates');
    await fs.mkdir(folder, { recursive: true });
    const file = `templates/${id}.json`;
    await writeJson(path.join(folder, `${id}.json`), { id, ...(input.template || {}) });
    const catalog = await readTemplateIndex();
    const existing = catalog.templates.find((entry) => entry.id === id);
    const meta = {
      id,
      title: input.meta?.title || existing?.title || id,
      description: input.meta?.description || existing?.description || '',
      category: input.meta?.category || existing?.category || 'poster',
      format: input.meta?.format || existing?.format || { width: 1080, height: 1080, name: 'Carré 1080', orientation: 'carré' },
      palette: input.meta?.palette || existing?.palette || [],
      preview: input.meta?.preview ?? existing?.preview ?? null,
      file,
      version: input.meta?.version != null ? Number(input.meta.version) : (existing ? (existing.version || 1) + 1 : 1),
      tags: input.meta?.tags || existing?.tags || [],
      updatedAt: new Date().toISOString(),
      slots: input.meta?.slots || existing?.slots || [],
    };
    const templates = [...catalog.templates.filter((entry) => entry.id !== id), meta];
    await writeJson(path.join(folder, 'index.json'), { version: (catalog.version || 1) + 1, templates });
    return meta;
  }

  async function deleteTemplate(id) {
    const catalog = await readTemplateIndex();
    const entry = catalog.templates.find((template) => template.id === id);
    if (!entry) throw new GedStoreError('GABARIT', `Gabarit inconnu : ${id}`);
    await fs.rm(templatePath(entry.file), { force: true });
    await writeJson(path.join(templateRoot, 'templates', 'index.json'), {
      version: (catalog.version || 1) + 1,
      templates: catalog.templates.filter((template) => template.id !== id),
    });
    return { removed: entry.file };
  }

  return {
    uploadRoot,
    templateRoot,
    assetPath,
    templatePath,
    listAssets,
    decorate,
    readAssetManifest,
    writeAssetManifest,
    readAssetFile,
    saveAsset,
    patchAsset,
    renameAsset,
    deleteAsset,
    writeEditableState,
    readEditableState,
    listTemplates,
    readTemplate,
    saveTemplate,
    deleteTemplate,
  };
}

/** Le magasin du projet, pointé sur `public/uploads` et `public/canvas`. */
export const gedStore = createGedStore();

/** `module/fichier` depuis n'importe quelle forme de référence (URL, chemin, `/uploads/...`). */
export function toAssetRef(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?uploads\//, '')
    .replace(/^\/+/, '')
    .split('?')[0]
    .split('#')[0];
}

/** Idem pour un gabarit (`canvas/templates/x.json` → `templates/x.json`). */
export function toTemplateRef(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?canvas\//, '')
    .replace(/^\/+/, '')
    .split('?')[0];
}

export { manifestName, parseAssetName, assetUrl, folderOf };
