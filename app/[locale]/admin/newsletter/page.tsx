'use client';

/**
 * Liste d'abonnement à la newsletter — CRUD complet, côté serveur.
 *
 * Toutes les inscriptions du site (bandeau de l'accueil, article, formulaire de
 * contact, pied de page) arrivent ici, filtrables par langue, statut et origine.
 * La suppression va dans une corbeille, d'où l'on peut restaurer ou purger.
 *
 * Trois choses méritent une ligne : la **date d'abonnement** est un texte statique
 * (elle est posée par le site, pas par l'écran), la **note** laissée par le
 * visiteur est la colonne `notes` — la même que celle que le formulaire de la
 * vitrine alimente — et les **centres d'intérêt** se saisissent en étiquettes
 * autocomplete, séparées à la virgule, sans liste fermée.
 *
 * L'export prend deux formes : la liste filtrée à l'écran, ou la sélection
 * d'un clic par ligne (« Exporter la sélection ») pour traiter un lot précis.
 * Le nombre de lignes par page se règle en bas du tableau et se retient.
 *
 * Les données viennent de `/api/admin/newsletter`, qui lit l'API CMS quand elle
 * répond et le fichier `data/newsletter.json` sinon — l'écran affiche le mode
 * utilisé pour qu'on sache où l'on écrit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Download, Eye, Inbox, Loader2, Pencil, Plus, RefreshCcw, RotateCcw, Search,
  Send, ThumbsDown, Trash2, Undo2, X,
} from 'lucide-react';
import Drawer from '@/components/admin/Drawer';
import { useToast } from '@/components/admin/Toast';
import TopicsPicker from '@/components/admin/newsletter/TopicsPicker';
import { reasonLabel } from '@/lib/newsletter-reasons';
import {
  bulkSubscribers,
  createSubscriber,
  deleteSubscriber,
  downloadSubscribersCsv,
  listSubscribers,
  restoreSubscriber,
  subscriberStats,
  topicSuggestions,
  type TopicSuggestion,
  updateSubscriber,
  type Subscriber,
  type SubscriberFilters,
} from '@/lib/newsletter-admin';
import { formatDateWith, type SupportedLocale } from '@/lib/date-format';

const STATUSES = ['subscribed', 'pending', 'unsubscribed'] as const;
const LOCALES = ['fr', 'en', 'ar'] as const;

/**
 * Lignes par page : réglable, parce qu'une liste de 400 adresses se relit
 * rarement 25 par 25 quand on cherche un lot. `0` = tout afficher.
 */
const PAGE_SIZES = [10, 25, 50, 100, 0] as const;
const PAGE_SIZE_KEY = 'sari.newsletter.pageSize';
const DEFAULT_PAGE_SIZE = 25;

function readStoredPageSize(): number {
  try {
    const raw = window.localStorage.getItem(PAGE_SIZE_KEY);
    const value = Number(raw);
    if (raw !== null && Number.isFinite(value) && (PAGE_SIZES as readonly number[]).includes(value)) return value;
  } catch {
    /* navigation privée, stockage indisponible : le défaut suffit */
  }
  return DEFAULT_PAGE_SIZE;
}

const EMPTY_FORM: Partial<Subscriber> = {
  email: '', name: '', locale: 'fr', status: 'subscribed', source: 'admin',
  notes: '', topics: [], consent: true,
};

