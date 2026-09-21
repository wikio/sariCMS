import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';
import { LogRetentionTask } from './log-retention.task';
import { MaintenanceSettingsService } from './maintenance-settings.service';

@Module({
  controllers: [SettingsController],
  providers: [TrashPurgeTask, LogRetentionTask, MaintenanceSettingsService, CatalogImportService],
  exports: [MaintenanceSettingsService, CatalogImportService],
})
export class SettingsModule {}
