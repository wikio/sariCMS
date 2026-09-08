// app/api/admin/translations/tree/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const TRANSLATIONS_DIR = path.join(process.cwd(), 'translate');

interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  path?: string;
  children?: TreeNode[];
}

// Fonction récursive pour scanner un dossier
async function scanDirectory(dir: string, basePath: string = ''): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Trier : dossiers d'abord, puis fichiers
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Un même nom de namespace peut exister deux fois au même étage : `admin.json`
    // (le fichier plat) et `admin/` (le dossier détaillé) cohabitent dans
    // `translate/fr`. L'`id` d'un nœud sert de clé React et de mémoire de sélection ;
    // en retirant `.json` aux fichiers, les deux naissaient sous l'`id` `admin`, et
    // React prévenait « Encountered two children with the same key ». Un fichier garde
    // donc son extension dans son `id` — et dans son libellé quand le conflit existe,
    // pour que les deux lignes se distinguent à l'écran.
    const folders = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
    // Sous Windows, `path.join` sépare avec un antislash : les identifiants sont rendus
    // avec des `/`, sinon le même arbre change de clés selon la machine qui l'a écrit.
    const toId = (p: string) => p.split(path.sep).join('/');

    for (const entry of sortedEntries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = toId(path.join(basePath, entry.name));

      if (entry.isDirectory()) {
        // Dossier
        const children = await scanDirectory(fullPath, relativePath);
        nodes.push({
          id: relativePath,
          label: entry.name,
          type: 'folder',
          children
        });
      } else if (entry.name.endsWith('.json')) {
        // Fichier JSON
        const stem = entry.name.replace(/\.json$/, '');
        nodes.push({
          id: relativePath,
          label: folders.has(stem) ? entry.name : stem,
          type: 'file',
          path: relativePath
        });
      }
    }
  } catch (error) {
    console.error(`Erreur scan dossier ${dir}:`, error);
  }
  
  return nodes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') || 'fr';
  
  try {
    const localeDir = path.join(TRANSLATIONS_DIR, locale);
    
    // Vérifier que le dossier existe
    await fs.access(localeDir);
    
    // Scanner récursivement
    const tree = await scanDirectory(localeDir);
    
    return NextResponse.json({
      locale,
      tree,
      success: true
    });
  } catch (error) {
    console.error('Erreur lecture arborescence:', error);
    return NextResponse.json(
      { 
        locale,
        tree: [],
        success: false,
        error: 'Dossier non trouvé'
      },
      { status: 404 }
    );
  }
}