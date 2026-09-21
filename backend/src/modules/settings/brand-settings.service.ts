import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COLLECTIONS, REPOSITORY_FACTORY } from '../../common/constants/tokens';
import { BaseEntity, RepositoryFactory } from '../../common/crud/interfaces/repository.interface';

/**
 * Clé de la ligne `settings` qui porte la marque. Une seule ligne, un seul
 * objet : titre, sous-titre et logo changent ensemble ou pas du tout.
 */
export const BRAND_KEY = 'brand';

export interface BrandSettings {
  /** Nom affiché dans la barre latérale, l'onglet du navigateur, la connexion. */
  title: string;
  /** Seconde ligne sous le nom. Vide = la ligne n'est pas rendue. */
  subtitle: string;
  /** Image du logo, vide = l'icône par défaut (bouclier). */
  logo: string;
}

export type BrandSource = 'db' | 'env' | 'default';

export interface BrandStatus extends BrandSettings {
  source: BrandSource;
}

export const BRAND_DEFAULTS: BrandSettings = {
  title: 'SARI CMS',
  subtitle: 'Administration',
  logo: '',
};

/** Bornes de saisie. Au-delà, la barre latérale casse visuellement. */
export const BRAND_LIMITS = {
  title: { min: 1, max: 40 },
  subtitle: { max: 60 },
  logo: { max: 400 },
} as const;

/**
 * Ce qu'on accepte dans `logo`.
 *
 * Le champ se retrouve dans un `<img src>` rendu à tous les visiteurs de
 * l'administration, y compris sur l'écran de connexion, donc avant
 * authentification. Un `data:text/html,…` ou une URL externe arbitraire ferait
 * de ce champ un vecteur de pistage (et de vol de session par image
 * porteuse de jeton dans certains contextes). On restreint donc aux trois
 * formes que l'interface produit elle-même.
 */
const SAFE_LOGO = /^(\/|https?:\/\/|data:image\/)/i;

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

interface SettingRow extends BaseEntity {
  key?: string;
  value?: unknown;
  group?: string;
}

/**
 * Marque de l'administration : nom, accroche et logo.
 *
 * Pourquoi la table `settings` et pas le `localStorage` : l'identité du back-
 * office doit être la même sur tous les postes et visible dès l'écran de
 * connexion, qui tourne sans session. Le `localStorage` rend le réglage propre
 * à un navigateur — c'est exactement le défaut qui faisait disparaître les
 * coupons au changement de poste.
 *
 * Ordre de lecture : ligne `settings`, puis variables d'environnement, puis
 * défauts — comme la maintenance, pour qu'un déploiement puisse fixer une marque
 * sans passer par l'interface, et que l'interface puisse ensuite la surcharger.
 */
@Injectable()
export class BrandSettingsService {
  private readonly logger = new Logger(BrandSettingsService.name);

  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: RepositoryFactory,
    private readonly config: ConfigService,
  ) {}

  private repo() {
    return this.factory<SettingRow>(COLLECTIONS.settings);
  }

  /** Valeurs portées par les variables d'environnement, défauts compris. */
  fromEnv(): BrandSettings {
    return {
      title: clip(this.config.get('SARI_BRAND_TITLE'), BRAND_LIMITS.title.max) || BRAND_DEFAULTS.title,
      // Une variable présente mais vide se lit « pas d'accroche », et non « tant
      // pis pour le défaut » : `SARI_BRAND_SUBTITLE=` est une façon explicite de
      // retirer la seconde ligne sans toucher au code. Le repli sur le défaut
      // n'intervient que quand la variable est absente.
      subtitle:
        this.config.get('SARI_BRAND_SUBTITLE') === undefined
          ? BRAND_DEFAULTS.subtitle
          : clip(this.config.get('SARI_BRAND_SUBTITLE'), BRAND_LIMITS.subtitle.max),
      logo: this.safeLogo(clip(this.config.get('SARI_BRAND_LOGO'), BRAND_LIMITS.logo.max)),
    };
  }

  private safeLogo(raw: string): string {
    return SAFE_LOGO.test(raw) ? raw : '';
  }

  /** Ligne enregistrée en base, ou null si l'écran n'a jamais sauvegardé. */
  private async stored(): Promise<Partial<BrandSettings> | null> {
    try {
      const row = await this.repo().findOne({ key: BRAND_KEY }, true);
      const value = row?.value;
      if (!value || typeof value !== 'object') return null;
      return value as Partial<BrandSettings>;
    } catch (err) {
      // Table absente (base non migrée) : on retombe sur l'environnement.
      this.logger.warn(`lecture de la marque: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Marque effective. Ne lève jamais : un affichage d'identité ne doit pas
   * pouvoir empêcher l'administration de s'ouvrir, et l'écran de connexion
   * appelle cette méthode avant toute authentification.
   */
  async current(): Promise<BrandSettings> {
    const env = this.fromEnv();
    const stored = await this.stored();
    if (!stored) return env;
    const title = clip(stored.title, BRAND_LIMITS.title.max);
    return {
      title: title.length >= BRAND_LIMITS.title.min ? title : env.title,
      subtitle: clip(stored.subtitle, BRAND_LIMITS.subtitle.max),
      logo: this.safeLogo(clip(stored.logo, BRAND_LIMITS.logo.max)),
    };
  }

  async status(): Promise<BrandStatus> {
    const [current, stored] = await Promise.all([this.current(), this.stored()]);
    const fromEnv =
      this.config.get('SARI_BRAND_TITLE') || this.config.get('SARI_BRAND_SUBTITLE') || this.config.get('SARI_BRAND_LOGO');
    return { ...current, source: stored ? 'db' : fromEnv ? 'env' : 'default' };
  }

  /**
   * Valide un jeu de réglages. Le titre est obligatoire : sans lui la barre
   * latérale n'a plus d'en-tête, et l'onglet du navigateur retombe sur le titre
   * de la vitrine — le défaut exact qu'on vient corriger.
   */
  validate(input: Partial<BrandSettings>): BrandSettings {
    const title = clip(input.title, BRAND_LIMITS.title.max);
    if (title.length < BRAND_LIMITS.title.min) {
      throw new BadRequestException(
        `title est obligatoire (${BRAND_LIMITS.title.min} à ${BRAND_LIMITS.title.max} caractères)`,
      );
    }
    const logo = clip(input.logo, BRAND_LIMITS.logo.max);
    if (logo && !SAFE_LOGO.test(logo)) {
      throw new BadRequestException(
        'logo doit être un chemin relatif (/…), une URL http(s) ou une image data: — les autres schémas sont refusés',
      );
    }
    return {
      title,
      subtitle: clip(input.subtitle, BRAND_LIMITS.subtitle.max),
      logo: logo ? this.safeLogo(logo) : '',
    };
  }

  /** Enregistre la marque, puis renvoie l'état complet. */
  async save(input: Partial<BrandSettings>): Promise<BrandStatus> {
    const validated = this.validate(input);
    const existing = await this.repo().findOne({ key: BRAND_KEY }, true);
    if (existing?.id) {
      await this.repo().update(existing.id, { value: validated } as Partial<SettingRow>);
    } else {
      await this.repo().create({ key: BRAND_KEY, value: validated, group: 'brand' } as Partial<SettingRow>);
    }
    return this.status();
  }

  /** Supprime la ligne : on revient aux variables d'environnement, puis aux défauts. */
  async reset(): Promise<BrandStatus> {
    const existing = await this.repo().findOne({ key: BRAND_KEY }, true);
    if (existing?.id) await this.repo().hardDelete(existing.id);
    return this.status();
  }
}
