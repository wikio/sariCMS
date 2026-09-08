// app/api/admin/translations/file/route.ts
/**
 * Le fichier d'un écran, lu et enregistré par l'atelier de traduction.
 *
 * La logique est ailleurs (`lib/translate-store.ts`) parce qu'un enregistrement ne
 * vaut plus pour un seul fichier : il doit atteindre les messages que le site lit,
 * sinon l'écran sourit pour rien. Voir ce module pour le pourquoi du chemin.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  TranslationConflictError,
  TranslationPathError,
  readAtelierFile,
  resolveAtelierFile,
  saveAtelierFile,
} from '@/lib/translate-store';

function params(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return {
    locale: searchParams.get('locale') || 'fr',
    path: searchParams.get('path') || '',
  };
}

export async function GET(request: NextRequest) {
  const { locale, path: filePath } = params(request);
  if (!filePath) {
    return NextResponse.json({ error: 'Paramètre path manquant' }, { status: 400 });
  }
  try {
    return NextResponse.json(await readAtelierFile(resolveAtelierFile(locale, filePath)));
  } catch (error) {
    if (error instanceof TranslationPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
  }
}

export async function PUT(request: NextRequest) {
  const { locale, path: filePath } = params(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON attendu' }, { status: 400 });
  }

  let target;
  try {
    target = resolveAtelierFile(locale, filePath);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof TranslationPathError ? error.message : 'Chemin invalide' },
      { status: 400 },
    );
  }

  try {
    const outcome = await saveAtelierFile(target, body);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof TranslationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Erreur écriture fichier:', error);
    return NextResponse.json({ error: 'Écriture impossible' }, { status: 500 });
  }
}
