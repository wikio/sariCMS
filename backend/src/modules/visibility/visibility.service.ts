import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { SETTING_REPOSITORY } from '../../common/constants/tokens';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { SettingEntity } from '../settings/entities/setting.entity';

/**
 * Visibilité de la vitrine, enregistrée par langue.
 *
 * Le réglage vivait auparavant dans le `localStorage` du navigateur : il
 * s'appliquait donc à toutes les langues à la fois et n'existait que sur le
 * poste où il avait été modifié. Il est désormais persisté côté serveur, une
 * entrée par langue, et vaut pour tous les visiteurs.
 *
 * On réutilise la table `settings` (clé unique + valeur JSON) plutôt que
 * d'ajouter une table : aucune migration n'est nécessaire, et le réglage suit
 * naturellement le pilote de base de données configuré.
 */
@Injectable()
export class VisibilityService {
  /** Une clé par langue : `visibility.fr`, `visibility.en`, `visibility.ar`. */
  private static readonly PREFIX = 'visibility.';
  private static readonly GROUP = 'visibility';

  constructor(
    @Inject(SETTING_REPOSITORY) private readonly settings: ICrudRepository<SettingEntity>,
    private readonly cache: AppCacheService,
  ) {}

  private key(locale: string) {
    return `${VisibilityService.PREFIX}${locale}`;
  }

  private cacheKey(locale: string) {
    return `visibility:${locale}`;
  }

  /**
   * Réglages d'une langue. Retourne uniquement les exceptions enregistrées :
   * une clé absente signifie « valeur par défaut », que la vitrine connaît.
   * Le dictionnaire vide est donc une réponse normale, pas une erreur.
   */
  async find(locale: string): Promise<Record<string, boolean>> {
    const cached = await this.cache.get<Record<string, boolean>>(this.cacheKey(locale));
    if (cached) return cached;

    const row = await this.settings.findOne({ key: this.key(locale) });
    const value = this.sanitize(row?.value);
    await this.cache.set(this.cacheKey(locale), value, 30);
    return value;
  }

  /** Réglages de plusieurs langues en une fois, pour l'écran d'administration. */
  async findMany(locales: string[]): Promise<Record<string, Record<string, boolean>>> {
    const out: Record<string, Record<string, boolean>> = {};
    for (const locale of locales) out[locale] = await this.find(locale);
    return out;
  }

  /**
   * Remplace les réglages d'une langue.
   *
   * `overrides` ne contient que les exceptions : la vitrine applique ses
   * valeurs par défaut pour tout le reste. Enregistrer un dictionnaire vide
   * revient donc à revenir aux défauts.
   */
  async replace(locale: string, overrides: Record<string, boolean>, userId?: number) {
    const value = this.sanitize(overrides);
    const key = this.key(locale);
    const existing = await this.settings.findOne({ key });

    if (existing) {
      await this.settings.update(existing.id, { value, updatedBy: userId } as Partial<SettingEntity>);
    } else {
      await this.settings.create({
        key,
        value,
        group: VisibilityService.GROUP,
        createdBy: userId,
        updatedBy: userId,
      } as Partial<SettingEntity>);
    }

    await this.cache.del(this.cacheKey(locale));
    return value;
  }

  /** Bascule une seule clé, sans réécrire le reste. */
  async setOne(locale: string, key: string, on: boolean, userId?: number) {
    const current = await this.find(locale);
    return this.replace(locale, { ...current, [key]: on }, userId);
  }

  /** Copie les réglages d'une langue vers d'autres. */
  async copy(from: string, to: string[], userId?: number) {
    const source = await this.find(from);
    const done: string[] = [];
    for (const locale of to) {
      if (locale === from) continue;
      await this.replace(locale, source, userId);
      done.push(locale);
    }
    return { from, to: done, count: Object.keys(source).length };
  }

  /** Efface les réglages d'une langue : retour aux valeurs par défaut. */
  async reset(locale: string, userId?: number) {
    return this.replace(locale, {}, userId);
  }

  /**
   * N'accepte que des booléens sous des clés plausibles.
   *
   * La valeur vient d'une colonne JSON : selon le pilote elle peut revenir en
   * chaîne, et rien ne garantit sa forme. On la normalise ici pour que la
   * vitrine reçoive toujours un dictionnaire de booléens.
   */
  private sanitize(raw: unknown): Record<string, boolean> {
    let value = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const out: Record<string, boolean> = {};
    for (const [key, on] of Object.entries(value as Record<string, unknown>)) {
      if (typeof on !== 'boolean') continue;
      if (!/^[a-z0-9_.-]{1,80}$/i.test(key)) continue;
      out[key] = on;
    }
    return out;
  }
}
