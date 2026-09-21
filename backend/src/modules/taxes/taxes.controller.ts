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
import { CreateTaxRuleDto, SyncTaxRulesDto, UpdateTaxRuleDto } from './dto/tax-rule.dto';
import { TaxRuleEntity } from './entities/tax-rule.entity';
import { TaxesService } from './taxes.service';

@ApiTags('taxes')
@ApiBearerAuth()
@Controller('taxes')
@CrudResource('taxes')
export class TaxesController extends BaseCrudController<TaxRuleEntity> {
  constructor(protected readonly service: TaxesService) {
    super();
  }

  @Get('all')
  @ApiOperation({ summary: 'Jeu complet, trié par priorité' })
  listAll() {
    return this.service.listAll();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistrer le jeu complet (créations, mises à jour, corbeille)' })
  sync(@Body() dto: SyncTaxRulesDto, @Actor() actor: ActorContext) {
    return this.service.sync(dto, actor);
  }

  @Post()
  override create(@Body() dto: CreateTaxRuleDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<TaxRuleEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateTaxRuleDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<TaxRuleEntity>, actor);
  }
}
