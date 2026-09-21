import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BrandSettingsService } from './brand-settings.service';

/**
 * Marque du back-office, en lecture seule et sans authentification.
 *
 * Pourquoi public : l'écran de connexion affiche le nom et le logo, et il tourne
 * par définition avant toute session. Le layout serveur de l'administration en a
 * besoin aussi pour le titre de l'onglet, qu'il doit produire avant de connaître
 * l'état connecté du poste.
 *
 * Trois champs, aucun secret : nom, accroche, image. Rien sur les comptes, les
 * réglages de base, la maintenance. L'écriture reste sur `settings/brand`,
 * gardée par les permissions `settings:admin`.
 *
 * Ce point d'entrée ne renvoie volontairement pas d'erreur si la table
 * `settings` est absente : `current()` retombe sur les variables
 * d'environnement puis les défauts, donc l'administration s'affiche même sur
 * une base non migrée.
 */
@ApiTags('public')
@Public()
@Controller('public/brand')
export class PublicBrandController {
  constructor(private readonly brand: BrandSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Nom, accroche et logo de l’administration' })
  getBrand() {
    return this.brand.current();
  }
}
