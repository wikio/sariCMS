import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const VIEW_MODES = ['list', 'card', 'block'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseFilters(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export class QueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Champ de tri (whitelist côté service)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Recherche texte libre (champs configurés par module)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filtres dynamiques. Accepte filter[status]=published ou filter={"status":"published","rating":{"gte":4}}',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseFilters(value))
  @IsObject()
  filter?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: VIEW_MODES, default: 'list' })
  @IsOptional()
  @IsIn(VIEW_MODES)
  view?: ViewMode = 'list';

  @ApiPropertyOptional({ description: 'Inclure les éléments soft-deleted' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({ description: 'Uniquement la corbeille' })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  onlyDeleted?: boolean;
}

export class AutocompleteQueryDto {
  @ApiPropertyOptional({ description: 'Préfixe de recherche' })
  @IsString()
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ default: 'title' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  field?: string;

  @ApiPropertyOptional({ default: 10, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}

export class PurgeConfirmDto {
  @ApiPropertyOptional({
    description: 'Jeton reçu via POST /:id/purge. Obligatoire pour une suppression définitive.',
  })
  @IsString()
  @MaxLength(128)
  confirm!: string;
}
