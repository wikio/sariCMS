import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { VisibilityService } from './visibility.service';

/**
 * Lecture publique de la visibilité : la vitrine en a besoin au rendu, avant
 * toute authentification. Seules les exceptions sont renvoyées ; une clé
 * absente signifie « valeur par défaut ».
 */
@ApiTags('public')
@Public()
@Controller('public/visibility')
export class PublicVisibilityController {
  constructor(private readonly visibility: VisibilityService) {}

  @Get()
  @ApiOperation({ summary: 'Visibilité par langue (?locale=fr)' })
  find(@Query('locale') locale?: string) {
    return this.visibility.find(locale || 'fr');
  }

  @Get(':locale')
  @ApiOperation({ summary: "Visibilité d'une langue" })
  byLocale(@Param('locale') locale: string) {
    return this.visibility.find(locale);
  }
}
