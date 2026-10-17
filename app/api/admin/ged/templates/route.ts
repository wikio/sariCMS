import { NextRequest, NextResponse } from 'next/server';
import { gedStore } from '@/lib/ged/store.mjs';
import { failure } from '@/lib/ged/http';

/**
 * /api/admin/ged/templates — le catalogue des gabarits de l'atelier.
 *
 * Les gabarits vivent dans `public/canvas/templates/` : un JSON Fabric par gabarit,
 * plus `index.json` pour les fiches. Ce choix, et non une table, tient à ce qu'un
 * gabarit est du code et non une donnée : il accompagne la charte livrée avec le
 * projet, se relit dans un diff, se déploie sans migration, et Next le sert déjà en
 * statique — un client peut donc charger `story-ete.json` directement, sans API.
 *
 * L'écriture reste nécessaire (`POST`, `DELETE`) pour qu'un atelier puisse publier le
 * canvas courant comme gabarit réutilisable : il écrit le fichier sous `public/canvas`
 * et recale l'index, au lieu de déposer un énième asset dans la GED.
 */

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const { meta, template } = await gedStore.readTemplate(String(id));
      return NextResponse.json({ meta, template });
    }
    return NextResponse.json(await gedStore.listTemplates());
  } catch (error) {
    return failure(error, 'Catalogue des gabarits indisponible');
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps attendu : JSON.' }, { status: 400 });
  }
  if (!body.id || !body.template) {
    return NextResponse.json({ error: 'Paramètres attendus : id, template.' }, { status: 400 });
  }
  try {
    const meta = await gedStore.saveTemplate({ id: String(body.id), meta: body.meta as never, template: body.template });
    return NextResponse.json({ meta }, { status: 201 });
  } catch (error) {
    return failure(error, 'Publication du gabarit impossible');
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Paramètre manquant : id.' }, { status: 400 });
  try {
    return NextResponse.json(await gedStore.deleteTemplate(String(id)));
  } catch (error) {
    return failure(error, 'Suppression du gabarit impossible');
  }
}
