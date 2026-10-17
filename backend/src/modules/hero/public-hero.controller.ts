import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { HeroService } from './hero.service';

@ApiTags('public')
@Public()
@Controller('public/hero')
export class PublicHeroController {
  constructor(private readonly hero: HeroService) {}

  @Get()
  @ApiOperation({ summary: 'Slides hero publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.hero.findAll({
      ...publishedQuery(query, locale ? { locale } : {}),
      sortBy: query.sortBy || 'sortOrder',
      sortOrder: query.sortOrder || 'asc',
    });
  }
}
