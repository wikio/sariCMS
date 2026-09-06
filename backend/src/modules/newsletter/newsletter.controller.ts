import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { perm } from '../../common/constants/permissions';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { BulkNewsletterDto, UpdateNewsletterSubscriberDto } from './dto/newsletter.dto';
import { NewsletterSubscriberEntity } from './entities/newsletter.entity';
import { NewsletterService } from './newsletter.service';

/**
 * Gestion de la liste d'abonnement : CRUD complet, corbeille incluse
 * (suppression douce, restauration, purge définitive avec jeton) — tout cela
 * vient du socle CRUD commun, et fonctionne pour chaque pilote de base.
 *
 * Les deux routes ajoutées sont des raccourcis d'écran : compteurs et export.
 * Elles vivent sous `/newsletter/report/…` pour ne jamais entrer en concurrence
 * avec `/newsletter/:id`.
 */
@ApiTags('newsletter')
@ApiBearerAuth()
@Controller('newsletter')
@CrudResource('newsletter')
export class NewsletterController extends BaseCrudController<NewsletterSubscriberEntity> {
  protected declare readonly service: NewsletterService;

  constructor(protected readonly newsletter: NewsletterService) {
    super();
    this.service = newsletter;
  }

  @Post('report/bulk')
  @RequirePermissions(perm('newsletter', 'update'))
  @ApiOperation({ summary: 'Applique un statut (ou une suppression) à une sélection' })
  bulk(@Body() dto: BulkNewsletterDto, @Actor() actor: ActorContext) {
    return this.newsletter.bulk(dto.ids, dto.status || 'subscribed', actor);
  }

  @Get('report/stats')
  @RequirePermissions(perm('newsletter', 'read'))
  @ApiOperation({ summary: 'Compteurs par statut' })
  stats() {
    return this.newsletter.stats();
  }

  @Get('report/export')
  @RequirePermissions(perm('newsletter', 'read'))
  @ApiOperation({ summary: 'Export CSV des adresses' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'locale', required: false })
  async exportCsv(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('locale') locale?: string,
  ) {
    const csv = await this.newsletter.exportCsv(status, locale);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"');
    return csv;
  }

  @Post(':id/status')
  @RequirePermissions(perm('newsletter', 'update'))
  @ApiOperation({ summary: 'Change le statut d’une adresse' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateNewsletterSubscriberDto, @Actor() actor: ActorContext) {
    return this.newsletter.update(Number(id), { status: dto.status }, actor);
  }
}
