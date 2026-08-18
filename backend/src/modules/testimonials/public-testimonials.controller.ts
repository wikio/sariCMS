import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { TestimonialsService } from './testimonials.service';

@ApiTags('public')
@Public()
@Controller('public/testimonials')
export class PublicTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'Témoignages publiés' })
  list(@Query() query: QueryDto) {
    return this.testimonials.findAll({
      ...query,
      filter: { ...(query.filter ?? {}), status: 'published' },
    });
  }
}
