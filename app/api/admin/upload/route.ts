import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

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
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, name), buf);
  return NextResponse.json({ url: `/uploads/${name}`, name: file.name, size: file.size });
}

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'uploads');
  try {
    const files = await fs.readdir(dir);
    return NextResponse.json({
      files: files
        .filter((f) => !f.startsWith('.'))
        .map((f) => ({ name: f, url: `/uploads/${f}` })),
    });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
