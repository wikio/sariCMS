import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Santé du process + driver actif' })
  check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      driver: this.config.get('DB_DRIVER') || 'json',
      env: this.config.get('NODE_ENV') || 'development',
    };
  }
}
