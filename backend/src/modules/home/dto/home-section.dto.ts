import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';

/** Un objet JSON est accepté, rien n'imposé : la forme relève du bloc lui-même. */
function toJson(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

export class UpsertHomeSectionDto {
  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsObject()
  texts?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsObject()
  selection?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', description: 'Apparence du bloc (fond, hauteur, grille, CSS libre)' })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsObject()
  style?: Record<string, unknown>;

  /**
   * Éléments du bloc répétable (chiffres, blocs en alternance, tuiles…).
   *
   * Typé `unknown` et non `Array<Record<string, unknown>>` : le pipe global
   * transforme avec `enableImplicitConversion`, et la réflexion de types réduit
   * alors chaque objet de la liste à un tableau vide — les éléments sont perdus
   * sans erreur. Validé ici (`@IsArray` + `@IsObject`), la forme interne
   * relevant du bloc lui-même et non de la base.
   */
  @ApiPropertyOptional({ type: 'array', isArray: true })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsArray()
  @IsObject({ each: true })
  items?: unknown;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @Transform(({ value }) => toJson(value))
  @IsObject()
  builder?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'], default: 'published' })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;
}

export class UpdateHomeSectionDto extends PartialType(UpsertHomeSectionDto) {}

/** Copie la structure (et éventuellement les textes) vers d'autres langues. */
export class CopyHomeSectionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8)
  from!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  to!: string[];

  @ApiPropertyOptional({ description: 'Sans clé = tous les blocs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keys?: string[];

  @ApiPropertyOptional({ default: false, description: 'Copier aussi les textes' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  withTexts?: boolean;
}

/** Nouvel ordre des blocs sur la page. */
export class ReorderHomeSectionsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8)
  locale!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  keys!: string[];
}
