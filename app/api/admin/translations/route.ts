// app/api/admin/translations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.join(process.cwd(), 'translate');
const ALLOWED_LOCALES = ['fr', 'en', 'ar'];

// ✅ Sécuriser le chemin pour empêcher le directory traversal
function sanitizePath(inputPath: string): string {
  const normalized = path.normalize(inputPath);
  if (normalized.includes('..')) {
    throw new Error('Invalid path');
  }
  return normalized;
}

// ✅ Récupérer tous les fichiers JSON récursivement
async function getAllFiles(dir: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.json')) {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error('Erreur lecture dossier:', error);
  }
  
  return files;
}

// ✅ GET : Lister l'arborescence ou lire un fichier spécifique
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'fr';
  const filePath = searchParams.get('path');

  // Validation de la locale
  if (!ALLOWED_LOCALES.includes(locale)) {
    return NextResponse.json(
      { error: 'Locale non valide' },
      { status: 400 }
    );
  }

  try {
    const localeDir = path.join(TRANSLATIONS_DIR, locale);
    
    // Vérifier que le dossier existe
    await fs.access(localeDir);

    if (filePath) {
      // ✅ Lire un fichier spécifique
      const sanitizedPath = sanitizePath(filePath);
      const fullPath = path.join(localeDir, sanitizedPath);
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);
      
      return NextResponse.json(data);
    } else {
      // ✅ Lister tous les fichiers
      const files = await getAllFiles(localeDir, localeDir);
      
      // Organiser par catégorie
      const structure = {
        root: files.filter(f => !f.includes('/')),
        pages: files.filter(f => f.startsWith('pages/')),
        components: {
          cards: files.filter(f => f.startsWith('components/cards/')),
          sections: files.filter(f => f.startsWith('components/sections/')),
          layout: files.filter(f => f.startsWith('components/layout/')),
        }
      };
      
      return NextResponse.json({
        locale,
        files,
        structure
      });
    }
  } catch (error) {
    console.error('Erreur GET:', error);
    return NextResponse.json(
      { error: 'Fichier ou dossier non trouvé', details: (error as Error).message },
      { status: 404 }
    );
  }
}

// ✅ PUT : Écrire un fichier
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, path: filePath, content } = body;

    // Validation
    if (!locale || !filePath || !content) {
      return NextResponse.json(
        { error: 'Paramètres manquants (locale, path, content)' },
        { status: 400 }
      );
    }

    if (!ALLOWED_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: 'Locale non valide' },
        { status: 400 }
      );
    }

    const sanitizedPath = sanitizePath(filePath);
    const fullPath = path.join(TRANSLATIONS_DIR, locale, sanitizedPath);
    
    // Créer le dossier s'il n'existe pas
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Écrire le fichier
    await fs.writeFile(fullPath, JSON.stringify(content, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      message: 'Fichier sauvegardé',
      path: filePath 
    });
  } catch (error) {
    console.error('Erreur PUT:', error);
    return NextResponse.json(
      { error: 'Erreur sauvegarde', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// ✅ DELETE : Supprimer un fichier
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale');
  const filePath = searchParams.get('path');

  if (!locale || !filePath) {
    return NextResponse.json(
      { error: 'Paramètres manquants' },
      { status: 400 }
    );
  }

  try {
    const sanitizedPath = sanitizePath(filePath);
    const fullPath = path.join(TRANSLATIONS_DIR, locale, sanitizedPath);
    
    await fs.unlink(fullPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE:', error);
    return NextResponse.json(
      { error: 'Erreur suppression' },
      { status: 500 }
    );
  }
}