import { Module } from '@nestjs/common';
import { ContactInfoController, PublicContactController } from './contact.controller';
import { ContactInfoService } from './contact-info.service';
import { ContactMessagesController } from './contact-messages.controller';
import { ContactMessagesService } from './contact-messages.service';

import { ContactAiService } from './contact-ai.service';
import { ContactDossierService } from './contact-dossier.service';
import { ContactPolicyService } from './contact-policy.service';
import { ContactIntakeService } from './contact-intake.service';
import { ContactTriageController } from './contact-triage.controller';

@Module({
  controllers: [
    PublicContactController,
    ContactInfoController,
    ContactMessagesController,
    ContactTriageController,
  ],
  providers: [
    ContactInfoService,
    ContactMessagesService,
    ContactPolicyService,
    ContactAiService,
    ContactIntakeService,
    ContactDossierService,
  ],
  exports: [ContactInfoService, ContactMessagesService],
})
export class ContactModule {}
