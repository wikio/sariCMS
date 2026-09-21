import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TaxesService } from './taxes.service';

/**
 * Les taxes actives, pour le calcul des totaux dans le panier.
 *
 * Contrairement aux coupons, cette liste **est** publique : les taux de TVA
 * figurent sur la facture et ne sont pas une information à protéger. Sans ce
 * point d'entrée, le panier d'un client retombait sur les taxes de démonstration
 * du `localStorage` vide (lib/shop-store.ts, `DEFAULT_TAXES`).
 */
@ApiTags('public')
@Public()
@Controller('public/taxes')
export class PublicTaxesController {
  constructor(private readonly taxes: TaxesService) {}

  @Get()
  @ApiOperation({ summary: 'Taxes actives, triées par ordre d\'application' })
  async list() {
    const rows = (await this.taxes.listAll()) as { active?: boolean }[];
    return { taxes: rows.filter((row) => row.active !== false) };
  }
}
