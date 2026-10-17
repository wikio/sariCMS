import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, rename, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

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
          if (file.startsWith('.')) continue;
          
          const parts = file.split('_');
          const id = parts[1] || '';
          const nameWithExt = parts.slice(2).join('_');
          const name = nameWithExt.replace(/\.[^/.]+$/, '');
          
          files.push({
            name: name || file,
            url: `/uploads/${module}/${file}`,
            file: `${module}/${file}`,
            originalName: file,
            label: name || file,
            module,
            id,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (stats.isFile()) {
        // C'est un fichier à la racine (ancien format)
        const parts = item.split('_');
        const module = parts[0] || 'ged';
        const id = parts[1] || '';
        const nameWithExt = parts.slice(2).join('_');
        const name = nameWithExt.replace(/\.[^/.]+$/, '');
        
        files.push({
          name: name || item,
          url: `/uploads/${item}`,
          file: item,
          originalName: item,
          label: name || item,
          module: module,
          id,
          createdAt: new Date().toISOString(),
          isLegacy: true, // Marquer comme ancien fichier
        });
      }
    }

    return NextResponse.json({ files });
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
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const module = formData.get('module') as string || 'ged';
    const id = formData.get('id') as string || Date.now().toString();
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
