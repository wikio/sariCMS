import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { NewsModule } from '../news/news.module';
import { PagesModule } from '../pages/pages.module';
import { ProductsModule } from '../products/products.module';
import { ServicesModule } from '../services/services.module';
import { SettingsModule } from '../settings/settings.module';
import { SolutionsModule } from '../solutions/solutions.module';
import { GraphicsController } from './graphics.controller';
import { GraphicsService } from './graphics.service';

@Module({
  imports: [NewsModule, EventsModule, ProductsModule, ServicesModule, SolutionsModule, PagesModule, SettingsModule],
  controllers: [GraphicsController],
  providers: [GraphicsService],
})
export class GraphicsModule {}
