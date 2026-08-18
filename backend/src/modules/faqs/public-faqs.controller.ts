import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { FaqsService } from './faqs.service';

@ApiTags('public')
@Public()
@Controller('public/faqs')
export class PublicFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({ summary: 'FAQ publiées' })
  list(@Query() query: QueryDto) {
    return this.faqs.findAll({
      ...query,
      filter: { ...(query.filter ?? {}), status: 'published' },
      sortBy: query.sortBy ?? 'sortOrder',
      sortOrder: query.sortOrder ?? 'asc',
    });
  }
}
