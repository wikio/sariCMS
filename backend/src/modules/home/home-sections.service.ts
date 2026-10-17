import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { HOME_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, ActorContext, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { HomeSectionEntity } from './entities/home-section.entity';

/**
 * Configuration des blocs de la page d'accueil.
 *
 * Le service ne connaît pas la forme des blocs : il stocke un objet JSON par
 * (clé, langue) et garantit seulement les invariants de rangement — une ligne
 * par bloc et par langue, un ordre, un statut. La lecture côté vitrine fusionne
 * la langue courante avec la langue de référence (les structures ne se
 * traduisent pas) ; cette fusion est faite dans la vitrine, pas ici, pour que
 * l'API reste un magasin simple et prévisible.
 */
@Injectable()
export class HomeSectionsService extends BaseCrudService<HomeSectionEntity> {
  protected readonly repository: ICrudRepository<HomeSectionEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'home-sections',
    searchFields: ['key', 'label'],
    sortableFields: ['createdAt', 'updatedAt', 'sortOrder', 'key', 'locale', 'status'],
    listFields: ['key', 'label', 'locale', 'enabled', 'sortOrder', 'status'],
    cardFields: ['key', 'label', 'locale', 'enabled', 'sortOrder', 'status', 'texts', 'selection', 'settings', 'style', 'items', 'builder'],
    // Pas de `legacyId` : les langues d'un même bloc se retrouvent par `key`.
    hasLegacyId: false,
  };

  constructor(
    @Inject(HOME_REPOSITORY) repository: ICrudRepository<HomeSectionEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  /** Toutes les lignes d'une (ou plusieurs) langue(s), triées pour la page. */
  async findForLocales(locales: string[]): Promise<HomeSectionEntity[]> {
    const { data } = await this.repository.findMany({
      filters: [{ field: 'locale', op: 'in', value: locales }],
      sortBy: 'sortOrder',
      sortOrder: 'asc',
      limit: 200,
    });
    return data;
  }

  /**
   * Ligne d'un bloc pour une langue.
   *
   * `includeDeleted` sert au chemin d'écriture : un bloc « réinitialisé » n'est
   * que mis à la corbeille, et la contrainte d'unicité (key, locale) continue de
   * compter. Recréer la ligne échouerait donc après un reset — `upsert` cherche
   * aussi dans la corbeille et ranime la fiche.
   */
  async findByKeyAndLocale(key: string, locale: string, includeDeleted = false): Promise<HomeSectionEntity | null> {
    return this.repository.findOne({ key, locale }, includeDeleted);
  }

  /**
   * Crée ou remplace la ligne d'un bloc pour une langue.
   *
   * `null` sur un champ significatif « absent » : on ne réécrit pas ce qui
   * n'a pas été envoyé, ce qui laisse l'éditeur partiel (un seul texte à
   * corriger) fonctionner sans vider le reste.
   */
  async upsert(key: string, locale: string, dto: Partial<HomeSectionEntity>, actor?: ActorContext) {
    const existing = await this.findByKeyAndLocale(key, locale, true);
    const payload: Partial<HomeSectionEntity> = {
      key,
      locale,
      label: dto.label ?? existing?.label ?? null,
      enabled: dto.enabled ?? existing?.enabled ?? true,
      sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
      status: dto.status ?? existing?.status ?? 'published',
      texts: dto.texts ?? (existing?.texts as HomeSectionEntity['texts']) ?? {},
      selection: dto.selection ?? (existing?.selection as HomeSectionEntity['selection']) ?? {},
      settings: dto.settings ?? (existing?.settings as HomeSectionEntity['settings']) ?? {},
      style: dto.style ?? (existing?.style as HomeSectionEntity['style']) ?? {},
      items: (dto.items as HomeSectionEntity['items']) ?? (existing?.items as HomeSectionEntity['items']) ?? [],
      builder: dto.builder ?? (existing?.builder as HomeSectionEntity['builder']) ?? {},
    };

    if (existing) {
      // `deletedAt: null` : un enregistrement après une réinitialisation sort la
      // fiche de la corbeille au lieu de heurter l'unicité (key, locale).
      const updated = await this.repository.update(existing.id, { ...payload, deletedAt: null });
      await this.invalidateCache();
      await this.audit.record({
        actorId: actor?.id,
        action: 'update',
        resource: this.options.resource,
        resourceId: existing.id,
        payload: { key, locale },
        ip: actor?.ip,
        userAgent: actor?.userAgent,
      });
      return this.toView(updated, 'block');
    }

    const created = await this.repository.create({
      ...payload,
      createdBy: actor?.id ?? null,
      updatedBy: actor?.id ?? null,
    } as Partial<HomeSectionEntity>);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'create',
      resource: this.options.resource,
      resourceId: created.id,
      payload: { key, locale },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return this.toView(created, 'block');
  }

  /** Réinitialise un bloc : la vitrine repart de ses valeurs par défaut. */
  async reset(key: string, locale: string, actor?: ActorContext) {
    const existing = await this.findByKeyAndLocale(key, locale);
    if (!existing) return { reset: false, reason: 'empty' };
    await this.repository.softDelete(existing.id);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'soft_delete',
      resource: this.options.resource,
      resourceId: existing.id,
      payload: { key, locale },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { reset: true };
  }

  /**
   * Propage la configuration d'une langue vers d'autres.
   *
   * Utile dès qu'un bloc est construit dans la langue de référence : sans
   * copier la sélection et le style, chaque langue devrait être réglée à la
   * main. `withTexts` existe pour les cas où l'on veut aussi dupliquer les
   * textes (page de campagne monolingue, par exemple).
   */
  async copy(from: string, to: string[], keys: string[] | undefined, withTexts: boolean, actor?: ActorContext) {
    const source = await this.findForLocales([from]);
    const wanted = keys?.length ? source.filter((row) => keys.includes(row.key)) : source;
    const done: Array<{ key: string; locale: string }> = [];

    for (const target of to) {
      if (!target || target === from) continue;
      for (const row of wanted) {
        const payload: Partial<HomeSectionEntity> = {
          enabled: row.enabled,
          sortOrder: row.sortOrder,
          status: row.status,
          selection: row.selection,
          settings: row.settings,
          items: withTexts ? row.items : this.stripItemTexts(row.items),
          builder: withTexts ? row.builder : this.stripBuilderHtml(row.builder),
          texts: {},
        };
        await this.upsert(row.key, target, payload, actor);
        done.push({ key: row.key, locale: target });
      }
    }
    return { from, to, copied: done.length };
  }

  /** Applique un nouvel ordre de blocs (glisser-déposer dans le studio). */
  /**
   * Nouvel ordre des blocs de la page.
   *
   * Un bloc jamais configuré n'a pas de ligne : si l'on se contentait de mettre
   * à jour les lignes existantes, les blocs « vierges » garderaient leur rang
   * par défaut et se glisseraient au milieu de l'ordre demandé. On crée donc
   * une ligne vide pour chaque bloc manquant — uniquement un rang, aucun texte —
   * ce qui rend l'ordre enregistré complet et donc respecté tel quel par la
   * vitrine.
   */
  async reorder(locale: string, keys: string[], actor?: ActorContext) {
    const rows = await this.findForLocales([locale]);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    let touched = 0;
    for (const [index, key] of keys.entries()) {
      const row = byKey.get(key);
      if (!row) {
        // `upsert` plutôt qu'un `create` brut : le bloc a pu être réinitialisé,
        // sa ligne dort dans la corbeille et l'unicité (key, locale) s'y oppose.
        await this.upsert(
          key,
          locale,
          {
            label: null,
            enabled: true,
            sortOrder: index,
            status: 'published',
            texts: {},
            selection: {},
            settings: {},
            style: {},
            items: [],
            builder: {},
          } as Partial<HomeSectionEntity>,
          actor,
        );
        touched += 1;
        continue;
      }
      if (row.sortOrder === index) continue;
      await this.repository.update(row.id, { sortOrder: index } as Partial<HomeSectionEntity>);
      touched += 1;
    }
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'update',
      resource: this.options.resource,
      resourceId: 0,
      payload: { locale, count: touched },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { locale, updated: touched };
  }

  /** En copie multi-langue, on ne duplique pas la langue d'origine. */
  private stripItemTexts(items: HomeSectionEntity['items']): Array<Record<string, unknown>> {
    if (!Array.isArray(items)) return [];
    // Les blocs répétables gardent leur identité (id, image, lien) ; les
    // textes sont laissés vides pour que la langue cible les saisisse.
    return items.map((item) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item || {})) {
        if (typeof v === 'string' && TEXT_KEYS.has(k)) continue;
        out[k] = v;
      }
      return out;
    });
  }

  private stripBuilderHtml(builder: HomeSectionEntity['builder']): Record<string, unknown> {
    if (!builder || typeof builder !== 'object') return {};
    const { html: _html, ...rest } = builder as Record<string, unknown>;
    return rest;
  }
}

/** Champs d'un bloc répétable qui sont du texte à traduire. */
const TEXT_KEYS = new Set(['title', 'subtitle', 'description', 'text', 'label', 'ctaLabel', 'quote']);
