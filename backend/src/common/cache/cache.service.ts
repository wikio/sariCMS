import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Keyv from 'keyv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Two-tier cache:
 *   L1 — cache-manager in-memory (fast, process-local)
 *   L2 — Keyv persisted to a JSON file (survives restart, no Redis)
 *
 * Optional SQLite L2 can be enabled with CACHE_SQLITE_PATH + @keyv/sqlite
 * if the host can compile native addons. File store is the default because
 * cPanel/Passenger shared hosting often cannot compile better-sqlite3.
 */
@Injectable()
export class AppCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private keyv!: Keyv;
  private persistTimer?: NodeJS.Timeout;
  private memoryIndex = new Map<string, { value: unknown; expiresAt: number | null }>();
  private filePath!: string;
  private dirty = false;

  constructor(@Inject(CACHE_MANAGER) private readonly memory: Cache) {}

  onModuleInit(): void {
    this.filePath = path.resolve(process.env.CACHE_L2_PATH || './storage/cache/keyv.json');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.loadFile();

    this.keyv = new Keyv({
      store: this.buildMapStore() as any,
      namespace: 'sari',
    });
    this.keyv.on('error', (err) => this.logger.error(`Keyv error: ${err.message}`));

    this.persistTimer = setInterval(() => this.flush(), 5_000);
    if (this.persistTimer.unref) this.persistTimer.unref();
    this.logger.log(`L2 cache file store → ${this.filePath}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.flush();
    await this.keyv?.disconnect?.();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const l1 = await this.memory.get<T>(key);
    if (l1 !== undefined && l1 !== null) return l1;
    const l2 = (await this.keyv.get(key)) as T | undefined;
    if (l2 !== undefined && l2 !== null) {
      await this.memory.set(key, l2);
      return l2;
    }
    return undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = (ttlSeconds ?? Number(process.env.CACHE_TTL_SECONDS ?? 60)) * 1000;
    await this.memory.set(key, value, ttl);
    await this.keyv.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.memory.del(key);
    await this.keyv.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const keys = [...this.memoryIndex.keys()].filter((k) => k.includes(prefix) || k.endsWith(prefix));
    await Promise.all(keys.map((k) => this.del(k.replace(/^sari:/, ''))));
  }

  async wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async reset(): Promise<void> {
    await this.memory.reset();
    this.memoryIndex.clear();
    this.dirty = true;
    this.flush();
  }

  private buildMapStore() {
    const index = this.memoryIndex;
    const mark = () => {
      this.dirty = true;
    };
    return {
      get: async (key: string) => {
        const hit = index.get(key);
        if (!hit) return undefined;
        if (hit.expiresAt && hit.expiresAt < Date.now()) {
          index.delete(key);
          mark();
          return undefined;
        }
        return hit.value;
      },
      set: async (key: string, value: unknown, ttl?: number) => {
        const expiresAt = ttl ? Date.now() + ttl : null;
        index.set(key, { value, expiresAt });
        mark();
        return true;
      },
      delete: async (key: string) => {
        const ok = index.delete(key);
        mark();
        return ok;
      },
      clear: async () => {
        index.clear();
        mark();
      },
    };
  }

  private loadFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Record<string, { value: unknown; expiresAt: number | null }>;
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        if (!v.expiresAt || v.expiresAt > now) this.memoryIndex.set(k, v);
      }
    } catch (err) {
      this.logger.warn(`Unable to load L2 cache file: ${(err as Error).message}`);
    }
  }

  private flush(): void {
    if (!this.dirty) return;
    try {
      const serializable: Record<string, { value: unknown; expiresAt: number | null }> = {};
      const now = Date.now();
      for (const [k, v] of this.memoryIndex.entries()) {
        if (!v.expiresAt || v.expiresAt > now) serializable[k] = v;
      }
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(serializable));
      fs.renameSync(tmp, this.filePath);
      this.dirty = false;
    } catch (err) {
      this.logger.warn(`Unable to persist L2 cache: ${(err as Error).message}`);
    }
  }
}
