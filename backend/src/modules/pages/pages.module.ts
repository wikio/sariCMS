import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PublicPagesController } from './public-pages.controller';

@Module({
  controllers: [PublicPagesController, PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
