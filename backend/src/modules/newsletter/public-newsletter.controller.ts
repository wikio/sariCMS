import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { SubscribeDto, UnsubscribeDto } from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

/**
 * Points d'entrée publics du bloc newsletter.
 *
 * Toute la vitrine passe par là — page d'accueil, bas d'article, page contact —
 * ce qui garde une liste unique. Les adresses sont normalisées (minuscules,
 * sans espace) et une réinscription réactive la fiche au lieu de doubler.
 */
@ApiTags('public')
@Public()
@Controller('public/newsletter')
export class PublicNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post()
  @ApiOperation({ summary: 'S’inscrire à la newsletter' })
  subscribe(@Body() dto: SubscribeDto, @Req() req: { ip?: string; headers: Record<string, unknown> }) {
    const actor: ActorContext = {
      ip: dto.ip || req.ip,
      userAgent: dto.userAgent || String(req.headers['user-agent'] ?? ''),
    };
    return this.newsletter.subscribe(dto, actor);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Se désinscrire (par email ou par jeton)' })
  unsubscribe(@Body() dto: UnsubscribeDto, @Req() req: { ip?: string; headers: Record<string, unknown> }) {
    const actor: ActorContext = {
      ip: (dto as { ip?: string }).ip || req.ip,
      userAgent: (dto as { userAgent?: string }).userAgent || String(req.headers['user-agent'] ?? ''),
    };
    return this.newsletter.unsubscribe(dto, actor);
  }

  @Get('confirm')
  @ApiOperation({ summary: 'Confirmer une inscription (double opt-in)' })
  confirm(@Query('token') token?: string) {
    return this.newsletter.confirm(token || '');
  }
}
