import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AssetPatchDto, CanvasExportDto, ListAssetsDto, RenameAssetDto, SaveAssetDto, TemplateUpsertDto, WriteStateDto } from './dto/canvas-export.dto';
import { buildAssetName, extensionOf, isWritableExtension, parseAssetName, PREFIX_TABLE, slugifyModule } from './ged-prefix.policy';

/** Au-delà, l'état éditable part dans son propre fichier : une fiche qui gonfle fait gonfler chaque listing. */
const MAX_INLINE_STATE = 240_000;
const MAX_RENDER_BYTES = 30 * 1024 * 1024;

export interface GedAssetSummary {
  file: string;
  module: string;
  name: string;
  title: string;
  alt: string;
  kind: string;
  prefix: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  version: number;
  editable: boolean;
  editableFormat: 'fabric' | 'svg' | null;
  stateFile: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: Record<string, unknown> | null;
  history: Array<{ file: string; version: number; at: string }>;
}

/**
 * Le magasin de la GED, côté backend.
 *
 * Il n'y a ni table ni ORM ici, et c'est le même choix que côté interface : la GED de
 * sariCMS est un système de fichiers (`public/uploads/<module>/<fichier>`), servi
 * statiquement par Next. Une table aurait voulu dire une double écriture à réussir deux
 * fois — le fichier et sa ligne — et un désaccord entre les deux à la première
 * interruption. Le fichier reste la vérité ; la fiche `.sari.json` à côté ne fait
 * qu'ajouter ce que l'extension ne peut pas porter (légende, étiquettes, état éditable,
 * versions).
 *
 * Ce service expose donc les deux routes dont l'atelier a besoin hors du back-office :
 * écrire un rendu (`POST /ged/canvas-export`) et retrouver des visuels (`GET /ged/assets`).
 */
@Injectable()
export class GedService {
  constructor(private readonly config: ConfigService) {}

  /** La racine des médias. `GED_UPLOAD_DIR` permet de la poser ailleurs qu'à côté du backend. */
  get root(): string {
    const fromEnv = this.config.get<string>('GED_UPLOAD_DIR');
    return fromEnv && fromEnv.trim()
      ? path.resolve(fromEnv.trim())
      : path.resolve(process.cwd(), '..', 'public', 'uploads');
  }

