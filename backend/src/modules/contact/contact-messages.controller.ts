import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isInternalKey } from '../../common/security/internal-key';
import { ContactIntakeService } from './contact-intake.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  constructor(
    protected readonly service: ContactMessagesService,
    private readonly intake: ContactIntakeService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  @Public()
  @Post()
  // Le quota par visiteur est sur Next. Ici l'IP est celle du relais ; le plafond Nest global reste actif.
  @ApiOperation({ summary: 'Trier une demande du formulaire — relais Next.js uniquement' })
  override create(
    @Body() dto: CreateContactMessageDto,
    @Actor() actor: ActorContext,
    @Headers('x-mail-internal-key') key?: string,
  ) {
    if (!isInternalKey(key, this.config.get<string>('MAIL_INTERNAL_KEY') || '')) throw new UnauthorizedException();
    return this.intake.submit(dto, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateContactMessageDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.followUp(id, dto, actor);
  }
}
