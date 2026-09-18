import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMailDto } from './dto/send-mail.dto';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

/**
 * Le point d'entrée interne est la seule porte qui permette à un flux public
 * (contact, newsletter) de faire partir un email. Sa seule protection est la clé
 * partagée : ces tests vérifient qu'elle ne se contourne ni par une valeur
 * fausse, ni par une valeur vide, ni par l'absence de configuration.
 */
function makeController(internalKey: string | undefined) {
  const send = jest.fn(async (dto: SendMailDto) => ({
    ...dto,
    id: 'mail-1',
    sentAt: new Date(0).toISOString(),
    provider: 'file' as const,
  }));
  const mail = { send } as unknown as MailService;
  const config = {
    get: jest.fn((key: string) => (key === 'MAIL_INTERNAL_KEY' ? internalKey : undefined)),
  } as unknown as ConfigService;
  return { controller: new MailController(mail, config), send };
}

const dto = { to: 'client@exemple.dz', subject: 'Bonjour', html: '<p>Test</p>' } as SendMailDto;

describe('MailController — POST /mail/internal/send', () => {
  it('transmet au transport quand la clé partagée est exacte', async () => {
    const { controller, send } = makeController('cle-secrete-123');
    const out = await controller.internalSend('cle-secrete-123', dto);
    expect(send).toHaveBeenCalledWith(dto);
    expect(out.to).toBe('client@exemple.dz');
  });

  it('refuse une clé erronée sans toucher au transport', async () => {
    const { controller, send } = makeController('cle-secrete-123');
    await expect(controller.internalSend('autre-cle', dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuse une clé vide alors qu’une clé est configurée', async () => {
    const { controller, send } = makeController('cle-secrete-123');
    await expect(controller.internalSend('', dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuse tout si MAIL_INTERNAL_KEY n’est pas configuré — même avec une clé vide', async () => {
    const { controller, send } = makeController(undefined);
    await expect(controller.internalSend('', dto)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.internalSend('n-importe-quoi', dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(send).not.toHaveBeenCalled();
  });
});
