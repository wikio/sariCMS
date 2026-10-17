import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { PagesService } from './pages.service';

@ApiTags('public')
@Public()
@Controller('public/pages')
export class PublicPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Pages publiées (vitrine)' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    // Filtre par locale (comme les autres endpoints publics) pour que la vitrine
    // reçoive uniquement les pages de la langue demandée.
    return this.pages.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Page publiée par slug' })
  async bySlug(@Param('slug') slug: string, @Query('locale') locale?: string) {
    const page = await this.pages.findPublishedBySlug(slug, locale || 'fr');
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }
}
