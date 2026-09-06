/**
 * Passerelle d'administration de la liste d'abonnement.
 *
 * Elle expose aux écrans du back-office une seule interface, que les
 * abonnements vivent dans le CMS ou dans le fichier de secours : le studio ne
 * se soucie pas du stockage et affiche simplement d'où viennent les données
 * (`stored: "api" | "local"`).
 *
 *   GET    /api/admin/newsletter                 liste filtrée
 *   GET    /api/admin/newsletter?action=stats      compteurs
 *   GET    /api/admin/newsletter?action=export     CSV
 *   POST   /api/admin/newsletter                   création (ou ?action=bulk)
 *   PATCH  /api/admin/newsletter?id=…              modification
 *   DELETE /api/admin/newsletter?id=…              corbeille (&hard=1 : purge)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { bearer, cmsOr } from '@/lib/server/cms-or';
import {
  bulkStatus,
  createSubscriber,
  deleteSubscriber,
  listSubscribers,
  restoreSubscriber,
  subscriberStats,
  toCsv,
  updateSubscriber,
  type SubscriberRow,
} from '@/lib/newsletter-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

/** Une ligne du CMS et une ligne du fichier se ressemblent assez pour un seul écran. */
function shape(row: Row | SubscriberRow): Row {
  const r = row as Row;
  return {
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    name: (r.name as string) ?? '',
    locale: String(r.locale ?? 'fr'),
    status: String(r.status ?? 'subscribed'),
    source: (r.source as string) ?? '',
    consent: Boolean(r.consent),
    topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
    notes: (r.notes as string) ?? '',
    ip: (r.ip as string) ?? '',
    userAgent: (r.userAgent as string) ?? '',
    subscribedAt: (r.subscribedAt as string) ?? null,
    unsubscribedAt: (r.unsubscribedAt as string) ?? null,
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    deleted: Boolean(r.deleted),
  };
}

function filtersFrom(url: URL) {
  return {
    search: url.searchParams.get('search') || undefined,
    status: url.searchParams.get('status') || undefined,
    locale: url.searchParams.get('locale') || undefined,
    source: url.searchParams.get('source') || undefined,
    includeDeleted: url.searchParams.get('trash') === '1',
  };
}

/**
 * Page de la liste côté CMS.
 *
 * `QueryDto.limit` est plafonné à 100 côté API : demander 500 lignes d'un coup
 * renvoyait un 400, que la passerelle traduisait en erreur d'écran. On pagine
 * donc à hauteur autorisée, et l'appelant s'arrête dès qu'une page est pleine.
 */
const API_PAGE_SIZE = 100;

function apiQuery(url: URL, offset = 0, limit = Number(url.searchParams.get('limit') || API_PAGE_SIZE)) {
  const parts = new URLSearchParams({
    view: 'block',
    limit: String(Math.max(1, Math.min(API_PAGE_SIZE, Number(limit) || API_PAGE_SIZE))),
  });
  if (offset > 0) parts.set('offset', String(offset));
  const search = url.searchParams.get('search');
  if (search) parts.set('search', search);
  const filter: Record<string, string> = {};
  for (const key of ['status', 'locale', 'source'] as const) {
    const value = url.searchParams.get(key);
    if (value) filter[key] = value;
  }
  if (Object.keys(filter).length) parts.set('filter', JSON.stringify(filter));
  if (url.searchParams.get('trash') === '1') return `/newsletter/trash?${parts.toString()}`;
  return `/newsletter?${parts.toString()}`;
}

