// app/api/admin/translations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TranslationConflictError,
  TranslationPathError,
  resolveAtelierFile,
  saveAtelierFile,
} from '@/lib/translate-store';

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

// PUT : écrire un fichier de l'atelier — par le même chemin que l'écran, pour que
// l'enregistrement atteigne aussi les messages que le site lit (`lib/translate-store.ts`).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, path: filePath, content } = body ?? {};

    if (!locale || !filePath || content === undefined) {
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

    const outcome = await saveAtelierFile(resolveAtelierFile(String(locale), String(filePath)), content);
    return NextResponse.json({
      success: true,
      message: outcome.synced.messages
        ? 'Fichier sauvegardé, messages à jour'
        : 'Fichier sauvegardé, mais les messages ne sont pas atteignables en écriture',
      ...outcome,
    });
  } catch (error) {
    if (error instanceof TranslationPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TranslationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Erreur PUT:', error);
    return NextResponse.json(
      { error: 'Erreur sauvegarde', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE : refusé, et c'est voulu.
//
// Un fichier de l'atelier n'est pas un dépôt de chaînes, c'est la vue d'une branche
// des `messages/`. Le supprimer ne désactiverait rien sur le site — les clés
// resteraient dans les messages — mais l'écran ne montrerait plus l'endroit où les
// retoucher, et `npm run intl:check` hurlerait juste après. Pour faire disparaître
// des chaînes de l'interface, c'est dans `messages/<locale>.json` qu'il faut les
// retirer, puis rejouer `npm run intl:sync`.
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Un fichier de l'atelier ne se supprime pas : il est la copie d'une branche des messages. " +
        'Retirez les clés de messages/<locale>.json, puis « npm run intl:sync ».',
    },
    { status: 409 }
  );
}

