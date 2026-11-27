import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { BulkContactMessagesDto, CreateContactMessageDto, UpdateContactMessageDto } from './dto/contact.dto';
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

  @Post('bulk/status')
  @ApiOperation({ summary: 'Changer le statut de plusieurs messages' })
  async bulkStatus(@Body() dto: BulkContactMessagesDto, @Actor() actor: ActorContext) {
    if (!dto.ids?.length || !dto.status) throw new BadRequestException('ids et status requis');
    const unique = [...new Set(dto.ids)].slice(0, 100);
    const results = await Promise.allSettled(unique.map((id) => this.service.followUp(id, { status: dto.status }, actor)));
    return {
      updated: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  @Post('bulk/delete')
  @ApiOperation({ summary: 'Supprimer plusieurs messages (corbeille)' })
  async bulkDelete(@Body() dto: BulkContactMessagesDto, @Actor() actor: ActorContext) {
    if (!dto.ids?.length) throw new BadRequestException('ids requis');
    const unique = [...new Set(dto.ids)].slice(0, 100);
    const results = await Promise.allSettled(unique.map((id) => this.service.softDelete(id, actor)));
    return {
      deleted: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  @Post('bulk/triage')
  @ApiOperation({ summary: 'Relancer l’analyse IA sur plusieurs messages' })
  async bulkTriage(@Body() dto: BulkContactMessagesDto, @Actor() actor: ActorContext) {
    if (!dto.ids?.length) throw new BadRequestException('ids requis');
    const unique = [...new Set(dto.ids)].slice(0, 20);
    let updated = 0, failed = 0;
    for (const id of unique) {
      try { await this.intake.retriage(id, actor); updated++; }
      catch { failed++; }
    }
    return { updated, failed };
  }

  @Post(':id/triage')
  @ApiOperation({ summary: 'Relancer l’analyse IA sur un message existant' })
  triage(@Param('id', new ParseIntPipe()) id: number, @Actor() actor: ActorContext) {
    return this.intake.retriage(id, actor);
  }
}
