import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

type CollectionMap = Record<string, Record<string, unknown>[]>;

/**
 * Synchronous-enough JSON file store with per-collection write serialization.
 * Suitable for cPanel single-process Node (Passenger) — not for multi-instance.
 */
export class JsonStore {
  private readonly logger = new Logger(JsonStore.name);
  private readonly dir: string;
  private readonly cache = new Map<string, Record<string, unknown>[]>();
  private readonly queues = new Map<string, Promise<void>>();

  constructor(dir: string) {
    this.dir = path.resolve(dir);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  fileOf(collection: string): string {
    return path.join(this.dir, `${collection}.json`);
  }

  read(collection: string): Record<string, unknown>[] {
    if (this.cache.has(collection)) {
      return this.cache.get(collection)!;
    }
    const file = this.fileOf(collection);
    if (!fs.existsSync(file)) {
      this.cache.set(collection, []);
      return this.cache.get(collection)!;
    }
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : [];
      const list = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
      this.cache.set(collection, list);
      return list;
    } catch (err) {
      this.logger.error(`Failed to read ${file}: ${(err as Error).message}`);
      this.cache.set(collection, []);
      return this.cache.get(collection)!;
    }
  }

  async write(collection: string, items: Record<string, unknown>[]): Promise<void> {
    const previous = this.queues.get(collection) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queues.set(
      collection,
      previous.then(() => current),
    );
    await previous.catch(() => undefined);
    try {
      this.cache.set(collection, items);
      const file = this.fileOf(collection);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
      fs.renameSync(tmp, file);
    } finally {
      release();
    }
  }

  snapshot(): CollectionMap {
    const out: CollectionMap = {};
    for (const [k, v] of this.cache.entries()) out[k] = v;
    return out;
  }
}
