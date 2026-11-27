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
const numeric = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
function formatEventDate(value: unknown, locale: string): string {
  const raw = cleanText(value);
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
const ICON_PATHS: Record<string, string> = {
  activity: 'M2 12h4l3-8 5 16 3-8h5',
  'heart-pulse': 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z M3 12h4l2-3 3 6 2-3h7',
  stethoscope: 'M6 3v5a4 4 0 0 0 8 0V3 M4 3h4 M12 3h4 M10 12v2a5 5 0 0 0 10 0v-1 M18 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  wrench: 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-2-2z',
  package: 'M3 7l9-4 9 4v10l-9 4-9-4z M12 3v18 M3 7l9 5 9-5 M7 5l9 5',
  'shopping-cart': 'M3 3h2l2.2 12h11.5L21 7H6 M9 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2 M17 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  monitor: 'M3 4h18v13H3z M8 21h8 M12 17v4',
  scan: 'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M7 12h10',
  baby: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M5 21v-2a7 7 0 0 1 14 0v2 M9 14h.01 M15 14h.01',
  accessibility: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M4 9l8 2 8-2 M12 11v5 M8 21l4-5 4 5 M6 11l-2 5 M18 11l2 5',
  syringe: 'M3 21l9-9 M14 5l5 5 M11 8l5 5 M7 17l-3-3 M17 2l5 5 M9 10l5 5',
  'flask-conical': 'M9 3h6 M10 3v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3 M7 16h10',
  truck: 'M3 6h12v12H3z M15 10h4l3 4v4h-7 M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
};
function iconMarkup(name: string, x: number, y: number, size: number, color: string): string {
  const key = name.toLowerCase().replaceAll('_', '-');
  const pathData = ICON_PATHS[key];
  const inside = pathData
    ? `<path d="${pathData}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<text x="12" y="16" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="10" font-weight="700">${esc(key.slice(0, 2).toUpperCase())}</text>`;
  return `<g transform="translate(${x} ${y}) scale(${size / 24})"><circle cx="12" cy="12" r="11" fill="${color}"/>${inside}</g>`;
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

  private async remoteImage(url: string): Promise<Buffer | null> {
    let target: URL;
    try { target = new URL(url); } catch { return null; }
    if (target.protocol !== 'https:' || target.username || target.password) return null;
    let allowedHosts: string[] = [];
    const publicSite = this.config.get<string>('PUBLIC_SITE_URL') || '';
    try { if (publicSite) allowedHosts.push(new URL(publicSite).hostname.toLowerCase()); } catch { /* invalid origin is ignored */ }
    allowedHosts = [...allowedHosts, ...(this.config.get<string>('GRAPHICS_ALLOWED_IMAGE_HOSTS') || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)];
    if (!allowedHosts.includes(target.hostname.toLowerCase())) return null;
    try {
      const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      const contentType = response.headers.get('content-type') || '';
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (!response.ok || !contentType.toLowerCase().startsWith('image/') || declaredSize > 12 * 1024 * 1024) return null;
      const data = Buffer.from(await response.arrayBuffer());
      return data.length <= 12 * 1024 * 1024 ? data : null;
    } catch { return null; }
  }

  private async imageData(value: unknown): Promise<string> {
    const raw = cleanText(value);
    if (!raw || raw.length > 2048) return '';
    let pathname = raw;
    let remoteUrl = '';
    try {
      if (/^https?:\/\//i.test(raw)) { const parsed = new URL(raw); pathname = parsed.pathname; remoteUrl = raw; }
    } catch { return ''; }
    if (pathname.startsWith('uploads/')) pathname = `/${pathname}`;
    if (!pathname.startsWith('/uploads/')) return '';
    let rel: string;
    try { rel = decodeURIComponent(pathname.slice('/uploads/'.length)); } catch { return ''; }
    if (!rel || rel.split(/[\\/]/).some((part) => part === '..' || part === '.')) return '';
    const root = path.resolve(this.config.get<string>('GED_UPLOAD_DIR') || path.resolve(process.cwd(), '..', 'public', 'uploads'));
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) return '';
    try {
      let buffer: Buffer | null = null;
      try {
        const stat = await fs.stat(file);
        if (stat.isFile() && stat.size <= 12 * 1024 * 1024) buffer = await fs.readFile(file);
      } catch { /* try the explicitly allowed public origin below */ }
      if (!buffer) {
        const site = this.config.get<string>('PUBLIC_SITE_URL') || '';
        const fallbackUrl = remoteUrl || (site ? new URL(pathname, site).toString() : '');
        if (fallbackUrl) buffer = await this.remoteImage(fallbackUrl);
      }
      if (!buffer) return '';
      const png = await sharp(buffer, { limitInputPixels: 25_000_000 }).resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { return ''; }
  }

  async social(source: string, id: string, query: Record<string, unknown>) {
    const platform = String(query.platform || 'og') as SocialPlatform;
    if (!(platform in SOCIAL_FORMATS)) throw new BadRequestException(`Format inconnu. Formats : ${Object.keys(SOCIAL_FORMATS).join(', ')}.`);
    const { width, height } = SOCIAL_FORMATS[platform];
    const requestedLocale = String(query.locale || 'fr').slice(0, 12);
    const locale = ['fr', 'en', 'ar'].includes(requestedLocale) ? requestedLocale : 'fr';
    const [item, brand] = await Promise.all([this.published(source, id, locale), this.brand.current()]);
    const resolved = ALIASES[source.toLowerCase()];
    const title = cleanText(query.title || item.title || item.name || item.question || item.subject || '').slice(0, 180);
    if (!title) throw new BadRequestException('Le contenu ne comporte pas de titre.');
    const summary = cleanText(query.summary || item.chapo || item.shortDesc || item.summary || item.excerpt || item.description || item.subtitle || item.sujet || item.subject || item.category || item.content || '').slice(0, 500);
    const defaultSubject = resolved === 'news' ? item.sujet || item.category || item.classification : resolved === 'events' ? item.type || item.category : resolved === 'products' ? item.category : '';
    const subject = cleanText(query.subject || defaultSubject || '').slice(0, 72);
    const imageValue = query.image || findImage(item.image) || findImage(item.coverImage) || findImage(item.thumbnail) || findImage(item.media) || findImage(item.slides) || findImage(item.sections);
    const image = await this.imageData(imageValue);
    const logoValue = query.logo === 'none' ? '' : query.logo || brand.logo;
    const logo = await this.imageData(logoValue);
    const bg = hexColor(query.bg, '#1B2A4A');
    const bg2 = hexColor(query.bg2, '#169EC9');
    const accent = hexColor(query.accent, '#C6DA34');
    const fg = hexColor(query.textColor, '#FFFFFF');
    const layoutCandidates = ['full', 'split-left', 'split-right', 'diagonal'];
    const defaultLayout = ['products', 'services', 'solutions'].includes(resolved) ? 'split-left' : 'full';
    const layout = layoutCandidates.includes(String(query.layout)) ? String(query.layout) : defaultLayout;
    const effectCandidates = ['none', 'tint', 'negative', 'screen', 'multiply', 'soft-light', 'overlay'];
    const effect = effectCandidates.includes(String(query.effect)) ? String(query.effect) : 'none';
    const effectColor = hexColor(query.effectColor, accent);
    const effectOpacity = clamp(numeric(query.effectOpacity, 0.26), 0, 0.9);
    const imageOpacity = clamp(numeric(query.imageOpacity, 1), 0, 1);
    const overlay = clamp(numeric(query.overlay, 0.52), 0, 0.88);
    const align = ['left', 'center', 'right'].includes(String(query.align)) ? String(query.align) : 'left';
    const includeQr = ['1', 'true', 'yes'].includes(String(query.qr || '').toLowerCase());
    const url = cleanText(query.url || this.contentUrl(source, item, locale));
    const qrData = includeQr && url ? await this.qr(url, { size: 180, color: bg, background: '#FFFFFF', margin: 1 }) : null;
    const pad = Math.round(width * 0.055);
    const split = layout === 'split-left' || layout === 'split-right';
    const photoWidth = split ? Math.round(width * 0.43) : width;
    const photoX = layout === 'split-right' ? width - photoWidth : 0;
    const photoPath = layout === 'diagonal'
      ? `M0 0 H${Math.round(width * 0.84)} L${Math.round(width * 0.60)} ${height} H0 Z`
      : `M${photoX} 0 H${photoX + photoWidth} V${height} H${photoX} Z`;
    const photoClip = `<clipPath id="photoClip"><path d="${photoPath}"/></clipPath>`;
    const imageFilter = effect === 'negative'
      ? '<filter id="negative"><feComponentTransfer><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer></filter>'
      : '';
    const imageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>${photoClip}${imageFilter}</defs><rect width="100%" height="100%" fill="url(#base)"/>${image ? `<image href="${image}" x="${photoX}" y="0" width="${photoWidth}" height="${height}" opacity="${imageOpacity}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)" ${effect === 'negative' ? 'filter="url(#negative)"' : ''}/>` : ''}</svg>`;
    let background = await sharp(Buffer.from(imageSvg)).png().toBuffer();
    if (image && ['tint', 'screen', 'multiply', 'soft-light', 'overlay'].includes(effect) && effectOpacity > 0) {
      const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${photoClip}</defs><rect width="100%" height="100%" fill="${effectColor}" opacity="${effectOpacity}" clip-path="url(#photoClip)"/></svg>`;
      const blend = effect === 'tint' ? 'over' : effect as 'screen' | 'multiply' | 'soft-light' | 'overlay';
      background = await sharp(background).composite([{ input: Buffer.from(tintSvg), blend }]).png().toBuffer();
    }
    const regionStart = layout === 'split-left' ? Math.round(width * 0.47) : pad;
    const regionEnd = layout === 'split-right' ? Math.round(width * 0.52) - pad : width - pad;
    const regionWidth = Math.max(100, regionEnd - regionStart);
    const defaultTitleX = layout === 'split-left' ? 53 : layout === 'split-right' ? 7 : align === 'center' ? 50 : align === 'right' ? 93 : 7;
    const titleX = clamp(numeric(query.titleX, defaultTitleX), 3, 97);
    const textX = Math.round(width * titleX / 100);
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const story = platform.includes('story');
    const titleFont = clamp(numeric(query.titleSize, Math.round((split ? regionWidth : width - pad * 2) * (split ? 0.085 : 0.064))), 22, Math.round(width * 0.12));
    const defaultTitleY = story ? 61 : split ? 44 : resolved === 'events' ? 58 : 65;
    const titleY = Math.round(height * clamp(numeric(query.titleY, defaultTitleY) / 100, 0.15, 0.9));
    const usable = Math.max(120, Math.min(regionWidth, width - Math.max(pad, textX % width - pad)));
    const titleLines = wrap(title, Math.max(10, Math.floor(usable / (titleFont * 0.57))), story ? 4 : 3);
    const summaryLines = wrap(summary, Math.max(16, Math.floor(usable / (titleFont * 0.34))), story ? 4 : 3);
    const titleSvg = titleLines.map((line, index) => `<text x="${textX}" y="${titleY + index * Math.round(titleFont * 1.12)}" text-anchor="${anchor}" fill="${fg}" font-family="Arial, sans-serif" font-size="${titleFont}" font-weight="800">${esc(line)}</text>`).join('');
    const summaryY = titleY + titleLines.length * Math.round(titleFont * 1.12) + Math.round(titleFont * 0.65);
    const summarySvg = summaryLines.map((line, index) => `<text x="${textX}" y="${summaryY + index * Math.round(titleFont * 0.56)}" text-anchor="${anchor}" fill="${fg}" opacity="0.94" font-family="Arial, sans-serif" font-size="${Math.round(titleFont * 0.39)}">${esc(line)}</text>`).join('');
    const eventDates = resolved === 'events' ? [formatEventDate(item.startDate || item.date, locale), formatEventDate(item.endDate, locale)].filter(Boolean).join(' – ') : '';
    const eventPlace = resolved === 'events' ? cleanText(item.location || item.venue || '') : '';
    const eventMeta = [eventDates, eventPlace].filter(Boolean).join('  ·  ').slice(0, 180);
    const eventY = summaryY + summaryLines.length * Math.round(titleFont * 0.56) + Math.round(titleFont * 0.8);
    const eventSvg = eventMeta ? `<text x="${textX}" y="${eventY}" text-anchor="${anchor}" fill="${accent}" font-family="Arial,sans-serif" font-size="${Math.round(titleFont * 0.32)}" font-weight="700">${esc(eventMeta)}</text>` : '';
    const itemColor = hexColor(query.iconColor || item.color, accent);
    const iconName = cleanText(query.icon || item.icon || '');
    const iconX = align === 'center' ? textX - 22 : align === 'right' ? textX - 46 : textX;
    const iconY = titleY - titleFont - (subject ? 88 : 62);
    const icon = iconName && ['services', 'solutions', 'products'].includes(resolved) ? iconMarkup(iconName, iconX, iconY, 42, itemColor) : '';
    const subjectWidth = clamp(subject.length * 9 + 30, 82, Math.min(300, regionWidth));
    const subjectX = align === 'center' ? textX - subjectWidth / 2 : align === 'right' ? textX - subjectWidth : textX;
    const subjectY = titleY - titleFont * 0.92;
    const subjectSvg = subject ? `<g><rect x="${subjectX}" y="${subjectY - 24}" width="${subjectWidth}" height="30" rx="15" fill="${accent}"/><text x="${subjectX + subjectWidth / 2}" y="${subjectY - 4}" text-anchor="middle" fill="${bg}" font-family="Arial,sans-serif" font-size="14" font-weight="800">${esc(subject)}</text></g>` : '';
    const badge = subjectSvg || (resolved === 'events' ? '<g><rect x="0" y="0" width="0" height="0"/></g>' : '');
    const logoPosition = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(String(query.logoPosition)) ? String(query.logoPosition) : 'top-left';
    const qrPosition = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(String(query.qrPosition)) ? String(query.qrPosition) : 'bottom-right';
    const qrX = qrPosition.endsWith('left') ? pad : width - pad - 148;
    const qrY = qrPosition.startsWith('top') ? pad : height - pad - 148;
    const logoX = logoPosition.endsWith('right') ? width - pad - 180 : pad;
    const logoY = logoPosition.startsWith('bottom') ? height - pad - 64 : pad;
    const frameWidth = clamp(numeric(query.borderWidth, 0), 0, 36);
    const frameColor = hexColor(query.borderColor, accent);
    const frameRadius = clamp(numeric(query.borderRadius, 0), 0, Math.floor(Math.min(width, height) / 4));
    const shade = overlay > 0 ? `<rect x="${split ? regionStart - pad : 0}" y="0" width="${split ? regionWidth + pad : width}" height="100%" fill="#000" opacity="${overlay}"/>` : '';
    const diagonalShape = layout === 'diagonal' ? `<path d="M${width * 0.82} 0 L${width * 0.60} ${height} L${width} ${height} L${width} 0Z" fill="${bg}" opacity="0.94"/>` : '';
    const panelAccent = split ? `<rect x="${layout === 'split-left' ? photoWidth : 0}" y="0" width="${Math.round(width * 0.012)}" height="100%" fill="${accent}"/>` : '';
    const logoMarkup = logo ? `<image href="${logo}" x="${logoX}" y="${logoY}" width="180" height="64" preserveAspectRatio="xMinYMid meet"/>` : `<text x="${logoX}" y="${logoY + 34}" fill="${fg}" opacity="0.95" font-family="Arial,sans-serif" font-size="${Math.round(width * 0.026)}" font-weight="700">${esc(brand.title)}</text>`;
    const frame = frameWidth > 0 ? `<rect x="${frameWidth / 2}" y="${frameWidth / 2}" width="${width - frameWidth}" height="${height - frameWidth}" rx="${frameRadius}" fill="none" stroke="${frameColor}" stroke-width="${frameWidth}"/>` : '';
    const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${photoClip}<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.30"/></linearGradient></defs>${shade}${diagonalShape}${panelAccent}<path d="M0 ${height - Math.round(height * 0.10)} Q${width * 0.42} ${height - Math.round(height * 0.35)} ${width} ${height - Math.round(height * 0.18)} L${width} ${height} L0 ${height}Z" fill="${accent}" opacity="0.15"/>${logoMarkup}${icon}${badge}${titleSvg}${summarySvg}${eventSvg}${qrData ? `<rect x="${qrX - 9}" y="${qrY - 9}" width="166" height="166" rx="12" fill="#fff"/><image href="data:image/png;base64,${qrData.toString('base64')}" x="${qrX}" y="${qrY}" width="148" height="148"/>` : ''}${frame}<rect x="${pad}" y="${height - Math.round(height * 0.036)}" width="${Math.round(width * 0.15)}" height="5" rx="2.5" fill="${accent}"/></svg>`;
    const format = String(query.format || 'png').toLowerCase();
    if (!['png', 'jpeg', 'webp'].includes(format)) throw new BadRequestException('format doit être png, jpeg ou webp.');
    // SVG units are CSS px; sharp's default 72 DPI preserves the requested social dimensions.
    const renderer = sharp(background).composite([{ input: Buffer.from(overlaySvg) }]);
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
