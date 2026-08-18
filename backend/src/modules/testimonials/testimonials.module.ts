import { Module } from '@nestjs/common';
import { PublicTestimonialsController } from './public-testimonials.controller';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  controllers: [PublicTestimonialsController, TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
