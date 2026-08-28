import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateTranslationDto, UpdateTranslationDto } from './dto/translation.dto';
import { TranslationEntity } from './entities/translation.entity';
import { TranslationsService } from './translations.service';

@ApiTags('translations')
@ApiBearerAuth()
@Controller('translations')
@CrudResource('translations')
export class TranslationsController extends BaseCrudController<TranslationEntity> {
  constructor(protected readonly service: TranslationsService) {
    super();
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Toutes les traductions d’une entité' })
  forEntity(@Param('entityType') entityType: string, @Param('entityId', new ParseIntPipe()) entityId: number) {
    return this.service.forEntity(entityType, entityId);
  }

  @Post()
  override create(@Body() dto: CreateTranslationDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<TranslationEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateTranslationDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<TranslationEntity>, actor);
  }
}