export default function AdminNewsletterPage() {
  const locale = useLocale();
  const t = useTranslations('admin.newsletter');
  /** Les motifs de retrait se traduisent depuis un dictionnaire partagé. */
  const tr = useTranslations('common.newsletterReasons');
  const { showToast } = useToast();

  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [stored, setStored] = useState<'api' | 'local'>('local');
  const [filters, setFilters] = useState<SubscriberFilters>({ status: '', locale: '', source: '', search: '', trash: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: Partial<Subscriber> } | null>(null);
  const [form, setForm] = useState<Partial<Subscriber>>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);

  const query = useMemo(() => ({ ...filters }), [filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, counts] = await Promise.all([listSubscribers(query), subscriberStats().catch(() => ({ stats: {} }))]);
      setRows(list.rows || []);
      setStored(list.stored || 'local');
      setStats((counts as { stats: Record<string, number> }).stats || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPageSize(readStoredPageSize());
    // Les suggestions de thèmes sont les mêmes d'une fiche à l'autre : une seule
    // lecture par ouverture de l'écran suffit.
    void topicSuggestions(locale).then(setTopics).catch(() => setTopics([]));
  }, [locale]);

  useEffect(() => {
    setPage(0);
    // Une sélection vit dans le filtre courant : changer de filtre et laisser des
    // lignes cochées ferait exporter ou désabonner des adresses que l'on ne voit
    // plus à l'écran.
    setPicked([]);
  }, [filters, pageSize]);

  const changePageSize = useCallback((value: number) => {
    setPageSize(value);
    try {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(value));
    } catch {
      /* stockage indisponible : le réglage ne survivra pas à la page, rien de grave */
    }
  }, []);

  const size = pageSize > 0 ? pageSize : rows.length || 1;
  const paged = useMemo(() => rows.slice(page * size, page * size + size), [rows, page, size]);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));

  /**
   * L'écran de consultation renvoie ici avec `?edit=<id>` pour ouvrir la fiche
   * directement en édition — pas besoin de retrouver la ligne dans la liste.
   */
  const editApplied = useRef('');
  useEffect(() => {
    const editId = searchParams?.get('edit') || '';
    if (!editId || loading || editApplied.current === editId) return;
    const row = rows.find((item) => String(item.id) === editId);
    if (!row) return;
    // Une seule fois par identifiant : sinon, refermer le tiroir puis rafraîchir
    // la liste le rouvrirait sans demande de l'administrateur.
    editApplied.current = editId;
    setForm({ ...row });
    setEditing({ mode: 'edit', row });
  }, [rows, searchParams, loading]);
  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.source).filter(Boolean))) as string[], [rows]);

  const patchRow = useCallback(
    async (row: Subscriber, patch: Partial<Subscriber>, message: string) => {
      try {
        await updateSubscriber(row.id, patch);
        showToast(message, 'success');
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [refresh, showToast],
  );

  const removeRow = useCallback(
    async (row: Subscriber, hard = false) => {
      if (hard && !window.confirm(t('confirmPurge', { email: row.email }))) return;
      try {
        await deleteSubscriber(row.id, hard);
        showToast(hard ? t('purged') : t('movedToTrash'), 'success');
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [refresh, showToast, t],
  );

  const restore = useCallback(
    async (row: Subscriber) => {
      try {
        await restoreSubscriber(row.id);
        showToast(t('restored'), 'success');
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [refresh, showToast, t],
  );

  const runBulk = useCallback(
    async (status: string) => {
      if (!picked.length) return;
      try {
        await bulkSubscribers(picked, status);
        setPicked([]);
        showToast(t('bulkDone', { count: picked.length }), 'success');
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [picked, refresh, showToast, t],
  );

  const submitForm = useCallback(async () => {
    if (!form.email?.includes('@')) {
      showToast(t('emailInvalid'), 'error');
      return;
    }
    setSavingForm(true);
    try {
      const payload: Partial<Subscriber> = {
        email: String(form.email).trim().toLowerCase(),
        name: form.name || undefined,
        locale: form.locale || locale,
        status: form.status || 'subscribed',
        source: form.source || 'admin',
        consent: form.consent !== false,
        notes: form.notes || undefined,
        topics: form.topics || [],
      };
      if (editing?.mode === 'edit' && editing.row.id) await updateSubscriber(String(editing.row.id), payload);
      else await createSubscriber(payload as { email: string });
      setEditing(null);
      showToast(editing?.mode === 'edit' ? t('updated') : t('created'), 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSavingForm(false);
    }
  }, [editing, form, locale, refresh, showToast, t]);

  const allPickedOnPage = paged.length > 0 && paged.every((row) => picked.includes(row.id));

  return (
    <div className="space-y-4">
      <div className="ad-card p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black leading-tight">{t('title')}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>{t('subtitle')}</p>
        </div>
        <span className={`ad-chip ${stored === 'api' ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
          {stored === 'api' ? t('storedApi') : t('storedFile')}
        </span>
        <button
          type="button"
          className="ad-btn ad-btn-ghost text-xs"
          onClick={() => void downloadSubscribersCsv(filters).catch((err: Error) => showToast(err.message, 'error'))}
          disabled={!rows.length}
        >
          <Download className="w-3.5 h-3.5" /> {t('exportCsv')}
        </button>
        <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => void refresh()}>
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('reload')}
        </button>
        <button
          type="button"
          className="ad-btn ad-btn-primary text-xs"
          onClick={() => {
            setForm({ ...EMPTY_FORM, locale, topics: [] });
            setEditing({ mode: 'create', row: {} });
          }}
        >
          <Plus className="w-3.5 h-3.5" /> {t('addSubscriber')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'total', label: t('statTotal'), value: stats.total ?? rows.length },
          ...STATUSES.map((status) => ({ key: status, label: t(`stat_${status}`), value: stats[status] ?? 0 })),
          { key: 'trash', label: t('statTrash'), value: stats.trash ?? stats.deleted ?? 0 },
        ].map((card) => (
          <div key={card.key} className="ad-card px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
              {card.label}
            </div>
            <div className="text-2xl font-black tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="ad-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ad-muted)' }} />
          <input
            className="ad-input ad-input-icon ps-9"
            placeholder={t('searchPlaceholder')}
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <select className="ad-input w-auto" value={filters.status || ''} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
        <select className="ad-input w-auto" value={filters.locale || ''} onChange={(e) => setFilters((prev) => ({ ...prev, locale: e.target.value }))}>
          <option value="">{t('allLocales')}</option>
          {LOCALES.map((value) => (
            <option key={value} value={value}>
              {t(`locale_${value}`)}
            </option>
          ))}
        </select>
        <select className="ad-input w-auto" value={filters.source || ''} onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}>
          <option value="">{t('allSources')}</option>
          {sources.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`ad-btn text-xs ${filters.trash ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          onClick={() => setFilters((prev) => ({ ...prev, trash: !prev.trash }))}
        >
          <Inbox className="w-3.5 h-3.5" /> {t('trash')}
        </button>
      </div>

      {picked.length ? (
        <div className="ad-card px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold">{t('selected', { count: picked.length })}</span>
          <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => void runBulk('subscribed')}>
            <Send className="w-3.5 h-3.5" /> {t('markSubscribed')}
          </button>
          <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => void runBulk('unsubscribed')}>
            <ThumbsDown className="w-3.5 h-3.5" /> {t('markUnsubscribed')}
          </button>
          <button
            type="button"
            className="ad-btn ad-btn-ghost text-xs"
            onClick={() => void downloadSubscribersCsv(filters, picked).catch((err: Error) => showToast(err.message, 'error'))}
          >
            <Download className="w-3.5 h-3.5" /> {t('exportSelection', { count: picked.length })}
          </button>
          <button type="button" className="ad-btn ad-btn-danger text-xs" onClick={() => void runBulk('delete')}>
            <Trash2 className="w-3.5 h-3.5" /> {t('trashSelected')}
          </button>
          <button type="button" className="ad-btn-icon ms-auto" onClick={() => setPicked([])} aria-label={t('clearSelection')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ad-card p-3 text-sm" style={{ color: 'var(--ad-danger, #ef4444)' }}>
          {error}
        </div>
      ) : null}

      <div className="ad-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start" style={{ color: 'var(--ad-muted)' }}>
                <th className="px-3 py-2 text-start font-black w-8">
                  <input
                    type="checkbox"
                    aria-label={t('selectAll')}
                    checked={allPickedOnPage}
                    onChange={(e) =>
                      setPicked((prev) =>
                        e.target.checked
                          ? Array.from(new Set([...prev, ...paged.map((row) => row.id)]))
                          : prev.filter((id) => !paged.some((row) => String(row.id) === id)),
                      )
                    }
                  />
                </th>
                <th className="px-3 py-2 text-start font-black">{t('colEmail')}</th>
                <th className="px-3 py-2 text-start font-black">{t('colName')}</th>
                <th className="px-3 py-2 text-start font-black">{t('colLocale')}</th>
                <th className="px-3 py-2 text-start font-black">{t('colStatus')}</th>
                <th className="px-3 py-2 text-start font-black">{t('colSource')}</th>
                <th className="px-3 py-2 text-start font-black">{t('colNotes')}</th>
                <th className="px-3 py-2 text-start font-black whitespace-nowrap">{t('colDate')}</th>
                <th className="px-3 py-2 text-end font-black">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center">
                    <Loader2 className="w-4 h-4 animate-spin inline" /> {t('loading')}
                  </td>
                </tr>
              ) : null}
              {!loading && !paged.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>
                    {t('empty')}
                  </td>
                </tr>
              ) : null}
              {paged.map((row) => (
                <tr key={String(row.id)} className="border-t hover:bg-black/[.03] dark:hover:bg-white/[.03]" style={{ borderColor: 'var(--ad-line)' }}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={picked.includes(row.id)}
                      onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)))}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    <span className="block truncate max-w-[240px]">{row.email}</span>
                    {row.consent === false ? <span className="ad-chip ad-chip-warn text-[10px]">{t('noConsent')}</span> : null}
                  </td>
                  <td className="px-3 py-2">{row.name || <span style={{ color: 'var(--ad-muted)' }}>—</span>}</td>
                  <td className="px-3 py-2"><span className="ad-chip ad-chip-mute">{row.locale}</span></td>
                  <td className="px-3 py-2">
                    <span className={`ad-chip ${row.status === 'subscribed' ? 'ad-chip-ok' : row.status === 'pending' ? 'ad-chip-warn' : 'ad-chip-mute'}`}>
                      {t.has(`status_${row.status}`) ? t(`status_${row.status}`) : row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--ad-muted)' }}>{row.source || '—'}</td>
                  {/* La note est celle que le visiteur a laissée dans la fenêtre de
                      confirmation (colonne `notes`) : tronquée ici, entière sur la fiche. */}
                  <td className="px-3 py-2 text-xs max-w-[220px]">
                    {row.notes ? (
                      <span className="block truncate" title={row.notes}>{row.notes}</span>
                    ) : (
                      <span style={{ color: 'var(--ad-muted)' }}>—</span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-xs whitespace-nowrap"
                    title={`${t('colDate')} · ${formatDateWith(row.subscribedAt || row.createdAt, locale as SupportedLocale, { fallback: '—' })}`}
                  >
                    {formatDateWith(row.subscribedAt || row.createdAt, locale as SupportedLocale, { dateOnly: true, fallback: '—' })}
                    {row.status === 'unsubscribed' && row.unsubscribedAt ? (
                      // La date de retrait et son motif, lues là où la liste se
                      // parcourt : c'est ce qui explique une ligne en rouge.
                      <span className="block text-[10px]" style={{ color: 'var(--ad-muted)' }}>
                        {formatDateWith(row.unsubscribedAt, locale as SupportedLocale, { dateOnly: true, fallback: '—' })}
                        {row.unsubscribeReason ? ` · ${reasonLabel(row.unsubscribeReason, tr)}` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      {filters.trash ? (
                        <>
                          <button type="button" className="ad-btn-icon" title={t('restore')} onClick={() => void restore(row)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" className="ad-btn-icon" title={t('purge')} onClick={() => void removeRow(row, true)}>
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/${locale}/admin/newsletter/${row.id}`}
                            className="ad-btn-icon"
                            title={t('view')}
                            aria-label={t('view')}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            className="ad-btn-icon"
                            title={row.status === 'unsubscribed' ? t('reactivate') : t('deactivate')}
                            onClick={() => void patchRow(row, { status: row.status === 'unsubscribed' ? 'subscribed' : 'unsubscribed' }, t('updated'))}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="ad-btn-icon"
                            title={t('edit')}
                            onClick={() => {
                              setForm({ ...row, topics: row.topics || [] });
                              setEditing({ mode: 'edit', row });
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" className="ad-btn-icon" title={t('trash')} onClick={() => void removeRow(row)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t flex items-center gap-3 text-xs" style={{ borderColor: 'var(--ad-line)', color: 'var(--ad-muted)' }}>
          <span>{t('countShown', { shown: paged.length, total: rows.length })}</span>
          <label className="flex items-center gap-1.5">
            <span>{t('pageSize')}</span>
            <select
              className="ad-input w-auto text-xs py-1"
              value={String(pageSize)}
              onChange={(e) => changePageSize(Number(e.target.value))}
              aria-label={t('pageSize')}
            >
              {PAGE_SIZES.map((value) => (
                <option key={value} value={String(value)}>
                  {value === 0 ? t('pageSizeAll') : value}
                </option>
              ))}
            </select>
          </label>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" className="ad-btn-icon" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label={t('previousPage')}>
              ‹
            </button>
            <span className="tabular-nums">{page + 1} / {pageCount}</span>
            <button type="button" className="ad-btn-icon" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} aria-label={t('nextPage')}>
              ›
            </button>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(editing)}
        title={editing?.mode === 'edit' ? t('editSubscriber') : t('addSubscriber')}
        subtitle={t('drawerHint')}
        onClose={() => setEditing(null)}
        footer={
          <div className="flex items-center gap-2 justify-end w-full">
            <button type="button" className="ad-btn ad-btn-ghost text-xs" onClick={() => setEditing(null)}>
              {t('cancel')}
            </button>
            <button type="button" className="ad-btn ad-btn-primary text-xs" disabled={savingForm} onClick={() => void submitForm()}>
              {savingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {t('save')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldEmail')}</span>
            <input className="ad-input" value={form.email || ''} disabled={editing?.mode === 'edit'} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            {editing?.mode === 'edit' ? <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('emailLocked')}</p> : null}
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldName')}</span>
            <input className="ad-input" value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldLocale')}</span>
              <select className="ad-input" value={form.locale || 'fr'} onChange={(e) => setForm((prev) => ({ ...prev, locale: e.target.value }))}>
                {LOCALES.map((value) => (
                  <option key={value} value={value}>{t(`locale_${value}`)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldStatus')}</span>
              <select className="ad-input" value={form.status || 'subscribed'} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>{t(`status_${value}`)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldSource')}</span>
            <input className="ad-input" value={form.source || ''} placeholder="home.newsletter" onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))} />
          </label>
          <TopicsPicker
            label={t('fieldTopics')}
            help={t('topicsHint')}
            placeholder="produits, evenements"
            addLabel={t('topicsAdd')}
            removeLabel={t('topicsRemove')}
            value={form.topics || []}
            suggestions={topics}
            onChange={(next) => setForm((prev) => ({ ...prev, topics: next }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consent !== false} onChange={(e) => setForm((prev) => ({ ...prev, consent: e.target.checked }))} />
            {t('fieldConsent')}
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>{t('fieldNotes')}</span>
            <textarea
              className="ad-input min-h-[80px]"
              value={form.notes || ''}
              placeholder={t('fieldNotesPlaceholder')}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('fieldNotesHint')}</p>
          </label>

          {/* Journal de la fiche : dates, motif de retrait, empreinte réseau.
              Tout est écrit par le site à l'inscription ou au désabonnement —
              l'écran ne fait que le montrer, sans champ à corriger. */}
          {editing?.mode === 'edit' ? (
            <div
              className="rounded-lg border px-3 py-2.5 space-y-1 text-[11px]"
              style={{ borderColor: 'var(--ad-line)', color: 'var(--ad-muted)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">{t('trace')}</p>
              <p>
                {t('fieldSubscribedAt')} :{' '}
                <span className="font-semibold" style={{ color: 'var(--ad-ink)' }}>
                  {formatDateWith(editing.row.subscribedAt || editing.row.createdAt, locale as SupportedLocale, { fallback: t('unknown') })}
                </span>
              </p>
              {editing.row.unsubscribedAt ? (
                <p>
                  {t('fieldUnsubscribedAt')} :{' '}
                  <span className="font-semibold" style={{ color: 'var(--ad-ink)' }}>
                    {formatDateWith(editing.row.unsubscribedAt, locale as SupportedLocale, { fallback: t('unknown') })}
                  </span>
                  {editing.row.unsubscribeReason ? (
                    <>
                      {' · '}
                      {t('fieldUnsubscribeReason')} :{' '}
                      <span className="font-semibold" style={{ color: 'var(--ad-ink)' }}>
                        {reasonLabel(editing.row.unsubscribeReason, tr)}
                      </span>
                    </>
                  ) : null}
                </p>
                ) : null}
              {editing.row.unsubscribeNote ? (
                <p className="text-[11px] leading-5" style={{ color: 'var(--ad-ink)' }}>
                  {editing.row.unsubscribeNote}
                </p>
              ) : null}
              {editing.row.ip || editing.row.userAgent ? (
                <p title={`${editing.row.ip || ''} ${editing.row.userAgent || ''}`.trim()}>
                  {editing.row.ip || '—'} · {editing.row.userAgent ? `${editing.row.userAgent.slice(0, 60)}${editing.row.userAgent.length > 60 ? '…' : ''}` : '—'}
                </p>
              ) : null}
              <p>{t('traceHint')}</p>
            </div>
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
