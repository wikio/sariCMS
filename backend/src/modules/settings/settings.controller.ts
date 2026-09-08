import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CatalogImportService } from './catalog-import.service';
import { ImportCatalogDto } from './dto/import-catalog.dto';
import { TrashPurgeTask } from './trash-purge.task';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly purge: TrashPurgeTask,
    private readonly catalog: CatalogImportService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'État CMS + compteurs par collection' })
  async status() {
    const counts = await this.catalog.counts();
    return {
      driver: this.config.get('DB_DRIVER') || 'json',
      connected: true,
      counts,
    };
  }

  @Post('import-catalog')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Importer le catalogue JSON de la vitrine dans le CMS' })
  importCatalog(@Body() dto: ImportCatalogDto) {
    return this.catalog.importFromDisk({
      replace: dto.replace,
      locales: dto.locales,
    });
  }

  @Post('trash/purge-expired')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Purger manuellement la corbeille expirée (toutes collections)' })
  run() {
    return this.purge.purgeAll();
  }
}
