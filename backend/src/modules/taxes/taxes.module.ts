import { Module } from '@nestjs/common';
import { PublicTaxesController } from './public-taxes.controller';
import { TaxesController } from './taxes.controller';
import { TaxesService } from './taxes.service';

@Module({
  controllers: [PublicTaxesController, TaxesController],
  providers: [TaxesService],
  exports: [TaxesService],
})
export class TaxesModule {}
