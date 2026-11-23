import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActorContext } from '../../common/crud/base-crud.service';
import { Actor } from '../../common/decorators/actor.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ContactAiService } from './contact-ai.service';
import { ContactDossierService } from './contact-dossier.service';
import { ContactPolicyService } from './contact-policy.service';

@ApiTags('contact')
@ApiBearerAuth()
@Controller('contact/triage')
export class ContactTriageController {
  constructor(
    private readonly policy: ContactPolicyService,
    private readonly ai: ContactAiService,
    private readonly dossier: ContactDossierService,
  ) {}

  @Get('policy')
  @RequirePermissions('settings:read')
  async read() {
    return { policy: await this.policy.read(), ai: this.ai.status() };
  }

  @Put('policy')
  @RequirePermissions('settings:admin')
  async save(@Body() body: unknown, @Actor() actor: ActorContext) {
    return { policy: await this.policy.save(body, actor.id), ai: this.ai.status() };
  }

  @Get('accounts/:account')
  @RequirePermissions('users:read')
  notes(@Param('account') account: string) {
    return this.dossier.read(account);
  }

  @Delete('accounts/:account/penalties/:id')
  @RequirePermissions('users:update')
  retract(@Param('account') account: string, @Param('id', ParseIntPipe) id: number, @Actor() actor: ActorContext) {
    return this.dossier.retract(account, id, actor.id);
  }
}
