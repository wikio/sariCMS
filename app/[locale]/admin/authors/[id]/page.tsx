// app/[locale]/admin/authors/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ModuleEditPage } from '@/components/admin/CmsModulePages';

export default function AuthorEditPage() {
  const params = useParams();
  return <ModuleEditPage moduleKey="authors" id={String(params.id)} />;
}
