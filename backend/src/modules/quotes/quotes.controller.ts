import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
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

  @Public()
  @Post()
  override create(@Body() dto: CreateQuoteDto, @Actor() actor: ActorContext) {
    if (!dto.date) (dto as unknown as Record<string, unknown>).date = new Date().toISOString();
    return this.service.create(dto as unknown as Partial<QuoteEntity>, actor || { ip: undefined } as ActorContext);
  }

  @Public()
  @Get('my/list')
  async myQuotes(@Actor() actor: any, @Query() query: Record<string, unknown>) {
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
    @Body() dto: UpdateQuoteDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<QuoteEntity>, actor || { ip: undefined } as ActorContext);
  }
}
