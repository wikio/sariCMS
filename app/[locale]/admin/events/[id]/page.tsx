'use client';
import { useParams } from 'next/navigation';
import { ModuleEditPage } from '@/components/admin/CmsModulePages';
export default function Page() {
  const params = useParams();
  return <ModuleEditPage moduleKey="events" id={String(params.id)} />;
}
