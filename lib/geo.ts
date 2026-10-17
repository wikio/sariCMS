'use client';

export interface GeoInfo {
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

const cache = new Map<string, GeoInfo>();

/** Résout le pays d’une IP via l’API backend (cache mémoire + localStorage). */
export async function geoLookup(ip: string): Promise<GeoInfo | null> {
  const clean = (ip || '').trim();
  if (!clean) return null;
  if (cache.has(clean)) return cache.get(clean)!;
  const key = `sari_geo_${clean}`;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as GeoInfo;
        cache.set(clean, parsed);
        return parsed;
      }
    } catch { /* ignore */ }
  }
  try {
    const res = await fetch(`/api/v1/geo/ip?ip=${encodeURIComponent(clean)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const info = (json && json.data ? json.data : json) as GeoInfo;
    if (!info || !info.country) return null;
    cache.set(clean, info);
    if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(info));
    return info;
  } catch {
    return null;
  }
}

export function flagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2 || countryCode === 'XX') return '🌍';
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
