import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsObject, IsOptional, IsString, Matches } from 'class-validator';

/** Langue : deux à cinq lettres, éventuellement avec un sous-tag régional. */
const LOCALE_RE = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/;

export class ReplaceVisibilityDto {
  /**
   * Exceptions uniquement : une clé absente vaut « valeur par défaut ».
   * Un objet vide revient donc à rétablir les défauts.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { 'footer.careers': false, 'menu.events': false },
  })
  @IsObject()
  overrides!: Record<string, boolean>;
}

export class SetOneVisibilityDto {
  @ApiProperty({ example: 'footer.careers' })
  @IsString()
  @Matches(/^[a-z0-9_.-]{1,80}$/i, { message: 'key: caractères autorisés a-z 0-9 . _ -' })
  key!: string;

  @ApiProperty()
  @IsBoolean()
  on!: boolean;
}

export class CopyVisibilityDto {
  @ApiProperty({ example: 'fr' })
  @IsString()
  @Matches(LOCALE_RE, { message: 'from: code de langue invalide' })
  from!: string;

  @ApiPropertyOptional({ type: [String], example: ['en', 'ar'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(LOCALE_RE, { each: true, message: 'to: code de langue invalide' })
  to?: string[];
}
