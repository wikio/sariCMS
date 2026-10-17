'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { cmsAdminList } from '@/lib/cms-admin';
import { CMS_MODULES } from '@/lib/cms-modules';

export default function SearchPage() {
  const locale = useLocale();
  const q = useSearchParams().get('q') || '';
  const [groups, setGroups] = useState<Array<{ key: string; label: string; path: string; rows: Record<string, unknown>[] }>>([]);

  useEffect(() => {
    if (!q.trim()) { setGroups([]); return; }
    (async () => {
      const next = [];
      for (const mod of CMS_MODULES.slice(0, 8)) {
        try {
          const rows = await cmsAdminList(mod.resource, { q, filter: JSON.stringify({ locale }) });
          const hit = rows.filter((r) => mod.searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q.toLowerCase())));
          if (hit.length) next.push({ key: mod.key, label: mod.label, path: mod.path, rows: hit.slice(0, 6) });
        } catch { /* */ }
      }
      setGroups(next);
    })();
  }, [q, locale]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">Recherche · « {q} »</h1>
      {groups.length === 0 && <div className="ad-card p-8" style={{ color: 'var(--ad-muted)' }}>Aucun résultat</div>}
      {groups.map((g) => (
        <section key={g.key} className="ad-card p-4 space-y-2">
          <h2 className="font-black">{g.label}</h2>
          {g.rows.map((r) => (
            <Link key={String(r.id)} href={`/${locale}/admin/${g.path}/${r.id}`} className="block py-1 text-sm hover:underline">
              {String(r.name || r.title || r.id)}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
