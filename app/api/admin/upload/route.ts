import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, rename, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isManifestFile } from '@/lib/ged/prefix.mjs';
import { isStateFile } from '@/lib/ged/manifest.mjs';
import { bufferFromDataUrl, extensionFromDataUrl } from '@/lib/ged/http';
import { gedStore } from '@/lib/ged/store.mjs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * Les fichiers d'à-côté écrits par `lib/ged/store.mjs` — la fiche `.sari.json` et
 * l'état éditable `.sari.canvas.json` — ne sont pas des assets. La boucle ci-dessous
 * traite tout ce qui n'est pas un dossier comme un média : sans ce filtre, un
 * recadrage sauvegardé depuis l'atelier ferait apparaître deux « images » de plus
 * dans la médiathèque, et `GedPicker` proposerait un JSON en miniature.
 */
function isSidecar(name: string): boolean {
  return isManifestFile(name) || isStateFile(name);
}

/**
 * Génère un ID unique sans dépendance externe
 */
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Génère un nom de fichier unique avec le format: module_id_slug.ext
 * Ex: solution_2_cardiologie.jpg, product_1_echographe.png
 */
function generateFileName(module: string, id: string | number, slug: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  
  return `${module}_${id}_${cleanSlug}${ext}`;
}

/**
 * Obtient le chemin du dossier pour un module
 * Ex: /public/uploads/solution/, /public/uploads/product/, etc.
 */
function getModuleDir(module: string): string {
  return path.join(UPLOAD_DIR, module);
}

/**
 * GET /api/admin/upload
 * Liste tous les fichiers uploadés (racine + sous-dossiers)
 */
