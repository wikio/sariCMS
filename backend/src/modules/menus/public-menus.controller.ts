import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { MenusService } from './menus.service';

@ApiTags('public')
@Public()
@Controller('public/menus')
export class PublicMenusController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @ApiOperation({ summary: 'Menus publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.menus.findAll({
      ...query,
      filter: { ...(query.filter ?? {}), ...(locale ? { locale } : {}), status: 'published' },
    });
  }

  @Get(':location')
  @ApiOperation({ summary: 'Menu publié par emplacement (main, footer-nav, …)' })
  async byLocation(@Param('location') location: string, @Query('locale') locale?: string) {
    const menu = await this.menus.findByLocation(location, locale || 'fr');
    if (!menu || menu.status !== 'published') throw new NotFoundException('Menu not found');
    return menu;
  }
}
