import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';
import { slugify } from '../../common/crud/query.util';

export interface ImportCatalogOptions {
  replace?: boolean;
  locales?: string[];
}

export interface ImportCatalogResult {
  path: string;
  locales: string[];
  replace: boolean;
  imported: Record<string, number>;
  skipped: Record<string, string>;
}

const DEFAULT_LOCALES = ['fr', 'en', 'ar'];

@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly config: ConfigService,
  ) {}

  async importFromDisk(options: ImportCatalogOptions = {}): Promise<ImportCatalogResult> {
    const locales = (options.locales?.length ? options.locales : DEFAULT_LOCALES).map((l) => l.toLowerCase());
    const replace = Boolean(options.replace);
    const root = this.resolveDataRoot();
    const imported: Record<string, number> = {};
    const skipped: Record<string, string> = {};
    const bump = (key: string, n: number) => {
      imported[key] = (imported[key] ?? 0) + n;
    };

    for (const locale of locales) {
      const dir = path.join(root, locale);
      if (!fs.existsSync(dir)) {
        skipped[locale] = `missing ${dir}`;
        continue;
      }

      bump('products', await this.importArray(COLLECTIONS.products, locale, this.readJson(dir, 'products.json'), replace, (row, slug) => ({
        locale,
        slug,
        name: String(row.name ?? 'Produit'),
        category: row.category ?? null,
        price: row.price ?? null,
        shortDesc: row.shortDesc ?? null,
        fullDesc: row.fullDesc ?? null,
        image: row.image ?? null,
        gallery: row.gallery ?? [],
        inStock: row.inStock !== false,
        deliveryTime: row.deliveryTime ?? null,
        features: row.features ?? [],
        specs: row.specs ?? {},
        options: row.options ?? [],
        catalogPdf: row.catalogPdf ?? null,
        status: 'published',
        publishedAt: new Date().toISOString(),
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('services', await this.importArray(COLLECTIONS.services, locale, this.readJson(dir, 'services.json'), replace, (row, slug) => ({
        locale,
        slug,
        title: String(row.title ?? 'Service'),
        icon: row.icon ?? null,
        shortDesc: row.shortDesc ?? null,
        fullDesc: row.fullDesc ?? null,
        features: row.features ?? [],
        faq: row.faq ?? [],
        sortOrder: typeof row.id === 'number' ? row.id : 0,
        status: 'published',
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('careers', await this.importArray(COLLECTIONS.careers, locale, this.readJson(dir, 'careers.json'), replace, (row, slug) => ({
        locale,
        slug,
        title: String(row.title ?? 'Offre'),
        type: row.type ?? null,
        location: row.location ?? null,
        salary: row.salary ?? null,
        shortDesc: row.shortDesc ?? row.mission ?? null,
        fullDesc: row.fullDesc ?? null,
        image: row.image ?? null,
        typeTravail: row.typeTravail ?? null,
        mission: row.mission ?? null,
        objectifs: row.objectifs ?? [],
        prerequis: row.prerequis ?? [],
        experience: row.experience ?? null,
        workflow: row.workflow ?? [],
        benefits: row.benefits ?? [],
        contact: row.contact ?? null,
        status: 'published',
        publishedAt: new Date().toISOString(),
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('news', await this.importArray(COLLECTIONS.news, locale, this.readJson(dir, 'news.json'), replace, (row, slug) => ({
        locale,
        slug,
        title: String(row.title ?? 'Article'),
        category: row.category ?? null,
        classification: row.classification ?? null,
        sujet: row.sujet ?? null,
        authorName: row.author ?? row.authorName ?? null,
        date: row.date ?? null,
        readTime: row.readTime != null ? String(row.readTime) : null,
        shortDesc: row.shortDesc ?? null,
        fullContent: row.fullContent ?? null,
        image: row.image ?? null,
        tags: row.tags ?? [],
        status: 'published',
        publishedAt: new Date().toISOString(),
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('events', await this.importArray(COLLECTIONS.events, locale, this.readJson(dir, 'events.json'), replace, (row, slug) => ({
        locale,
        slug,
        title: String(row.title ?? 'Événement'),
        type: row.type ?? null,
        date: row.date ?? null,
        location: row.location ?? null,
        shortDesc: row.shortDesc ?? null,
        fullContent: row.fullContent ?? null,
        image: row.image ?? null,
        agenda: row.agenda ?? [],
        status: 'published',
        publishedAt: new Date().toISOString(),
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('testimonials', await this.importArray(COLLECTIONS.testimonials, locale, this.readJson(dir, 'testimonials.json'), replace, (row) => ({
        locale,
        name: String(row.name ?? 'Client'),
        role: row.role ?? null,
        clinic: row.clinic ?? null,
        text: String(row.text ?? ''),
        image: row.image ?? null,
        rating: Number(row.rating ?? 5),
        sortOrder: typeof row.id === 'number' ? row.id : 0,
        status: 'published',
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('partners', await this.importArray(COLLECTIONS.partners, locale, this.readJson(dir, 'partners.json'), replace, (row) => ({
        locale,
        name: String(row.name ?? 'Partenaire'),
        logo: row.logo ?? null,
        category: row.category ?? null,
        sortOrder: typeof row.id === 'number' ? row.id : 0,
        status: 'published',
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('solutions', await this.importArray(COLLECTIONS.solutions, locale, this.readJson(dir, 'solution-categories.json'), replace, (row, slug) => ({
        locale,
        slug: String(row.id || slug),
        title: String(row.title ?? 'Solution'),
        shortDesc: row.shortDesc ?? null,
        fullDesc: row.fullDesc ?? null,
        icon: row.icon ?? null,
        image: row.image ?? null,
        color: row.color ?? 'sari-blue',
        productIds: row.productIds ?? [],
        features: row.features ?? [],
        faq: row.faq ?? [],
        sortOrder: 0,
        status: 'published',
      })));

      bump('hero', await this.importArray(COLLECTIONS.hero, locale, this.readJson(dir, 'hero.json'), replace, (row) => ({
        locale,
        title: String(row.title ?? 'Slide'),
        subtitle: row.subtitle ?? null,
        description: row.description ?? null,
        image: row.image ?? null,
        cta: row.cta ?? null,
        ctaLink: row.ctaLink ?? null,
        sortOrder: typeof row.id === 'number' ? row.id : 0,
        status: 'published',
        legacyId: typeof row.id === 'number' ? row.id : null,
      })));

      bump('pages', await this.importLegal(locale, this.readJson(dir, 'legal.json'), replace));
      bump('pages', await this.importGeneric(locale, this.readJson(dir, 'genericContent.json'), replace));
      bump('menus', await this.importMenus(locale, this.readJson(dir, 'menu.json'), replace));
      bump('contact', await this.importContact(locale, this.readJson(dir, 'config.json'), replace));
    }

    this.logger.log(`Catalog import done from ${root}: ${JSON.stringify(imported)}`);
    return { path: root, locales, replace, imported, skipped };
  }

  async counts(): Promise<Record<string, number>> {
    const keys: Array<[string, string]> = [
      ['products', COLLECTIONS.products],
      ['services', COLLECTIONS.services],
      ['careers', COLLECTIONS.careers],
      ['news', COLLECTIONS.news],
      ['events', COLLECTIONS.events],
      ['testimonials', COLLECTIONS.testimonials],
      ['partners', COLLECTIONS.partners],
      ['solutions', COLLECTIONS.solutions],
      ['hero', COLLECTIONS.hero],
      ['pages', COLLECTIONS.pages],
      ['menus', COLLECTIONS.menus],
      ['users', COLLECTIONS.users],
    ];
    const out: Record<string, number> = {};
    for (const [key, col] of keys) {
      out[key] = await this.factory(col).count();
    }
    return out;
  }

  private resolveDataRoot(): string {
    const configured = this.config.get<string>('CATALOG_JSON_PATH');
    const candidates = [
      configured,
      path.resolve(process.cwd(), '../data'),
      path.resolve(process.cwd(), 'data'),
      path.resolve(__dirname, '../../../../data'),
    ].filter(Boolean) as string[];
    for (const dir of candidates) {
      if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'fr'))) return dir;
    }
    throw new Error(`Catalogue JSON introuvable. Essayé : ${candidates.join(', ')}`);
  }

  private readJson(dir: string, file: string): unknown {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  }

  private async importArray(
    collection: string,
    locale: string,
    raw: unknown,
    replace: boolean,
    map: (row: Record<string, unknown>, slug: string) => Record<string, unknown>,
  ): Promise<number> {
    if (!Array.isArray(raw) || raw.length === 0) return 0;
    const repo = this.factory(collection);
    const existing = await this.localeCount(repo, locale);
    if (existing > 0 && !replace) return 0;
    if (replace && existing > 0) await this.deleteLocale(repo, locale);

    const used = new Set<string>();
    let n = 0;
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const base = slugify(String(row.slug ?? row.name ?? row.title ?? row.id ?? 'item')) || 'item';
      let slug = base;
      let i = 2;
      while (used.has(slug)) slug = `${base}-${i++}`;
      used.add(slug);
      await repo.create({
        id: randomUUID(),
        ...map(row, slug),
      } as Partial<BaseEntity>);
      n += 1;
    }
    return n;
  }

  private async importLegal(locale: string, raw: unknown, replace: boolean): Promise<number> {
    if (!raw || typeof raw !== 'object') return 0;
    const repo = this.factory(COLLECTIONS.pages);
    const existing = await repo.count({ locale, kind: 'legal' });
    if (existing > 0 && !replace) return 0;
    if (replace && existing > 0) await this.deleteWhere(repo, { locale, kind: 'legal' });
    let n = 0;
    for (const [key, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
      if (!value || typeof value !== 'object') continue;
      const slug = slugify(key) || key;
      await repo.create({
        id: randomUUID(),
        locale,
        slug,
        kind: key === 'about' ? 'about' : 'legal',
        subtype: 'simple',
        title: String(value.title ?? key),
        content: String(value.content ?? ''),
        status: 'published',
        publishedAt: new Date().toISOString(),
        sortOrder: n,
      } as Partial<BaseEntity>);
      n += 1;
    }
    return n;
  }

  private async importGeneric(locale: string, raw: unknown, replace: boolean): Promise<number> {
    if (!Array.isArray(raw)) return 0;
    const repo = this.factory(COLLECTIONS.pages);
    const existing = await repo.count({ locale, kind: 'generic' });
    if (existing > 0 && !replace) return 0;
    if (replace && existing > 0) await this.deleteWhere(repo, { locale, kind: 'generic' });
    const used = new Set<string>();
    let n = 0;
    for (const item of raw) {
      const row = item as Record<string, unknown>;
      const base = slugify(String(row.title ?? row.id ?? 'page')) || 'page';
      let slug = base;
      let i = 2;
      while (used.has(slug)) slug = `${base}-${i++}`;
      used.add(slug);
      const subtype = ['simple', 'gallery', 'flyer', 'slide', 'scroll', 'full', 'about'].includes(String(row.type))
        ? String(row.type)
        : 'simple';
      await repo.create({
        id: randomUUID(),
        locale,
        slug,
        kind: 'generic',
        subtype,
        title: String(row.title ?? 'Page'),
        subtitle: row.subtitle ?? null,
        category: row.category ?? null,
        content: row.content ?? null,
        media: row.media ?? null,
        slides: row.slides ?? null,
        sections: row.sections ?? null,
        status: 'published',
        publishedAt: new Date().toISOString(),
        sortOrder: typeof row.id === 'number' ? row.id : n,
      } as Partial<BaseEntity>);
      n += 1;
    }
    return n;
  }

  private async importMenus(locale: string, raw: unknown, replace: boolean): Promise<number> {
    if (!raw || typeof raw !== 'object') return 0;
    const menu = raw as Record<string, unknown>;
    const repo = this.factory(COLLECTIONS.menus);
    const existing = await this.localeCount(repo, locale);
    if (existing > 0 && !replace) return 0;
    if (replace && existing > 0) await this.deleteLocale(repo, locale);
    const blocks: Array<{ name: string; location: string; items: unknown }> = [
      { name: 'Principal', location: 'main', items: menu.mainMenu ?? [] },
      {
        name: 'Pied navigation',
        location: 'footer-nav',
        items: (menu.footerMenu as { navigation?: unknown })?.navigation ?? [],
      },
      {
        name: 'Pied légal',
        location: 'footer-legal',
        items: (menu.footerMenu as { legal?: unknown })?.legal ?? [],
      },
      { name: 'Réseaux', location: 'social', items: menu.socialLinks ?? {} },
    ];
    for (const block of blocks) {
      await repo.create({
        id: randomUUID(),
        locale,
        name: block.name,
        location: block.location,
        items: block.items,
        status: 'published',
      } as Partial<BaseEntity>);
    }
    return blocks.length;
  }

  private async importContact(locale: string, raw: unknown, replace: boolean): Promise<number> {
    if (!raw || typeof raw !== 'object') return 0;
    const cfg = raw as { meta?: Record<string, unknown>; stats?: unknown };
    const repo = this.factory(COLLECTIONS.contactInfo);
    const existing = await repo.findOne({ locale });
    if (existing && !replace) return 0;
    const meta = cfg.meta ?? {};
    const payload = {
      locale,
      company: meta.companyName ?? meta.company ?? 'SARI Système',
      tagline: meta.tagline ?? '',
      phone: meta.phone ?? '',
      email: meta.email ?? '',
      address: meta.address ?? '',
      logo: meta.logo ?? '',
      social: meta.social ?? {},
      extras: { description: meta.description, stats: cfg.stats ?? {} },
    };
    if (existing) {
      await repo.update(existing.id, payload as Partial<BaseEntity>);
    } else {
      await repo.create({ id: randomUUID(), ...payload } as Partial<BaseEntity>);
    }
    return 1;
  }

  private async localeCount(repo: ICrudRepository<BaseEntity>, locale: string): Promise<number> {
    return repo.count({ locale });
  }

  private async deleteLocale(repo: ICrudRepository<BaseEntity>, locale: string): Promise<void> {
    await this.deleteWhere(repo, { locale });
  }

  private async deleteWhere(repo: ICrudRepository<BaseEntity>, where: Record<string, unknown>): Promise<void> {
    const page = await repo.findMany({ page: 1, limit: 500, includeDeleted: true, filters: Object.entries(where).map(([field, value]) => ({ field, value })) });
    for (const item of page.data) {
      await repo.hardDelete(item.id);
    }
  }
}
