'use client';
import { Suspense } from 'react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="ad-card"><PixelGridLoader label="Taxonomies" /></div>}>{children}</Suspense>;
}
