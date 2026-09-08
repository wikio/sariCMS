import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ImportCatalogDto {
  @ApiPropertyOptional({ description: 'Écraser les fiches déjà importées pour chaque locale' })
  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['fr', 'en', 'ar'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locales?: string[];
}
