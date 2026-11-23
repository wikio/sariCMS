import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SettingsDocsService } from './settings-docs.service';

/** Le formulaire et sa route de session consultent le même réglage, pas le cache du poste. */
@ApiTags('public')
@Public()
@Controller('public/admin-login-policy')
export class PublicLoginPolicyController {
  constructor(private readonly docs: SettingsDocsService) {}

  @Get()
  @ApiOperation({ summary: 'CAPTCHA requis sur le formulaire de connexion admin' })
  async policy() {
    const security = (await this.docs.read('admin'))?.security as { adminCaptcha?: unknown } | undefined;
    return { captchaRequired: security?.adminCaptcha !== false };
  }
}
