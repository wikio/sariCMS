import { Module } from '@nestjs/common';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';
import { PublicFaqsController } from './public-faqs.controller';

@Module({
  controllers: [PublicFaqsController, FaqsController],
  providers: [FaqsService],
  exports: [FaqsService],
})
export class FaqsModule {}
