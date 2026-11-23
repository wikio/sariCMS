/**
 * Persistance serveur des paramètres du générateur d'images & logos (`/api/placeholder`).
 *
 * Stocké dans `data/placeholder-settings.json` (écriture atomique + file d'exclusion).
 * Aucun schéma SQL à migrer ; surchargeable via `PLACEHOLDER_SETTINGS_FILE` pour les tests.
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_PLACEHOLDER_CONFIG,
  sanitizePlaceholderConfig,
  type PlaceholderConfig,
} from './placeholder-engine';

function settingsFile(): string {
  return process.env.PLACEHOLDER_SETTINGS_FILE || path.join(process.cwd(), 'data', 'placeholder-settings.json');
}

let writeQueue: Promise<unknown> = Promise.resolve();
let tmpSeq = 0;

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function readPlaceholderConfig(): Promise<PlaceholderConfig> {
  try {
    const raw = await fs.readFile(settingsFile(), 'utf8');
    return sanitizePlaceholderConfig(JSON.parse(raw));
  } catch {
    return sanitizePlaceholderConfig(DEFAULT_PLACEHOLDER_CONFIG);
  }
}

export function writePlaceholderConfig(incoming: Partial<PlaceholderConfig>): Promise<PlaceholderConfig> {
  return exclusive(async () => {
    const current = await readPlaceholderConfig();
    const merged = sanitizePlaceholderConfig({ ...current, ...incoming });
    const target = settingsFile();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${(tmpSeq += 1)}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(merged, null, 2), 'utf8');
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
    return merged;
  });
}
