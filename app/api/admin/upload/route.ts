import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

export type MediaMeta = {
  file: string;
  url: string;
  originalName: string;
  module: string;
  label: string;
  title?: string;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
  size: number;
};

function dir() {
  return path.join(process.cwd(), 'public', 'uploads');
}

function metaPath() {
  return path.join(dir(), 'meta.json');
}

async function readMeta(): Promise<MediaMeta[]> {
  try {
    const raw = await fs.readFile(metaPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMeta(rows: MediaMeta[]) {
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(metaPath(), JSON.stringify(rows, null, 2));
}

const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.svg'];

/** Nom de fichier sûr (accents retirés, caractères spéciaux → « - »). */
function safeBase(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function fileExists(name: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir(), name));
    return true;
  } catch {
    return false;
  }
}

/** Retourne un nom de fichier libre (incrémenté si collision). */
async function uniqueName(base: string, ext: string): Promise<string> {
  let candidate = `${base}${ext}`;
  let i = 2;
  while (await fileExists(candidate)) {
    candidate = `${base}-${i}${ext}`;
    i += 1;
  }
  return candidate;
}

function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);/.exec(dataUrl);
  return m ? m[1] : '';
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

// ---------------------------------------------------------------------------
// POST — deux modes :
//   • multipart/form-data : upload de fichier
//   • application/json     : { dataUrl, filename?, module?, title?, category? }
//     → enregistre une image produite par l'éditeur (canvas)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return saveImage(await req.json().catch(() => null));
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (8 Mo)' }, { status: 400 });
  }
  const ext = path.extname(file.name || '').toLowerCase() || '.bin';
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: 'Type non autorisé' }, { status: 400 });
  }
  await fs.mkdir(dir(), { recursive: true });

  const base = safeBase(file.name.replace(/\.[^.]+$/, '')) || 'fichier';
  const stored = await uniqueName(base, ext);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir(), stored), buf);

  const now = new Date().toISOString();
  const item: MediaMeta = {
    file: stored,
    url: `/uploads/${stored}`,
    originalName: file.name,
    module: String(form.get('module') || 'ged'),
    label: String(form.get('label') || file.name),
    title: form.get('title') ? String(form.get('title')) : undefined,
    description: form.get('description') ? String(form.get('description')) : undefined,
    category: form.get('category') ? String(form.get('category')) : undefined,
    createdAt: now,
    updatedAt: now,
    size: file.size,
  };
  const meta = await readMeta();
  meta.unshift(item);
  await writeMeta(meta);
  return NextResponse.json(item);
}

async function saveImage(payload: { dataUrl?: string; filename?: string; module?: string; title?: string; category?: string } | null) {
  if (!payload?.dataUrl) {
    return NextResponse.json({ error: 'dataUrl manquant' }, { status: 400 });
  }
  const mime = mimeFromDataUrl(payload.dataUrl);
  const ext = EXT_BY_MIME[mime] || '.png';
  const base = safeBase((payload.filename || 'image').replace(/\.[^.]+$/, '')) || 'image';
  const stored = await uniqueName(base, ext);

  const buf = Buffer.from(payload.dataUrl.replace(/^data:[^,]+,/, ''), 'base64');
  if (buf.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image trop volumineuse (8 Mo)' }, { status: 400 });
  }
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), stored), buf);

  const now = new Date().toISOString();
  const item: MediaMeta = {
    file: stored,
    url: `/uploads/${stored}`,
    originalName: `${base}${ext}`,
    module: payload.module || 'ged',
    label: `${base}${ext}`,
    title: payload.title || undefined,
    category: payload.category || undefined,
    createdAt: now,
    updatedAt: now,
    size: buf.length,
  };
  const meta = await readMeta();
  meta.unshift(item);
  await writeMeta(meta);
  return NextResponse.json(item);
}

// ---------------------------------------------------------------------------
// GET — liste (filtres module / catégorie optionnels)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const qModule = req.nextUrl.searchParams.get('module') || '';
    const qCategory = req.nextUrl.searchParams.get('category') || '';
    const files = (await fs.readdir(dir())).filter((f) => !f.startsWith('.') && f !== 'meta.json');
    const meta = await readMeta();
    const byFile = new Map(meta.map((m) => [m.file, m]));
    const items = files
      .map((f) => {
        const known = byFile.get(f);
        const item = known || {
          file: f,
          url: `/uploads/${f}`,
          originalName: f,
          module: 'inconnu',
          label: f,
          createdAt: '',
          size: 0,
        } as MediaMeta;
        return { ...item, name: item.title || item.label || item.originalName || item.file };
      })
      .filter((item) => {
        if (qModule && item.module !== qModule) return false;
        if (qCategory && item.category !== qCategory) return false;
        return true;
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return NextResponse.json({ files: items });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

// ---------------------------------------------------------------------------
// PATCH — métadonnées + renommage :
//   { file, label?, title?, description?, category?, module? }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.file) return NextResponse.json({ error: 'file manquant' }, { status: 400 });

  const meta = await readMeta();
  const idx = meta.findIndex((m) => m.file === body.file);
  if (idx < 0) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });

  const item = { ...meta[idx] };
  const updates: Partial<MediaMeta> = {};

  // Renommage du fichier (physique) si le label change.
  if (typeof body.label === 'string' && body.label.trim() && body.label.trim() !== item.label) {
    const ext = path.extname(item.file);
    const newBase = safeBase(body.label.trim().replace(/\.[^.]+$/, '')) || 'fichier';
    const newFile = await uniqueName(newBase, ext);
    try {
      await fs.rename(path.join(dir(), item.file), path.join(dir(), newFile));
    } catch {
      return NextResponse.json({ error: 'Renommage impossible' }, { status: 500 });
    }
    updates.file = newFile;
    updates.url = `/uploads/${newFile}`;
    updates.label = body.label.trim();
  } else if (typeof body.label === 'string') {
    updates.label = body.label;
  }

  if ('title' in body) updates.title = body.title ? String(body.title) : undefined;
  if ('description' in body) updates.description = body.description ? String(body.description) : undefined;
  if ('category' in body) updates.category = body.category ? String(body.category) : undefined;
  if ('module' in body && body.module) updates.module = String(body.module);

  updates.updatedAt = new Date().toISOString();
  meta[idx] = { ...item, ...updates };
  await writeMeta(meta);
  return NextResponse.json(meta[idx]);
}

// ---------------------------------------------------------------------------
// DELETE — suppression d'un fichier : ?file=nom ou { file }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get('file');
  let name = fromQuery;
  if (!name) {
    const body = await req.json().catch(() => null);
    name = body?.file;
  }
  if (!name) return NextResponse.json({ error: 'file manquant' }, { status: 400 });

  try {
    await fs.unlink(path.join(dir(), name));
  } catch {
    // déjà absent
  }
  const meta = await readMeta();
  await writeMeta(meta.filter((m) => m.file !== name));
  return NextResponse.json({ deleted: true });
}
