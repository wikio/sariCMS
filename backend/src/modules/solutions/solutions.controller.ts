import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateSolutionDto, UpdateSolutionDto } from './dto/solution.dto';
import { SolutionEntity } from './entities/solution.entity';
import { SolutionsService } from './solutions.service';

@ApiTags('solutions')
@ApiBearerAuth()
@Controller('solutions')
@CrudResource('solutions')
export class SolutionsController extends BaseCrudController<SolutionEntity> {
  constructor(protected readonly service: SolutionsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateSolutionDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<SolutionEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSolutionDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<SolutionEntity>, actor);
  }
}
