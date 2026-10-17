'use client';

/**
 * Fiche d'abonnement — consultation.
 *
 * Écran en lecture seule : tout ce qui y figure vient du site et n'a pas à être
 * recopié à la main. Il sert trois usages : relire la note laissée lors de
 * l'inscription, comprendre un retrait (date, motif, commentaire), et récupérer
 * le lien de désinscription personnel que le visiteur a reçu.
 *
 * Deux actions seulement : « Modifier » (rouvre le tiroir de la liste sur cette
 * fiche, seul endroit où la donnée s'édite) et « Copier le lien de retrait ».
 * Une fiche supprimée est marquée comme telle et propose de revenir en arrière.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft, Check, Copy, Loader2, Pencil, RotateCcw, ThumbsDown, Trash2, Undo2,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { deleteSubscriber, fetchSubscriber, restoreSubscriber, type Subscriber } from '@/lib/newsletter-admin';
import { formatDateWith, type SupportedLocale } from '@/lib/date-format';
import { reasonLabel } from '@/lib/newsletter-reasons';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0" style={{ borderColor: 'var(--ad-line)' }}>
      <span
        className="text-[11px] font-black uppercase tracking-[0.14em] shrink-0"
        style={{ color: 'var(--ad-muted)' }}
      >
        {label}
      </span>
      <span className="text-sm text-end break-words min-w-0">{children}</span>
    </div>
  );
}

export default function AdminNewsletterSubscriberPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const locale = useLocale();
  const t = useTranslations('admin.newsletter');
  const tr = useTranslations('common.newsletterReasons');
  const { showToast } = useToast();
  const [row, setRow] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const date = (value?: string | null) =>
    formatDateWith(value, locale as SupportedLocale, { fallback: t('unknown') });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchSubscriber(id);
      setRow(payload?.row || null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: 'restore' | 'delete') => {
      if (action === 'delete' && !window.confirm(t('confirmDelete'))) return;
      setBusy(true);
      try {
        if (action === 'restore') await restoreSubscriber(id);
        else await deleteSubscriber(id);
        showToast(t(action === 'restore' ? 'restored' : 'trashed'), 'success');
        await refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('loadError'), 'error');
      } finally {
        setBusy(false);
      }
    },
    [id, refresh, showToast, t],
  );

  const link = row?.token && typeof window !== 'undefined'
    ? `${window.location.origin}/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(row.token)}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/${locale}/admin/newsletter`} className="ad-btn ad-btn-ghost text-xs">
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" /> {t('backToList')}
        </Link>
        {row && !row.deleted ? (
          <Link href={`/${locale}/admin/newsletter?edit=${row.id}`} className="ad-btn text-xs ms-auto">
            <Pencil className="w-3.5 h-3.5" /> {t('edit')}
          </Link>
        ) : null}
        {row?.deleted ? (
          <button
            type="button"
            className="ad-btn ad-btn-ghost text-xs ms-auto"
            disabled={busy}
            onClick={() => void run('restore')}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} {t('restore')}
          </button>
        ) : row ? (
          <button
            type="button"
            className="ad-btn ad-btn-ghost text-xs"
            disabled={busy}
            onClick={() => void run('delete')}
          >
            <Trash2 className="w-3.5 h-3.5" /> {t('trash')}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="ad-card p-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--ad-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}
        </div>
      ) : !row ? (
        <div className="ad-card p-10 text-center space-y-3">
          <p className="text-sm font-semibold">{t('notFound')}</p>
          <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t('notFoundHint')}</p>
        </div>
      ) : (
        <>
          <div className="ad-card p-4 space-y-1">
            <p className="text-base font-black break-all">{row.email}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ad-muted)' }}>
              <span
                className="ad-chip"
                style={
                  row.status === 'subscribed'
                    ? { background: 'color-mix(in srgb, #16a34a 15%, transparent)', color: '#15803d' }
                    : row.status === 'unsubscribed'
                      ? { background: 'color-mix(in srgb, #dc2626 15%, transparent)', color: '#b91c1c' }
                      : undefined
                }
              >
                {row.status === 'unsubscribed'
                  ? t('chipUnsubscribed')
                  : row.status === 'pending'
                    ? t('chipPending')
                    : t('chipSubscribed')}
              </span>
              {row.deleted ? <span className="ad-chip ad-chip-danger">{t('chipDeleted')}</span> : null}
              {row.name || row.email}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="ad-card p-4">
              <h2 className="text-xs font-black uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--ad-muted)' }}>
                {t('cardSubscriber')}
              </h2>
              <Row label={t('fieldName')}>{row.name || '—'}</Row>
              <Row label={t('fieldEmail')}>
                <span className="break-all">{row.email}</span>
              </Row>
              <Row label={t('fieldLocale')}>{row.locale || '—'}</Row>
              <Row label={t('fieldSource')}>{row.source || '—'}</Row>
              <Row label={t('fieldConsent')}>
                {row.consent ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-green-600" /> {t('consentYes')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ThumbsDown className="w-3.5 h-3.5 text-red-600" /> {t('consentNo')}
                  </span>
                )}
              </Row>
              <Row label={t('fieldTopics')}>
                {row.topics && row.topics.length ? (
                  <span className="inline-flex flex-wrap gap-1 justify-end">
                    {row.topics.map((topic) => (
                      <span key={topic} className="ad-chip ad-chip-mute">
                        {topic}
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                )}
              </Row>
            </div>

            <div className="ad-card p-4">
              <h2 className="text-xs font-black uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--ad-muted)' }}>
                {t('cardTrace')}
              </h2>
              {/* Date d'abonnement en texte statique : posée par le site à la
                  validation du double opt-in, jamais par cet écran. */}
              <Row label={t('fieldSubscribedAt')}>
                <span title={date(row.subscribedAt || row.createdAt)}>{date(row.subscribedAt || row.createdAt)}</span>
              </Row>
              <Row label={t('fieldUnsubscribedAt')}>
                {row.unsubscribedAt ? date(row.unsubscribedAt) : '—'}
              </Row>
              <Row label={t('fieldUnsubscribeReason')}>
                {row.unsubscribeReason ? reasonLabel(row.unsubscribeReason, tr) : '—'}
              </Row>
              <Row label={t('fieldUnsubscribeNote')}>
                {row.unsubscribeNote ? <span className="break-words">{row.unsubscribeNote}</span> : '—'}
              </Row>
              <Row label={t('fieldNotes')}>
                {row.notes ? <span className="break-words">{row.notes}</span> : '—'}
              </Row>
              <Row label={t('fieldIp')}>{row.ip || '—'}</Row>
              <Row label={t('fieldUserAgent')}>
                <span className="text-[11px] break-all" title={row.userAgent || ''}>
                  {row.userAgent ? `${row.userAgent.slice(0, 90)}${row.userAgent.length > 90 ? '…' : ''}` : '—'}
                </span>
              </Row>
              <Row label={t('fieldCreatedAt')}>{date(row.createdAt)}</Row>
              <Row label={t('fieldUpdatedAt')}>{date(row.updatedAt)}</Row>
            </div>
          </div>

          <div className="ad-card p-4 space-y-2">
            <h2 className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>
              {t('cardLinks')}
            </h2>
            {link ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-[11px] break-all flex-1 min-w-[240px] px-2 py-1.5 rounded border" style={{ borderColor: 'var(--ad-line)' }}>
                  {link}
                </code>
                <button
                  type="button"
                  className="ad-btn ad-btn-ghost text-xs"
                  onClick={() => void navigator.clipboard.writeText(link).then(
                    () => showToast(t('linkCopied'), 'success'),
                    () => showToast(t('copyError'), 'error'),
                  )}
                >
                  <Copy className="w-3.5 h-3.5" /> {t('copyLink')}
                </button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--ad-muted)' }}>
                {t('noLink')}
              </p>
            )}
            <p className="text-[11px] leading-5" style={{ color: 'var(--ad-muted)' }}>
              {t('linksHint')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
