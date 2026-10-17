import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { PartnersService } from './partners.service';

@ApiTags('public')
@Public()
@Controller('public/partners')
export class PublicPartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  @ApiOperation({ summary: 'Partenaires publiés (vitrine)' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.partners.findAll(publishedQuery(query, locale ? { locale } : {}));
  }
}
