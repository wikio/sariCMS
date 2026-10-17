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

  // Déclaré avant ':idOrSlug' : sinon Nest capterait « translations » comme un slug.
  @Get(':idOrSlug/translations')
  @ApiOperation({
    summary: "Versions linguistiques d'une solution (même legacyId)",
    description:
      "Permet au sélecteur de langue de rediriger vers l'URL équivalente, ex. fr/solutions/1-diagnostic → ar/solutions/101-التشخيص-والتصوير.",
  })
  translations(@Param('idOrSlug') idOrSlug: string) {
    return this.solutions.findTranslations(idOrSlug);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Solution publiée par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.solutions.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Solution not found');
    return item;
  }
}
