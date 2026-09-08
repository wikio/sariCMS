import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';
import { ApplicationEntity } from './entities/application.entity';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
@CrudResource('applications')
export class ApplicationsController extends BaseCrudController<ApplicationEntity> {
  constructor(protected readonly service: ApplicationsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateApplicationDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<ApplicationEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateApplicationDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<ApplicationEntity>, actor);
  }
}
