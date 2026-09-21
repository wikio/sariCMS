import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';
import { LogRetentionTask } from './log-retention.task';

@Module({
  controllers: [SettingsController],
  providers: [TrashPurgeTask, LogRetentionTask, CatalogImportService],
  exports: [CatalogImportService],
})
export class SettingsModule {}
