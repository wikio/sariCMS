import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/partner.dto';
import { PartnerEntity } from './entities/partner.entity';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@ApiBearerAuth()
@Controller('partners')
@CrudResource('partners')
export class PartnersController extends BaseCrudController<PartnerEntity> {
  constructor(protected readonly service: PartnersService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreatePartnerDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<PartnerEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePartnerDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<PartnerEntity>, actor);
  }
}
