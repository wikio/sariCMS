import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActorContext } from '../../common/crud/base-crud.service';
import { Actor } from '../../common/decorators/actor.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ContactAiSettingsService } from './contact-ai-settings.service';
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
    private readonly connection: ContactAiSettingsService,
    private readonly dossier: ContactDossierService,
  ) {}

  @Get('policy')
  @RequirePermissions('settings:read')
  async read() {
    return { policy: await this.policy.read(), ai: this.connection.status() };
  }

  @Put('policy')
  @RequirePermissions('settings:admin')
  async save(@Body() body: unknown, @Actor() actor: ActorContext) {
    return { policy: await this.policy.save(body, actor.id), ai: this.connection.status() };
  }

  @Put('connection')
  @RequirePermissions('settings:admin')
  saveConnection(@Body() draft: unknown) {
    return this.connection.save(draft);
  }

  @Post('connection/test')
  @HttpCode(200)
  @RequirePermissions('settings:admin')
  testConnection(@Body() draft: unknown) {
    return this.ai.test(draft);
  }

  @Delete('connection')
  @RequirePermissions('settings:admin')
  resetConnection() {
    return this.connection.reset();
  }

  @Get('accounts/:account')
  @RequirePermissions('users:read')
  notes(@Param('account') account: string) {
    return this.dossier.read(account);
  }

  @Delete('accounts/:account/penalties/:id')
  @RequirePermissions('users:update')
  retract(
    @Param('account') account: string,
    @Param('id', ParseIntPipe) id: number,
    @Actor() actor: ActorContext,
  ) {
    return this.dossier.retract(account, id, actor.id);
  }
}
