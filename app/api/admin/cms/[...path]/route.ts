/**
 * /api/admin/cms/[...path] — Passerelle serveur authentifiée vers l'API NestJS.
 *
 * La session administrateur vit dans un cookie `httpOnly` (`sari_admin_access`)
 * illisible en JavaScript : le navigateur ne peut donc plus envoyer d'en-tête
 * `Authorization: Bearer` directement sur `/api/v1/*`. Cette route lit le
 * cookie côté serveur, injecte le jeton Bearer vers `CMS_API_INTERNAL_URL`, et
 * bénéficie en prime de la protection CSRF du middleware (`/api/admin/*`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/admin-auth';
import { cmsServerBase } from '@/lib/cms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROXY_TIMEOUT_MS = 60_000;

const FORWARDED_REQ_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'x-lang',
  'x-locale',
  'x-forwarded-for',
  'x-real-ip',
  'user-agent',
] as const;

const FORWARDED_RES_HEADERS = [
  'content-type',
  'content-disposition',
] as const;

function extractBearerHeader(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

function validateSegments(segments: unknown): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const clean: string[] = [];
  for (const raw of segments) {
    if (typeof raw !== 'string') return null;
    const seg = raw.trim();
    if (
      !seg ||
      seg === '.' ||
      seg === '..' ||
      seg.includes('/') ||
      seg.includes('\\') ||
      seg.includes('\0') ||
      /^[a-z][a-z0-9+.-]*:/i.test(seg)
    ) {
      return null;
    }
    clean.push(encodeURIComponent(seg));
  }
  return clean.join('/');
}

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const safePath = validateSegments(path);
  if (!safePath) {
    return NextResponse.json({ error: 'Chemin API invalide', code: 'INVALID_PATH' }, { status: 400 });
  }

  const accessToken = getAccessToken(req) || extractBearerHeader(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const base = cmsServerBase().replace(/\/$/, '');
  const targetUrl = `${base}/${safePath}${req.nextUrl.search}`;

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('Authorization', `Bearer ${accessToken}`);
  for (const name of FORWARDED_REQ_HEADERS) {
    const value = req.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }
  if (!upstreamHeaders.has('accept')) {
    upstreamHeaders.set('accept', 'application/json');
  }

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) body = buf;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body,
      cache: 'no-store',
      signal: controller.signal,
    });

    const outHeaders = new Headers();
    outHeaders.set('Cache-Control', 'no-store');
    for (const name of FORWARDED_RES_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) outHeaders.set(name, value);
    }

    if (upstream.status === 204 || upstream.status === 304) {
      return new NextResponse(null, { status: upstream.status, headers: outHeaders });
    }

    const responseBuffer = await upstream.arrayBuffer();
    return new NextResponse(responseBuffer, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        error: isAbort ? 'Délai dépassé vers le backend CMS' : 'Backend CMS injoignable',
        code: isAbort ? 'CMS_TIMEOUT' : 'CMS_UNREACHABLE',
      },
      { status: isAbort ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
