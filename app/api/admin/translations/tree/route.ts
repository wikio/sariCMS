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
    
    for (const entry of sortedEntries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
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
        const id = relativePath.replace(/\\/g, '/').replace('.json', '');
        nodes.push({
          id,
          label: entry.name.replace('.json', ''),
          type: 'file',
          path: relativePath.replace(/\\/g, '/')
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