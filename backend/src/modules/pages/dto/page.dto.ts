import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PAGE_KINDS, PAGE_STATUSES, PAGE_SUBTYPES } from '../entities/page.entity';
import { SLUG_REGEX, SLUG_MESSAGE } from '../../../common/validation/slug';

export class PageSlideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  media?: string;

  @ApiPropertyOptional({ enum: ['image', 'video', 'youtube'] })
  @IsOptional()
  @IsIn(['image', 'video', 'youtube'])
  mediaType?: 'image' | 'video' | 'youtube';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaLink?: string;
}

export class CreatePageDto {
  @ApiProperty({ example: 'mentions-legales' })
  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiProperty({ enum: PAGE_KINDS })
  @IsIn(PAGE_KINDS)
  kind!: (typeof PAGE_KINDS)[number];

  @ApiPropertyOptional({ enum: PAGE_SUBTYPES, default: 'simple' })
  @IsOptional()
  @IsIn(PAGE_SUBTYPES)
  subtype?: (typeof PAGE_SUBTYPES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'URL unique ou tableau d’URLs (galerie)' })
  @IsOptional()
  media?: string | string[];

  @ApiPropertyOptional({ type: [PageSlideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSlideDto)
  slides?: PageSlideDto[];

  @ApiPropertyOptional({ type: [PageSlideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSlideDto)
  sections?: PageSlideDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfUrl?: string;

  @ApiPropertyOptional({ enum: PAGE_STATUSES })
  @IsOptional()
  @IsIn(PAGE_STATUSES)
  status?: (typeof PAGE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePageDto extends PartialType(CreatePageDto) {}
