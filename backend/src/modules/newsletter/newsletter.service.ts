import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { NEWSLETTER_REPOSITORY } from '../../common/constants/tokens';
import { ActorContext, BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SubscribeDto, UnsubscribeDto } from './dto/newsletter.dto';
import { NewsletterSubscriberEntity } from './entities/newsletter.entity';

/** Un envoi de confirmation n'est déclenché que si l'SMTP est configuré. */
const PENDING_UNTIL_CONFIRM = false;

/**
 * Liste des abonné·es à la newsletter, partagée par tout le site.
 *
 * Le formulaire de la page d'accueil, celui d'un article, la case à cocher de
 * la page contact ou un bloc construit dans le constructeur de page écrivent
 * tous ici : une seule liste, une seule désinscription, et une colonne `source`
 * qui dit d'où vient chaque adresse.
 *
 * L'adresse est la clé métier : `subscribe()` met à jour la fiche existante au
 * lieu d'ajouter un doublon, et une réinscription après désinscription repasse
 * le statut à `subscribed` (avec son horodatage).
 */
@Injectable()
export class NewsletterService extends BaseCrudService<NewsletterSubscriberEntity> {
  protected readonly repository: ICrudRepository<NewsletterSubscriberEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'newsletter',
    searchFields: ['email', 'name', 'notes', 'source'],
    sortableFields: ['createdAt', 'updatedAt', 'email', 'status', 'source', 'subscribedAt', 'locale'],
    listFields: ['email', 'name', 'locale', 'status', 'source', 'consent', 'topics', 'subscribedAt', 'unsubscribedAt', 'notes'],
    cardFields: [
      'email', 'name', 'locale', 'status', 'source', 'consent', 'topics', 'notes',
      'subscribedAt', 'unsubscribedAt', 'ip', 'userAgent',
    ],
    uniqueFields: ['email'],
    // Une adresse n'est pas une fiche traduite : pas de lien multi-langue.
    hasLegacyId: false,
  };

  constructor(
    @Inject(NEWSLETTER_REPOSITORY) repository: ICrudRepository<NewsletterSubscriberEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  static normalizeEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
  }

  /**
   * Inscription publique.
   *
   * `created` distingue une nouvelle adresse d'une réactivation : l'écran
   * d'administration n'a pas besoin de savoir lesquelles étaient déjà là, mais
   * le message affiché au visiteur, si (« Inscription confirmée » vs « Votre
   * adresse était déjà dans la liste »).
   */
  async subscribe(dto: SubscribeDto, actor?: ActorContext) {
    const email = NewsletterService.normalizeEmail(dto.email);
    const now = new Date().toISOString();
    const token = randomUUID();
    const fields = {
      email,
      name: dto.name?.trim() || undefined,
      locale: dto.locale || 'fr',
      source: dto.source || 'form',
      consent: dto.consent !== false,
      topics: Array.isArray(dto.topics) ? dto.topics : undefined,
      ip: actor?.ip,
      userAgent: actor?.userAgent,
      subscribedAt: now,
      unsubscribedAt: null,
      status: PENDING_UNTIL_CONFIRM ? 'pending' : 'subscribed',
    };

    const existing = await this.repository.findOne({ email }, true);
    if (existing) {
      const revived = await this.repository.update(existing.id, {
        ...fields,
        token: existing.token || token,
        deletedAt: null,
      } as Partial<NewsletterSubscriberEntity>);
      await this.invalidateCache();
      await this.audit.record({
        actorId: actor?.id,
        action: 'newsletter_subscribe',
        resource: this.options.resource,
        resourceId: existing.id,
        payload: { source: fields.source, locale: fields.locale },
        ip: actor?.ip,
        userAgent: actor?.userAgent,
      });
      return { created: false, subscriber: this.toView(revived, 'block') };
    }

    const created = await this.repository.create({
      ...fields,
      token,
      createdBy: actor?.id ?? null,
      updatedBy: actor?.id ?? null,
    } as Partial<NewsletterSubscriberEntity>);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'newsletter_subscribe',
      resource: this.options.resource,
      resourceId: created.id,
      payload: { source: fields.source, locale: fields.locale },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { created: true, subscriber: this.toView(created, 'block') };
  }

  /** Désinscription — par jeton (lien du mail) ou par adresse (bloc du site). */
  async unsubscribe(dto: UnsubscribeDto, actor?: ActorContext) {
    const email = dto.email ? NewsletterService.normalizeEmail(dto.email) : '';
    let row = dto.token ? await this.repository.findOne({ token: dto.token }) : null;
    if (!row && email) row = await this.repository.findOne({ email });
    if (!row) return { done: false, reason: 'unknown' };

    const updated = await this.repository.update(row.id, {
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString(),
    } as Partial<NewsletterSubscriberEntity>);
    await this.invalidateCache();
    await this.audit.record({
      actorId: actor?.id,
      action: 'newsletter_unsubscribe',
      resource: this.options.resource,
      resourceId: row.id,
      payload: { source: dto.source || 'link' },
      ip: actor?.ip,
      userAgent: actor?.userAgent,
    });
    return { done: true, subscriber: this.toView(updated, 'block') };
  }

  /** Confirmation d'inscription (double opt-in), si un jeton est attendu. */
  async confirm(token: string) {
    if (!token) return { done: false, reason: 'no_token' };
    const row = await this.repository.findOne({ token });
    if (!row) return { done: false, reason: 'unknown' };
    if (row.status === 'subscribed') return { done: true, already: true };
    const updated = await this.repository.update(row.id, {
      status: 'subscribed',
      subscribedAt: new Date().toISOString(),
    } as Partial<NewsletterSubscriberEntity>);
    await this.invalidateCache();
    return { done: true, subscriber: this.toView(updated, 'block') };
  }

  /** Action de masse : statut ou envoi en corbeille. */
  async bulk(
    ids: number[],
    action: string,
    actor?: ActorContext,
  ): Promise<{ done: number; failed: number }> {
    let done = 0;
    let failed = 0;
    for (const id of ids || []) {
      try {
        if (action === 'delete') {
          await this.softDelete(id, actor);
        } else {
          const patch: Partial<NewsletterSubscriberEntity> = { status: action };
          if (action === 'subscribed') patch.subscribedAt = new Date().toISOString();
          if (action === 'unsubscribed') patch.unsubscribedAt = new Date().toISOString();
          await this.update(id, patch, actor);
        }
        done += 1;
      } catch {
        failed += 1;
      }
    }
    return { done, failed };
  }

  /** Compteurs de l'écran d'administration (bandeaux + filtres). */
  async stats() {
    const statuses = ['subscribed', 'pending', 'unsubscribed', 'bounced', 'blocked'];
    const out: Record<string, number> = {};
    let total = 0;
    for (const status of statuses) {
      const count = await this.repository.count({ status });
      out[status] = count;
      total += count;
    }
    out.total = total;
    return out;
  }

  /** Export CSV (toute la liste, ou les seules lignes filtrées envoyées). */
  async exportCsv(status?: string, locale?: string): Promise<string> {
    const filters: Array<{ field: string; op?: 'eq'; value: unknown }> = [];
    if (status) filters.push({ field: 'status', op: 'eq', value: status });
    if (locale) filters.push({ field: 'locale', op: 'eq', value: locale });
    const { data } = await this.repository.findMany({
      filters,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 5000,
    });
    const head = ['email', 'name', 'locale', 'status', 'source', 'consent', 'topics', 'subscribedAt', 'unsubscribedAt'];
    const esc = (v: unknown) => {
      const text = Array.isArray(v) ? v.join('|') : v === null || v === undefined ? '' : String(v);
      return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [head.join(',')];
    for (const row of data) {
      lines.push(head.map((k) => esc((row as Record<string, unknown>)[k])).join(','));
    }
    return lines.join('\n');
  }
}
