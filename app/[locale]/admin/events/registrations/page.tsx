'use client';

import { Suspense } from 'react';
import EventRegistrationsDesk from '@/components/admin/EventRegistrationsDesk';
import PixelGridLoader from '@/components/admin/PixelGridLoader';

export default function AdminEventRegistrationsPage() {
  return (
    <Suspense fallback={<div className="ad-card"><PixelGridLoader label="..." /></div>}>
      <EventRegistrationsDesk />
    </Suspense>
  );
}
