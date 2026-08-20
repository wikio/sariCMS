'use client';

import { useParams } from 'next/navigation';
import { ModuleEditPage } from '@/components/admin/CmsModulePages';

export default function NewModulePage() {
  const params = useParams();
  return <ModuleEditPage moduleKey={String(params.module)} id="new" />;
}
