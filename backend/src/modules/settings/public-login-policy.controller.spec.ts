import { PublicLoginPolicyController } from './public-login-policy.controller';
import { SettingsDocsService } from './settings-docs.service';

describe('Politique de connexion publique', () => {
  it.each([
    [null, true], [{ security: { adminCaptcha: 'false' } }, true],
    [{ security: { adminCaptcha: false, admin2fa: true }, private: 'hidden' }, false],
  ] as const)('ne désactive le CAPTCHA que sur un choix explicite (%j)', async (doc, captchaRequired) => {
    const docs = new SettingsDocsService(jest.fn());
    jest.spyOn(docs, 'read').mockResolvedValue(doc);
    await expect(new PublicLoginPolicyController(docs).policy()).resolves.toEqual({ captchaRequired });
  });
});
