import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * `scope` et `type` sont des énumérations fermées : les accepter en texte libre
 * laisserait l'interface envoyer une valeur que `lib/commerce-math.ts` ne sait
 * pas interpréter, et la remise tomberait silencieusement à zéro.
 */
export const COUPON_TYPES = ['fixed', 'percent'] as const;
export const COUPON_SCOPES = ['all', 'category', 'product'] as const;

export class CreateCouponDto {
  @ApiProperty({ description: 'Code saisi par le client (unique, y compris en corbeille)' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @ApiPropertyOptional({ enum: COUPON_TYPES, default: 'percent' })
  @IsOptional()
  @IsIn(COUPON_TYPES)
  type?: string;

  @ApiProperty({ description: 'Montant fixe, ou pourcentage si type = percent' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'Plafond de remise, utile en pourcentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ description: 'Panier minimum requis' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrder?: number | null;

  @ApiPropertyOptional({ description: 'Début de validité (ISO ou AAAA-MM-JJ)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'Fin de validité, incluse (ISO ou AAAA-MM-JJ)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Nombre total d\'utilisations admises' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limitGlobal?: number | null;

  @ApiPropertyOptional({ description: 'Utilisations admises par client' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limitPerClient?: number | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  used?: number;

  @ApiPropertyOptional({ enum: COUPON_SCOPES, default: 'all' })
  @IsOptional()
  @IsIn(COUPON_SCOPES)
  scope?: string;

  @ApiPropertyOptional({ type: [String], description: 'Catégories ou produits ciblés' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  scopeValues?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Catégories ou produits exclus' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  excludeValues?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Chiffre d\'affaires attribué (agrégat)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  revenue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

/**
 * Ligne d'un envoi par lot : un coupon plus, éventuellement, son identifiant
 * serveur.
 *
 * DTO distinct de `CreateCouponDto` parce que `ValidationPipe` tourne avec
 * `forbidNonWhitelisted` : un `id` absent de la classe de base ferait rejeter
 * l'envoi entier.
 */
export class CouponSyncRowDto extends CreateCouponDto {
  @ApiPropertyOptional({ description: 'Identifiant serveur si la ligne existe déjà' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;
}

/**
 * Envoi du catalogue complet depuis l'écran d'administration.
 *
 * L'interface a toujours raisonné en « tableau entier » (`saveCoupons(rows)`),
 * pas ligne par ligne. Reprendre cette forme évite de réécrire sa gestion
 * d'état. Les suppressions sont **explicites** (`removed`) et non déduites des
 * absences : un envoi partiel ne peut donc pas vider le catalogue par accident.
 */
export class SyncCouponsDto {
  @ApiProperty({ type: [CouponSyncRowDto], description: 'Coupons à créer ou mettre à jour' })
  @IsArray()
  @ArrayMaxSize(1000)
  // Sans `@ValidateNested`, les objets du tableau ne sont jamais contrôlés : un
  // `type` ou un `scope` hors énumération passait jusqu'au service, qui le
  // ramenait silencieusement au défaut — un coupon « moitié » devenait un
  // pourcentage sans que personne ne le signale.
  @ValidateNested({ each: true })
  @Type(() => CouponSyncRowDto)
  coupons!: CouponSyncRowDto[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Identifiants à envoyer en corbeille',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  removed?: number[];
}
