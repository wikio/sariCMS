import { Module } from '@nestjs/common';
import { PublicPartnersController } from './public-partners.controller';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  controllers: [PublicPartnersController, PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
