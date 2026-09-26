import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';
import { LogRetentionTask } from './log-retention.task';
import { MaintenanceSettingsService } from './maintenance-settings.service';
import { BrandSettingsService } from './brand-settings.service';
import { PublicBrandController } from './public-brand.controller';
import { SettingsDocsService } from './settings-docs.service';
import { SkuSeqService } from './sku-seq.service';

@Module({
  controllers: [SettingsController, PublicBrandController],
  providers: [TrashPurgeTask, LogRetentionTask, MaintenanceSettingsService, BrandSettingsService,
    CatalogImportService, SettingsDocsService, SkuSeqService],
  // `SettingsDocsService` et `SkuSeqService` sont exportés parce que le service
  // produits lit le format de référence dans `doc_admin` et réserve ses numéros
  // ici : la règle de la référence ne vit pas dans deux endroits.
  exports: [MaintenanceSettingsService, BrandSettingsService, CatalogImportService,
    SettingsDocsService, SkuSeqService],
})
export class SettingsModule {}
