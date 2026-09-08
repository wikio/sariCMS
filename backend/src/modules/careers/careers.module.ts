import { Module } from '@nestjs/common';
import { PublicCareersController } from './public-careers.controller';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';

@Module({
  controllers: [PublicCareersController, CareersController],
  providers: [CareersService],
  exports: [CareersService],
})
export class CareersModule {}
