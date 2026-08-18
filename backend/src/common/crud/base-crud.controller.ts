import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Actor } from '../decorators/actor.decorator';
import { AutocompleteQueryDto, PurgeConfirmDto, QueryDto, VIEW_MODES } from './dto/query.dto';
import { ActorContext, BaseCrudService } from './base-crud.service';
import { BaseEntity } from './interfaces/repository.interface';

/**
 * Generic CRUD controller. Concrete controllers inherit and only add
 * module-specific endpoints. Swagger metadata is declared here so every
 * resource documents the same contract.
 */
@ApiBearerAuth()
@ApiTags('crud')
export abstract class BaseCrudController<T extends BaseEntity> {
  protected abstract readonly service: BaseCrudService<T>;

  @Get()
  @ApiOperation({ summary: 'Liste paginée (filtres, tri, recherche, vue)' })
  @ApiQuery({ name: 'view', required: false, enum: VIEW_MODES })
  @ApiResponse({ status: 200, description: 'Page de résultats' })
  findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete réutilisable' })
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.service.autocomplete(query);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Corbeille (éléments soft-deleted)' })
  trash(@Query() query: QueryDto) {
    return this.service.trash(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'view', required: false, enum: VIEW_MODES })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('view') view?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const mode = VIEW_MODES.includes(view as (typeof VIEW_MODES)[number])
      ? (view as (typeof VIEW_MODES)[number])
      : 'block';
    return this.service.findOne(id, mode, includeDeleted === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Création' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: any, @Actor() actor: ActorContext) {
    return this.service.create(dto as Partial<T>, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mise à jour partielle' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: any,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as Partial<T>, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Suppression douce (envoie en corbeille)' })
  softDelete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Actor() actor: ActorContext,
  ) {
    return this.service.softDelete(id, actor);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurer depuis la corbeille' })
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Actor() actor: ActorContext,
  ) {
    return this.service.restore(id, actor);
  }

  @Post(':id/purge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander une suppression définitive (renvoie un jeton de confirmation)',
  })
  requestPurge(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Actor() actor: ActorContext,
  ) {
    return this.service.requestPurge(id, actor);
  }

  @Delete(':id/purge')
  @ApiOperation({
    summary: 'Confirmer la suppression définitive avec le jeton reçu',
  })
  confirmPurge(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: PurgeConfirmDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.confirmPurge(id, query.confirm, actor);
  }
}
