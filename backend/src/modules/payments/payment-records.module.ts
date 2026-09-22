import { Module } from '@nestjs/common';
import { PaymentRecordsController } from './payment-records.controller';
import { PaymentRecordsService } from './payment-records.service';

@Module({
  controllers: [PaymentRecordsController],
  providers: [PaymentRecordsService],
  exports: [PaymentRecordsService],
})
export class PaymentRecordsModule {}
