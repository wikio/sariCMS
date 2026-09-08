import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CommerceItemDto, HistoryEntryDto } from '../../orders/dto/order.dto';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const QUOTE_STATUSES = [
  'draft',
  'submitted',
  'processing',
  'replied',
  'revision',
  'accepted',
  'rejected',
  'transformed',
  'expired',
  'cancelled',
  // conservés pour les données historiques de l'admin
  'pending',
  'sent',
] as const;

export class CreateQuoteDto {
  @ApiPropertyOptional({ example: 'DV-2026-00001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @ApiPropertyOptional({ description: 'Compte client rattaché (users.id)' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  client!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  company?: string;

  @ApiPropertyOptional({ enum: QUOTE_STATUSES, default: 'submitted' })
  @IsOptional()
  @IsIn(QUOTE_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({ default: 'DZD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ description: 'Durée de validité affichée' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  validity?: string;

  @ApiPropertyOptional({ type: [CommerceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommerceItemDto)
  items?: CommerceItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  coupon?: string;

  @ApiPropertyOptional({ description: 'Commande générée après acceptation' })
  @IsOptional()
  @IsInt()
  orderId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  zone?: string;

  @ApiPropertyOptional({ type: [HistoryEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryEntryDto)
  history?: HistoryEntryDto[];

  @ApiPropertyOptional({ example: 'vente | consultation | appel-offre | gros | autre' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  natureOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Date souhaitée (ISO)' })
  @IsOptional()
  @IsString()
  desiredDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachments?: string[];

  @ApiPropertyOptional({ type: Object, description: 'Réponse commerciale' })
  @IsOptional()
  @IsObject()
  response?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Date de la demande (ISO)' })
  @IsOptional()
  @IsString()
  date?: string;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
