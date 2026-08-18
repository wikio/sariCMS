import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqEntity } from './entities/faq.entity';
import { FaqsService } from './faqs.service';

@ApiTags('faqs')
@ApiBearerAuth()
@Controller('faqs')
@CrudResource('faqs')
export class FaqsController extends BaseCrudController<FaqEntity> {
  constructor(protected readonly service: FaqsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateFaqDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<FaqEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateFaqDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<FaqEntity>, actor);
  }
}
