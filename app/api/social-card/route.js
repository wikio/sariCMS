import { convertThemeConfig } from '../../../config/socialTheme.js';
import { renderSocialCard } from '../../../lib/canvasRenderer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.SOCIAL_CARD_ALLOWED_ORIGINS || '*')
    .split(',').map((item) => item.trim()).filter(Boolean);
  const allowedOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    Vary: 'Origin',
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function requestInput(requestUrl, body = {}) {
  const params = new URL(requestUrl).searchParams;
  const read = (name, alias) => body[name] ?? (alias ? body[alias] : undefined) ?? params.get(name) ?? (alias ? params.get(alias) : null);
  const themeParam = params.get('themeConfig') || params.get('theme');
  const themeFromQuery = parseJson(themeParam, ['light', 'dark'].includes(themeParam) ? { mode: themeParam } : {});
  let networks = body.networks ?? parseJson(params.get('networks'), null) ?? params.get('networks');
  if (typeof networks === 'string') networks = networks.split(',').map((name) => name.trim()).filter(Boolean);
  if (!Array.isArray(networks)) networks = [];

  const providedTheme = body.theme && typeof body.theme === 'object' ? body.theme : themeFromQuery;
  const locale = String(read('locale') || '').slice(0, 12);
  const style = String(read('style', 'themePreset') || providedTheme.style || '').slice(0, 48);
  const direction = read('direction') || providedTheme.direction || (locale === 'ar' ? 'rtl' : 'ltr');
  const theme = { ...providedTheme, ...(style ? { style } : {}), direction, locale };
  const transparentValue = body.transparent ?? theme.transparent ?? params.get('transparent');
  const showLogoValue = body.showLogo ?? params.get('showLogo');
  const includeQrValue = body.includeQr ?? params.get('includeQr');
  return {
    kind: String(read('kind') || 'article').slice(0, 48),
    format: String(read('format') || 'square').slice(0, 32),
    width: Number(read('width')) || undefined,
    height: Number(read('height')) || undefined,
    logoUrl: read('logoUrl', 'logo'),
    imageUrl: read('imageUrl', 'image'),
    topic: read('topic'),
    title: read('title'),
    summary: read('summary'),
    location: read('location'),
    date: read('date'),
    url: read('url'),
    networks: networks.slice(0, 8),
    brand: read('brand'),
    showLogo: showLogoValue == null ? true : parseBoolean(showLogoValue),
    includeQr: includeQrValue == null ? true : parseBoolean(includeQrValue),
    textScale: Number(read('textScale')) || 1,
    theme: { ...theme, transparent: parseBoolean(transparentValue) },
  };
}

function allowedImageHosts(request) {
  const hosts = new Set([
    'images.unsplash.com',
    ...(process.env.SOCIAL_CARD_ALLOWED_IMAGE_HOSTS || process.env.GRAPHICS_ALLOWED_IMAGE_HOSTS || '')
      .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean),
  ]);
  const publicSite = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  try { if (publicSite) hosts.add(new URL(publicSite).hostname.toLowerCase()); } catch { /* bad site origin is ignored */ }
  if (!publicSite) {
    // Same-origin GED paths remain usable in local development; external destinations are never trusted implicitly.
    try {
      const requestHost = new URL(request.url).hostname.toLowerCase();
      if (['localhost', '127.0.0.1', '::1'].includes(requestHost)) hosts.add(requestHost);
    } catch { /* invalid request URL */ }
  }
  return hosts;
}

async function resolveImage(value, request) {
  if (!value || typeof value !== 'string' || value.length > 2048) return null;
  const site = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  let target;
  try { target = new URL(value, site); } catch { return null; }
  const hosts = allowedImageHosts(request);
  if (!hosts.has(target.hostname.toLowerCase())) return null;
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(target.hostname))) return null;
  if (target.username || target.password) return null;
  try {
    const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(4500) });
    const mime = response.headers.get('content-type') || '';
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (!response.ok || !/^image\/(?:png|jpe?g|webp|gif|avif|bmp|tiff)$/i.test(mime.split(';')[0].trim()) || declaredSize > MAX_IMAGE_BYTES) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } catch { return null; }
}

function validateInput(input) {
  const max = { kind: 48, format: 32, topic: 100, title: 240, summary: 1200, location: 160, date: 120, url: 2048, brand: 80 };
  for (const [key, limit] of Object.entries(max)) {
    if (input[key] != null && String(input[key]).length > limit) throw new Error(`Le champ ${key} dépasse ${limit} caractères.`);
  }
  if (input.url) {
    let target;
    try { target = new URL(input.url); } catch { throw new Error('url doit être une URL HTTP(S) valide.'); }
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('url doit utiliser HTTP ou HTTPS.');
  }
  if (input.networks.some((name) => typeof name !== 'string' || name.length > 24)) throw new Error('La liste networks contient une valeur invalide.');
}

async function createResponse(request, input, method) {
  const cors = corsHeaders(request);
  if (method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    if (origin && !cors['Access-Control-Allow-Origin']) return new Response(null, { status: 403, headers: cors });
    return new Response(null, { status: 204, headers: cors });
  }
  try {
    validateInput(input);
    const [image, logo] = await Promise.all([
      resolveImage(input.imageUrl, request),
      resolveImage(input.logoUrl, request),
    ]);
    const png = await renderSocialCard({ ...input, image, logo });
    const dimensions = convertThemeConfig(input.theme, input.format, input);
    const headers = {
      ...cors,
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Image-Width': String(dimensions.width),
      'X-Image-Height': String(dimensions.height),
      'Cache-Control': method === 'GET'
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
        : 'no-store',
    };
    return new Response(png, { status: 200, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Échec du rendu de la carte sociale.' }, {
      status: 400,
      headers: { ...cors, 'Cache-Control': 'no-store' },
    });
  }
}

export async function GET(request) {
  const input = requestInput(request.url);
  return createResponse(request, input, 'GET');
}

export async function POST(request) {
  const cors = corsHeaders(request);
  if (request.headers.get('origin') && !cors['Access-Control-Allow-Origin']) {
    return new Response('Origin not allowed', { status: 403, headers: cors });
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return Response.json({ error: 'Corps de requête trop volumineux.' }, { status: 413, headers: cors });
    body = JSON.parse(raw || '{}');
  } catch {
    return Response.json({ error: 'Corps JSON invalide.' }, { status: 400, headers: cors });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Le corps doit être un objet JSON.' }, { status: 400, headers: cors });
  }
  return createResponse(request, requestInput(request.url, body), 'POST');
}

export async function OPTIONS(request) {
  return createResponse(request, {}, 'OPTIONS');
}
