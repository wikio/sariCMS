import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TAX_MODES = ['percent', 'fixed'] as const;
export const TAX_SCOPES = ['all', 'category', 'product'] as const;

export class CreateTaxRuleDto {
  @ApiProperty({ description: 'Libellé de repli, utilisé si `names` ne couvre pas la langue' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Libellés traduits, ex. { fr, en, ar }' })
  @IsOptional()
  @IsObject()
  names?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Libellés courts traduits (facture PDF)' })
  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;

  @ApiPropertyOptional({ enum: TAX_MODES, default: 'percent' })
  @IsOptional()
  @IsIn(TAX_MODES)
  mode?: string;

  @ApiProperty({ description: 'Taux en pourcentage, ou montant fixe' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate!: number;

  @ApiPropertyOptional({ default: 'DZ' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @ApiPropertyOptional({ enum: TAX_SCOPES, default: 'all' })
  @IsOptional()
  @IsIn(TAX_SCOPES)
  scope?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  scopeValues?: string[];

  @ApiPropertyOptional({ default: false, description: 'Taxe incluse dans le prix affiché' })
  @IsOptional()
  @IsBoolean()
  included?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Ordre d\'application' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'TVA globale appliquée automatiquement — une seule au plus',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

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
}

export class UpdateTaxRuleDto extends PartialType(CreateTaxRuleDto) {}

/** Ligne d'un envoi par lot. Voir `CouponSyncRowDto` pour le pourquoi du DTO distinct. */
export class TaxRuleSyncRowDto extends CreateTaxRuleDto {
  @ApiPropertyOptional({ description: 'Identifiant serveur si la ligne existe déjà' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;
}

/**
 * Envoi du jeu de taxes complet, même forme que `SyncCouponsDto` : l'écran
 * raisonnait déjà en tableau entier (`saveTaxes(rows)`).
 */
export class SyncTaxRulesDto {
  @ApiProperty({ type: [TaxRuleSyncRowDto] })
  @IsArray()
  @ArrayMaxSize(200)
  // Sans `@ValidateNested` les objets du tableau échappent à tout contrôle :
  // un `mode` hors énumération serait ramené en silence à `percent`.
  @ValidateNested({ each: true })
  @Type(() => TaxRuleSyncRowDto)
  taxes!: TaxRuleSyncRowDto[];

  @ApiPropertyOptional({ type: [Number], description: 'Identifiants à envoyer en corbeille' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  removed?: number[];
}
