import { Body, Controller, Delete, Get, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { isInternalKey } from '../../common/security/internal-key';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { SaveSmtpDto, TestSmtpDto } from './dto/smtp.dto';

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

  /* -------------------------------------------------------------------------
   * Réglages SMTP
   *
   * L'écran Paramètres → SMTP écrivait dans le `localStorage` du navigateur :
   * les réglages n'arrivaient jamais au serveur, qui ne lisait que ses variables
   * d'environnement. D'où un « SMTP non configuré » persistant alors que le
   * formulaire était rempli. Ces trois routes ferment la boucle : l'écran
   * enregistre sur le serveur, le transport est reconstruit aussitôt, et le test
   * dit ce qui se passe vraiment.
   *
   * Le mot de passe ne sort jamais du serveur : l'état renvoie `hasPassword`,
   * jamais la valeur.
   * ---------------------------------------------------------------------- */

  @Get('smtp')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'État des réglages SMTP (sans le mot de passe)' })
  smtp() {
    return this.mail.smtpStatus();
  }

  @Post('smtp')
  @RequirePermissions(perm('settings', 'admin'))
  @HttpCode(200)
  @ApiOperation({ summary: 'Enregistrer les réglages SMTP et les appliquer' })
  saveSmtp(@Body() dto: SaveSmtpDto) {
    return this.mail.saveSmtp(dto);
  }

  @Delete('smtp')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Oublier les réglages enregistrés (retour aux variables d’environnement)' })
  clearSmtp() {
    return this.mail.clearSmtp();
  }

  @Post('smtp/test')
  @RequirePermissions(perm('settings', 'admin'))
  @HttpCode(200)
  @ApiOperation({ summary: 'Tester le SMTP : connexion, puis envoi réel si `to` est fourni' })
  testSmtp(@Body() dto: TestSmtpDto) {
    return dto.to ? this.mail.testSend(dto.to) : this.mail.verifySmtp();
  }
}
