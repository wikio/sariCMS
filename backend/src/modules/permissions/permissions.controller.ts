import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreatePermissionDto, UpdatePermissionDto } from '../roles/dto/role.dto';
import { PermissionEntity } from '../roles/entities/role.entity';
import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
@CrudResource('permissions')
export class PermissionsController extends BaseCrudController<PermissionEntity> {
  constructor(protected readonly service: PermissionsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreatePermissionDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<PermissionEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdatePermissionDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<PermissionEntity>, actor);
  }
}
