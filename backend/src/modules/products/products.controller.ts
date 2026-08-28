import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductEntity } from './entities/product.entity';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@CrudResource('products')
export class ProductsController extends BaseCrudController<ProductEntity> {
  constructor(protected readonly service: ProductsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateProductDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<ProductEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateProductDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<ProductEntity>, actor);
  }
}
