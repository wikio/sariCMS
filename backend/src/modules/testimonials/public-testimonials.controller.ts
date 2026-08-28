import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { TestimonialsService } from './testimonials.service';

@ApiTags('public')
@Public()
@Controller('public/testimonials')
export class PublicTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'Témoignages publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.testimonials.findAll(publishedQuery(query, locale ? { locale } : {}));
  }
}
