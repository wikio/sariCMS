// app/api/admin/translations/file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.join(process.cwd(), 'translate');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'fr';
  const filePath = searchParams.get('path');
  
  if (!filePath) {
    return NextResponse.json(
      { error: 'Paramètre path manquant' },
      { status: 400 }
    );
  }
  
  try {
    const fullPath = path.join(TRANSLATIONS_DIR, locale, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const data = JSON.parse(content);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erreur lecture fichier:', error);
    return NextResponse.json(
      { error: 'Fichier non trouvé' },
      { status: 404 }
    );
  }
}