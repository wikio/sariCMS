'use client';
import { useParams } from 'next/navigation';
import { ModuleEditPage } from '@/components/admin/CmsModulePages';
export default function Page() {
  const params = useParams();
  return <ModuleEditPage moduleKey="testimonials" id={String(params.id)} />;
}
