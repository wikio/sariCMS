import { Module } from '@nestjs/common';
import { PublicSolutionsController } from './public-solutions.controller';
import { SolutionsController } from './solutions.controller';
import { SolutionsService } from './solutions.service';

@Module({
  controllers: [PublicSolutionsController, SolutionsController],
  providers: [SolutionsService],
  exports: [SolutionsService],
})
export class SolutionsModule {}
