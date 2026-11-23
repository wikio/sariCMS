/**
 * Handler HTTP partagé par `/api/placeholder` et `/api/placeholder/[...segments]`.
 *
 * Sécurité & performance :
 * - Respecte la configuration admin (`enabled`, `maxWidth`, `maxHeight`, `cacheMaxAge`, `allowExternalReferer`).
 * - ETag SHA-256 tronqué + réponse `304 Not Modified`.
 * - En-têtes SVG durcis (`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, `X-Content-Type-Options: nosniff`).
 */
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { parsePlaceholderRequest, renderPlaceholderSvg } from './placeholder-engine';
import { readPlaceholderConfig } from './placeholder-settings';

const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

function sameOriginHost(req: NextRequest, referer: string): boolean {
  try {
    const refUrl = new URL(referer);
    const reqHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(reqHost) && refUrl.host.toLowerCase() === reqHost;
  } catch {
    return false;
  }
}

export async function handlePlaceholderGet(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const config = await readPlaceholderConfig();

  if (!config.enabled) {
    return NextResponse.json(
      { ok: false, error: 'Le générateur d’images dynamique est désactivé dans les paramètres.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!config.allowExternalReferer) {
    const referer = req.headers.get('referer') || '';
    if (referer && !sameOriginHost(req, referer)) {
      return NextResponse.json(
        { ok: false, error: 'Accès externe refusé par la politique anti-hotlink.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  const spec = parsePlaceholderRequest(segments, req.nextUrl.searchParams, config);
  const svg = renderPlaceholderSvg(spec);
  const etag = `"ph-${createHash('sha256').update(svg).digest('hex').slice(0, 16)}"`;

  const cacheControl =
    config.cacheMaxAge > 0
      ? `public, max-age=${config.cacheMaxAge}, stale-while-revalidate=${Math.min(config.cacheMaxAge, 86400)}`
      : 'no-store';

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': cacheControl,
    ETag: etag,
    'Content-Security-Policy': SVG_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': config.allowExternalReferer ? 'cross-origin' : 'same-origin',
  };

  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: baseHeaders });
  }

  return new NextResponse(svg, { status: 200, headers: baseHeaders });
}
