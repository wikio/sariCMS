import { Module } from '@nestjs/common';
import { ContactInfoController, PublicContactController } from './contact.controller';
import { ContactInfoService } from './contact-info.service';
import { ContactMessagesController } from './contact-messages.controller';
import { ContactMessagesService } from './contact-messages.service';

@Module({
  controllers: [PublicContactController, ContactInfoController, ContactMessagesController],
  providers: [ContactInfoService, ContactMessagesService],
  exports: [ContactInfoService, ContactMessagesService],
})
export class ContactModule {}
