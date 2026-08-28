import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

@ApiTags('mail')
@ApiBearerAuth()
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('send')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Envoyer un email (SMTP) ou le journaliser (mode fichier)' })
  send(@Body() dto: SendMailDto) {
    return this.mail.send(dto);
  }

  @Get('outbox')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'Historique des emails envoyés / journalisés' })
  outbox() {
    return {
      smtpConfigured: this.mail.isSmtpConfigured(),
      items: this.mail.outbox(),
    };
  }
}
