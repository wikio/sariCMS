import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** D'où vient le visuel — c'est ce qui permet de retrouver la page qui l'affiche. */
export class GedSourceDto {
  @ApiPropertyOptional({ enum: ['builder', 'atelier', 'media', 'import'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  origin?: 'builder' | 'atelier' | 'media' | 'import';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  pageSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  componentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  field?: string;
}

/**
 * La payload d'export de l'atelier graphique.
 *
 * Le pipe global refuse une clé inconnue (`forbidNonWhitelisted`) : tout ce que
 * l'atelier envoie doit être déclaré ici, et c'est voulu — un champ oublié est un
 * champ qui cesse d'être écrit sans que personne ne s'en aperçoive.
 */
export class CanvasExportDto {
  @ApiPropertyOptional({ description: 'La référence `module/fichier` à réécrire (nouvelle version).' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  file?: string;

  @ApiPropertyOptional({ default: 'canvas', description: 'Le type rangé : `canvas`, `image`, `svg`, `doc`, ou une clé ajoutée à la table.' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  kind?: string;

  @ApiPropertyOptional({ description: 'Préfixe imposé. Vide = celui de la table pour le type demandé.' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,11}_$/, { message: 'ged.prefix_format' })
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiProperty({ description: 'Largeur du rendu, en pixels.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12000)
  width!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12000)
  height!: number;

  @ApiPropertyOptional({ description: 'PNG en base64, sans en-tête `data:`.' })
  @IsOptional()
  @IsString()
  png?: string;

  @ApiPropertyOptional({ description: 'SVG, admise seulement si le document est entièrement vectoriel.' })
  @IsOptional()
  @IsString()
  svg?: string;

  @ApiPropertyOptional({ description: 'L’état Fabric rejouable (JSON), pour réouvrir la planche.' })
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;

  @ApiPropertyOptional({ type: GedSourceDto })
  @IsOptional()
  @IsObject()
  source?: GedSourceDto;

  @ApiPropertyOptional({ description: 'Écrire seulement l’état : pas de nouveau rendu.' })
  @IsOptional()
  @IsBoolean()
  skipRender?: boolean;

  @ApiPropertyOptional({ enum: ['fabric', 'svg'], default: 'fabric' })
  @IsOptional()
  @IsString()
  format?: 'fabric' | 'svg';

  @ApiPropertyOptional({ description: 'Le module (dossier) cible. Par défaut celui du type.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;
}

/** Les filtres de liste. Un seul objet, pour que l'atelier et le constructeur trient pareil. */
export class ListAssetsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  kind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,11}_$/)
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}


/* --------------------------------------------------------------------- fiches */

/**
 * Écrire un asset depuis l'API métier : la retouche et l'import envoient un contenu
 * encodé, la GED décide du nom, du préfixe et du dossier.
 */
export class SaveAssetDto {
  @ApiPropertyOptional({ description: 'Le contenu encodé (`data:image/png;base64,…`).' })
  @IsOptional()
  @IsString()
  dataUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  kind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;

  @ApiPropertyOptional({ description: 'La référence exacte à écrire (`module/fichier`, ou un nom à la racine).' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  file?: string;

  @ApiPropertyOptional({ description: 'La référence à remplacer : l’ancien contenu part en `-vN`.' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  overwrite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,11}_$/, { message: 'ged.prefix_format' })
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  extension?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  width?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  height?: number;

  @ApiPropertyOptional({ description: 'L’état Fabric rejouable, écrit en même temps que le rendu.' })
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['fabric', 'svg'], default: 'fabric' })
  @IsOptional()
  @IsString()
  format?: 'fabric' | 'svg';

  @ApiPropertyOptional({ type: GedSourceDto })
  @IsOptional()
  @IsObject()
  source?: GedSourceDto;
}

/** Corriger la fiche d'un asset (titre, légende, étiquettes, dimensions). */
export class AssetPatchDto {
  @ApiProperty({ description: 'La référence `module/fichier` de l’asset.' })
  @IsString()
  @MaxLength(240)
  file!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  width?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  height?: number;
}

/** Renommer un asset ; le fichier, sa fiche et son état suivent. */
export class RenameAssetDto {
  @ApiProperty()
  @IsString()
  @MaxLength(240)
  file!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  newName!: string;
}

/** Attacher un état éditable à un asset déjà rendu. */
export class WriteStateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(240)
  file!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['fabric', 'svg'] })
  @IsOptional()
  @IsString()
  format?: 'fabric' | 'svg';
}

/** Publier un gabarit dans `public/canvas/templates`. */
export class TemplateUpsertDto {
  @ApiProperty({ description: 'L’identifiant — un nom de fichier : minuscules, chiffres, tirets.' })
  @IsString()
  @MaxLength(64)
  id!: string;

  @ApiProperty({ description: 'Le document Fabric rejouable.' })
  @IsObject()
  template!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meta?: Partial<{
    title: string;
    description: string;
    category: string;
    format: { width: number; height: number; name?: string; orientation?: string };
    palette: string[];
    tags: string[];
    version: number;
    slots: unknown[];
  }>;
}
