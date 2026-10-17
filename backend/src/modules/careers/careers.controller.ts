import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateCareerDto, UpdateCareerDto } from './dto/career.dto';
import { CareerEntity } from './entities/career.entity';
import { CareersService } from './careers.service';

@ApiTags('careers')
@ApiBearerAuth()
@Controller('careers')
@CrudResource('careers')
export class CareersController extends BaseCrudController<CareerEntity> {
  constructor(protected readonly service: CareersService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateCareerDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<CareerEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateCareerDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<CareerEntity>, actor);
  }
}
