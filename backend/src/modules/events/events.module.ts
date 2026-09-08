import { Module } from '@nestjs/common';
import { PublicEventsController } from './public-events.controller';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [PublicEventsController, EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
