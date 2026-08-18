import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { MenuEntity } from './entities/menu.entity';
import { MenusService } from './menus.service';

@ApiTags('menus')
@ApiBearerAuth()
@Controller('menus')
@CrudResource('menus')
export class MenusController extends BaseCrudController<MenuEntity> {
  constructor(protected readonly service: MenusService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateMenuDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<MenuEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMenuDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<MenuEntity>, actor);
  }
}
