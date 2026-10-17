import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type MediaMeta = {
  file: string;
  url: string;
  originalName: string;
  module: string;
  label: string;
  createdAt: string;
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

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (8 Mo)' }, { status: 400 });
  }
  const ext = path.extname(file.name || '').toLowerCase() || '.bin';
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.svg'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Type non autorisé' }, { status: 400 });
  }
  await fs.mkdir(dir(), { recursive: true });
  const stored = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir(), stored), buf);
  const item: MediaMeta = {
    file: stored,
    url: `/uploads/${stored}`,
    originalName: file.name,
    module: String(form.get('module') || 'ged'),
    label: String(form.get('label') || file.name),
    createdAt: new Date().toISOString(),
    size: file.size,
  };
  const meta = await readMeta();
  meta.unshift(item);
  await writeMeta(meta);
  return NextResponse.json(item);
}

export async function GET() {
  try {
    const files = (await fs.readdir(dir())).filter((f) => !f.startsWith('.') && f !== 'meta.json');
    const meta = await readMeta();
    const byFile = new Map(meta.map((m) => [m.file, m]));
    return NextResponse.json({
      files: files.map((f) => {
        const known = byFile.get(f);
        const item = known || {
          file: f,
          url: `/uploads/${f}`,
          originalName: f,
          module: 'inconnu',
          label: f,
          createdAt: '',
          size: 0,
        };
        return { ...item, name: item.label || item.originalName || item.file };
      }),
    });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
