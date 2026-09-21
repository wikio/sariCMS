import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BRAND_LIMITS } from '../brand-settings.service';

/**
 * Saisie de la marque du back-office.
 *
 * Les bornes sont reprises de `BRAND_LIMITS`, l'unique source : un contrôle
 * serveur plus large que la validation d'interface laisserait entrer un titre
 * qui casse la barre latérale, et un contrôle plus étroit la ferait refuser une
 * saisie pourtant annoncée comme valide.
 */
export class UpdateBrandDto {
  @ApiProperty({ description: 'Nom affiché dans l’administration', maxLength: BRAND_LIMITS.title.max })
  @IsString()
  @MaxLength(BRAND_LIMITS.title.max)
  title!: string;

  @ApiPropertyOptional({ description: 'Accroche sous le nom ; vide = non affichée', maxLength: BRAND_LIMITS.subtitle.max })
  @IsOptional()
  @IsString()
  @MaxLength(BRAND_LIMITS.subtitle.max)
  subtitle?: string;

  @ApiPropertyOptional({ description: 'Chemin ou URL du logo ; vide = icône par défaut', maxLength: BRAND_LIMITS.logo.max })
  @IsOptional()
  @IsString()
  @MaxLength(BRAND_LIMITS.logo.max)
  logo?: string;
}
