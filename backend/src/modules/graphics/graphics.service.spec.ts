import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
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

  it('loads an existing GED photo and renders split layouts, blend effects, frames, event dates and places', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sari-graphics-'));
    try {
      await sharp({ create: { width: 64, height: 48, channels: 3, background: '#336699' } }).png().toFile(path.join(directory, 'photo.png'));
      const withImage = { findPublished: jest.fn(async () => ({ title: 'Salon professionnel', shortDesc: 'Rencontrez notre équipe', slug: 'salon', image: '/uploads/photo.png', startDate: '2026-11-30T09:00:00Z', endDate: '2026-11-30T17:00:00Z', location: 'Montréal', status: 'published' })) };
      const isolated = new GraphicsService({ get: (key: string) => key === 'GED_UPLOAD_DIR' ? directory : key === 'PUBLIC_SITE_URL' ? 'https://example.test' : undefined } as ConfigService, content as never, withImage as never, content as never, content as never, content as never, content as never, brand as never);
      const result = await isolated.social('events', 'salon', { platform: 'facebook', layout: 'split-left', effect: 'screen', effectColor: '#00AAFF', effectOpacity: 0.25, borderWidth: 8, borderColor: '#C6DA34' });
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata).toMatchObject({ width: 1200, height: 630 });
      isPng(result.buffer);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
