import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { GraphicsService } from './graphics.service';

@ApiTags('public-graphics')
@Public()
@Controller('public/graphics')
export class GraphicsController {
  constructor(private readonly graphics: GraphicsService) {}

  @Get('formats')
  @ApiOperation({ summary: 'Dimensions des formats sociaux intégrés' })
  formats() { return this.graphics.formats(); }

  @Get('social/:source/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Image sociale dynamique PNG/JPEG/WebP à partir d’un contenu publié',
    description: 'Exemple : /api/v1/public/graphics/social/articles/mon-article?platform=linkedin&locale=fr&qr=1. Les sources `articles`, `announcements` et `tips` ciblent les actualités publiées.',
  })
  @ApiQuery({ name: 'platform', required: false, description: 'youtube, instagram, instagram-story, facebook, facebook-cover, linkedin, x, pinterest, og, youtube-banner' })
  @ApiQuery({ name: 'locale', required: false, description: 'Langue du contenu publié (fr, en, ar)' })
  @ApiQuery({ name: 'title', required: false, description: 'Remplacement facultatif du titre du contenu' })
  @ApiQuery({ name: 'summary', required: false, description: 'Remplacement facultatif du résumé' })
  @ApiQuery({ name: 'image', required: false, description: 'Chemin GED /uploads/... à la place de l’image de la fiche' })
  @ApiQuery({ name: 'logo', required: false, description: 'Chemin GED du logo, ou `none` pour le masquer; par défaut logo configuré du site' })
  @ApiQuery({ name: 'bg', required: false, description: 'Couleur de fond hexadécimale (#RRGGBB)' })
  @ApiQuery({ name: 'bg2', required: false, description: 'Deuxième couleur du dégradé' })
  @ApiQuery({ name: 'accent', required: false, description: 'Couleur d’accentuation' })
  @ApiQuery({ name: 'textColor', required: false, description: 'Couleur du texte' })
  @ApiQuery({ name: 'align', required: false, enum: ['left', 'center', 'right'] })
  @ApiQuery({ name: 'overlay', required: false, description: 'Intensité du voile sombre entre 0 et 0.88' })
  @ApiQuery({ name: 'titleX', required: false, description: 'Position horizontale du texte en pourcentage (3 à 97)' })
  @ApiQuery({ name: 'titleY', required: false, description: 'Position verticale du titre en pourcentage (15 à 90)' })
  @ApiQuery({ name: 'logoPosition', required: false, enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] })
  @ApiQuery({ name: 'qr', required: false, description: '1 pour inclure un QR code qui ouvre url ou le lien canonique' })
  @ApiQuery({ name: 'qrPosition', required: false, enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] })
  @ApiQuery({ name: 'url', required: false, description: 'URL encodée dans le QR code et renvoyée avec la carte' })
  @ApiQuery({ name: 'format', required: false, enum: ['png', 'jpeg', 'webp'] })
  async social(@Param('source') source: string, @Param('id') id: string, @Query() query: Record<string, unknown>, @Res() res: Response) {
    const result = await this.graphics.social(source, id, query);
    res.set({
      'Content-Type': `image/${result.format === 'jpeg' ? 'jpeg' : result.format}`,
      'Content-Length': String(result.buffer.length),
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Image-Width': String(result.width),
      'X-Image-Height': String(result.height),
    });
    res.send(result.buffer);
  }

  @Get('qr')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Générer un QR code PNG configurable' })
  async qr(@Query('data') data: string, @Query('size') size: string, @Query('color') color: string, @Query('background') background: string, @Query('margin') margin: string, @Res() res: Response) {
    const png = await this.graphics.qr(data, { size: Number(size), color, background, margin: Number(margin) });
    res.set({ 'Content-Type': 'image/png', 'Content-Length': String(png.length), 'Cache-Control': 'public, max-age=300' }).send(png);
  }

  @Get('barcode')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Générer un code-barres PNG (Code 128, EAN, UPC, ITF-14, ISBN, Code 39 ou Data Matrix)' })
  async barcode(@Query('data') data: string, @Query('type') type: string, @Query('color') color: string, @Query('background') background: string, @Query('scale') scale: string, @Query('height') height: string, @Res() res: Response) {
    const png = await this.graphics.barcode(data, type, { color, background, scale: Number(scale), height: Number(height) });
    res.set({ 'Content-Type': 'image/png', 'Content-Length': String(png.length), 'Cache-Control': 'public, max-age=300' }).send(png);
  }
}
