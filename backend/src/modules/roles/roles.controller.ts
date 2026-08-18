import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { ActorContext } from '../../common/crud/base-crud.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RoleEntity } from './entities/role.entity';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@CrudResource('roles')
export class RolesController extends BaseCrudController<RoleEntity> {
  constructor(protected readonly service: RolesService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateRoleDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<RoleEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoleDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<RoleEntity>, actor);
  }
}
