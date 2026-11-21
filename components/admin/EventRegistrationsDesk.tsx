'use client';

/**
 * Bureau d'administration des candidatures et participants aux événements.
 *
 * - Suivi par événement, par statut (`pending`, `confirmed`, `attended`,
 *   `waitlist`, `rejected`, `cancelled`) et par lien au profil client.
 * - Association / promotion d'un candidat en tant que profil client par e-mail
 *   (unitaire, en lot, ou synchronisation globale des clients existants).
 * - Création manuelle, édition, pointage de présence, corbeille et export CSV.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Drawer from '@/components/admin/Drawer';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import SearchField from '@/components/admin/SearchField';
import { useToast } from '@/components/admin/Toast';
import DateText from '@/components/shared/DateText';
import { cmsAdminList } from '@/lib/cms-admin';
import {
  bulkEventRegistrations,
  createEventRegistrationAdmin,
  deleteEventRegistrationAdmin,
  eventRegistrationsCsvUrl,
  listEventRegistrations,
  promoteRegistrationToClient,
  syncRegistrationClients,
  updateEventRegistrationAdmin,
  type EventRegistration,
  type EventRegistrationStats,
  type EventRegistrationStatus,
} from '@/lib/event-registrations-admin';

const STATUSES: EventRegistrationStatus[] = [
  'pending',
  'confirmed',
  'attended',
  'waitlist',
  'rejected',
  'cancelled',
];

interface CmsEventOption {
  id: string;
  legacyId?: string;
  slug?: string;
  title: string;
  startDate?: string;
  location?: string;
  type?: string;
}

function statusChipClass(status: EventRegistrationStatus): string {
  switch (status) {
    case 'confirmed':
      return 'ad-chip-acc';
    case 'attended':
      return 'ad-chip-ok';
    case 'waitlist':
      return 'ad-chip-mute';
    case 'rejected':
    case 'cancelled':
      return 'ad-chip-warn';
    default:
      return 'ad-chip-mute';
  }
}

export default function EventRegistrationsDesk() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations('admin.eventRegistrations');
  const { showToast } = useToast();

  const initialEventId = searchParams.get('eventId') || '';
  const initialSearch = searchParams.get('search') || '';

  const [rows, setRows] = useState<EventRegistration[]>([]);
  const [stats, setStats] = useState<EventRegistrationStats | null>(null);
  const [events, setEvents] = useState<CmsEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [syncingClients, setSyncingClients] = useState(false);

  // Filtres
  const [eventFilter, setEventFilter] = useState(initialEventId);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState<'' | 'linked' | 'unlinked'>('');
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [showTrash, setShowTrash] = useState(false);

  // Sélection groupée
  const [selected, setSelected] = useState<string[]>([]);

  // Fiche détaillée / édition
  const [activeRow, setActiveRow] = useState<EventRegistration | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<EventRegistration>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Création manuelle
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    eventId: initialEventId,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    notes: '',
    adminNotes: '',
    status: 'confirmed' as EventRegistrationStatus,
    addAsClient: false,
  });
  const [savingCreate, setSavingCreate] = useState(false);

  // Bannière mot de passe temporaire lors de la création d'un compte client
  const [createdClientBanner, setCreatedClientBanner] = useState<{
    email: string;
    name: string;
    tempPassword: string;
  } | null>(null);

  // Charger les événements du CMS pour le filtre et le formulaire d'ajout
  useEffect(() => {
    let cancelled = false;
    cmsAdminList<Record<string, unknown>>('events', {
      filter: JSON.stringify({ locale }),
      limit: '100',
    })
      .then((list) => {
        if (cancelled) return;
        setEvents(
          list.map((e) => ({
            id: String(e.id ?? ''),
            legacyId: e.legacyId ? String(e.legacyId) : undefined,
            slug: e.slug ? String(e.slug) : undefined,
            title: String(e.title || `#${e.id}`),
            startDate: e.startDate ? String(e.startDate) : e.date ? String(e.date) : undefined,
            location: e.location ? String(e.location) : undefined,
            type: e.type ? String(e.type) : undefined,
          })),
        );
      })
      .catch(() => {
        // Repli sur les événements présents dans stats.byEvent
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEventRegistrations({
        eventId: eventFilter || undefined,
        status: statusFilter || undefined,
        clientLinked: clientFilter || undefined,
        search: searchQuery || undefined,
        trash: showTrash,
      });
      setRows(res.rows || []);
      setStats(res.stats || null);
      setSelected([]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [eventFilter, statusFilter, clientFilter, searchQuery, showTrash, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Liste fusionnée des événements (CMS + événements ayant déjà des inscriptions)
  const eventOptions = useMemo(() => {
    const map = new Map<string, CmsEventOption & { count: number }>();
    for (const ev of events) {
      const key = ev.legacyId || ev.id;
      const statEntry = stats?.byEvent?.[key] || stats?.byEvent?.[ev.id];
      map.set(key, { ...ev, count: statEntry?.total || 0 });
    }
    if (stats?.byEvent) {
      for (const [key, info] of Object.entries(stats.byEvent)) {
        if (!map.has(key)) {
          map.set(key, {
            id: info.eventId || key,
            legacyId: key !== info.eventId ? key : undefined,
            title: info.eventTitle,
            count: info.total,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [events, stats]);

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () => setSelected(allChecked ? [] : rows.map((r) => r.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const statusLabel = (s: EventRegistrationStatus) => t(`status_${s}`);

  const handleQuickStatus = async (row: EventRegistration, nextStatus: EventRegistrationStatus) => {
    if (row.status === nextStatus) return;
    setBusy(true);
    try {
      await updateEventRegistrationAdmin(row.id, { status: nextStatus });
      showToast(t('toastSaved'), 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePromoteClient = async (row: EventRegistration) => {
    setPromotingId(row.id);
    try {
      const res = await promoteRegistrationToClient(row.id);
      if (res.mode === 'created') {
        showToast(t('toastClientCreated', { email: row.email }), 'success');
        if (res.tempPassword) {
          setCreatedClientBanner({
            email: row.email,
            name: row.fullName || row.email,
            tempPassword: res.tempPassword,
          });
        }
      } else {
        showToast(t('toastClientLinked', { email: row.email }), 'success');
      }
      await load();
      if (activeRow?.id === row.id && res.registration) {
        setActiveRow(res.registration);
        setEditDraft(res.registration);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setPromotingId(null);
    }
  };

  const handleSyncClients = async () => {
    setSyncingClients(true);
    try {
      const res = await syncRegistrationClients();
      showToast(
        t('toastSyncDone', {
          linked: String(res.linkedRows),
          clients: String(res.matchedClients),
        }),
        'success',
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setSyncingClients(false);
    }
  };

  const handleDelete = async (row: EventRegistration, hard = false) => {
    const msg = hard ? t('confirmPurge') : t('confirmDelete');
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteEventRegistrationAdmin(row.id, hard);
      showToast(t('toastDeleted'), 'success');
      if (activeRow?.id === row.id) setActiveRow(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (row: EventRegistration) => {
    setBusy(true);
    try {
      await updateEventRegistrationAdmin(row.id, { restore: true });
      showToast(t('toastRestored'), 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async (
    op: 'status' | 'delete' | 'restore' | 'promote_client',
    extra: { status?: EventRegistrationStatus; hard?: boolean } = {},
  ) => {
    if (!selected.length) return;
    if (op === 'delete' && !confirm(t('confirmBulkDelete', { count: String(selected.length) }))) return;
    setBusy(true);
    try {
      const res = await bulkEventRegistrations(op, selected, extra);
      if (op === 'promote_client') {
        showToast(
          t('toastSyncDone', {
            linked: String((res.created || 0) + (res.linked || 0)),
            clients: String(res.created || 0),
          }),
          'success',
        );
      } else {
        showToast(t('toastBulkDone', { count: String(res.count ?? selected.length) }), 'success');
      }
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openDrawer = (row: EventRegistration) => {
    setActiveRow(row);
    setEditDraft({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      company: row.company || '',
      position: row.position || '',
      notes: row.notes || '',
      adminNotes: row.adminNotes || '',
      status: row.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!activeRow) return;
    setSavingEdit(true);
    try {
      const res = await updateEventRegistrationAdmin(activeRow.id, editDraft);
      showToast(t('toastSaved'), 'success');
      setActiveRow(res.registration);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = eventOptions.find(
      (opt) => opt.id === newForm.eventId || opt.legacyId === newForm.eventId,
    );
    if (!newForm.eventId) {
      showToast(t('selectEvent'), 'error');
      return;
    }
    setSavingCreate(true);
    try {
      const res = await createEventRegistrationAdmin({
        eventId: ev?.id || newForm.eventId,
        eventLegacyId: ev?.legacyId,
        eventSlug: ev?.slug,
        eventTitle: ev?.title || `Événement #${newForm.eventId}`,
        eventDate: ev?.startDate,
        eventLocation: ev?.location,
        eventType: ev?.type,
        firstName: newForm.firstName,
        lastName: newForm.lastName,
        email: newForm.email,
        phone: newForm.phone,
        company: newForm.company,
        position: newForm.position,
        notes: newForm.notes,
        adminNotes: newForm.adminNotes,
        status: newForm.status,
        locale,
        addAsClient: newForm.addAsClient,
      });
      showToast(t('toastCreated'), 'success');
      if (res.promoted?.mode === 'created' && res.promoted.tempPassword) {
        setCreatedClientBanner({
          email: newForm.email,
          name: [newForm.firstName, newForm.lastName].filter(Boolean).join(' ') || newForm.email,
          tempPassword: res.promoted.tempPassword,
        });
      }
      setCreating(false);
      setNewForm({
        eventId: eventFilter || '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        notes: '',
        adminNotes: '',
        status: 'confirmed',
        addAsClient: false,
      });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toastLoadError'), 'error');
    } finally {
      setSavingCreate(false);
    }
  };

  const exportHref = eventRegistrationsCsvUrl(
    {
      eventId: eventFilter || undefined,
      status: statusFilter || undefined,
      clientLinked: clientFilter || undefined,
      search: searchQuery || undefined,
      trash: showTrash,
    },
    selected.length ? selected : undefined,
  );

  const copyText = (txt: string) => {
    navigator.clipboard?.writeText(txt).then(() => showToast(t('toastCopied'), 'success')).catch(() => {});
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>
            {t('eyebrow')}
          </div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="w-7 h-7" style={{ color: 'var(--ad-accent)' }} />
            {t('title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
            {t('subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/${locale}/admin/events`} className="ad-btn ad-btn-ghost">
            <Calendar className="w-4 h-4" /> {t('backToEvents')}
          </Link>
          <button
            type="button"
            className="ad-btn ad-btn-ghost"
            disabled={syncingClients}
            onClick={() => void handleSyncClients()}
          >
            <RefreshCw className={`w-4 h-4 ${syncingClients ? 'animate-spin' : ''}`} /> {t('syncClients')}
          </button>
          <a href={exportHref} className="ad-btn ad-btn-ghost">
            <Download className="w-4 h-4" /> {selected.length ? t('exportSelected', { count: String(selected.length) }) : t('exportCsv')}
          </a>
          <button
            type="button"
            className="ad-btn ad-btn-primary"
            onClick={() => {
              setNewForm((f) => ({ ...f, eventId: eventFilter || eventOptions[0]?.id || '' }));
              setCreating(true);
            }}
          >
            <Plus className="w-4 h-4" /> {t('addParticipant')}
          </button>
        </div>
      </header>

      {/* Bannière identifiants temporaires si un nouveau compte client vient d'être créé */}
      {createdClientBanner && (
        <div className="ad-card p-4 border-2 border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ad-rise">
          <div className="space-y-1 text-sm">
            <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> {t('newClientBannerTitle')} — {createdClientBanner.name}
            </div>
            <p style={{ color: 'var(--ad-muted)' }}>
              {t('newClientBannerDesc', { email: createdClientBanner.email })}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs uppercase font-bold" style={{ color: 'var(--ad-muted)' }}>
                {t('tempPasswordLabel')} :
              </span>
              <code className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold text-xs">
                {createdClientBanner.tempPassword}
              </code>
              <button
                type="button"
                className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs"
                onClick={() =>
                  copyText(`Email: ${createdClientBanner.email}\nMot de passe temporaire: ${createdClientBanner.tempPassword}`)
                }
              >
                <Copy className="w-3.5 h-3.5" /> {t('copyCredentials')}
              </button>
              <Link
                href={`/${locale}/admin/clients`}
                className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {t('viewClient')}
              </Link>
            </div>
          </div>
          <button
            type="button"
            className="ad-btn ad-btn-icon ad-btn-ghost self-start"
            onClick={() => setCreatedClientBanner(null)}
            title={t('dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ad-rise">
          <KpiCard label={t('kpiTotal')} value={stats.total} icon={Users} />
          <KpiCard label={t('kpiPending')} value={stats.pending} icon={Clock} tone="warn" />
          <KpiCard label={t('kpiConfirmed')} value={stats.confirmed} icon={CheckCircle2} tone="acc" />
          <KpiCard label={t('kpiAttended')} value={stats.attended} icon={Check} tone="ok" />
          <KpiCard label={t('kpiWaitlist')} value={stats.waitlist} icon={Calendar} />
          <KpiCard label={t('kpiLinkedClients')} value={stats.linkedClients} icon={UserCheck} tone="ok" />
        </div>
      )}

      {/* Filtres */}
      <div className="ad-card p-3 space-y-3 ad-rise">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          onSubmit={() => setSearchQuery(searchDraft)}
          showSubmit
          placeholder={t('searchPlaceholder')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="ad-select sm:w-64"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">{t('allEvents')}</option>
            {eventOptions.map((ev) => (
              <option key={ev.legacyId || ev.id} value={ev.legacyId || ev.id}>
                {ev.title} ({ev.count})
              </option>
            ))}
          </select>

          <select
            className="ad-select sm:w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>

          <select
            className="ad-select sm:w-52"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value as '' | 'linked' | 'unlinked')}
          >
            <option value="">{t('allClients')}</option>
            <option value="linked">{t('linkedOnly')}</option>
            <option value="unlinked">{t('unlinkedOnly')}</option>
          </select>

          <button
            type="button"
            className={`ad-btn ms-auto ${showTrash ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            onClick={() => setShowTrash((v) => !v)}
          >
            <Trash2 className="w-4 h-4" />
            {showTrash ? t('activeList') : `${t('trash')}${stats?.trash ? ` (${stats.trash})` : ''}`}
          </button>
        </div>
      </div>

      {/* Barre d'actions groupées */}
      {selected.length > 0 && (
        <div className="ad-card p-3 flex flex-wrap items-center gap-2 ad-rise" style={{ background: 'var(--ad-surface-2)' }}>
          <span className="text-xs font-black uppercase tracking-wider px-2">
            {t('selectedCount', { count: String(selected.length) })}
          </span>
          {!showTrash ? (
            <>
              <button type="button" className="ad-btn ad-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('status', { status: 'confirmed' })}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('bulkConfirm')}
              </button>
              <button type="button" className="ad-btn ad-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('status', { status: 'attended' })}>
                <Check className="w-3.5 h-3.5" /> {t('bulkAttended')}
              </button>
              <button type="button" className="ad-btn ad-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('status', { status: 'waitlist' })}>
                <Clock className="w-3.5 h-3.5" /> {t('bulkWaitlist')}
              </button>
              <button type="button" className="ad-btn ad-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('status', { status: 'rejected' })}>
                <X className="w-3.5 h-3.5" /> {t('bulkReject')}
              </button>
              <button type="button" className="ad-btn ad-btn-primary !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('promote_client')}>
                <UserPlus className="w-3.5 h-3.5" /> {t('bulkAddClients')}
              </button>
              <button type="button" className="ad-btn ad-btn-danger !py-1.5 text-xs ms-auto" disabled={busy} onClick={() => void handleBulk('delete', { hard: false })}>
                <Trash2 className="w-3.5 h-3.5" /> {t('bulkTrash')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ad-btn ad-btn-primary !py-1.5 text-xs" disabled={busy} onClick={() => void handleBulk('restore')}>
                <RotateCcw className="w-3.5 h-3.5" /> {t('bulkRestore')}
              </button>
              <button type="button" className="ad-btn ad-btn-danger !py-1.5 text-xs ms-auto" disabled={busy} onClick={() => void handleBulk('delete', { hard: true })}>
                <Trash2 className="w-3.5 h-3.5" /> {t('bulkPurge')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Tableau principal */}
      {loading ? (
        <div className="ad-card">
          <PixelGridLoader label={t('title')} />
        </div>
      ) : (
        <div className="ad-card overflow-x-auto">
          <table className="ad-table min-w-[960px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Tout sélectionner" />
                </th>
                <th>{t('colParticipant')}</th>
                <th>{t('colContact')}</th>
                <th>{t('colEvent')}</th>
                <th>{t('colStatus')}</th>
                <th>{t('colClient')}</th>
                <th>{t('colDate')}</th>
                <th className="text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={r.fullName}
                    />
                  </td>
                  <td>
                    <div className="font-bold leading-snug">{r.fullName || r.email}</div>
                    {(r.company || r.position) && (
                      <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {[r.company, r.position].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="text-xs space-y-0.5">
                      <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:underline font-medium">
                        <Mail className="w-3 h-3 shrink-0" style={{ color: 'var(--ad-muted)' }} />
                        <span>{r.email}</span>
                      </a>
                      {r.phone && (
                        <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1 hover:underline" style={{ color: 'var(--ad-muted)' }}>
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{r.phone}</span>
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="font-semibold text-sm max-w-[220px] truncate" title={r.eventTitle}>
                      {r.eventTitle}
                    </div>
                    <div className="text-[11px] flex flex-wrap items-center gap-2 mt-0.5" style={{ color: 'var(--ad-muted)' }}>
                      {r.eventDate && <DateText value={r.eventDate} dateOnly />}
                      {r.eventLocation && (
                        <span className="inline-flex items-center gap-0.5 truncate max-w-[140px]">
                          <MapPin className="w-3 h-3" /> {r.eventLocation}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {!showTrash ? (
                      <select
                        className="ad-select !py-1 !px-2 text-xs w-36"
                        value={r.status}
                        disabled={busy}
                        onChange={(e) => void handleQuickStatus(r, e.target.value as EventRegistrationStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`ad-chip ${statusChipClass(r.status)}`}>{statusLabel(r.status)}</span>
                    )}
                  </td>
                  <td>
                    {r.clientUserId ? (
                      <div className="flex items-center gap-1.5">
                        <span className="ad-chip ad-chip-ok inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {t('clientLinked')}
                        </span>
                        <Link
                          href={`/${locale}/admin/users?search=${encodeURIComponent(r.email)}`}
                          className="ad-btn ad-btn-icon ad-btn-ghost !p-1"
                          title={t('viewClient')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ) : !showTrash ? (
                      <button
                        type="button"
                        className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs"
                        disabled={promotingId === r.id}
                        onClick={() => void handlePromoteClient(r)}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {promotingId === r.id ? t('linking') : t('addAsClient')}
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--ad-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="text-xs whitespace-nowrap" style={{ color: 'var(--ad-muted)' }}>
                    <DateText value={r.createdAt} />
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {!showTrash ? (
                      <div className="inline-flex items-center gap-1">
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            className="ad-btn ad-btn-icon ad-btn-ghost"
                            title={t('quickConfirm')}
                            disabled={busy}
                            onClick={() => void handleQuickStatus(r, 'confirmed')}
                          >
                            <CheckCircle2 className="w-4 h-4 text-sky-500" />
                          </button>
                        )}
                        {r.status !== 'attended' && r.status !== 'rejected' && r.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="ad-btn ad-btn-icon ad-btn-ghost"
                            title={t('quickCheckIn')}
                            disabled={busy}
                            onClick={() => void handleQuickStatus(r, 'attended')}
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="ad-btn ad-btn-icon ad-btn-ghost"
                          title={t('openDetails')}
                          onClick={() => openDrawer(r)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="ad-btn ad-btn-icon ad-btn-danger"
                          title={t('delete')}
                          disabled={busy}
                          onClick={() => void handleDelete(r, false)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs"
                          disabled={busy}
                          onClick={() => void handleRestore(r)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> {t('restore')}
                        </button>
                        <button
                          type="button"
                          className="ad-btn ad-btn-icon ad-btn-danger"
                          title={t('purge')}
                          disabled={busy}
                          onClick={() => void handleDelete(r, true)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12" style={{ color: 'var(--ad-muted)' }}>
                    {showTrash ? t('emptyTrash') : t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer d'édition / détail */}
      <Drawer
        open={Boolean(activeRow)}
        onClose={() => setActiveRow(null)}
        title={activeRow ? `${t('drawerTitle')} — ${activeRow.fullName || activeRow.email}` : ''}
      >
        {activeRow && (
          <div className="space-y-4">
            <div className="ad-card p-3 space-y-1.5 text-xs" style={{ background: 'var(--ad-surface-2)' }}>
              <div className="font-bold text-sm">{activeRow.eventTitle}</div>
              <div className="flex flex-wrap gap-3" style={{ color: 'var(--ad-muted)' }}>
                <span>{t('metaSource')}: {activeRow.source === 'admin' ? t('sourceAdmin') : t('sourceFrontend')}</span>
                <span>{t('metaCreated')}: <DateText value={activeRow.createdAt} /></span>
                {activeRow.checkedInAt && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t('metaCheckedIn')}: <DateText value={activeRow.checkedInAt} />
                  </span>
                )}
                {activeRow.ip && <span>{t('metaIp')}: {activeRow.ip}</span>}
              </div>
            </div>

            {/* Bloc association client */}
            <div className="ad-card p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-bold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
                  {t('colClient')}
                </div>
                <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                  {activeRow.clientUserId
                    ? `${t('clientLinked')} (#${activeRow.clientUserId})`
                    : activeRow.email}
                </div>
              </div>
              {activeRow.clientUserId ? (
                <Link
                  href={`/${locale}/admin/users?search=${encodeURIComponent(activeRow.email)}`}
                  className="ad-btn ad-btn-ghost text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {t('viewClient')}
                </Link>
              ) : (
                <button
                  type="button"
                  className="ad-btn ad-btn-primary text-xs"
                  disabled={promotingId === activeRow.id}
                  onClick={() => void handlePromoteClient(activeRow)}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {promotingId === activeRow.id ? t('linking') : t('addAsClient')}
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('firstName')}
                </span>
                <input
                  className="ad-input"
                  value={String(editDraft.firstName || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, firstName: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('lastName')}
                </span>
                <input
                  className="ad-input"
                  value={String(editDraft.lastName || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, lastName: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('email')}
                </span>
                <input
                  type="email"
                  className="ad-input"
                  value={String(editDraft.email || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('phone')}
                </span>
                <input
                  type="tel"
                  className="ad-input"
                  value={String(editDraft.phone || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('company')}
                </span>
                <input
                  className="ad-input"
                  value={String(editDraft.company || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, company: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                  {t('position')}
                </span>
                <input
                  className="ad-input"
                  value={String(editDraft.position || '')}
                  onChange={(e) => setEditDraft({ ...editDraft, position: e.target.value })}
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('status')}
              </span>
              <select
                className="ad-select"
                value={String(editDraft.status || 'pending')}
                onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as EventRegistrationStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('notes')}
              </span>
              <textarea
                rows={3}
                className="ad-input"
                value={String(editDraft.notes || '')}
                onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('adminNotes')}
              </span>
              <textarea
                rows={3}
                className="ad-input"
                value={String(editDraft.adminNotes || '')}
                onChange={(e) => setEditDraft({ ...editDraft, adminNotes: e.target.value })}
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--ad-line)' }}>
              <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setActiveRow(null)}>
                {t('close')}
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                disabled={savingEdit}
                onClick={() => void handleSaveEdit()}
              >
                {savingEdit ? '…' : t('save')}
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer d'ajout manuel d'un participant */}
      <Drawer open={creating} onClose={() => setCreating(false)} title={t('newTitle')}>
        <form onSubmit={handleCreate} className="space-y-3">
          <label className="space-y-1 block">
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
              {t('eventField')} *
            </span>
            <select
              className="ad-select"
              required
              value={newForm.eventId}
              onChange={(e) => setNewForm({ ...newForm, eventId: e.target.value })}
            >
              <option value="">{t('selectEvent')}</option>
              {eventOptions.map((ev) => (
                <option key={ev.legacyId || ev.id} value={ev.legacyId || ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('firstName')} *
              </span>
              <input
                className="ad-input"
                required
                value={newForm.firstName}
                onChange={(e) => setNewForm({ ...newForm, firstName: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('lastName')} *
              </span>
              <input
                className="ad-input"
                required
                value={newForm.lastName}
                onChange={(e) => setNewForm({ ...newForm, lastName: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('email')} *
              </span>
              <input
                type="email"
                className="ad-input"
                required
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('phone')} *
              </span>
              <input
                type="tel"
                className="ad-input"
                required
                value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('company')}
              </span>
              <input
                className="ad-input"
                value={newForm.company}
                onChange={(e) => setNewForm({ ...newForm, company: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
                {t('position')}
              </span>
              <input
                className="ad-input"
                value={newForm.position}
                onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
              {t('status')}
            </span>
            <select
              className="ad-select"
              value={newForm.status}
              onChange={(e) => setNewForm({ ...newForm, status: e.target.value as EventRegistrationStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ad-muted)' }}>
              {t('adminNotes')}
            </span>
            <textarea
              rows={3}
              className="ad-input"
              value={newForm.adminNotes}
              onChange={(e) => setNewForm({ ...newForm, adminNotes: e.target.value })}
            />
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={newForm.addAsClient}
              onChange={(e) => setNewForm({ ...newForm, addAsClient: e.target.checked })}
            />
            <span>{t('addAsClientOnCreate')}</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--ad-line)' }}>
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setCreating(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="ad-btn ad-btn-primary" disabled={savingCreate}>
              {savingCreate ? '…' : t('create')}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: 'ok' | 'warn' | 'acc';
}) {
  const accentColor =
    tone === 'ok'
      ? '#10b981'
      : tone === 'warn'
        ? '#f59e0b'
        : tone === 'acc'
          ? 'var(--ad-accent)'
          : 'var(--ad-muted)';
  return (
    <div className="ad-card p-3.5 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black leading-none tabular-nums">{value}</div>
        <div className="text-[11px] truncate mt-1" style={{ color: 'var(--ad-muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
