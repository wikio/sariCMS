import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

/**
 * Ligne de commande. Doit être une classe typée : avec `whitelist: true`
 * (main.ts), un simple `@IsArray()` sur du `unknown[]` fait supprimer toutes
 * les propriétés des objets — le panier arrivait vide en base.
 */
export class CommerceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: number | string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ description: 'Unité de mesure (pièce, kg, m²…)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  attachment?: string;

  @ApiPropertyOptional({ description: 'Taux de taxe (%)' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;
}

/** Entrée d'historique de statut. */
export class HistoryEntryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  status!: string;

  @ApiProperty()
  @IsString()
  at!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'SARI-WCMD26-00001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({ description: 'Compte client rattaché (users.id)' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiProperty({ example: 'Sonatrach' })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  client!: string;

  @ApiProperty({ example: 'contact@client.dz' })
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

  @ApiPropertyOptional({ enum: ORDER_STATUSES, default: 'pending' })
  @IsOptional()
  @IsIn(ORDER_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ default: 'DZD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ type: [CommerceItemDto], description: 'Lignes de commande' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommerceItemDto)
  items?: CommerceItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  payment?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  coupon?: string;

  @ApiPropertyOptional({ description: 'Devis à l’origine de la commande' })
  @IsOptional()
  @IsInt()
  quoteId?: number;

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

  @ApiPropertyOptional({ type: Object, description: 'Facture liée (ERP ou upload)' })
  @IsOptional()
  @IsObject()
  invoice?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Date de la commande (ISO)' })
  @IsOptional()
  @IsString()
  date?: string;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
