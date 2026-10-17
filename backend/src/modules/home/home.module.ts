import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { PublicHomeController } from './public-home.controller';
import { HomeSectionsService } from './home-sections.service';

@Module({
  controllers: [PublicHomeController, HomeController],
  providers: [HomeSectionsService],
  exports: [HomeSectionsService],
})
export class HomeModule {}
