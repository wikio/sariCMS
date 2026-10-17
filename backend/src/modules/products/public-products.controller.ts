import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { publishedQuery } from '../../common/crud/query.util';
import { ProductsService } from './products.service';

@ApiTags('public')
@Public()
@Controller('public/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Produits publiés' })
  list(@Query() query: QueryDto, @Query('locale') locale?: string) {
    return this.products.findAll(publishedQuery(query, locale ? { locale } : {}));
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Produit publié par slug ou id' })
  async bySlug(@Param('idOrSlug') idOrSlug: string, @Query('locale') locale?: string) {
    const item = await this.products.findPublished(idOrSlug, locale);
    if (!item) throw new NotFoundException('Product not found');
    return item;
  }
}
