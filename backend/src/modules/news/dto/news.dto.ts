import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SLUG_REGEX, SLUG_MESSAGE } from '../../../common/validation/slug';

export class CreateNewsDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  classification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sujet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorName?: string;

  /**
   * Fiche auteur liée. Les identifiants du CMS sont des entiers
   * auto-incrémentés : la contrainte `@IsUUID` héritée du prototype rejetait
   * toute valeur réelle et rendait le champ inutilisable.
   */
  @ApiPropertyOptional({ description: 'Identifiant de la fiche auteur' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : Number(value)))
  @IsInt()
  authorId?: number;

  @ApiPropertyOptional({ description: 'Date libre (ISO ou libellé vitrine)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  date?: string;

  @ApiPropertyOptional({ description: 'Date de publication (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  @Type(() => String)
  publicationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDesc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @ApiPropertyOptional({ description: 'Date de publication (ISO-8601)' })
  @IsOptional()
  @IsString()
  publicationDate?: string;
}
