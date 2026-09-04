import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Modules pouvant alimenter un sous-menu généré (voir lib/menu-auto.ts). */
export const AUTO_SOURCES = ['solutions', 'services', 'products', 'news', 'events'] as const;

/**
 * Règle de sous-menu généré depuis le contenu.
 *
 * On enregistre la règle, pas la liste : la vitrine la résout à l'affichage,
 * si bien qu'une fiche publiée ensuite apparaît d'elle-même et qu'une fiche
 * archivée disparaît sans repasser par l'administration.
 */
export class MenuAutoDto {
  @ApiProperty({ enum: AUTO_SOURCES })
  @IsIn(AUTO_SOURCES)
  source!: (typeof AUTO_SOURCES)[number];

  @ApiProperty({ enum: ['all', 'pick'] })
  @IsIn(['all', 'pick'])
  mode!: 'all' | 'pick';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  ids?: Array<string | number>;

  @ApiPropertyOptional({ description: '0 = pas de limite' })
  @IsOptional()
  @IsInt()
  @Min(0)
  limit?: number;
}

export class MenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  href!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  desc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  /**
   * Sous-liens saisis à la main.
   *
   * L'administration a toujours envoyé `submenu` ; le DTO ne déclarait que
   * `children`, et `forbidNonWhitelisted` rejetait donc l'enregistrement avec
   * « property submenu should not exist ». Les deux noms sont désormais
   * acceptés, `children` restant pour les menus déjà en base.
   */
  @ApiPropertyOptional({ type: () => [MenuItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  submenu?: MenuItemDto[];

  @ApiPropertyOptional({ type: () => [MenuItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  children?: MenuItemDto[];

  /** Règle de génération ; `submenu` est alors calculé côté vitrine. */
  @ApiPropertyOptional({ type: () => MenuAutoDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => MenuAutoDto)
  auto?: MenuAutoDto | null;
}

export const MENU_LOCATIONS = ['main', 'footer-nav', 'footer-legal', 'social'] as const;

export class CreateMenuDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: MENU_LOCATIONS })
  @IsIn(MENU_LOCATIONS)
  location!: (typeof MENU_LOCATIONS)[number];

  @ApiProperty({ type: [MenuItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items!: MenuItemDto[];

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}