  /** Les préfixes surchargés par l'environnement (`GED_PREFIX_OVERRIDES={"audio":{"prefix":"SND_","module":"media"}}`). */
  get overrides(): Record<string, Partial<{ prefix: string; module: string; extensions: string[] }>> {
    const raw = this.config.get<string>('GED_PREFIX_OVERRIDES');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, never>;
      return parsed && typeof parsed === 'object' ? (parsed as never) : {};
    } catch {
      // Une override mal écrite ne doit pas empêcher d'écrire un fichier : la table
      // par défaut tient, et le message d'avertissement suffit.
      return {};
    }
  }

  /** Un chemin de la GED, sous scellé : `../` ne sort pas du dossier des médias. */
  private resolve(relative: string): string {
    const clean = String(relative || '').replace(/^\/+/, '').replace(/^uploads\//, '');
    const target = path.resolve(this.root, clean);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new BadRequestException(`Chemin hors de la GED : ${relative}`);
    }
    return target;
  }

  private urlFor(relative: string): string {
    return `/uploads/${relative.split(path.sep).join('/')}`;
  }

  /**
   * La référence interne d'un asset, sous n'importe quelle forme reçue : `/uploads/…`,
   * une URL absolue du même serveur, `module/fichier`, ou le nom nu d'un fichier posé
   * à la racine de `public/uploads`.
   */
  private ref(value: string): string {
    return String(value || '')
      .trim()
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/?uploads\//, '')
      .replace(/^\/+/, '')
      .split('?')[0]
      .split('#')[0];
  }

  /** Écrire un buffer, en créant le dossier au besoin. */
  private async write(relative: string, data: Buffer | string): Promise<number> {
    const target = this.resolve(relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    await fs.writeFile(target, buffer);
    return buffer.length;
  }

  /**
   * Lit une fiche JSON, `null` si elle n'existe pas.
   *
   * Le `resolve` est DEHORS du `try` : une tentative de sortie du dépôt doit remonter,
   * pas se déguiser en « fichier absent ». C'est le même garde-fou que dans `statOrNull`,
   * et c'est là que le test d'évasion attrape une vraie régression.
   */
  private async readJson<T>(relative: string): Promise<T | null> {
    const target = this.resolve(relative);
    try {
      return JSON.parse(await fs.readFile(target, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  /** L'archive de la version précédente, s'il y en a une à archiver. */
  private async archivePrevious(currentRelative: string): Promise<{ file: string; version: number } | null> {
    const parsed = parseAssetName(currentRelative);
    const folder = parsed.module || 'ged';
    // La racine du nom, `-vN` retiré : c'est elle qui sert de clé aux versions.
    const stem = parsed.name.replace(/\.[^.]+$/, '').replace(/-v\d+$/, '');
    const siblings = await fs.readdir(path.dirname(this.resolve(currentRelative))).catch(() => [] as string[]);
    let highest = 1;
    for (const name of siblings) {
      const candidate = parseAssetName(`${folder}/${name}`);
      if (candidate.label === `${stem}-v${candidate.version}` && candidate.version > highest) highest = candidate.version;
    }
    const version = highest + 1;
    const archived = `${parsed.module}/${stem}-v${version}.${parsed.extension}`;
    await fs.copyFile(this.resolve(currentRelative), this.resolve(archived)).catch(() => undefined);
    return { file: archived, version };
  }

  /**
   * Écrit un rendu de l'atelier : le PNG, la SVG si elle est demandée, et l'état
   * rejouable — sous le même nom de base, à la même seconde.
   *
   * Trois fichiers, une seule requête : c'est ce qui empêche une page d'afficher le
   * rendu d'hier avec le JSON d'aujourd'hui. Si `file` est fourni, l'ancien contenu est
   * copié en `-vN` AVANT d'être écrasé, et l'URL ne change pas — un lien déjà publié
   * dans une page continue de pointer au bon endroit, vers la version en cours.
   */
  async exportCanvas(dto: CanvasExportDto): Promise<{ asset: GedAssetSummary; file: string; url: string; written: string[]; version: number }> {
    const kind = (dto.kind || 'canvas').toLowerCase();
    const written: string[] = [];
    const extension = dto.svg && !dto.png ? 'svg' : 'png';
    if (!isWritableExtension(extension)) {
      throw new BadRequestException(`Extension refusée par la GED : ${extension}`);
    }
    const png = dto.png ? Buffer.from(dto.png.replace(/^data:[^;]+;base64,/, ''), 'base64') : null;
    if (png && png.length > MAX_RENDER_BYTES) {
      throw new BadRequestException(`Rendu trop lourd (${png.length} octets).`);
    }
    if (!png && !dto.svg && !dto.state) {
      throw new BadRequestException('Rien à écrire : png, svg ou state attendu.');
    }

    let relative = dto.file ? this.ref(dto.file) : '';
    let version = 1;
    let history: GedAssetSummary['history'] = [];

    if (relative) {
      const existing = await this.statOrNull(relative);
      if (!existing) throw new NotFoundException(`Fichier absent : ${relative}`);
      // Un `file` sans dossier désigne la racine : on n'y ajoute pas le module du
      // type, ce qui déménagerait l'asset à chaque enregistrement et casserait, dans
      // chaque page, l'URL qui pointait l'emplacement d'origine.
      const archived = await this.archivePrevious(relative);
      if (archived) {
        version = archived.version;
        written.push(archived.file);
        history = [{ file: archived.file, version: archived.version, at: new Date().toISOString() }];
      }
    } else {
      const built = buildAssetName(kind, { name: dto.name || dto.title || kind, extension, prefix: dto.prefix }, this.overrides);
      // Un module demandé fait foi (il décide du dossier, donc de l'URL) ; à défaut,
      // c'est la table des préfixes qui range le type.
      const folder = dto.module ? slugifyModule(dto.module) : built.module;
      relative = `${folder}/${built.file}`;
    }

    const parsed = parseAssetName(relative);
    const base = relative.replace(/\.[^.]+$/, '');
    const manifestPath = `${relative}.sari.json`;
    const previousManifest = await this.readJson<GedAssetSummary & Record<string, unknown>>(manifestPath);
    if (previousManifest?.history?.length) history = [...previousManifest.history, ...history].slice(0, 20);

    if (png) await this.write(relative, png);
    if (dto.svg) await this.write(`${base}.svg`, dto.svg);

    // L'état éditable : inline dans la fiche s'il tient, à côté s'il ne tient pas.
    let stateFile: string | null = null;
    let inline: unknown | undefined;
    if (dto.state) {
      const text = JSON.stringify(dto.state);
      if (text.length <= MAX_INLINE_STATE) inline = dto.state;
      else {
        stateFile = `${base}.sari.canvas.json`;
        await this.write(stateFile, text);
      }
    }

    const bytes = png ? png.length : (await this.statOrNull(relative))?.size || 0;
    const now = new Date().toISOString();
    const asset: GedAssetSummary = {
      file: relative,
      module: parsed.module,
      name: parsed.name,
      title: dto.title || parsed.title || parsed.label,
      alt: dto.alt || '',
      kind,
      // Le préfixe réellement écrit, et pas celui demandé : si la table a décidé
      // autrement, la fiche doit dire la vérité.
      prefix: dto.prefix || parsed.prefix || PREFIX_TABLE[kind]?.prefix || '',
      url: this.urlFor(relative),
      width: dto.width,
      height: dto.height,
      bytes,
      version,
      editable: !!dto.state,
      editableFormat: dto.state ? dto.format || 'fabric' : null,
      stateFile,
      tags: dto.tags || [],
      createdAt: (previousManifest?.createdAt as string) || now,
      updatedAt: now,
      source: (dto.source as unknown as Record<string, unknown>) || null,
      history,
    };

    await this.write(
      manifestPath,
      JSON.stringify(
        {
          ...asset,
          editable: asset.editable ? { format: asset.editableFormat, inline, file: stateFile } : null,
          render: { png: this.urlFor(relative), svg: dto.svg ? this.urlFor(`${base}.svg`) : '', webp: '' },
          extra: (previousManifest?.extra as Record<string, unknown>) || {},
        },
        null,
        0,
      ),
    );
    written.push(relative, manifestPath);
    if (dto.svg) written.push(`${base}.svg`);
    if (stateFile) written.push(stateFile);

    return { asset, file: asset.file, url: asset.url, written, version };
  }

  private async statOrNull(relative: string) {
    // Voir `readJson` : le contrôle de périmètre n'est pas une erreur rattrapable.
    const target = this.resolve(relative);
    try {
      return await fs.stat(target);
    } catch {
      return null;
    }
  }

  /**
   * L'état rejouable d'un asset, inline ou dans son fichier de côté.
   *
   * Un fichier sans fiche n'est PAS une erreur : `state: null` veut dire « ce visuel
   * n'a jamais été dessiné dans l'atelier », et l'écran sait quoi en faire (il repart
   * du rendu). Une 404 ici faisait planter l'ouverture d'une image de la médiathèque.
   */
  async readState(file: string): Promise<unknown | null> {
    const relative = this.ref(file);
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    const manifest = await this.readJson<{ editable?: { inline?: unknown; file?: string } }>(`${relative}.sari.json`);
    if (!manifest) {
      if (!(await this.statOrNull(relative))) throw new NotFoundException(`Fichier absent : ${relative}`);
      return null;
    }
    if (manifest.editable?.inline) return manifest.editable.inline;
    if (manifest.editable?.file) return this.readJson<unknown>(manifest.editable.file);
    return null;
  }

  /**
   * Liste la GED. Le parcours est celui du back-office : les dossiers de modules, puis
   * les fichiers posés à la racine ; les fichiers d'à-côté (`.sari.json`,
   * `.sari.canvas.json`) ne sont jamais des assets.
   */
  async list(query: ListAssetsDto = {}): Promise<{ items: GedAssetSummary[]; total: number; page: number; limit: number; kinds: string[]; modules: string[]; tags: string[] }> {
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const search = String(query.search || '').trim().toLowerCase();
    const folders = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    const entries: GedAssetSummary[] = [];

    // Un fichier de la GED est un média : `.gitkeep`, `.DS_Store`, un `notes.txt`
    // oublié ou un dossier de cache ne doivent pas devenir des « images » cliquables
    // dans l'atelier. La liste blanche suit l'extension, comme l'écriture.
    const listable = (name: string) =>
      !name.startsWith('.') && !/\.sari\.(canvas\.)?json$/i.test(name) && isWritableExtension(extensionOf(name));

    const collect = async (relative: string, forcedModule: string) => {
      const parsed = parseAssetName(relative);
      if (/\.sari\.(canvas\.)?json$/.test(parsed.name)) return;
      const manifest = await this.readJson<Record<string, unknown>>(`${relative}.sari.json`);
      const stats = await this.statOrNull(relative);
      const merged = { ...(manifest || {}), ...(manifest?.editable ? {} : {}) } as Partial<GedAssetSummary>;
      entries.push({
        ...(merged as GedAssetSummary),
        file: relative,
        module: forcedModule || (manifest?.module as string) || parsed.module || 'ged',
        name: parsed.name,
        title: (manifest?.title as string) || parsed.title || parsed.label,
        alt: (manifest?.alt as string) || '',
        kind: (manifest?.kind as string) || parsed.kind || (isWritableExtension(parsed.extension) ? 'image' : 'doc'),
        prefix: parsed.prefix,
        url: this.urlFor(relative),
        width: Number(manifest?.width || 0) || 0,
        height: Number(manifest?.height || 0) || 0,
        bytes: stats?.size || 0,
        version: parsed.version,
        editable: !!manifest?.editable,
        editableFormat: (manifest?.editableFormat as 'fabric' | 'svg') || null,
        stateFile: (manifest?.stateFile as string) || null,
        tags: (manifest?.tags as string[]) || [],
        createdAt: (manifest?.createdAt as string) || '',
        updatedAt: (manifest?.updatedAt as string) || (stats?.mtime ? new Date(stats.mtime).toISOString() : ''),
        source: (manifest?.source as Record<string, unknown>) || null,
        history: (manifest?.history as GedAssetSummary['history']) || [],
      });
    };

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      if (query.module && folder.name !== query.module) continue;
      const files = await fs.readdir(path.join(this.root, folder.name)).catch(() => []);
      for (const file of files) if (listable(file)) await collect(`${folder.name}/${file}`, folder.name);
    }
    if (!query.module) {
      // La racine aussi est une rangée de la GED — `GET /api/admin/upload` la liste,
      // l'atelier doit la voir sous la même URL, sinon « image non chargeable ».
      for (const item of folders) {
        if (!item.isFile() || !listable(item.name)) continue;
        await collect(item.name, '');
      }
    }

    const filtered = entries.filter((entry) => {
      if (query.kind && entry.kind !== query.kind) return false;
      if (query.prefix && entry.prefix !== query.prefix) return false;
      if (query.tag && !(entry.tags || []).includes(query.tag)) return false;
      if (search) {
        const haystack = `${entry.name} ${entry.title} ${entry.alt} ${(entry.tags || []).join(' ')} ${entry.file}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      kinds: [...new Set(filtered.map((entry) => entry.kind))].filter(Boolean).sort(),
      modules: [...new Set(filtered.map((entry) => entry.module))].filter(Boolean).sort(),
      tags: [...new Set(filtered.flatMap((entry) => entry.tags || []))].filter(Boolean).sort(),
    };
  }

  /**
   * La fiche d'un asset, relue sur le disque.
   *
   * `GET /ged/asset` répond `{ asset, manifest, state }` — la même forme que la route
   * Next : un écran ne doit pas connaître la surface qui lui répond.
   */
  async readAsset(file: string): Promise<{ asset: GedAssetSummary; manifest: Record<string, unknown> | null; state: unknown | null; found: boolean }> {
    const relative = this.ref(file);
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    if (!(await this.statOrNull(relative))) throw new NotFoundException(`Fichier absent : ${relative}`);
    const manifest = await this.readJson<Record<string, unknown>>(`${relative}.sari.json`);
    const state = await this.readState(relative).catch(() => null);
    return { asset: await this.decorate(relative, manifest), manifest: manifest || null, state, found: !!manifest };
  }

  /** La fiche d'un fichier, complétée par ce que le disque sait de lui. */
  private async decorate(relative: string, manifest?: Record<string, unknown> | null): Promise<GedAssetSummary> {
    const parsed = parseAssetName(relative);
    const stats = await this.statOrNull(relative);
    const stored = manifest === undefined ? await this.readJson<Record<string, unknown>>(`${relative}.sari.json`) : manifest;
    return {
      file: relative,
      module: (stored?.module as string) || parsed.module || 'ged',
      name: parsed.name,
      title: (stored?.title as string) || parsed.title || parsed.label,
      alt: (stored?.alt as string) || '',
      kind: (stored?.kind as string) || parsed.kind || (isWritableExtension(parsed.extension) ? 'image' : 'doc'),
      prefix: (stored?.prefix as string) || parsed.prefix,
      url: this.urlFor(relative),
      width: Number(stored?.width || 0) || 0,
      height: Number(stored?.height || 0) || 0,
      bytes: stats?.size || 0,
      version: Number(stored?.version || 0) || parsed.version,
      editable: Boolean((stored?.editable as { inline?: unknown; file?: string } | undefined)?.inline || (stored?.editable as { file?: string } | undefined)?.file),
      editableFormat: ((stored?.editable as { format?: 'fabric' | 'svg' } | undefined)?.format as 'fabric' | 'svg') || null,
      stateFile: ((stored?.editable as { file?: string } | undefined)?.file as string) || null,
      tags: (stored?.tags as string[]) || [],
      createdAt: (stored?.createdAt as string) || '',
      updatedAt: (stored?.updatedAt as string) || (stats?.mtime ? new Date(stats.mtime).toISOString() : ''),
      source: (stored?.source as Record<string, unknown>) || null,
      history: (stored?.history as GedAssetSummary['history']) || [],
    };
  }

  /**
   * Écrit un asset depuis un contenu encodé — la porte d'entrée de la retouche et de
   * l'import quand le back-office passe par l'API métier (jeton, permissions, audit).
   *
   * Le fichier `multipart` reste servi par la route Next `/api/admin/ged/assets`, qui
   * écrit dans le même arbre : deux portes, un seul magasin, une seule politique.
   */
  async saveAsset(dto: SaveAssetDto): Promise<{ asset: GedAssetSummary; file: string; url: string; version: number; written: string[] }> {
    const extension = String(dto.extension || extensionOf(dto.file || dto.name || '') || 'png')
      .toLowerCase()
      .replace(/^\./, '');
    if (!isWritableExtension(extension)) throw new BadRequestException(`Extension refusée par la GED : ${extension}`);
    const buffer = dto.dataUrl
      ? Buffer.from(String(dto.dataUrl).replace(/^data:[^;]+;base64,/, ''), 'base64')
      : null;
    if (!buffer || !buffer.length) throw new BadRequestException('Rien à écrire : dataUrl (base64) attendu.');
    if (buffer.length > MAX_RENDER_BYTES) throw new BadRequestException(`Contenu trop lourd (${buffer.length} octets).`);

    const kind = (dto.kind || 'image').toLowerCase();
    const target = this.ref(dto.file || '');
    let relative = target;
    if (!relative) {
      const built = buildAssetName(kind, { name: dto.name || dto.title || kind, extension, prefix: dto.prefix }, this.overrides);
      const folder = dto.module ? slugifyModule(dto.module) : built.module;
      relative = `${folder}/${built.file}`;
    }

    const written: string[] = [];
    let version = 1;
    const previous = await this.readJson<Record<string, unknown>>(`${relative}.sari.json`);
    if (dto.overwrite && this.ref(dto.overwrite) === relative && (await this.statOrNull(relative))) {
      const archived = await this.archivePrevious(relative);
      if (archived) {
        version = archived.version;
        written.push(archived.file);
      }
    }

    await this.write(relative, buffer);
    const base = relative.replace(/\.[^.]+$/, '');
    let stateFile: string | null = null;
    let inline: unknown | undefined;
    if (dto.state) {
      const text = JSON.stringify(dto.state);
      if (text.length <= MAX_INLINE_STATE) inline = dto.state;
      else {
        stateFile = `${base}.sari.canvas.json`;
        await this.write(stateFile, text);
        written.push(stateFile);
      }
    }
    const summary = await this.decorate(relative, {
      ...(previous || {}),
      module: relative.includes('/') ? relative.split('/')[0] : (previous?.module as string) || 'ged',
      kind,
      prefix: dto.prefix || parseAssetName(relative).prefix || PREFIX_TABLE[kind]?.prefix || '',
      title: dto.title || previous?.title || parseAssetName(relative).title,
      alt: dto.alt ?? previous?.alt ?? '',
      tags: dto.tags ?? (previous?.tags as string[]) ?? [],
      width: dto.width ?? (Number(previous?.width || 0) || 0),
      height: dto.height ?? (Number(previous?.height || 0) || 0),
      source: (dto.source as Record<string, unknown>) || (previous?.source as Record<string, unknown>) || null,
      createdAt: (previous?.createdAt as string) || new Date().toISOString(),
    });
    await this.write(
      `${relative}.sari.json`,
      JSON.stringify(
        {
          ...summary,
          version,
          editable: inline || stateFile ? { format: dto.format || 'fabric', inline: inline ?? null, file: stateFile } : (previous?.editable ?? null),
          render: { png: this.urlFor(relative), svg: '', webp: '' },
          history: [...(((previous?.history as unknown[]) || []) as unknown[]), ...(written.length ? [{ file: written[0], version, at: new Date().toISOString() }] : [])].slice(-20),
        },
      ),
    );
    written.push(relative, `${relative}.sari.json`);
    return { asset: summary, file: relative, url: summary.url, version, written };
  }

  /**
   * Corrige une fiche — titre, légende, étiquettes, dimensions. C'est ce que le
   * `PATCH /api/admin/upload` historique ne savait pas faire (il ne savait que
   * renommer), d'où un champ « titre » saisi en pure perte dans la médiathèque.
   */
  async patchAsset(dto: AssetPatchDto): Promise<{ asset: GedAssetSummary; file: string; url: string }> {
    const relative = this.ref(dto.file);
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    if (!(await this.statOrNull(relative))) throw new NotFoundException(`Fichier absent : ${relative}`);
    const current = (await this.readJson<Record<string, unknown>>(`${relative}.sari.json`)) || {};
    const next: Record<string, unknown> = {
      ...current,
      file: relative,
      title: dto.title ?? current.title ?? '',
      alt: dto.alt ?? current.alt ?? '',
      tags: dto.tags ?? (current.tags as string[]) ?? [],
      width: dto.width ?? (Number(current.width || 0) || 0),
      height: dto.height ?? (Number(current.height || 0) || 0),
      updatedAt: new Date().toISOString(),
    };
    await this.write(`${relative}.sari.json`, JSON.stringify(next));
    const asset = await this.decorate(relative, next);
    return { asset, file: relative, url: asset.url };
  }

  /** Renomme un asset, sa fiche à côté et son état éditable — l'URL suit le fichier. */
  async renameAsset(dto: RenameAssetDto): Promise<{ file: string; url: string }> {
    const relative = this.ref(dto.file);
    const targetName = path.basename(String(dto.newName || ''));
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    if (!targetName || targetName === '.' || targetName === '..') throw new BadRequestException(`Nom de fichier refusé : ${dto.newName}`);
    if (!(await this.statOrNull(relative))) throw new NotFoundException(`Fichier absent : ${relative}`);
    // On renomme en place : le dossier du fichier est celui du disque, pas celui que
    // le nom laisserait deviner.
    const folder = relative.includes('/') ? `${relative.split('/').slice(0, -1).join('/')}/` : '';
    const target = `${folder}${targetName}`;
    if (target === relative) return { file: relative, url: this.urlFor(relative) };
    if (await this.statOrNull(target)) throw new ConflictException('Un fichier porte déjà ce nom.');
    await fs.rename(this.resolve(relative), this.resolve(target));
    const manifest = await this.readJson<Record<string, unknown>>(`${relative}.sari.json`);
    await fs.rm(this.resolve(`${relative}.sari.json`), { force: true });
    if (manifest) {
      const editable = manifest.editable as { file?: string; inline?: unknown } | undefined;
      if (editable?.file && !editable.inline) {
        const nextState = `${target.replace(/\.[^.]+$/, '')}.sari.canvas.json`;
        await fs.rename(this.resolve(editable.file), this.resolve(nextState)).catch(() => undefined);
        manifest.editable = { ...editable, file: nextState };
      }
      await this.write(`${target}.sari.json`, JSON.stringify({ ...manifest, file: target }));
    }
    return { file: target, url: this.urlFor(target) };
  }

  /** Supprime un asset et ses fichiers d'à-côté ; `history=1` emporte aussi les versions. */
  async deleteAsset(file: string, purgeHistory = false): Promise<{ removed: string[]; file: string }> {
    const relative = this.ref(file);
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    const removed: string[] = [];
    const manifest = await this.readJson<{ history?: Array<{ file?: string }>; editable?: { file?: string } }>(`${relative}.sari.json`);
    if (await this.statOrNull(relative)) {
      await fs.rm(this.resolve(relative), { force: true });
      removed.push(relative);
    }
    if (!(await this.statOrNull(relative)) && !manifest) throw new NotFoundException(`Fichier absent : ${relative}`);
    await fs.rm(this.resolve(`${relative}.sari.json`), { force: true });
    if (manifest?.editable?.file) {
      await fs.rm(this.resolve(manifest.editable.file), { force: true }).catch(() => undefined);
      removed.push(manifest.editable.file);
    }
    if (purgeHistory) {
      for (const entry of manifest?.history || []) {
        if (!entry?.file) continue;
        await fs.rm(this.resolve(entry.file), { force: true }).catch(() => undefined);
        await fs.rm(this.resolve(`${entry.file}.sari.json`), { force: true }).catch(() => undefined);
        removed.push(entry.file);
      }
    }
    return { removed, file: relative };
  }

  /** Attache un état éditable à un asset existant, sans toucher au rendu. */
  async writeState(dto: WriteStateDto): Promise<{ file: string; stateFile: string | null; inlined: boolean }> {
    const relative = this.ref(dto.file);
    if (!relative) throw new BadRequestException('Paramètre manquant : file.');
    if (!(await this.statOrNull(relative))) throw new NotFoundException(`Aucun asset à relier : ${relative}`);
    const manifest = (await this.readJson<Record<string, unknown>>(`${relative}.sari.json`)) || { file: relative };
    const text = JSON.stringify(dto.state ?? null);
    let inline: unknown | null = dto.state ?? null;
    let stateFile: string | null = null;
    if (text.length > MAX_INLINE_STATE) {
      stateFile = `${relative.replace(/\.[^.]+$/, '')}.sari.canvas.json`;
      await this.write(stateFile, text);
      inline = null;
    }
    const next = {
      ...manifest,
      editable: { format: dto.format === 'svg' ? 'svg' : 'fabric', inline, file: stateFile },
      updatedAt: new Date().toISOString(),
    };
    await this.write(`${relative}.sari.json`, JSON.stringify(next));
    return { file: relative, stateFile, inlined: !stateFile };
  }

  /* ------------------------------------------------------------------ gabarits */

  /** La racine des gabarits — `public/canvas`, le même arbre que côté interface. */
  get templateRoot(): string {
    const fromEnv = this.config.get<string>('GED_CANVAS_DIR');
    return fromEnv && fromEnv.trim() ? path.resolve(fromEnv.trim()) : path.resolve(process.cwd(), '..', 'public', 'canvas');
  }

  private templateTarget(relative: string): string {
    const clean = String(relative || '')
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/?canvas\//, '')
      .replace(/^\/+/, '')
      .split('?')[0];
    const target = path.resolve(this.templateRoot, ...clean.split(/[\\/]+/).filter((part) => part && part !== '.'));
    if (target !== this.templateRoot && !target.startsWith(this.templateRoot + path.sep)) {
      throw new BadRequestException(`Chemin hors des gabarits : ${relative}`);
    }
    return target;
  }

  private async readTemplateIndex(): Promise<{ version: number; templates: Record<string, unknown>[] }> {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(this.templateRoot, 'templates', 'index.json'), 'utf8')) as { version?: number; templates?: Record<string, unknown>[] };
      if (Array.isArray(raw?.templates)) return { version: Number(raw.version || 1), templates: raw.templates };
    } catch {
      /* pas d'index : catalogue vide, les fichiers restent exploitables */
    }
    return { version: 1, templates: [] };
  }

  /**
   * Le catalogue des gabarits, recalé sur le disque : `public/canvas/templates/` est
   * suivi par git, sert de charte livrée, et n'a donc pas besoin d'une table.
   */
  async listTemplates(): Promise<{ version: number; templates: Record<string, unknown>[] }> {
    const catalog = await this.readTemplateIndex();
    const files = await fs.readdir(path.join(this.templateRoot, 'templates')).catch(() => [] as string[]);
    const present = new Set(files.filter((name) => name.endsWith('.json') && name !== 'index.json'));
    return {
      version: catalog.version,
      templates: catalog.templates
        .filter((entry) => present.has(`${entry.id}.json`) || present.has(path.basename(String(entry.file || ''))))
        .map((entry) => ({ ...entry, file: entry.file || `templates/${entry.id}.json` })),
    };
  }

  async readTemplate(id: string): Promise<{ meta: Record<string, unknown>; template: Record<string, unknown> }> {
    const catalog = await this.listTemplates();
    const wanted = String(id || '').replace(/\.json$/i, '');
    const entry = catalog.templates.find((template) => template.id === wanted);
    if (!entry) throw new NotFoundException(`Gabarit inconnu : ${id}`);
    try {
      const template = JSON.parse(await fs.readFile(this.templateTarget(String(entry.file)), 'utf8')) as Record<string, unknown>;
      return { meta: entry, template };
    } catch {
      throw new NotFoundException(`Fichier de gabarit illisible : ${entry.file}`);
    }
  }

  async saveTemplate(dto: TemplateUpsertDto): Promise<Record<string, unknown>> {
    const id = slugifyModule(dto.id);
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(dto.id || '')) || id !== dto.id) {
      throw new BadRequestException(`Identifiant de gabarit refusé : ${dto.id} (lettres minuscules, chiffres, tirets).`);
    }
    const folder = path.join(this.templateRoot, 'templates');
    await fs.mkdir(folder, { recursive: true });
    const file = `templates/${id}.json`;
    await fs.writeFile(path.join(folder, `${id}.json`), JSON.stringify({ id, ...(dto.template || {}) }, null, 2), 'utf8');
    const catalog = await this.readTemplateIndex();
    const existing = catalog.templates.find((entry) => entry.id === id) || {};
    const meta = {
      ...existing,
      ...(dto.meta || {}),
      id,
      title: dto.meta?.title || existing.title || id,
      file,
      version: dto.meta?.version != null ? Number(dto.meta.version) : Number(existing.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(folder, 'index.json'), JSON.stringify({ version: catalog.version + 1, templates: [...catalog.templates.filter((entry) => entry.id !== id), meta] }, null, 2), 'utf8');
    return meta;
  }

  async deleteTemplate(id: string): Promise<{ removed: string }> {
    const catalog = await this.readTemplateIndex();
    const entry = catalog.templates.find((template) => template.id === id);
    if (!entry) throw new NotFoundException(`Gabarit inconnu : ${id}`);
    await fs.rm(this.templateTarget(String(entry.file)), { force: true });
    await fs.writeFile(
      path.join(this.templateRoot, 'templates', 'index.json'),
      JSON.stringify({ version: catalog.version + 1, templates: catalog.templates.filter((template) => template.id !== id) }, null, 2),
      'utf8',
    );
    return { removed: String(entry.file) };
  }
}