export async function GET() {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const files: any[] = [];
    
    // Parcourir tous les éléments (fichiers et dossiers)
    const items = await readdir(UPLOAD_DIR);
    for (const item of items) {
      if (item.startsWith('.')) continue;
      
      const itemPath = path.join(UPLOAD_DIR, item);
      const stats = await stat(itemPath);
      
      if (stats.isDirectory()) {
        // C'est un sous-dossier (module)
        const module = item;
        const moduleFiles = await readdir(itemPath);
        for (const file of moduleFiles) {
          if (file.startsWith('.') || isSidecar(file)) continue;

          const parts = file.split('_');
          const id = parts[1] || '';
          const nameWithExt = parts.slice(2).join('_');
          const name = nameWithExt.replace(/\.[^/.]+$/, '');
          const fileStats = await stat(path.join(itemPath, file));

          files.push({
            name: name || file,
            url: `/uploads/${module}/${file}`,
            file: `${module}/${file}`,
            originalName: file,
            label: name || file,
            module,
            id,
            size: fileStats.size,
            kind: /\.svg$/i.test(file) ? 'svg' : 'image',
            createdAt: (fileStats.birthtime || fileStats.mtime).toISOString(),
          });
        }
      } else if (stats.isFile() && !isSidecar(item)) {
        // C'est un fichier à la racine (ancien format, ou déposé à la main).
        // Le module n'est PAS déduit du premier segment du nom : un
        // `1787106474890-e4bafdda.jpg` n'a pas de module, et en inventer un
        // affichait une puce « 1787106474890-e4bafdda.jpg » sur la vignette.
        // L'URL, elle, reste `/uploads/<fichier>` : c'est le seul endroit où il est.
        const parts = item.split('_');
        const hasModule = parts.length >= 2 && /^[a-z][a-z0-9-]*$/i.test(parts[0]);
        const id = hasModule ? parts[1] || '' : '';
        const nameWithExt = hasModule ? parts.slice(2).join('_') : item;
        const name = nameWithExt.replace(/\.[^/.]+$/, '');
        const statsFile = await stat(itemPath);

        files.push({
          name: name || item,
          url: `/uploads/${item}`,
          file: item,
          originalName: item,
          label: name || item,
          module: hasModule ? parts[0] : 'ged',
          id,
          size: statsFile.size,
          kind: /\.svg$/i.test(item) ? 'svg' : 'image',
          createdAt: (statsFile.birthtime || statsFile.mtime).toISOString(),
          isLegacy: true, // Marquer comme ancien fichier
        });
      }
    }

    // Un même fichier ne doit jamais être listé deux fois (racine + dossier) : les
    // écrans qui clé sur l'URL perdraient leurs repères.
    const unique = new Map<string, (typeof files)[number]>();
    for (const entry of files) if (!unique.has(entry.url)) unique.set(entry.url, entry);

    return NextResponse.json({ files: [...unique.values()] });
  } catch (error) {
    console.error('[Upload API] GET error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

/**
 * POST /api/admin/upload
 * Upload un nouveau fichier
 */
export async function POST(request: NextRequest) {
  // Un corps JSON est une écriture depuis la retouche ou l'atelier : l'image est déjà
  // encodée (`dataUrl`), il n'y a pas de `FormData`. `components/admin/ImageEditor.tsx`
  // poste exactement cette forme depuis le début — sans cette branche, `formData()`
  // échouait et l'écran répondait « Sauvegarde impossible (image protégée ?) », ce qui
  // n'avait rien à voir avec une image protégée. Le multipart garde son chemin habituel.
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    return postFromJson(request);
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const module = formData.get('module') as string || 'ged';
    // L'identifiant sert de nom de fichier, pas de clé React ; il doit donc être unique
    // par nature. `Date.now()` seul en produisait deux au même milliseconde — et un
    // écran qui clé sur `id` se mettait à rater « Encountered two children with the
    // same key », avec des vignettes qui disparaissent ou se dupliquent.
    const id = formData.get('id') as string || `${Date.now()}-${generateUniqueId()}`;
    const slug = formData.get('slug') as string || generateUniqueId();
    const label = formData.get('label') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Créer le dossier du module s'il n'existe pas
    const moduleDir = getModuleDir(module);
    if (!existsSync(moduleDir)) {
      await mkdir(moduleDir, { recursive: true });
    }

    // Générer le nom de fichier
    const fileName = generateFileName(module, id, slug, file.name);
    const filePath = path.join(moduleDir, fileName);

    // Lire et sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const url = `/uploads/${module}/${fileName}`;

    // Une fiche n'est écrite que si l'appelant en demande une : un upload de
    // formulaire métier reste exactement ce qu'il était, fichiers seuls.
    const metadata = readMetadataFields(formData);
    if (metadata) {
      await gedStore.patchAsset({ file: `${module}/${fileName}`, ...metadata }).catch(() => undefined);
    }

    return NextResponse.json({
      url,
      file: `${module}/${fileName}`,
      originalName: file.name,
      label: label || fileName,
      module,
      id,
    });
  } catch (error) {
    console.error('[Upload API] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

/**
 * Écrit un fichier encodé, envoyé en JSON depuis la retouche ou l'atelier.
 *
 * `kind` et `prefix` sont transmis au magasin : c'est là que `IMG_` (image retouchée)
 * et `CANVA_` (planche) se décident, pas dans l'appelant — la règle de nommage reste
 * écrite à un seul endroit.
 */
async function postFromJson(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }

  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  const extension = String(body.extension || extensionFromDataUrl(dataUrl) || 'png').toLowerCase().replace(/^\./, '');
  const buffer = await bufferFromDataUrl(dataUrl, 30 * 1024 * 1024);
  if (!buffer) {
    return NextResponse.json({ error: 'Image illisible : dataUrl (base64) attendu.' }, { status: 400 });
  }

  const overwrite = body.overwrite ? String(body.overwrite) : body.file ? String(body.file) : '';
  // Une réédition écrit à côté de l'asset remplacé (y compris à la racine de
  // `public/uploads`) ; une création prend le module demandé, `ged` par défaut.
  const existingFolder = overwrite ? overwrite.replace(/^\/?uploads\//, '').split('/').slice(0, -1).join('/') : '';
  const folder = String(body.module || existingFolder || 'ged');
  const id = String(body.id || `${Date.now()}-${generateUniqueId()}`);
  // `filename` est le champ qu'envoie `components/admin/ImageEditor.tsx` depuis le
  // début, `name` celui de la GED : les deux se lisent, pour que le libellé d'un
  // recadrage ne retombe pas sur « retouche ».
  const name = String(body.name || body.filename || body.slug || 'retouche');

  try {
    const asset = await gedStore.saveAsset({
      kind: String(body.kind || 'image'),
      prefix: body.prefix ? String(body.prefix) : undefined,
      // `undefined` = racine : un `file` explicite sans dossier y reste, sinon le
      // module demandé (ou celui du fichier remplacé) décide du dossier.
      module: toRef(String(overwrite || '')).includes('/') || !overwrite ? folder : undefined,
      // Une réédition repart sur le nom de l'asset d'origine ; une création reprend la
      // convention `{module}_{id}_{slug}` déjà en vigueur dans ce dossier.
      file: overwrite ? toRef(overwrite) : undefined,
      // Une création garde la graine courte de la GED (`<slug>` — la route y ajoute
      // `<PRÉFIXE>_<graine>`) : `module_id_slug` complet, ici, produisait un nom à
      // rallonges où le module était écrit deux fois.
      name: overwrite ? undefined : slugifyName(name),
      extension,
      buffer,
      overwrite: overwrite ? toRef(overwrite) : undefined,
      manifest: {
        title: String(body.label || body.title || name).slice(0, 200),
        alt: String(body.alt || '').slice(0, 500),
        tags: Array.isArray(body.tags)
          ? body.tags.map(String)
          : String(body.tags || '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
        width: Number(body.width || 0) || 0,
        height: Number(body.height || 0) || 0,
        source: {
          origin: (['builder', 'atelier', 'media', 'import'] as const).includes(body.origin as never) ? (body.origin as never) : 'atelier',
          pageId: String(body.pageId ?? ''),
          pageSlug: String(body.pageSlug ?? ''),
          componentId: String(body.componentId ?? ''),
          field: String(body.field ?? ''),
        },
      },
    });
    return NextResponse.json({
      url: asset.url,
      file: asset.file,
      originalName: asset.name,
      label: asset.title,
      module: asset.module,
      id,
      version: asset.version,
      asset,
    });
  } catch (error) {
    console.error('[Upload API] POST (json) error:', error);
    return NextResponse.json(
      { error: 'Sauvegarde impossible.', detail: String(error instanceof Error ? error.message : error) },
      { status: 400 },
    );
  }
}

/** Une référence `module/fichier`, telle que la GED la note dans ses fiches. */
function toRef(value: string): string {
  return String(value || '').replace(/^\/?uploads\//, '').replace(/^\/+/, '');
}

/** Les champs de fiche admis en `multipart`, pour que la retouche puisse légender sans route dédiée. */
function readMetadataFields(formData: FormData) {
  const wanted = ['title', 'alt', 'tags', 'width', 'height'];
  if (!wanted.some((key) => formData.get(key))) return null;
  return {
    title: String(formData.get('title') || '').slice(0, 200) || undefined,
    alt: String(formData.get('alt') || '').slice(0, 500) || undefined,
    tags: String(formData.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 24),
    width: Number(formData.get('width') || 0) || undefined,
    height: Number(formData.get('height') || 0) || undefined,
  };
}

/** Le même nettoyage de nom que `generateFileName`, isolé pour l'écriture JSON. */
function slugifyName(value: string): string {
  const clean = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return clean || 'visuel';
}

/**
 * DELETE /api/admin/upload
 * Supprime un fichier
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file specified' }, { status: 400 });
    }

    // Le fichier peut être module/filename ou juste filename
    const filePath = path.join(UPLOAD_DIR, file);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await unlink(filePath);
    // La fiche et l'état éditable suivent le fichier : un manifeste orphelin
    // survivrait à l'asset et resurgirait au premier dépôt du même nom.
    await unlink(`${filePath}.sari.json`).catch(() => undefined);
    await unlink(`${filePath}.sari.canvas.json`).catch(() => undefined);

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('[Upload API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/upload
 * Renomme un fichier
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldFile, newFile } = body;

    if (!oldFile || !newFile) {
      return NextResponse.json({ error: 'Missing oldFile or newFile' }, { status: 400 });
    }

    // Les fichiers peuvent être module/filename ou juste filename
    const oldPath = path.join(UPLOAD_DIR, oldFile);
    const newPath = path.join(UPLOAD_DIR, newFile);

    if (!existsSync(oldPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (existsSync(newPath)) {
      return NextResponse.json({ error: 'New file name already exists' }, { status: 400 });
    }

    await rename(oldPath, newPath);

    // Extraire le module du chemin
    const module = oldFile.split('/')[0] || 'ged';
    const newFileName = newFile.split('/').pop() || newFile;

    return NextResponse.json({
      success: true,
      oldFile,
      newFile,
      url: `/uploads/${module}/${newFileName}`,
    });
  } catch (error) {
    console.error('[Upload API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}
