import { Module } from '@nestjs/common';
import { PublicServicesController } from './public-services.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [PublicServicesController, ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
