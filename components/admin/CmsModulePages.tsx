'use client';

import { getModule } from '@/lib/cms-modules';
import CmsList from '@/components/admin/CmsList';
import CmsEditor from '@/components/admin/CmsEditor';

export function ModuleListPage({ moduleKey }: { moduleKey: string }) {
  const mod = getModule(moduleKey);
  if (!mod) return <div className="ad-card p-8">Module inconnu</div>;
  return <CmsList mod={mod} />;
}

export function ModuleEditPage({ moduleKey, id }: { moduleKey: string; id: string }) {
  const mod = getModule(moduleKey);
  if (!mod) return <div className="ad-card p-8">Module inconnu</div>;
  return <CmsEditor mod={mod} id={id} />;
}
