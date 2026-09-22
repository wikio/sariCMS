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
import { PaymentRecordsService } from './payment-records.service';
import {
  CreatePaymentRecordDto,
  SyncPaymentRecordsDto,
  UpdatePaymentRecordDto,
} from './dto/payment-record.dto';
import { PaymentRecordEntity } from './entities/payment-record.entity';

/**
 * Encaissements enregistrés.
 *
 * Ressource d'administration uniquement, comme les réglages d'écran : un visiteur
 * n'a rien à lire ici, et aucune de ces routes n'est publique — `payments:read`
 * garde aussi `GET /all`.
 *
 * Le parcours de commande, lui, ne passe pas par ici : il écrit dans le cache du
 * navigateur (`lib/payments.ts`), et le relevé part en base au premier montage d'un
 * écran d'administration. Ce n'est pas un oubli de branchement : exiger un jeton
 * d'administration pour enregistrer le paiement d'un client ferait échouer la
 * caisse en 403 dès qu'un poste n'est pas connecté. Le chemin est donc différé,
 * jamais perdu — c'est `planPull` qui pousse le poste vers une base vide.
 */
@ApiTags('payment-records')
@ApiBearerAuth()
@Controller('payment-records')
@CrudResource('payments')
export class PaymentRecordsController extends BaseCrudController<PaymentRecordEntity> {
  constructor(protected readonly service: PaymentRecordsService) {
    super();
  }

  @Get('all')
  @ApiOperation({ summary: 'Tous les encaissements (sans pagination), ce que lit l’écran' })
  listAll() {
    return this.service.listAll();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistrer le relevé complet (créations, mises à jour, corbeille)' })
  sync(@Body() dto: SyncPaymentRecordsDto, @Actor() actor: ActorContext) {
    return this.service.sync(dto, actor);
  }

  @Post()
  override create(@Body() dto: CreatePaymentRecordDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<PaymentRecordEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdatePaymentRecordDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<PaymentRecordEntity>, actor);
  }
}
