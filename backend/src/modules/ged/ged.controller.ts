import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssetPatchDto, CanvasExportDto, ListAssetsDto, RenameAssetDto, SaveAssetDto, TemplateUpsertDto, WriteStateDto } from './dto/canvas-export.dto';
import { GedService } from './ged.service';

/**
 * La GED vue du backend.
 *
 * `@ApiBearerAuth` et pas de `@Public()` : écrire dans les médias du site relève de
 * l'administration. Le back-office Next passe par ses propres route handlers, qui
 * tapent le même magasin de fichiers — les deux chemins se rejoignent sur la même
 * politique de préfixes, et c'est ce qui permet à une planche créée ici d'apparaître
 * là-bas sans synchronisation.
 */
@ApiTags('ged')
@ApiBearerAuth()
@Controller('ged')
export class GedController {
  constructor(private readonly ged: GedService) {}

  @Post('canvas-export')
  @ApiOperation({ summary: 'Enregistrer un rendu de l’atelier (PNG, SVG, état éditable) dans la GED' })
  export(@Body() dto: CanvasExportDto) {
    return this.ged.exportCanvas(dto);
  }

  @Get('assets')
  @ApiOperation({ summary: 'Lister la GED : recherche, filtres par type/préfixe/étiquette, pagination' })
  list(@Query() query: ListAssetsDto) {
    return this.ged.list(query);
  }

  @Get('asset/state')
  @ApiOperation({ summary: 'L’état éditable d’un asset, pour le réouvrir dans l’atelier' })
  state(@Query('file') file: string) {
    return this.ged.readState(file).then((state) => ({ file, state }));
  }

  /**
   * Un asset, sa fiche et son état : ce que l'atelier relit avant d'ouvrir une planche
   * et ce que la médiathèque affiche au clic. La forme de réponse est celle des routes
   * Next, pour qu'aucun écran n'ait à savoir laquelle des deux l'a servie.
   */
  @Get('asset')
  @ApiOperation({ summary: 'La fiche complète d’un asset (métadonnées + état éditable)' })
  asset(@Query('file') file: string) {
    return this.ged.readAsset(file);
  }

  @Post('assets')
  @HttpCode(201)
  @ApiOperation({ summary: 'Écrire un asset dans la GED depuis un contenu encodé (retouche, import)' })
  save(@Body() dto: SaveAssetDto) {
    return this.ged.saveAsset(dto);
  }

  @Patch('asset')
  @ApiOperation({ summary: 'Corriger les métadonnées d’un asset — ce que le PATCH historique ne savait pas faire' })
  patch(@Body() dto: AssetPatchDto) {
    return this.ged.patchAsset(dto);
  }

  @Put('asset')
  @ApiOperation({ summary: 'Renommer un asset ; la réponse porte la nouvelle URL à réécrire dans les pages' })
  rename(@Body() dto: RenameAssetDto) {
    return this.ged.renameAsset(dto);
  }

  @Delete('asset')
  @ApiOperation({ summary: 'Supprimer un asset et ses fichiers d’à-côté (?history=1 emporte les versions)' })
  remove(@Query() query: { file?: string; history?: string }) {
    return this.ged.deleteAsset(String(query.file || ''), query.history === '1' || query.history === 'true');
  }

  @Post('asset/state')
  @ApiOperation({ summary: 'Attacher un état éditable à un asset déjà rendu' })
  writeState(@Body() dto: WriteStateDto) {
    return this.ged.writeState(dto);
  }

  /* ------------------------------------------------------------- les gabarits */

  @Get('templates')
  @ApiOperation({ summary: 'Le catalogue des gabarits de l’atelier (public/canvas/templates)' })
  templates() {
    return this.ged.listTemplates();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Un gabarit et sa fiche, prêts pour Fabric' })
  template(@Param('id') id: string) {
    return this.ged.readTemplate(id);
  }

  @Post('templates')
  @HttpCode(201)
  @ApiOperation({ summary: 'Publier la planche courante comme gabarit réutilisable' })
  saveTemplate(@Body() dto: TemplateUpsertDto) {
    return this.ged.saveTemplate(dto);
  }

  @Delete('templates')
  @ApiOperation({ summary: 'Retirer un gabarit du catalogue' })
  removeTemplate(@Query('id') id: string) {
    return this.ged.deleteTemplate(String(id || ''));
  }
}
