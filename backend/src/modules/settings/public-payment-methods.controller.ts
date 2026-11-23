import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SettingsDocsService } from './settings-docs.service';

@ApiTags('public')
@Public()
@Controller('public/payment-methods')
export class PublicPaymentMethodsController {
  constructor(private readonly docs: SettingsDocsService) {}

  @Get()
  @ApiOperation({ summary: 'Modes de règlement manuel publiés par la boutique' })
  async list() {
    const rows: unknown = (await this.docs.read('payments'))?.items;
    if (!Array.isArray(rows)) return [];
    // Aucun compte bancaire de repli, aucun secret ni mode à encaissement simulé.
    return rows.filter(row => row?.active === true && ['transfer', 'check', 'cod', 'other'].includes(row.type)
      && typeof row.name === 'string' && typeof row.id === 'string').map(row => ({
      id: row.id, name: row.name, type: row.type, active: true, fees: Number(row.fees) || 0,
      instructions: typeof row.instructions === 'string' ? row.instructions : '',
      ...(row.type === 'transfer' || row.type === 'check' ? {
        iban: typeof row.iban === 'string' ? row.iban : '', rib: typeof row.rib === 'string' ? row.rib : '',
        account: typeof row.account === 'string' ? row.account : '',
      } : {}),
    }));
  }
}
