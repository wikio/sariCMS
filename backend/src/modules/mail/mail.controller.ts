import { Body, Controller, Get, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { isInternalKey } from '../../common/security/internal-key';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

@ApiTags('mail')
@ApiBearerAuth()
@Controller('mail')
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Post('send')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Envoyer un email (SMTP) ou le journaliser (mode fichier)' })
  send(@Body() dto: SendMailDto) {
    return this.mail.send(dto);
  }

  /**
   * Envoi interne, appelé par le serveur Next.js pour les flux publics
   * (formulaire de contact, inscription à la lettre d'information).
   *
   * Ces flux n'ont pas de session administrateur : sans ce point d'entrée, ils ne
   * pourraient pas envoyer l'accusé de réception que l'administrateur a pourtant
   * configuré. La route est donc `@Public()` côté JWT, mais fermée par une clé
   * partagée (`MAIL_INTERNAL_KEY`) que seul le serveur Next connaît — elle ne
   * passe jamais dans le navigateur. Clé absente du `.env` : la route refuse
   * tout, y compris une clé vide.
   */
  @Public()
  @Post('internal/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envoi interne (serveur Next.js) — protégé par MAIL_INTERNAL_KEY' })
  async internalSend(@Headers('x-mail-internal-key') key: string, @Body() dto: SendMailDto) {
    const expected = String(this.config.get<string>('MAIL_INTERNAL_KEY') || '');
    if (!isInternalKey(key, expected)) {
      throw new UnauthorizedException('Clé interne absente ou invalide');
    }
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
