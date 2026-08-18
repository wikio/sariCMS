import { Body, Controller, Get, Param, ParseUUIDPipe, Query, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventEntity } from './entities/event.entity';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
@CrudResource('events')
export class EventsController extends BaseCrudController<EventEntity> {
  constructor(protected readonly service: EventsService) {
    super();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Prochains événements publiés' })
  upcoming(@Query('limit') limit?: string) {
    return this.service.upcoming(Number(limit) || 5);
  }

  @Post()
  override create(@Body() dto: CreateEventDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<EventEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEventDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<EventEntity>, actor);
  }
}
