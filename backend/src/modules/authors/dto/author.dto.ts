import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SLUG_REGEX, SLUG_MESSAGE } from '../../../common/validation/slug';

/**
 * Le formulaire d'administration poste des chaînes vides pour les champs
 * facultatifs laissés vides ; on les ramène à `undefined` afin que les
 * validateurs `@IsEmail`/`@Matches` ne rejettent pas une absence de saisie.
 */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Les cases à cocher HTML arrivent parfois en "true"/"1" plutôt qu'en booléen. */
const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return value;
};

export class CreateAuthorDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ description: 'Qualification affichée sous le nom.' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(180)
  role?: string;

  @ApiPropertyOptional({ description: 'Présentation courte de l’auteur.' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional({
    description: "Auteur utilisé quand l'article n'en désigne aucun. Un seul auteur par langue.",
    default: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isFallback?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published'], default: 'published' })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  legacyId?: string;
}

export class UpdateAuthorDto extends PartialType(CreateAuthorDto) {}
