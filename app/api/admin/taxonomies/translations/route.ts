// app/api/admin/taxonomies/translations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const ALLOWED_LOCALES = ['fr', 'en', 'ar'];

/**
 * PUT: Mettre à jour une traduction option_{value} dans messages/{locale}.json
 * 
 * Body attendu:
 * {
 *   "locale": "fr" | "en" | "ar",
 *   "value": "Diagnostic",
 *   "translation": "تشخيص"
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, value, translation } = body;

    // Validation
    if (!locale || !value || translation === undefined) {
      return NextResponse.json(
        { error: 'Paramètres manquants (locale, value, translation)' },
        { status: 400 }
      );
    }

    if (!ALLOWED_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: 'Locale non valide' },
        { status: 400 }
      );
    }

    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    
    // Lire le fichier
    let data: any;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      data = JSON.parse(content);
    } catch (error) {
      return NextResponse.json(
        { error: 'Fichier de traduction non trouvé', locale },
        { status: 404 }
      );
    }

    // Mettre à jour la clé option_{value}
    const optionKey = `option_${value}`;
    
    // S'assurer que la structure admin.editor existe
    if (!data.admin) data.admin = {};
    if (!data.admin.editor) data.admin.editor = {};
    
    data.admin.editor[optionKey] = translation;

    // Écrire le fichier
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      message: 'Traduction sauvegardée',
      locale,
      key: optionKey,
      translation
    });
  } catch (error) {
    console.error('Erreur PUT taxonomies/translations:', error);
    return NextResponse.json(
      { error: 'Erreur sauvegarde', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST: Mettre à jour plusieurs traductions d'un coup
 * 
 * Body attendu:
 * {
 *   "value": "Diagnostic",
 *   "translations": {
 *     "fr": "Diagnostic",
 *     "en": "Diagnostic",
 *     "ar": "تشخيص"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { value, translations } = body;

    if (!value || !translations || typeof translations !== 'object') {
      return NextResponse.json(
        { error: 'Paramètres manquants (value, translations)' },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Mettre à jour chaque locale
    for (const [locale, translation] of Object.entries(translations)) {
      if (!ALLOWED_LOCALES.includes(locale)) {
        errors.push({ locale, error: 'Locale non valide' });
        continue;
      }

      if (typeof translation !== 'string') {
        errors.push({ locale, error: 'Traduction doit être une chaîne' });
        continue;
      }

      try {
        const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
        
        // Lire le fichier
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Mettre à jour la clé
        const optionKey = `option_${value}`;
        if (!data.admin) data.admin = {};
        if (!data.admin.editor) data.admin.editor = {};
        
        data.admin.editor[optionKey] = translation;

        // Écrire le fichier
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

        results.push({ locale, key: optionKey, translation });
      } catch (error) {
        errors.push({ locale, error: (error as Error).message });
      }
    }

    return NextResponse.json({ 
      success: errors.length === 0,
      updated: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Erreur POST taxonomies/translations:', error);
    return NextResponse.json(
      { error: 'Erreur sauvegarde', details: (error as Error).message },
      { status: 500 }
    );
  }
}
