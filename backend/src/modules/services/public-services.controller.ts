import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { ServicesService } from './services.service';

@ApiTags('public')
@Public()
@Controller('public/services')
export class PublicServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Services publiés (vitrine)' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.services.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  // Déclaré avant ':idOrSlug' : sinon Nest capterait « translations » comme un slug.
  @Get(':idOrSlug/translations')
  @ApiOperation({
    summary: "Versions linguistiques d'une fiche (même legacyId)",
    description:
      "Permet au sélecteur de langue de rediriger vers l'URL équivalente dans la langue cible.",
  })
  translations(@Param('idOrSlug') idOrSlug: string) {
    return this.services.findTranslations(idOrSlug);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Service publié par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.services.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Service not found');
    return item;
  }
}
