import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CatalogImportService } from './catalog-import.service';
import { ImportCatalogDto } from './dto/import-catalog.dto';
import { TrashPurgeTask } from './trash-purge.task';
import { LogRetentionTask } from './log-retention.task';
import { MaintenanceSettingsService, MaintenanceSettings } from './maintenance-settings.service';
import { BrandSettingsService, BrandSettings } from './brand-settings.service';
import { UpdateBrandDto } from './dto/brand.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly purge: TrashPurgeTask,
    private readonly retention: LogRetentionTask,
    private readonly maintenance: MaintenanceSettingsService,
    private readonly brand: BrandSettingsService,
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

  @Get('maintenance')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'Rétention des journaux et planification des purges' })
  getMaintenance() {
    return this.maintenance.status();
  }

  @Put('maintenance')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({
    summary:
      "Enregistrer la rétention et la planification, puis replanifier les deux tâches",
  })
  async putMaintenance(@Body() body: Partial<MaintenanceSettings>) {
    const status = await this.maintenance.save(body);
    // Le décorateur @Cron a figé une expression au démarrage : sans ce
    // réenregistrement, un réglage saisi ici n'aurait d'effet qu'au redéploiage.
    await Promise.all([this.retention.applySchedule(), this.purge.applySchedule()]);
    return status;
  }

  @Delete('maintenance')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: "Revenir aux variables d'environnement" })
  async resetMaintenance() {
    const status = await this.maintenance.reset();
    await Promise.all([this.retention.applySchedule(), this.purge.applySchedule()]);
    return status;
  }

  @Get('brand')
  @RequirePermissions(perm('settings', 'read'))
  @ApiOperation({ summary: 'Marque enregistrée, environnement et défauts compris' })
  getBrand() {
    // `status()` et non `current()` : l'écran doit dire d'où vient ce qu'il affiche.
    return this.brand.status();
  }

  @Put('brand')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Enregistrer le nom, l’accroche et le logo du back-office' })
  async putBrand(@Body() body: UpdateBrandDto) {
    return this.brand.save(body as Partial<BrandSettings>);
  }

  @Delete('brand')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Revenir aux variables d’environnement ou aux défauts' })
  async resetBrand() {
    return this.brand.reset();
  }

  @Post('logs/apply-retention')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({
    summary:
      "Appliquer la rétention : piste d'audit au-delà de la fenêtre, jetons expirés",
  })
  runRetention() {
    return this.retention.purgeAll();
  }
}
