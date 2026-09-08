import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { QuoteEntity } from './entities/quote.entity';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('quotes')
@CrudResource('quotes')
export class QuotesController extends BaseCrudController<QuoteEntity> {
  constructor(protected readonly service: QuotesService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateQuoteDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<QuoteEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateQuoteDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<QuoteEntity>, actor);
  }
}
