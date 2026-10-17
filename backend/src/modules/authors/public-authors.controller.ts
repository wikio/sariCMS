import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { AuthorsService } from './authors.service';

@ApiTags('public')
@Public()
@Controller('public/authors')
export class PublicAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Auteurs publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.authors.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  // Déclaré avant ':id' pour que « default » ne soit pas capté comme un id.
  @Get('default')
  @ApiOperation({
    summary: "Auteur de repli d'une langue",
    description:
      "Utilisé par la vitrine lorsqu'un article ne désigne aucun auteur. Renvoie null si aucune fiche n'est marquée.",
  })
  async fallback(@Query('locale') locale?: string) {
    return (await this.authors.findFallback(locale || 'fr')) ?? null;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Auteur publié par id' })
  async byId(@Param('id') id: string) {
    const item = await this.authors.findOne(Number(id), 'block');
    if (!item) throw new NotFoundException('Author not found');
    return item;
  }
}
