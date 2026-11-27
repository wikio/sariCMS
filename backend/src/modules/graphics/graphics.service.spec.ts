import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { GraphicsService, SOCIAL_FORMATS } from './graphics.service';

const content = {
  findPublished: jest.fn(async () => ({ title: 'Démo', shortDesc: 'Résumé de test', slug: 'demo', status: 'published' })),
  findPublishedBySlug: jest.fn(async () => ({ title: 'Page démo', slug: 'demo', status: 'published' })),
};
const config = { get: (key: string) => key === 'PUBLIC_SITE_URL' ? 'https://example.test' : undefined } as ConfigService;
const brand = { current: async () => ({ title: 'SARI', logo: '' }) };
const service = new GraphicsService(config, content as never, content as never, content as never, content as never, content as never, content as never, brand as never);

function isPng(buffer: Buffer) {
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
}

describe('GraphicsService', () => {
  it('publishes a PNG social image at exact platform dimensions and adds the QR when requested', async () => {
    const result = await service.social('articles', 'demo', { platform: 'linkedin', qr: '1', url: 'https://example.test/demo' });
    const dimensions = await sharp(result.buffer).metadata();
    isPng(result.buffer);
    expect(dimensions).toMatchObject({ width: SOCIAL_FORMATS.linkedin.width, height: SOCIAL_FORMATS.linkedin.height });
    expect(result.title).toBe('Démo');
  });

  it('creates colored QR and Code 128 images', async () => {
    const qr = await service.qr('https://example.test', { size: 256, color: '#123456', background: '#FFFFFF' });
    const barcode = await service.barcode('SARI-2026', 'code128', { color: '#123456', background: '#FFFFFF' });
    isPng(qr);
    isPng(barcode);
    expect((await sharp(qr).metadata()).width).toBe(256);
  });

  it('rejects unsupported source and barcode types', async () => {
    await expect(service.social('unknown', 'demo', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.barcode('1234', 'unknown')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not render unpublished or missing content', async () => {
    const hidden = { ...content, findPublished: jest.fn(async () => null) };
    const isolated = new GraphicsService(config, hidden as never, content as never, content as never, content as never, content as never, content as never, brand as never);
    await expect(isolated.social('articles', 'draft', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
