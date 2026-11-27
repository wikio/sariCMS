import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as QRCode from 'qrcode';
import * as bwipjs from 'bwip-js';
import sharp from 'sharp';
import { EventsService } from '../events/events.service';
import { NewsService } from '../news/news.service';
import { PagesService } from '../pages/pages.service';
import { ProductsService } from '../products/products.service';
import { ServicesService } from '../services/services.service';
import { SolutionsService } from '../solutions/solutions.service';
import { BrandSettingsService } from '../settings/brand-settings.service';

export const SOCIAL_FORMATS = {
  youtube: { width: 1280, height: 720, label: 'YouTube thumbnail' },
  'youtube-banner': { width: 2560, height: 1440, label: 'YouTube banner' },
  instagram: { width: 1080, height: 1080, label: 'Instagram square post' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram story / reel' },
  facebook: { width: 1200, height: 630, label: 'Facebook share' },
  'facebook-cover': { width: 1640, height: 624, label: 'Facebook cover' },
  linkedin: { width: 1200, height: 627, label: 'LinkedIn share' },
  x: { width: 1200, height: 675, label: 'X post' },
  pinterest: { width: 1000, height: 1500, label: 'Pinterest pin' },
  og: { width: 1200, height: 630, label: 'Open Graph' },
} as const;

export type SocialPlatform = keyof typeof SOCIAL_FORMATS;
type ContentSource = 'news' | 'events' | 'products' | 'services' | 'solutions' | 'pages';

const ALIASES: Record<string, ContentSource> = {
  news: 'news', articles: 'news', announcements: 'news', tips: 'news',
  events: 'events', products: 'products', services: 'services', solutions: 'solutions', pages: 'pages',
};
const HEX = /^#[0-9a-f]{6}$/i;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function cleanText(value: unknown): string {
  if (Array.isArray(value)) value = value.join(' ');
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function findImage(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map((item) => findImage(item, depth + 1)).find(Boolean) || '';
  if (typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  for (const key of ['url', 'src', 'path', 'image', 'media', 'thumbnail', 'cover']) {
    const candidate = findImage(row[key], depth + 1);
    if (candidate) return candidate;
  }
  return '';
}
function hexColor(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return HEX.test(s) ? s : fallback;
}
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; }
    else line = next;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

@Injectable()
export class GraphicsService {
  constructor(
    private readonly config: ConfigService,
    private readonly news: NewsService,
    private readonly events: EventsService,
    private readonly products: ProductsService,
    private readonly services: ServicesService,
    private readonly solutions: SolutionsService,
    private readonly pages: PagesService,
    private readonly brand: BrandSettingsService,
  ) {}

  formats() { return SOCIAL_FORMATS; }

  async qr(data: string, options: { size?: number; color?: string; background?: string; margin?: number } = {}) {
    const value = this.data(data);
    const size = clamp(Number(options.size) || 512, 128, 1200);
    const dark = hexColor(options.color, '#172554').slice(1).toUpperCase();
    const light = hexColor(options.background, '#FFFFFF').slice(1).toUpperCase();
    const margin = clamp(Number(options.margin) || 0, 0, 16);
    return QRCode.toBuffer(value, {
      type: 'png', width: size, margin,
      color: { dark: `#${dark}FF`, light: `#${light}FF` },
      errorCorrectionLevel: 'H',
    });
  }

  async barcode(data: string, type = 'code128', options: { color?: string; background?: string; scale?: number; height?: number } = {}) {
    const value = this.data(data);
    const accepted = new Set(['code128', 'ean13', 'ean8', 'upca', 'upce', 'itf14', 'isbn', 'code39', 'datamatrix']);
    const bcid = String(type || 'code128').toLowerCase();
    if (!accepted.has(bcid)) throw new BadRequestException(`Type de code-barres non pris en charge : ${bcid}`);
    const fg = hexColor(options.color, '#172554').slice(1).toUpperCase();
    const bg = hexColor(options.background, '#FFFFFF').slice(1).toUpperCase();
    try {
      return await bwipjs.toBuffer({
        bcid, text: value, scale: clamp(Number(options.scale) || 3, 1, 6),
        height: clamp(Number(options.height) || 18, 8, 80),
        includetext: true, textxalign: 'center', barcolor: fg, backgroundcolor: bg,
        padding: 8,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Données incompatibles avec le code-barres demandé.');
    }
  }

  private data(value: string) {
    const text = String(value || '').trim();
    if (!text) throw new BadRequestException('Le paramètre data est obligatoire.');
    if (text.length > 2048) throw new BadRequestException('Le paramètre data est limité à 2048 caractères.');
    return text;
  }

  private async published(source: string, id: string, locale: string): Promise<Record<string, unknown>> {
    const resolved = ALIASES[source.toLowerCase()];
    if (!resolved) throw new BadRequestException(`Source inconnue. Sources prises en charge : ${Object.keys(ALIASES).join(', ')}.`);
    const key = String(id || '').trim();
    if (!key || key.length > 240) throw new BadRequestException('Identifiant de contenu invalide.');
    let item: unknown;
    if (resolved === 'news') item = await this.news.findPublished(key, locale);
    else if (resolved === 'events') item = await this.events.findPublished(key, locale);
    else if (resolved === 'products') item = await this.products.findPublished(key, locale);
    else if (resolved === 'services') item = await this.services.findPublished(key, locale);
    else if (resolved === 'solutions') item = await this.solutions.findPublished(key, locale);
    else item = await this.pages.findPublishedBySlug(key, locale);
    if (!item || typeof item !== 'object') throw new NotFoundException('Contenu publié introuvable.');
    return item as Record<string, unknown>;
  }

  private async imageData(value: unknown): Promise<string> {
    const raw = cleanText(value);
    if (!raw || raw.length > 2048) return '';
    let pathname = raw;
    try { if (/^https?:\/\//i.test(raw)) pathname = new URL(raw).pathname; } catch { return ''; }
    if (!pathname.startsWith('/uploads/')) return '';
    let rel: string;
    try { rel = decodeURIComponent(pathname.slice('/uploads/'.length)); } catch { return ''; }
    if (!rel || rel.split(/[\\/]/).some((part) => part === '..' || part === '.')) return '';
    const root = path.resolve(this.config.get<string>('GED_UPLOAD_DIR') || path.resolve(process.cwd(), '..', 'public', 'uploads'));
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) return '';
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return '';
      const buffer = await fs.readFile(file);
      const png = await sharp(buffer, { limitInputPixels: 25_000_000 }).resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { return ''; }
  }

  async social(source: string, id: string, query: Record<string, unknown>) {
    const platform = String(query.platform || 'og') as SocialPlatform;
    if (!(platform in SOCIAL_FORMATS)) throw new BadRequestException(`Format inconnu. Formats : ${Object.keys(SOCIAL_FORMATS).join(', ')}.`);
    const { width, height } = SOCIAL_FORMATS[platform];
    const locale = String(query.locale || 'fr').slice(0, 12);
    const [item, brand] = await Promise.all([this.published(source, id, locale), this.brand.current()]);
    const title = cleanText(query.title || item.title || item.name || item.question || item.subject || '').slice(0, 180);
    if (!title) throw new BadRequestException('Le contenu ne comporte pas de titre.');
    const summary = cleanText(query.summary || item.shortDesc || item.summary || item.excerpt || item.description || item.subtitle || item.sujet || item.subject || item.category || item.content || '').slice(0, 500);
    const imageValue = query.image || findImage(item.image) || findImage(item.coverImage) || findImage(item.thumbnail) || findImage(item.media) || findImage(item.slides) || findImage(item.sections);
    const image = await this.imageData(imageValue);
    const logoValue = query.logo === 'none' ? '' : query.logo || brand.logo;
    const logo = await this.imageData(logoValue);
    const bg = hexColor(query.bg, '#1B2A4A');
    const bg2 = hexColor(query.bg2, '#169EC9');
    const accent = hexColor(query.accent, '#C6DA34');
    const fg = hexColor(query.textColor, '#FFFFFF');
    const overlay = clamp(Number(query.overlay ?? 0.52) || 0, 0, 0.88);
    const align = ['left', 'center', 'right'].includes(String(query.align)) ? String(query.align) : 'left';
    const includeQr = ['1', 'true', 'yes'].includes(String(query.qr || '').toLowerCase());
    const url = cleanText(query.url || this.contentUrl(source, item, locale));
    const qrData = includeQr && url ? await this.qr(url, { size: 180, color: bg, background: '#FFFFFF', margin: 1 }) : null;
    const logoPosition = String(query.logoPosition || 'top-left');
    const titleFont = clamp(Number(query.titleSize) || Math.round(width * 0.064), 28, Math.round(width * 0.12));
    const pad = Math.round(width * 0.07);
    const titleLines = wrap(title, Math.max(18, Math.floor((width - pad * 2) / (titleFont * 0.57))), platform.includes('story') ? 4 : 3);
    const summaryLines = wrap(summary, Math.max(24, Math.floor((width - pad * 2) / (titleFont * 0.34))), platform.includes('story') ? 4 : 2);
    const defaultTitleX = align === 'center' ? 50 : align === 'right' ? 93 : 7;
    const titleX = clamp(Number(query.titleX) || defaultTitleX, 3, 97);
    const defaultTitleY = platform.includes('story') ? 63 : 65;
    const titleY = Math.round(height * clamp(Number(query.titleY) || defaultTitleY, 15, 90) / 100);
    const textX = Math.round(width * titleX / 100);
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const titleSvg = titleLines.map((line, index) => `<text x="${textX}" y="${titleY + index * Math.round(titleFont * 1.12)}" text-anchor="${anchor}" fill="${fg}" font-family="Arial, sans-serif" font-size="${titleFont}" font-weight="800">${esc(line)}</text>`).join('');
    const summaryY = titleY + titleLines.length * Math.round(titleFont * 1.12) + Math.round(titleFont * 0.72);
    const summarySvg = summaryLines.map((line, index) => `<text x="${textX}" y="${summaryY + index * Math.round(titleFont * 0.58)}" text-anchor="${anchor}" fill="${fg}" opacity="0.92" font-family="Arial, sans-serif" font-size="${Math.round(titleFont * 0.40)}">${esc(line)}</text>`).join('');
    const qrPosition = String(query.qrPosition || 'bottom-right');
    const qrX = qrPosition.endsWith('left') ? pad : width - pad - 148;
    const qrY = qrPosition.startsWith('top') ? pad : height - pad - 148;
    const logoX = logoPosition.endsWith('right') ? width - pad - 180 : pad;
    const logoY = logoPosition.startsWith('bottom') ? height - pad - 64 : pad;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000" stop-opacity="${(overlay * 0.45).toFixed(2)}"/><stop offset="0.45" stop-color="#000" stop-opacity="${overlay.toFixed(2)}"/><stop offset="1" stop-color="#000" stop-opacity="${Math.min(0.92, overlay + 0.18).toFixed(2)}"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#base)"/>
      ${image ? `<image href="${image}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>` : ''}
      <rect width="100%" height="100%" fill="url(#shade)"/>
      <path d="M0 ${height - Math.round(height * 0.10)} Q${width * 0.42} ${height - Math.round(height * 0.35)} ${width} ${height - Math.round(height * 0.18)} L${width} ${height} L0 ${height}Z" fill="${accent}" opacity="0.22"/>
      ${logo ? `<image href="${logo}" x="${logoX}" y="${logoY}" width="180" height="64" preserveAspectRatio="xMinYMid meet"/>` : `<text x="${pad}" y="${pad + 34}" fill="${fg}" opacity="0.92" font-family="Arial,sans-serif" font-size="${Math.round(width * 0.026)}" font-weight="700">${esc(brand.title)}</text>`}
      ${titleSvg}${summarySvg}
      ${qrData ? `<rect x="${qrX - 9}" y="${qrY - 9}" width="166" height="166" rx="12" fill="#fff"/><image href="data:image/png;base64,${qrData.toString('base64')}" x="${qrX}" y="${qrY}" width="148" height="148"/>` : ''}
      <rect x="${pad}" y="${height - Math.round(height * 0.036)}" width="${Math.round(width * 0.15)}" height="5" rx="2.5" fill="${accent}"/>
    </svg>`;
    const format = String(query.format || 'png').toLowerCase();
    if (!['png', 'jpeg', 'webp'].includes(format)) throw new BadRequestException('format doit être png, jpeg ou webp.');
    // SVG units are CSS px; sharp's default 72 DPI preserves the requested social dimensions.
    const renderer = sharp(Buffer.from(svg));
    const output = format === 'jpeg' ? await renderer.flatten({ background: bg }).jpeg({ quality: 88 }).toBuffer() : format === 'webp' ? await renderer.webp({ quality: 88 }).toBuffer() : await renderer.png().toBuffer();
    return { buffer: output, format, width, height, title, summary, source: { type: source, id }, url };
  }

  private contentUrl(source: string, item: Record<string, unknown>, locale: string) {
    const slug = cleanText(item.slug || item.id);
    const id = cleanText(item.id);
    const routeKey = /^\d+$/.test(id) && slug ? `${id}-${slug}` : slug || id;
    const resolved = ALIASES[source.toLowerCase()];
    const route = resolved === 'pages' ? 'p' : resolved || 'news';
    const base = String(this.config.get('PUBLIC_SITE_URL') || '').replace(/\/$/, '');
    return routeKey ? `${base}/${locale}/${route}/${encodeURIComponent(routeKey)}` : base;
  }
}
