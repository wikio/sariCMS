// lib/translate-store.ts
/**
 * L'enregistrement depuis l'écran « Traductions », du bon bout.
 *
 * L'écran éditait `translate/<locale>/admin/newsletter.json`, le site lisait
 * `messages/<locale>.json` (ou la copie `translate/<locale>.json` fabriquée par un
 * script de concatenation lancé au démarrage). Trois endroits, une écriture : une
 * retouche validée depuis l'administration ne changeait **rien** en ligne, et il
 * fallait rejouer `npm run merge:translations` — ou redémarrer — pour la voir. Le
 * doublon `translate/fr/admin.json` à côté de `translate/fr/admin/` ajoutait un
 * second piège : enregistrer le fichier plat écrasait tout le namespace `admin`,
 * dossier compris.
 *
 * Depuis, un enregistrement vaut écriture aux deux endroits qui comptent, dans
 * l'ordre : le fichier de l'atelier (ce que l'écran recharge), puis la branche
 * correspondante dans `messages/<locale>.json` (la source, ce que le site lit), puis
 * `translate/<locale>.json` recopié à l'identique pour les déploiements qui
 * n'embarquent que lui. Aucun script à lancer après. Et si le disque est en lecture
 * seule, la réponse le dit au lieu de faire croire que c'est enregistré.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { applyNamespace, isObject, LEGACY_DIR, namespaceForFile, ROOT_FILE } from './intl-tree.mjs';

export const TRANSLATE_LOCALES = ['fr', 'en', 'ar'];

/** Le chemin d'un fichier de l'atelier, tel que l'écran l'a choisi. */
export type AtelierFile = {
  locale: string;
  /** `admin/newsletter.json`, séparateurs `/`. */
  rel: string;
  /** Les clés que ce fichier représente dans les messages : `['admin', 'newsletter']`. */
  namespace: string[];
  /** Le fichier récolte les feuilles d'un nœud qui a aussi des enfants-objets (`_root.json`). */
  leavesOnly: boolean;
  file: string;
  treeDir: string;
};

export class TranslationPathError extends Error {}
export class TranslationConflictError extends Error {}

const dump = (value: unknown) => JSON.stringify(value, null, 2);
const dumpMessages = (value: unknown) => `${dump(value)}\n`;

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Valide et résout le chemin demandé. Le garde-fou `..` était là, il restait
 * incomplet : `path.join` accepte un chemin absolu et l'absorbe.
 */
export function resolveAtelierFile(locale: string, relPath: string): AtelierFile {
  if (!TRANSLATE_LOCALES.includes(locale)) {
    throw new TranslationPathError(`Langue inconnue : « ${locale} » (${TRANSLATE_LOCALES.join(', ')}).`);
  }
  const parts = String(relPath ?? '')
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== '.');
  if (!parts.length || parts.some((segment) => segment === '..' || segment.includes(':'))) {
    throw new TranslationPathError(`Chemin refusé : « ${relPath} ».`);
  }
  const rel = parts.join('/');
  if (parts[0] === LEGACY_DIR) {
    throw new TranslationPathError(
      `« ${rel} » est un vestige rangé là par « npm run intl:sync » : ses clés vivent désormais dans ` +
        `messages/${locale}.json. Modifiez-les là, puis relancez la synchronisation.`,
    );
  }
  if (!rel.endsWith('.json')) {
    throw new TranslationPathError(`Seuls les fichiers .json de l'atelier s'éditent ici (« ${rel} »).`);
  }
  const namespace = namespaceForFile(rel);
  if (!namespace) throw new TranslationPathError(`Namespace méconnaissable derrière « ${rel} ».`);
  const treeDir = path.join(process.cwd(), 'translate', locale);
  const file = path.join(treeDir, ...parts);
  if (!file.startsWith(treeDir + path.sep) && file !== treeDir) {
    throw new TranslationPathError(`Chemin hors de l'atelier : « ${rel} ».`);
  }
  return {
    locale,
    rel,
    namespace,
    leavesOnly: parts[parts.length - 1] === ROOT_FILE,
    file,
    treeDir,
  };
}

export async function readAtelierFile(target: AtelierFile): Promise<unknown> {
  const raw = await fs.readFile(target.file, 'utf8');
  return JSON.parse(raw);
}

async function readJsonSafe(file: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return isObject(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type SaveOutcome = {
  ok: true;
  file: string;
  namespace: string;
  synced: { messages: boolean; runtime: boolean; reason?: string };
};

/**
 * Écrit le fichier de l'atelier, puis propage dans les messages et dans la copie que
 * le site charge. La propagation est ce qui rend l'enregistrement visible en ligne
 * sans rien relancer.
 */
export async function saveAtelierFile(target: AtelierFile, content: unknown): Promise<SaveOutcome> {
  const conflictDir = target.leavesOnly
    ? null
    : path.join(target.treeDir, ...target.namespace);
  if (conflictDir && (await isDirectory(conflictDir))) {
    throw new TranslationConflictError(
      `« ${target.rel} » est un fichier plat, et le dossier « ${target.namespace.join('/')} » existe : ` +
        `l'enregistrer écraserait chaque namespace du dossier. Éditez les fichiers de « ${target.namespace.join('/')}/ » ` +
        `(les valeurs directes sont dans « ${target.namespace.join('/')}/${ROOT_FILE} »).`,
    );
  }

  await fs.mkdir(path.dirname(target.file), { recursive: true });
  await fs.writeFile(target.file, dump(content), 'utf8');

  const messagesFile = path.join(process.cwd(), 'messages', `${target.locale}.json`);
  const runtimeFile = path.join(process.cwd(), 'translate', `${target.locale}.json`);
  const outcome: SaveOutcome = {
    ok: true,
    file: target.rel,
    namespace: target.namespace.join('.') || '(racine)',
    synced: { messages: false, runtime: false },
  };

  const messages = (await readJsonSafe(messagesFile)) ?? {};
  try {
    applyNamespace(messages, target.namespace, content, target.leavesOnly);
    const raw = dumpMessages(messages);
    await fs.writeFile(messagesFile, raw, 'utf8');
    outcome.synced.messages = true;
    try {
      // La copie générée : identique au bit près, pour qu'aucun des deux chemins de
      // lecture ne puisse être plus frais que l'autre.
      await fs.writeFile(runtimeFile, raw, 'utf8');
      outcome.synced.runtime = true;
    } catch {
      outcome.synced.reason = `translate/${target.locale}.json n'a pas pu être écrit (disque en lecture seule ?)`;
    }
  } catch (error) {
    outcome.synced.reason = `messages/${target.locale}.json n'a pas pu être écrit : ${(error as Error).message}`;
  }
  return outcome;
}
