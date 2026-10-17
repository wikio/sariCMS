import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SEO, getSeo, readSeoStore, writeSeoStore, type SeoLocale } from '@/lib/seo';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'fr';
  const seo = await getSeo(locale);
  return NextResponse.json({ locale, seo, defaults: DEFAULT_SEO });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null) as { locale?: string; seo?: Partial<SeoLocale> } | null;
  const locale = body?.locale || 'fr';
  const store = await readSeoStore();
  store[locale] = { ...DEFAULT_SEO, ...(store[locale] || {}), ...(body?.seo || {}) };
  await writeSeoStore(store);
  return NextResponse.json({ ok: true, locale, seo: store[locale] });
}
