import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { NewsService } from './news.service';

@ApiTags('public')
@Public()
@Controller('public/news')
export class PublicNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Actualités publiées' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.news.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Actualité publiée par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.news.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('News not found');
    return item;
  }
}
