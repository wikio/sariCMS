import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TrashPurgeTask } from './trash-purge.task';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly purge: TrashPurgeTask) {}

  @Post('trash/purge-expired')
  @RequirePermissions(perm('settings', 'admin'))
  @ApiOperation({ summary: 'Purger manuellement la corbeille expirée (toutes collections)' })
  run() {
    return this.purge.purgeAll();
  }
}
