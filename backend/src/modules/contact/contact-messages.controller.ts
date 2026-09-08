import { Body, Controller, Param, ParseIntPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateContactMessageDto, UpdateContactMessageDto } from './dto/contact.dto';
import { ContactMessageEntity } from './entities/contact.entity';
import { ContactMessagesService } from './contact-messages.service';

@ApiTags('contact')
@ApiBearerAuth()
@Controller('contact/messages')
@CrudResource('contact')
export class ContactMessagesController extends BaseCrudController<ContactMessageEntity> {
  constructor(protected readonly service: ContactMessagesService) {
    super();
  }

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envoyer un message depuis le site vitrine' })
  override create(@Body() dto: CreateContactMessageDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<ContactMessageEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateContactMessageDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<ContactMessageEntity>, actor);
  }
}
