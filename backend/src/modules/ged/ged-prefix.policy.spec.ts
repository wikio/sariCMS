import { readFileSync } from 'fs';
import * as path from 'path';
import {
  buildAssetName,
  WRITABLE_EXTENSIONS,
  isWritableExtension,
  kindOfPrefix,
  moduleForKind,
  parseAssetName,
  prefixForKind,
  PREFIX_TABLE,
  slugifyModule,
} from './ged-prefix.policy';

/**
 * La politique de nommage, et le cordon qui la rattache à sa source.
 *
 * La table vit d'abord dans `lib/ged/prefix.mjs`, en JavaScript nu, pour que le
 * back-office Next, l'atelier et un script Node la lisent sans transpilateur. `nest
 * build` (`rootDir: ./src`) ne peut pas l'avaler, donc le backend en porte une copie —
 * et une copie sans garde-fou dérive. Ce test est ce garde-fou : il relit le fichier du
 * frontend et compare.
 *
 * Il compare par texte, pas par import : `import()` d'un `.mjs` hors de `src` depuis un
 * test CJS ne marche pas, et un parser complet serait plus de code que la règle.
 */
describe('politique de préfixes GED', () => {
  const table = (kind: string) => PREFIX_TABLE[kind];

  it('attache chaque type connu à son préfixe et à son dossier', () => {
    expect(table('canvas')).toMatchObject({ prefix: 'CANVA_', module: 'canvas' });
    // Les dossiers viennent de la table de l'interface, pas d'un goût du moment :
    // `image`, `svg` et `doc` partagent le module historique des médias.
    expect(table('image')).toMatchObject({ prefix: 'IMG_', module: 'ged' });
    expect(table('svg')).toMatchObject({ prefix: 'SVG_', module: 'ged' });
    expect(table('doc')).toMatchObject({ prefix: 'DOC_', module: 'ged' });
  });

  it('laisse un type inconnu devenir son propre dossier et son propre préfixe', () => {
    // C'est la clause d'extensibilité du besoin : ajouter un type ne demande ni
    // migration ni retouche de schéma.
    expect(prefixForKind('audio')).toBe('AUDIO_');
    expect(moduleForKind('audio')).toBe('audio');
    expect(buildAssetName('audio', { name: 'Extrait Court', stamp: 'abc' }).file).toBe('AUDIO_abc_extrait-court.mp3'.replace('mp3', 'png'));
  });

  it('nettoie un libellé avec accents, ponctuation et espaces', () => {
    const built = buildAssetName('canvas', { name: '  L’Affiche Été — 2026 !!  ', stamp: 'm1z0', extension: 'png' });
    expect(built.file).toBe('CANVA_m1z0_l-affiche-ete-2026.png');
    expect(built.module).toBe('canvas');
  });

  it('refuse une extension qui n’est pas un média', () => {
    // `public/uploads` est servi statiquement : y écrire du HTML, c'est publier du
    // script dans le domaine du site.
    expect(isWritableExtension('html')).toBe(false);
    expect(isWritableExtension('svg')).toBe(true);
    expect(isWritableExtension('.png')).toBe(true);
    expect(isWritableExtension('exe')).toBe(false);
    expect(() => buildAssetName('image', { name: 'x', extension: 'html' })).toThrow(/refusée/);
  });

  it('relit un nom d’asset, et tolère un fichier posé à la main', () => {
    expect(parseAssetName('canvas/CANVA_mdz4k9_affiche-a4.png')).toMatchObject({
      module: 'canvas',
      prefix: 'CANVA_',
      kind: 'canvas',
      extension: 'png',
      version: 1,
    });
    expect(parseAssetName('media/IMG_001_vue-v2.jpg').version).toBe(2);
    expect(parseAssetName('banniere-sans-regle.png').prefix).toBe('');
  });

  it('retrouve le type depuis le préfixe, et retombe sur `doc` ailleurs', () => {
    expect(kindOfPrefix('CANVA_')).toBe('canvas');
    expect(kindOfPrefix('IMG')).toBe('image');
    // Un préfixe hors table n'est pas une erreur — mais il n'est pas un type connu non
    // plus. `doc` est la retombée de l'interface, et un appelant qui veut trancher
    // autrement passe son propre `fallback`.
    expect(kindOfPrefix('AUDIO_')).toBe('doc');
    expect(kindOfPrefix('AUDIO_', 'audio')).toBe('audio');
    expect(kindOfPrefix('')).toBe('doc');
  });

  it('garde la table du backend à l’aplomb de celle du frontend', () => {
    const source = path.resolve(process.cwd(), '..', 'lib', 'ged', 'prefix.mjs');
    let text: string;
    try {
      text = readFileSync(source, 'utf8');
    } catch {
      // Le backend se construit parfois seul (image Docker sans le frontend) : le test
      // n'a alors rien à comparer, et ne doit pas le payer par un échec.
      return;
    }
    const entries = [...text.matchAll(/([a-z][a-z0-9]*):\s*\{\s*prefix:\s*'([A-Z0-9_]+)'\s*,\s*module:\s*'([a-z0-9-]+)'([^}]*)\}/g)];
    expect(entries.length).toBeGreaterThan(0);
    for (const match of entries) {
      const [, kind, prefix, module, tail] = match;
      // Le miroir doit les mêmes promesses : mêmes types, mêmes préfixes, mêmes dossiers.
      expect({ kind, prefix: table(kind).prefix, module: table(kind).module }).toEqual({ kind, prefix, module: slugifyModule(module) });
      // La première extension d'un type est celle que l'atelier écrit par défaut : elle
      // doit être au nombre de celles qu'un contenu généré a le droit d'écrire.
      const extensions = [...String(tail).matchAll(/'([a-z0-9]+)'/g)].map((found) => found[1]);
      const first = table(kind).extensions[0];
      expect(extensions).toContain(first);
      expect(isWritableExtension(first)).toBe(true);
    }
    const frontendKinds = entries.map((match) => match[1]).sort();
    expect(Object.keys(PREFIX_TABLE).sort()).toEqual(frontendKinds);

    // La liste des extensions écrivables, littéralement la même des deux côtés.
    const writable = /WRITABLE_EXTENSIONS[\s\S]*?=\s*Object\.freeze\(\[([^\]]+)\]/.exec(text);
    expect(writable).toBeTruthy();
    const listed = String(writable?.[1]).match(/'[a-z0-9]+'/g)?.map((item) => item.replace(/'/g, '')).sort();
    expect([...WRITABLE_EXTENSIONS].sort()).toEqual(listed);
  });
});
