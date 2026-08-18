import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import { PageEntity } from './entities/page.entity';
import { PagesService } from './pages.service';

@ApiTags('pages')
@ApiBearerAuth()
@Controller('pages')
@CrudResource('pages')
export class PagesController extends BaseCrudController<PageEntity> {
  constructor(protected readonly service: PagesService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreatePageDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<PageEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePageDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<PageEntity>, actor);
  }
}
