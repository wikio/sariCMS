import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

type CollectionMap = Record<string, Record<string, unknown>[]>;

/**
 * Single-process JSON store with atomic replacement on disk.
 * Suitable for cPanel single-process Node (Passenger) — not for multi-instance.
 */
export class JsonStore {
  private readonly logger = new Logger(JsonStore.name);
  private readonly dir: string;
  private readonly cache = new Map<string, Record<string, unknown>[]>();
  /** Counter for temp file names — see the write path in `write`. */
  private tmpSeq = 0;

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
    // The repository has just read this collection and allocated its next id. Do not
    // yield before publication: a second create could read the same rows and id,
    // then overwrite the first message (or score entry). Filesystem I/O is synchronous.
    const file = this.fileOf(collection);
    const tmp = `${file}.${process.pid}.${++this.tmpSeq}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
      fs.renameSync(tmp, file);
      this.cache.set(collection, items);
    } catch (err) {
      try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
      throw err;
    }
  }

  snapshot(): CollectionMap {
    const out: CollectionMap = {};
    for (const [k, v] of this.cache.entries()) out[k] = v;
    return out;
  }
}
