import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { NEWSLETTER_STATUSES, NEWSLETTER_UNSUBSCRIBE_REASONS } from '../entities/newsletter.entity';

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toList(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : undefined;
      } catch {
        return undefined;
      }
    }
    return text.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return undefined;
}

/** Inscription publique — le seul champ obligatoire est l'adresse. */
export class SubscribeDto {
  @ApiProperty({ example: 'clinique@example.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  name?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional({ description: 'Bloc d’origine : home.newsletter, news.detail, contact…' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  consent?: boolean;

  @ApiPropertyOptional({ description: 'Thèmes reçus (actualités, offres, événements…)' })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  /**
   * Mot laissé par le visiteur à la confirmation (étape facultative du
   * formulaire) : une précision sur son besoin, sa structure, un délai.
   */
  @ApiPropertyOptional({ description: 'Note libre du visiteur (facultatif)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /**
   * Adresse du visiteur, transmise par la passerelle du site.
   *
   * Le back-office et la vitrine appellent l'API à travers Next : `req.ip` y
   * vaudrait 127.0.0.1, ce qui ne veut rien dire pour une preuve de collecte.
   * Le champ est optionnel — l'API exposée directement garde son propre relevé.
   */
  @ApiPropertyOptional({ description: 'IP du visiteur (relayée par le site)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;

  @ApiPropertyOptional({ description: 'User-Agent du visiteur (relayé par le site)' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  userAgent?: string;
}

export class UnsubscribeDto extends SubscribeDto {
  @ApiPropertyOptional({ description: 'À défaut d’email, le jeton reçu lors de l’inscription' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  token?: string;

  /**
   * Motif choisi dans le formulaire de désinscription. Un code court, jamais un
   * libellé : la traduction appartient au site, pas à la donnée.
   */
  @ApiPropertyOptional({ enum: NEWSLETTER_UNSUBSCRIBE_REASONS })
  @IsOptional()
  @IsIn([...NEWSLETTER_UNSUBSCRIBE_REASONS])
  reason?: string;

  /** Commentaire libre qui accompagne le motif (`reason: 'other'`, notamment). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;
}

export class CreateNewsletterSubscriberDto extends SubscribeDto {
  @ApiPropertyOptional({ enum: NEWSLETTER_STATUSES })
  @IsOptional()
  @IsIn([...NEWSLETTER_STATUSES])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateNewsletterSubscriberDto extends PartialType(CreateNewsletterSubscriberDto) {}

/** Action de masse : statut ou suppression. */
export class BulkNewsletterDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];

  @ApiPropertyOptional({ enum: [...NEWSLETTER_STATUSES, 'delete'] })
  @IsOptional()
  @IsIn([...NEWSLETTER_STATUSES, 'delete'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
