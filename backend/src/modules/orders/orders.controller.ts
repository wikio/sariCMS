import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrderEntity } from './entities/order.entity';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@CrudResource('orders')
export class OrdersController extends BaseCrudController<OrderEntity> {
  constructor(protected readonly service: OrdersService) {
    super();
  }

  @Public()
  @Post()
  override create(@Body() dto: CreateOrderDto, @Actor() actor: ActorContext) {
    // Public : permet aux clients (y compris invités) de créer une commande sans être admin.
    // L'IP est capturée si disponible, l'actor peut être vide.
    if (!dto.date) (dto as unknown as Record<string, unknown>).date = new Date().toISOString();
    return this.service.create(dto as unknown as Partial<OrderEntity>, actor || { ip: undefined } as ActorContext);
  }

  @Public()
  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateOrderDto,
    @Actor() actor: ActorContext,
  ) {
    // Public pour permettre la mise à jour du paiement par le client (vitrine)
    return this.service.update(id, dto as unknown as Partial<OrderEntity>, actor || { ip: undefined } as ActorContext);
  }
}
