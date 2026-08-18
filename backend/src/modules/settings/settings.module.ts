import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { TrashPurgeTask } from './trash-purge.task';

@Module({
  controllers: [SettingsController],
  providers: [TrashPurgeTask],
})
export class SettingsModule {}
