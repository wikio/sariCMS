import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto';
import { TestimonialEntity } from './entities/testimonial.entity';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@ApiBearerAuth()
@Controller('testimonials')
@CrudResource('testimonials')
export class TestimonialsController extends BaseCrudController<TestimonialEntity> {
  constructor(protected readonly service: TestimonialsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateTestimonialDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<TestimonialEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateTestimonialDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<TestimonialEntity>, actor);
  }
}
