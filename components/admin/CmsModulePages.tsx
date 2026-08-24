'use client';

import { Suspense } from 'react';
import { getModule } from '@/lib/cms-modules';
import CmsList from '@/components/admin/CmsList';
import CmsEditor from '@/components/admin/CmsEditor';
import PixelGridLoader from '@/components/admin/PixelGridLoader';

export function ModuleListPage({ moduleKey }: { moduleKey: string }) {
  const mod = getModule(moduleKey);
  if (!mod) return <div className="ad-card p-8">Module not found</div>;
  return <CmsList mod={mod} />;
}

export function ModuleEditPage({ moduleKey, id }: { moduleKey: string; id: string }) {
  const mod = getModule(moduleKey);
  if (!mod) return <div className="ad-card p-8">Module not found</div>;
  return (
    <Suspense fallback={<div className="ad-card"><PixelGridLoader label="..." /></div>}>
      <CmsEditor mod={mod} id={id} />
    </Suspense>
  );
}
