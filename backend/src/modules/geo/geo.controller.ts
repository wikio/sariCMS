import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Public()
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('ip')
  @ApiOperation({ summary: 'Résoudre le pays (et détails) d’une adresse IP' })
  lookup(@Query('ip') ip?: string) {
    return this.geo.lookup(ip || '');
  }
}
