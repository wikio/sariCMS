import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HomeSectionsService } from './home-sections.service';

/**
 * Lecture publique de la configuration des blocs.
 *
 * Seules les lignes publiées sortent ; un bloc en brouillon reste donc invisible
 * tant que son enregistrement n'est pas publié, indépendamment de `enabled`.
 * La fusion avec la langue de référence est faite par la vitrine (elle seule
 * connaît sa langue par défaut).
 */
@ApiTags('public')
@Public()
@Controller('public/home/sections')
export class PublicHomeController {
  constructor(private readonly sections: HomeSectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Configuration des blocs de la page d’accueil' })
  @ApiQuery({ name: 'locale', example: 'fr' })
  async list(@Query('locale') locale?: string) {
    const rows = await this.sections.findForLocales([locale || 'fr']);
    return rows.filter((row) => row.status === 'published');
  }

  @Get(':key')
  @ApiOperation({ summary: 'Configuration d’un bloc' })
  @ApiQuery({ name: 'locale', example: 'fr' })
  async one(@Param('key') key: string, @Query('locale') locale?: string) {
    const row = await this.sections.findByKeyAndLocale(key, locale || 'fr');
    if (!row || row.status !== 'published') return null;
    return row;
  }
}
