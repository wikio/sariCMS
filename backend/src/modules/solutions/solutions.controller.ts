import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
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
    @Param('id', new ParseIntPipe()) id: number,
    @Body() body: any,
    @Actor() actor: ActorContext,
  ) {
    console.log('[SolutionsController.update] Raw body received:', JSON.stringify(body, null, 2));
    return this.service.update(id, body as Partial<SolutionEntity>, actor);
  }
}