function unwrapList(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  const data = (payload as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as Row[];
  const nested = (data as { data?: unknown })?.data;
  if (Array.isArray(nested)) return nested as Row[];
  return [];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = bearer(req);
  const action = url.searchParams.get('action');

  if (action === 'stats') {
    const { value, via } = await cmsOr<Record<string, number>>(
      () => cmsFetch('/newsletter/report/stats', { token: token || undefined, timeoutMs: 8000 }).then((r) => r as Record<string, number>),
      () => subscriberStats(),
    );
    return NextResponse.json({ stats: value, stored: via });
  }

  if (action === 'export') {
    // L'export de l'API se filtre par statut et langue ; le tri par recherche
    // reste à l'écran. En secours fichier, on exporte la liste déjà filtrée.
    const exportQuery = new URLSearchParams({ view: 'list' });
    const status = url.searchParams.get('status');
    const locale = url.searchParams.get('locale');
    if (status) exportQuery.set('status', status);
    if (locale) exportQuery.set('locale', locale);
    const qs = exportQuery.toString();
    const csv = await cmsOr<string>(
      () => cmsFetch(`/newsletter/report/export${qs ? `?${qs}` : ''}`, { token: token || undefined, timeoutMs: 15000 }).then((r) => (typeof r === 'string' ? r : JSON.stringify(r))),
      () => listSubscribers(filtersFrom(url)).then((rows) => toCsv(rows)),
    );
    return new NextResponse(String(csv.value ?? ''), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
        'X-Newsletter-Source': csv.via,
      },
    });
  }

  const { value, via } = await cmsOr<Row[]>(
    async () => {
      // Pages successives jusqu'à épuisement : l'écran veut la liste complète
      // du filtre, pas seulement les 100 premières lignes autorisées par requête.
      const collected: Row[] = [];
      for (let page = 0; page < 20; page += 1) {
        const payload = await cmsFetch<unknown>(apiQuery(url, page * API_PAGE_SIZE), {
          token: token || undefined,
          timeoutMs: 12000,
        });
        const rows = unwrapList(payload);
        collected.push(...rows);
        if (rows.length < API_PAGE_SIZE) break;
      }
      return collected.map(shape);
    },
    async () => (await listSubscribers(filtersFrom(url))).map(shape),
  );

  return NextResponse.json({ rows: value, stored: via, total: value.length });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = bearer(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (url.searchParams.get('action') === 'bulk') {
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : [];
    const status = String(body.status || 'subscribed');
    const { value, via } = await cmsOr(
      () =>
        cmsFetch('/newsletter/report/bulk', {
          method: 'POST',
          json: { ids: ids.map((id) => Number(id)).filter((n) => Number.isFinite(n)), status },
          token: token || undefined,
          timeoutMs: 20000,
        }),
      () => bulkStatus(ids, status).then((done) => ({ done, failed: 0 })),
    );
    return NextResponse.json({ ok: true, result: value, stored: via });
  }

  const { value, via } = await cmsOr<Row>(
    () =>
      cmsFetch<Row>('/newsletter', { method: 'POST', json: body, token: token || undefined, timeoutMs: 12000 })
        // Une ligne de l'API et une ligne du fichier se présentent pareil à l'écran.
        .then((row) => (row ? shape(row) : null)),
    async () => shape(await createSubscriber(body as { email: string } & Partial<SubscriberRow>)),
  );
  return NextResponse.json({ ok: true, row: value, stored: via });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const token = bearer(req);
  const id = url.searchParams.get('id') || '';
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { value, via } = await cmsOr<Row | null>(
    () =>
      cmsFetch<Row>(`/newsletter/${encodeURIComponent(id)}`, { method: 'PATCH', json: body, token: token || undefined, timeoutMs: 12000 })
        .then((row) => (row ? shape(row) : null)),
    async () => {
      const row = await updateSubscriber(id, body as Partial<SubscriberRow>);
      return row ? shape(row) : null;
    },
  );
  return NextResponse.json({ ok: true, row: value, stored: via });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const token = bearer(req);
  const id = url.searchParams.get('id') || '';
  const hard = url.searchParams.get('hard') === '1';

  const { value, via } = await cmsOr(
    async () => {
      if (hard) {
        const confirm = await cmsFetch<{ confirm?: string }>(
          `/newsletter/${encodeURIComponent(id)}/purge`,
          { method: 'POST', token: token || undefined, timeoutMs: 12000 },
        );
        return cmsFetch(`/newsletter/${encodeURIComponent(id)}/purge?confirm=${confirm?.confirm || ''}`, {
          method: 'DELETE',
          token: token || undefined,
          timeoutMs: 12000,
        });
      }
      return cmsFetch(`/newsletter/${encodeURIComponent(id)}`, { method: 'DELETE', token: token || undefined, timeoutMs: 12000 });
    },
    async () => (hard ? { deleted: await deleteSubscriber(id, true) } : { deleted: await deleteSubscriber(id) }),
  );
  return NextResponse.json({ ok: true, result: value, stored: via });
}

/** Restauration depuis la corbeille. */
export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const token = bearer(req);
  const id = url.searchParams.get('id') || '';
  const { value, via } = await cmsOr(
    () => cmsFetch(`/newsletter/${encodeURIComponent(id)}/restore`, { method: 'POST', token: token || undefined, timeoutMs: 12000 }),
    async () => ({ restored: await restoreSubscriber(id) }),
  );
  return NextResponse.json({ ok: true, result: value, stored: via });
}
