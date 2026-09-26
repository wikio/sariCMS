import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, SyncCouponsDto, UpdateCouponDto } from './dto/coupon.dto';
import { CouponEntity } from './entities/coupon.entity';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
@CrudResource('coupons')
export class CouponsController extends BaseCrudController<CouponEntity> {
  constructor(protected readonly service: CouponsService) {
    super();
  }

  @Get('all')
  @ApiOperation({ summary: 'Catalogue complet (sans pagination), ce que lit l\'écran' })
  listAll() {
    return this.service.listAll();
  }

  /**
   * Déclaré avant `@Patch(':id')` du parent ? Non : Nest résout les routes dans
   * l'ordre de déclaration de la classe, et `sync` est un segment littéral qui
   * ne peut pas être confondu avec un `:id` numérique (ParseIntPipe).
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistrer le catalogue complet (créations, mises à jour, corbeille)' })
  sync(@Body() dto: SyncCouponsDto, @Actor() actor: ActorContext) {
    return this.service.sync(dto, actor);
  }

  @Post()
  override create(@Body() dto: CreateCouponDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<CouponEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateCouponDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<CouponEntity>, actor);
  }
}
