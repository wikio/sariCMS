import { Injectable, Logger } from '@nestjs/common';

export interface GeoLookup {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  flag: string;
}

const GEO_PROVIDERS = ['https://ipwho.is', 'https://ipapi.co'];

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly cache = new Map<string, GeoLookup>();

  /** Normalise une IP privée / locale vers « Local ». */
  private isLocal(ip: string): boolean {
    const t = ip.trim().toLowerCase();
    if (!t) return true;
    if (['::1', '127.0.0.1', 'localhost'].includes(t)) return true;
    if (t.startsWith('10.') || t.startsWith('192.168.') || t.startsWith('172.')) return true;
    if (t === '::ffff:127.0.0.1') return true;
    if (t.startsWith('fe80:') || t.startsWith('fc') || t.startsWith('fd')) return true;
    return false;
  }

  private localResult(ip: string): GeoLookup {
    return {
      ip,
      country: 'Local',
      countryCode: 'XX',
      city: 'Local',
      region: '',
      latitude: null,
      longitude: null,
      isp: null,
      flag: '🏠',
    };
  }

  async lookup(ip: string): Promise<GeoLookup> {
    const clean = (ip || '').trim();
    if (!clean) return this.localResult(clean);
    if (this.cache.has(clean)) return this.cache.get(clean)!;
    if (this.isLocal(clean)) {
      const r = this.localResult(clean);
      this.cache.set(clean, r);
      return r;
    }

    for (const base of GEO_PROVIDERS) {
      try {
        const res = await fetch(`${base}/${encodeURIComponent(clean)}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'sari-cms/1.0' },
        });
        if (!res.ok) continue;
        const json = (await res.json()) as Record<string, unknown>;

        // ipwho.is : { success, country, country_code, city, region, latitude, longitude, connection:{isp}, flag:{emoji} }
        if (json.success === false) continue;
        if (!json.country && !json.country_name) continue;

        const country = String(json.country || json.country_name || '');
        const countryCode = String(json.country_code || json.country_code2 || '').toUpperCase();
        const flagEmoji = (json.flag as { emoji?: string })?.emoji || '';
        const result: GeoLookup = {
          ip: clean,
          country,
          countryCode,
          city: String(json.city || ''),
          region: String(json.region || ''),
          latitude: typeof json.latitude === 'number' ? (json.latitude as number) : null,
          longitude: typeof json.longitude === 'number' ? (json.longitude as number) : null,
          isp: (json.connection as { isp?: string })?.isp || null,
          flag: flagEmoji || this.emojiFor(countryCode),
        };
        this.cache.set(clean, result);
        return result;
      } catch (err) {
        this.logger.warn(`Geo provider ${base} failed: ${(err as Error).message}`);
      }
    }

    const fallback: GeoLookup = { ip: clean, country: 'Inconnu', countryCode: 'XX', city: '', region: '', latitude: null, longitude: null, isp: null, flag: '🌍' };
    this.cache.set(clean, fallback);
    return fallback;
  }

  private emojiFor(code: string): string {
    if (!code || code.length !== 2 || code === 'XX') return '🌍';
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }
}
