import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { MenusService } from './menus.service';

@ApiTags('public')
@Public()
@Controller('public/menus')
export class PublicMenusController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @ApiOperation({ summary: 'Menus publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    // `view: 'block'` explicite : la valeur par défaut du DTO est `list`, dont
    // la projection (`listFields`) omet `items`. La vitrine recevait donc des
    // menus vides et retombait sur les données JSON de secours — les
    // sous-menus configurés dans l'administration n'apparaissaient jamais.
    return this.menus.findAll({ ...publishedQuery(query, locale ? { locale } : {}), view: 'block' });
  }

  @Get(':location')
  @ApiOperation({ summary: 'Menu publié par emplacement (main, footer-nav, …)' })
  async byLocation(@Param('location') location: string, @Query('locale') locale?: string) {
    const menu = await this.menus.findByLocation(location, locale || 'fr');
    if (!menu || menu.status !== 'published') throw new NotFoundException('Menu not found');
    return menu;
  }
}
