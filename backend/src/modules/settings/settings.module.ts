import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';

@Module({
  controllers: [SettingsController],
  providers: [TrashPurgeTask, CatalogImportService],
  exports: [CatalogImportService],
})
export class SettingsModule {}
