import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
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
  @Get('my/list')
  async myOrders(@Actor() actor: any, @Query() query: Record<string, unknown>) {
    // Supporte deux modes: authentifié (JWT -> actor) ou public par email (fallback démo sans token).
    // La garde JwtAuthGuard est désormais "optionnelle" pour @Public: actor est peuplé si token valide, sinon null.
    const rawId = actor?.id ? String(actor.id) : (query.userId ? String(query.userId) : (query.user_id ? String((query as any).user_id) : ''));
    const rawEmail = actor?.email ? String(actor.email).toLowerCase() : (query.email ? String(query.email).toLowerCase() : '');
    if (!rawId && !rawEmail) throw new UnauthorizedException('Not authenticated');
    const page = Number((query as any).page) || 1;
    const limit = Math.min(100, Number((query as any).limit) || 100);
    const res: any = await this.service.findAll({ page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'desc' } as any);
    const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    const uid = rawId;
    const email = rawEmail;
    const mine = rows.filter((r: any) => {
      if (uid && String(r.userId) === uid) return true;
      if (email && String(r.email || '').toLowerCase() === email) return true;
      return false;
    });
    const start = (page - 1) * limit;
    const paged = mine.slice(start, start + limit);
    return { data: paged, meta: { total: mine.length, page, limit, totalPages: Math.max(1, Math.ceil(mine.length / limit)) } };
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
