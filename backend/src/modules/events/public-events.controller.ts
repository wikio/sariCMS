import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { EventsService } from './events.service';

@ApiTags('public')
@Public()
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Événements publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.events.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Événement publié par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.events.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Event not found');
    return item;
  }
}
