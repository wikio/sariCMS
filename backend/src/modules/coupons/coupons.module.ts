import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PublicCouponsController } from './public-coupons.controller';

@Module({
  controllers: [PublicCouponsController, CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
