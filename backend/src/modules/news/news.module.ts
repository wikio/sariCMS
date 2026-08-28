import { Module } from '@nestjs/common';
import { PublicNewsController } from './public-news.controller';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  controllers: [PublicNewsController, NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
