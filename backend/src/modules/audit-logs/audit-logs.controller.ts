import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@RequirePermissions(perm('audit', 'read'))
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Journal d’audit paginé (immuable)' })
  list(@Query() query: QueryDto) {
    return this.service.findAll({
      ...query,
      sortBy: query.sortBy ?? 'createdAt',
    });
  }

  @Get('recent')
  @ApiOperation({ summary: 'Activité récente pour le tableau de bord' })
  recent(@Query('limit') limit?: string) {
    return this.service.recent(Math.min(50, Number(limit) || 20));
  }
}
