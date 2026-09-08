import { Module } from '@nestjs/common';
import { PublicVisibilityController } from './public-visibility.controller';
import { VisibilityController } from './visibility.controller';
import { VisibilityService } from './visibility.service';

@Module({
  controllers: [PublicVisibilityController, VisibilityController],
  providers: [VisibilityService],
  exports: [VisibilityService],
})
export class VisibilityModule {}
