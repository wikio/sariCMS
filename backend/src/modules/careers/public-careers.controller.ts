import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { CareersService } from './careers.service';

@ApiTags('public')
@Public()
@Controller('public/careers')
export class PublicCareersController {
  constructor(private readonly careers: CareersService) {}

  @Get()
  @ApiOperation({ summary: 'Offres d’emploi publiées' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.careers.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  // Déclaré avant ':idOrSlug' : sinon Nest capterait « translations » comme un slug.
  @Get(':idOrSlug/translations')
  @ApiOperation({
    summary: "Versions linguistiques d'une fiche (même legacyId)",
    description:
      "Permet au sélecteur de langue de rediriger vers l'URL équivalente dans la langue cible.",
  })
  translations(@Param('idOrSlug') idOrSlug: string) {
    return this.careers.findTranslations(idOrSlug);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Offre publiée par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.careers.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Career not found');
    return item;
  }
}
