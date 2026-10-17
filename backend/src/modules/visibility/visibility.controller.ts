import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CopyVisibilityDto, ReplaceVisibilityDto, SetOneVisibilityDto } from './dto/visibility.dto';
import { VisibilityService } from './visibility.service';

/**
 * Administration de la visibilité, langue par langue.
 *
 * La lecture publique est assurée par `PublicVisibilityController` ; ici tout
 * exige la permission d'écriture des réglages.
 */
@ApiTags('visibility')
@ApiBearerAuth()
@Controller('visibility')
export class VisibilityController {
  constructor(private readonly visibility: VisibilityService) {}

  @Get()
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'Réglages de plusieurs langues (par défaut fr, en, ar)' })
  findMany(@Query('locales') locales?: string) {
    const list = (locales || 'fr,en,ar')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.visibility.findMany(list);
  }

  @Get(':locale')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: "Réglages d'une langue" })
  find(@Param('locale') locale: string) {
    return this.visibility.find(locale);
  }

  @Post(':locale')
  @RequirePermissions(perm('settings', 'update'))
  @ApiOperation({ summary: "Remplace les réglages d'une langue" })
  replace(
    @Param('locale') locale: string,
    @Body() dto: ReplaceVisibilityDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.visibility.replace(locale, dto.overrides, user?.id);
  }

  @Patch(':locale')
  @RequirePermissions(perm('settings', 'update'))
  @ApiOperation({ summary: 'Bascule une seule clé' })
  setOne(
    @Param('locale') locale: string,
    @Body() dto: SetOneVisibilityDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.visibility.setOne(locale, dto.key, dto.on, user?.id);
  }

  @Post('copy/all')
  @RequirePermissions(perm('settings', 'update'))
  @ApiOperation({ summary: "Copie les réglages d'une langue vers les autres" })
  copy(@Body() dto: CopyVisibilityDto, @CurrentUser() user?: AuthUser) {
    const to = dto.to?.length ? dto.to : ['fr', 'en', 'ar'].filter((l) => l !== dto.from);
    return this.visibility.copy(dto.from, to, user?.id);
  }

  @Delete(':locale')
  @RequirePermissions(perm('settings', 'update'))
  @ApiOperation({ summary: 'Rétablit les valeurs par défaut pour une langue' })
  reset(@Param('locale') locale: string, @CurrentUser() user?: AuthUser) {
    return this.visibility.reset(locale, user?.id);
  }
}
