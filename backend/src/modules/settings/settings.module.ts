import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';
import { LogRetentionTask } from './log-retention.task';
import { MaintenanceSettingsService } from './maintenance-settings.service';
import { BrandSettingsService } from './brand-settings.service';
import { PublicBrandController } from './public-brand.controller';

@Module({
  controllers: [SettingsController, PublicBrandController],
  providers: [TrashPurgeTask, LogRetentionTask, MaintenanceSettingsService, BrandSettingsService,
    CatalogImportService],
  exports: [MaintenanceSettingsService, BrandSettingsService, CatalogImportService],
})
export class SettingsModule {}
