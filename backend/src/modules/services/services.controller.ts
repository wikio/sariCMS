import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { ServiceEntity } from './entities/service.entity';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
@CrudResource('services')
export class ServicesController extends BaseCrudController<ServiceEntity> {
  constructor(protected readonly service: ServicesService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateServiceDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<ServiceEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateServiceDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<ServiceEntity>, actor);
  }
}
