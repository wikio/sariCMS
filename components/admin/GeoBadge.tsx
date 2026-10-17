'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { geoLookup, flagEmoji, type GeoInfo } from '@/lib/geo';

export default function GeoBadge({ ip, country }: { ip?: string | null; country?: string | null }) {
  const [info, setInfo] = useState<GeoInfo | null>(null);

  useEffect(() => {
    if (!ip) return;
    let active = true;
    geoLookup(ip).then((res) => {
      if (active && res) setInfo(res);
    });
    return () => { active = false; };
  }, [ip]);

  if (!ip) return <span style={{ color: 'var(--ad-muted)' }}>—</span>;

  const flag = info?.flag || flagEmoji(country || undefined);
  const label = info?.country || country || '…';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={`IP : ${ip}`}>
      <span>{flag}</span>
      <span>{label}</span>
      <span className="font-mono opacity-70"><Globe className="w-3 h-3 inline" /> {ip}</span>
    </span>
  );
}
