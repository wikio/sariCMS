'use client';

/**
 * Panneau de diffusion de la lettre d'information.
 *
 * Deux temps, parce qu'un envoi de masse ne se rattrape pas :
 *  1. « Vérifier » résout les destinataires et affiche le compte — rien ne part ;
 *  2. « Envoyer » n'est actif qu'après cette vérification, et tout envoi suivant
 *     doit repasser par elle.
 *
 * Le message lui-même n'est pas composé ici : il vit dans
 * `data/mail/modules.json` et se règle dans l'écran Centre de courrier. Ce
 * panneau choisit *à qui* envoyer et donne la cible du « Lire la suite ».
 *
 * Les adresses sans consentement ou désabonnées sont écartées **côté serveur** ;
 * ce panneau n'a pas à le refaire, et ne le pourrait pas de façon fiable.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Mail, Search, Send, TriangleAlert } from 'lucide-react';
import {
  previewCampaign,
  sendCampaign,
  type CampaignPreview,
  type CampaignResult,
  type SubscriberFilters,
} from '@/lib/newsletter-admin';

type Scope = 'all' | 'filters' | 'picked';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: SubscriberFilters;
  picked: string[];
  locale: string;
  onToast: (message: string, kind?: 'success' | 'error') => void;
}

export default function CampaignPanel({ open, onClose, filters, picked, locale, onToast }: Props) {
  const t = useTranslations('admin.newsletter.campaign');

  const [scope, setScope] = useState<Scope>('filters');
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  /**
   * Portée de la clé d'unicité, fixée à la vérification : un double clic sur
   * « Envoyer » réutilise le même identifiant et ne renvoie donc pas tout.
   * Le régénérer à chaque rendu aurait eu l'effet inverse.
   */
  const [campaignId, setCampaignId] = useState('');
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const scopePayload = () => {
    if (scope === 'picked') return { ids: picked };
    if (scope === 'filters') {
      return {
        filters: {
          locale: filters.locale || undefined,
          source: filters.source || undefined,
          search: filters.search || undefined,
        },
      };
    }
    return {};
  };

  const runPreview = async () => {
    setError('');
    setResult(null);
    setPreview(null);
    setBusy(true);
    try {
      const next = await previewCampaign(scopePayload(), locale);
      setPreview(next);
      setCampaignId(next.wouldSend ? `campagne-${Date.now()}` : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runSend = async (campaignId: string) => {
    setError('');
    setBusy(true);
    try {
      const res = await sendCampaign(scopePayload(), {
        lien_document: link.trim(),
        locale,
        campaignId,
      });
      setResult(res);
      setPreview(null);
      onToast(
        t('toastSent', { sent: res.sent, attempted: res.attempted }),
        res.sent ? 'success' : 'error',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const linkOk = /^https?:\/\//i.test(link.trim());
  const canSend = Boolean(preview) && linkOk && preview!.wouldSend > 0 && Boolean(campaignId) && !busy;

  return (
    <div className="ad-card p-4" style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Mail className="w-4 h-4" />
        <h2 className="text-sm font-bold" style={{ margin: 0 }}>
          {t('title')}
        </h2>
        <button
          type="button"
          className="ad-btn ad-btn-sm ad-btn-ghost ms-auto"
          onClick={onClose}
          aria-label={t('close')}
        >
          {t('close')}
        </button>
      </div>

      <p className="text-xs" style={{ opacity: 0.75, margin: 0 }}>
        {t('hint')}
      </p>

      {/* Portée */}
      <fieldset style={{ display: 'grid', gap: '0.35rem', border: 0, padding: 0, margin: 0 }}>
        <legend className="text-xs font-bold">{t('scope')}</legend>
        {(
          [
            ['all', t('scopeAll')],
            ['filters', t('scopeFilters')],
            ['picked', t('scopePicked', { count: picked.length })],
          ] as Array<[Scope, string]>
        ).map(([value, label]) => (
          <label key={value} className="text-xs" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="radio"
              name="campaign-scope"
              checked={scope === value}
              disabled={value === 'picked' && picked.length === 0}
              onChange={() => {
                setScope(value);
                setPreview(null);
                setResult(null);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* Cible du « Lire la suite » */}
      <label className="text-xs" style={{ display: 'grid', gap: '0.25rem' }}>
        <span className="font-bold">{t('link')}</span>
        <input
          type="url"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setPreview(null);
          }}
          placeholder="https://…"
          className="ad-input"
        />
        <span style={{ opacity: 0.7 }}>{t('linkHint')}</span>
      </label>

      {error ? (
        <div className="text-xs" style={{ color: 'var(--ad-danger, #ef4444)' }}>
          {error}
        </div>
      ) : null}

      {preview ? (
        <div className="text-xs" style={{ display: 'grid', gap: '0.25rem' }}>
          <strong>{t('previewCount', { count: preview.eligible })}</strong>
          <span style={{ opacity: 0.75 }}>
            {t('previewSource')}: {preview.stored === 'api' ? t('sourceApi') : t('sourceFile')}
          </span>
          {preview.sample.length ? <span style={{ opacity: 0.75 }}>{preview.sample.join(', ')}</span> : null}
          {preview.wouldSend === 0 ? (
            <span style={{ color: 'var(--ad-danger, #ef4444)' }}>{t('previewEmpty')}</span>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="text-xs" style={{ display: 'grid', gap: '0.35rem' }}>
          <strong>{t('resultSummary', { sent: result.sent, attempted: result.attempted })}</strong>
          {Object.entries(result.skipped).map(([reason, count]) => (
            <span key={reason} style={{ opacity: 0.8 }}>
              {t(`reason.${reason}`, { defaultMessage: reason })}: {count}
            </span>
          ))}
          {result.failures.length ? (
            <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
              <TriangleAlert className="w-3.5 h-3.5" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <span>{result.failures.map((f) => f.email).join(', ')}</span>
            </span>
          ) : null}
          {result.remaining > 0 ? (
            <span style={{ opacity: 0.8 }}>{t('remaining', { count: result.remaining })}</span>
          ) : null}
        </div>
      ) : null}

      <div className="ad-toolbar" style={{ gap: '0.4rem' }}>
        <button type="button" className="ad-btn ad-btn-sm ad-btn-ghost" onClick={() => void runPreview()} disabled={busy}>
          {busy && !preview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {t('check')}
        </button>
        <button
          type="button"
          className="ad-btn ad-btn-sm ad-btn-primary"
          disabled={!canSend}
          onClick={() => void runSend(campaignId)}
        >
          <Send className="w-3.5 h-3.5" />
          {t('send', { count: preview?.wouldSend ?? 0 })}
        </button>
      </div>
    </div>
  );
}
