import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SLUG_REGEX, SLUG_MESSAGE } from '../../../common/validation/slug';

export class SolutionFaqDto {
  @ApiProperty()
  @IsString()
  @MaxLength(240)
  q!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  a!: string;
}

export class CreateSolutionDto {
  @ApiProperty({ example: 'Diagnostic & Imagerie' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'diagnostic' })
  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional({
    description:
      "Identifiant commun aux versions linguistiques d'une même solution. Permet au sélecteur de langue de basculer vers la bonne fiche traduite.",
    example: 'sol-1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  legacyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDesc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullDesc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  productIds?: Array<string | number>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ type: [SolutionFaqDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolutionFaqDto)
  faq?: SolutionFaqDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;
}

export class UpdateSolutionDto extends PartialType(CreateSolutionDto) {}
