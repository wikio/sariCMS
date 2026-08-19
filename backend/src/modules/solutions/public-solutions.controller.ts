import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { SolutionsService } from './solutions.service';

@ApiTags('public')
@Public()
@Controller('public/solutions')
export class PublicSolutionsController {
  constructor(private readonly solutions: SolutionsService) {}

  @Get()
  @ApiOperation({ summary: 'Catégories de solutions publiées' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.solutions.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Solution publiée par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.solutions.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Solution not found');
    return item;
  }
}
