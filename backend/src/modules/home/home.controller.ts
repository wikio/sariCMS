import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { AutocompleteQueryDto, QueryDto } from '../../common/crud/dto/query.dto';
import { CopyHomeSectionDto, ReorderHomeSectionsDto, UpsertHomeSectionDto } from './dto/home-section.dto';
import { HomeSectionsService } from './home-sections.service';

/**
 * Studio de la page d'accueil : un bloc = une ligne par langue.
 *
 * Les routes sont volontairement sous `/home/sections/…` plutôt que
 * `/home/:id` : le studio n'a jamais d'id à manipuler, il raisonne en clés de
 * bloc (`hero`, `mission`, …), et l'écriture est un enregistrement (upsert) —
 * créer ou remplacer selon que la ligne existe déjà.
 */
@ApiTags('home')
@ApiBearerAuth()
@Controller('home/sections')
@CrudResource('home')
export class HomeController {
  constructor(private readonly sections: HomeSectionsService) {}

  @Get()
  @RequirePermissions(perm('home', 'read'))
  @ApiOperation({ summary: 'Lignes de configuration des blocs, par langue' })
  @ApiQuery({ name: 'locale', example: 'fr' })
  @ApiQuery({ name: 'locales', example: 'fr,en,ar' })
  async list(@Query() query: QueryDto, @Query('locale') locale?: string, @Query('locales') locales?: string) {
    const wanted = (locales || locale || 'fr').split(',').map((s) => s.trim()).filter(Boolean);
    const rows = await this.sections.findForLocales(wanted);
    // Vue « block » : le studio a besoin des objets complets (textes, réglages,
    // blocs répétables, HTML du constructeur), la liste légère ne suffit pas.
    return { data: rows, meta: { total: rows.length, page: 1, limit: rows.length || 1, totalPages: 1 } };
  }

  @Get('autocomplete')
  @RequirePermissions(perm('home', 'read'))
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.sections.autocomplete(query);
  }

  @Get('trash')
  @RequirePermissions(perm('home', 'read'))
  @ApiOperation({ summary: 'Blocs réinitialisés (corbeille)' })
  trash(@Query() query: QueryDto) {
    return this.sections.trash(query);
  }

  @Get(':key')
  @RequirePermissions(perm('home', 'read'))
  @ApiOperation({ summary: 'Ligne d’un bloc pour une langue' })
  async one(@Param('key') key: string, @Query('locale') locale?: string) {
    return this.sections.findByKeyAndLocale(key, locale || 'fr');
  }

  @Put(':key')
  @RequirePermissions(perm('home', 'update'))
  @ApiOperation({ summary: 'Enregistre (crée ou remplace) la configuration d’un bloc' })
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertHomeSectionDto,
    @Actor() actor: ActorContext,
  ) {
    return this.sections.upsert(key, dto.locale || 'fr', dto as never, actor);
  }

  @Post(':key/copy')
  @RequirePermissions(perm('home', 'update'))
  @ApiOperation({ summary: 'Copie la configuration d’une langue vers d’autres' })
  copy(@Param('key') key: string, @Body() dto: CopyHomeSectionDto, @Actor() actor: ActorContext) {
    const keys = dto.keys?.length ? dto.keys : [key].filter(Boolean);
    return this.sections.copy(dto.from, dto.to || [], keys, Boolean(dto.withTexts), actor);
  }

  @Post('copy')
  @RequirePermissions(perm('home', 'update'))
  @ApiOperation({ summary: 'Copie tous les blocs d’une langue vers d’autres' })
  copyAll(@Body() dto: CopyHomeSectionDto, @Actor() actor: ActorContext) {
    return this.sections.copy(dto.from, dto.to || [], dto.keys, Boolean(dto.withTexts), actor);
  }

  @Post('reorder')
  @RequirePermissions(perm('home', 'update'))
  @ApiOperation({ summary: 'Nouvel ordre des blocs sur la page' })
  reorder(@Body() dto: ReorderHomeSectionsDto, @Actor() actor: ActorContext) {
    return this.sections.reorder(dto.locale, dto.keys || [], actor);
  }

  @Delete(':key')
  @RequirePermissions(perm('home', 'delete'))
  @ApiOperation({ summary: 'Réinitialise un bloc (retour aux valeurs par défaut)' })
  reset(@Param('key') key: string, @Query('locale') locale?: string, @Actor() actor?: ActorContext) {
    return this.sections.reset(key, locale || 'fr', actor);
  }
}
