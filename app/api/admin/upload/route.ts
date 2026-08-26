import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, rename } from 'fs/promises';
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
 * GET /api/admin/upload
 * Liste tous les fichiers uploadés
 */
export async function GET() {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const files = await readdir(UPLOAD_DIR);
    const fileList = files
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const parts = f.split('_');
        const module = parts[0] || 'unknown';
        const id = parts[1] || '';
        const nameWithExt = parts.slice(2).join('_');
        const name = nameWithExt.replace(/\.[^/.]+$/, '');
        
        return {
          name: name || f,
          url: `/uploads/${f}`,
          file: f,
          originalName: f,
          label: name || f,
          module,
          id,
          createdAt: new Date().toISOString(),
        };
      });

    return NextResponse.json({ files: fileList });
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
    const slug = formData.get('slug') as string || uuidv4().substring(0, 8);
    const label = formData.get('label') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Créer le dossier uploads s'il n'existe pas
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Générer le nom de fichier
    const fileName = generateFileName(module, id, slug, file.name);
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Lire et sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const url = `/uploads/${fileName}`;

    return NextResponse.json({
      url,
      file: fileName,
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

    const oldPath = path.join(UPLOAD_DIR, oldFile);
    const newPath = path.join(UPLOAD_DIR, newFile);

    if (!existsSync(oldPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (existsSync(newPath)) {
      return NextResponse.json({ error: 'New file name already exists' }, { status: 400 });
    }

    await rename(oldPath, newPath);

    return NextResponse.json({
      success: true,
      oldFile,
      newFile,
      url: `/uploads/${newFile}`,
    });
  } catch (error) {
    console.error('[Upload API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}
