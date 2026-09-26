import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PublicProductsController } from './public-products.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  // `SettingsModule` pour le compteur de références et le format saisi à l'écran.
  // Le chemin ne repart pas en sens inverse (`CatalogImportService` n'appelle pas
  // `ProductsService`), donc pas de cycle de modules.
  imports: [SettingsModule],
  controllers: [PublicProductsController, ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
