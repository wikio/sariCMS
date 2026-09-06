'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Briefcase, Building2, CheckSquare, ChevronDown, Eye, FileText, MapPin, MessageSquare,
  Package, Pencil, Phone, ShieldCheck, ShieldOff, Square, Clock, Trash2,
} from 'lucide-react';
import { candidateStatsFor, clientStats, userCode, type CandidateStats, type ClientStats } from '@/lib/user-stats';
import { wilayaCode, findWilaya } from '@/lib/wilayas';

type UserRecord = Record<string, unknown>;

/**
 * Ligne d'un compte dans la liste du back-office.
 *
 * L'affichage précédent se limitait au nom, à l'e-mail et au type : il fallait
 * ouvrir chaque fiche pour connaître un téléphone ou savoir si un client avait
 * déjà commandé. Cette ligne réunit les coordonnées, le code du compte et un
 * résumé d'activité adapté au type, plus les actions courantes.
 */
export default function UserRow({
  record,
  locale,
  selected,
  onToggleSelect,
  onConsult,
  onEdit,
  onDelete,
  onMessage,
  onStatus,
  busy = false,
}: {
  record: UserRecord;
  locale: string;
  selected: boolean;
  onToggleSelect: () => void;
  onConsult: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMessage: () => void;
  onStatus: (statut: string) => void;
  busy?: boolean;
}) {
  const t = useTranslations('admin.userForm');
  const tl = useTranslations('admin.userList');

  const v = (k: string) => String(record[k] ?? '').trim();
  const type = v('type');
  const statut = v('status');
  const email = v('email');

  // Les statistiques viennent du stockage local : les calculer pendant le
  // rendu casserait l'hydratation (serveur et client donneraient des valeurs
  // différentes). On les charge après le montage.
  const [statsClient, setStatsClient] = useState<ClientStats | null>(null);
  const [statsCandidat, setStatsCandidat] = useState<CandidateStats | null>(null);
  // Détail replié par défaut : la liste reste lisible d'un coup d'œil et
  // l'on déplie seulement le compte que l'on examine.
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (type === 'client' || type === 'partner') setStatsClient(clientStats(email, record.id as string));
    if (type === 'candidate') setStatsCandidat(candidateStatsFor(email));
  }, [type, email, record.id]);

  const libelle = (cle: string, brut: string) => (brut && t.has?.(cle) ? t(cle) : brut);
  const wil = findWilaya(v('wilaya'));

  const couleurStatut =
    statut === 'active' ? 'ad-chip-ok' : statut === 'blocked' ? 'ad-chip-warn' : 'ad-chip-mute';

  /** Petite information factuelle : icône, libellé, valeur. */
  const Info = ({ icon: Icon, children, title }: { icon: React.ElementType; children: React.ReactNode; title?: string }) => (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={title}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ad-muted)' }} />
      <span className="truncate">{children}</span>
    </span>
  );

  /** Compteur d'activité. Mis en avant lorsqu'il est non nul. */
  const Stat = ({ label, valeur, fort = false }: { label: string; valeur: number | string; fort?: boolean }) => (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap"
      style={{
        background: fort ? 'color-mix(in srgb, var(--ad-accent) 14%, transparent)' : 'var(--ad-surface-2)',
        color: fort ? 'var(--ad-accent)' : 'var(--ad-muted)',
      }}
    >
      {valeur} <span className="font-medium">{label}</span>
    </span>
  );

  return (
    <article
      className="ad-card p-3 sm:p-4 ad-rise"
      style={selected ? { borderColor: 'var(--ad-accent)' } : undefined}
    >
      {/* Ligne principale : identité, badges, actions. */}
      <div className="flex items-start gap-2 sm:gap-3">
        <button
          className="ad-affix-btn shrink-0 mt-0.5"
          onClick={onToggleSelect}
          title={tl('select')}
          aria-pressed={selected}
        >
          {selected ? <CheckSquare /> : <Square />}
        </button>

        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}
        >
          {(v('firstName') || email || '?').slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold truncate">
              {[v('firstName'), v('lastName')].filter(Boolean).join(' ') || email || '—'}
            </span>
            {type && <span className="ad-chip ad-chip-acc">{libelle(`type.${type}`, type)}</span>}
            {statut && <span className={`ad-chip ${couleurStatut}`}>{libelle(`status.${statut}`, statut)}</span>}
          </div>
          {/* Courriel et code du compte sous le nom : les deux repères qui
              servent à identifier une personne au téléphone. */}
          <div className="flex flex-wrap items-center gap-x-2 text-xs" style={{ color: 'var(--ad-muted)' }}>
            <a href={`mailto:${email}`} className="hover:underline truncate">{email}</a>
            <code className="font-mono font-bold shrink-0" title={tl('userCode')}>{userCode(type, record.id)}</code>
          </div>
        </div>

        {/* Actions : repliées en icônes sur petit écran. */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="ad-affix-btn"
            onClick={() => setOuvert((o) => !o)}
            title={ouvert ? tl('hideDetails') : tl('showDetails')}
            aria-expanded={ouvert}
          >
            <ChevronDown className={`transition-transform ${ouvert ? 'rotate-180' : ''}`} />
          </button>
          <button className="ad-affix-btn" onClick={onMessage} title={tl('sendMessage')}>
            <MessageSquare />
          </button>
          <button className="ad-affix-btn" onClick={onConsult} title={tl('consult')}>
            <Eye />
          </button>
          <button className="ad-affix-btn" onClick={onEdit} title={tl('edit')}>
            <Pencil />
          </button>
          <button
            className="ad-affix-btn hidden sm:inline-flex"
            onClick={onDelete}
            title={tl('trash')}
            style={{ color: 'var(--ad-danger)' }}
          >
            <Trash2 />
          </button>
        </div>
      </div>

      {/*
        Détail replié : coordonnées complètes et activité. Rendu seulement à
        l'ouverture — monter ces blocs pour chaque ligne alourdirait une liste
        de plusieurs centaines de comptes.
      */}
      {ouvert && (
      <>
      <div
        className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-x-4 gap-y-1.5 text-xs"
        style={{ borderColor: 'var(--ad-line)' }}
      >
        {v('phone') && (
          <Info icon={Phone}>
            <a href={`tel:${v('phone').replace(/\s/g, '')}`} className="hover:underline">{v('phone')}</a>
          </Info>
        )}
        {v('company') && <Info icon={Building2}>{v('company')}</Info>}
        {v('position') && <Info icon={Briefcase}>{v('position')}</Info>}
        {(v('address') || v('wilaya') || v('country')) && (
          <Info icon={MapPin} title={v('address')}>
            {[v('address'), wil ? `${wilayaCode(wil)} ${v('wilaya')}` : v('wilaya'), v('country')]
              .filter(Boolean)
              .join(' · ')}
          </Info>
        )}
      </div>

      {/* Résumé d'activité, propre à chaque type de compte. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(type === 'client' || type === 'partner') && statsClient && (
          <>
            <Stat label={tl('orders')} valeur={statsClient.orders} fort={statsClient.orders > 0} />
            <Stat label={tl('quotes')} valeur={statsClient.quotes} fort={statsClient.quotes > 0} />
            <Stat label={tl('paid')} valeur={statsClient.paid} />
            {statsClient.pending > 0 && <Stat label={tl('awaiting')} valeur={statsClient.pending} fort />}
            {statsClient.orders > 0 && (
              <Link
                href={`/${locale}/admin/orders?search=${encodeURIComponent(email)}`}
                className="ad-chip ad-chip-acc hover:underline"
              >
                <Package className="w-3 h-3 mr-1" /> {tl('seeOrders')}
              </Link>
            )}
          </>
        )}

        {type === 'candidate' && statsCandidat && (
          <>
            <Stat label={tl('applications')} valeur={statsCandidat.applications} fort={statsCandidat.applications > 0} />
            {statsCandidat.accepted > 0 && <Stat label={tl('accepted')} valeur={statsCandidat.accepted} fort />}
            {statsCandidat.rejected > 0 && <Stat label={tl('rejected')} valeur={statsCandidat.rejected} />}
            {statsCandidat.pending > 0 && <Stat label={tl('inProgress')} valeur={statsCandidat.pending} />}
            {/*
              Le lien vers les candidatures reste affiché même à zéro : c'est
              le point d'entrée attendu pour un candidat, et son absence
              donnerait l'impression que l'écran n'existe pas.
            */}
            <Link
              href={`/${locale}/admin/applications?search=${encodeURIComponent(email)}`}
              className="ad-chip ad-chip-acc hover:underline"
              title={tl('seeApplicationsTitle')}
            >
              <FileText className="w-3 h-3 mr-1" />
              {tl('seeApplications')} ({statsCandidat.applications})
            </Link>
          </>
        )}

        {type === 'admin' && (
          <>
            <Stat label={tl('roleLabel')} valeur={v('roleId') ? `#${v('roleId')}` : tl('fullRights')} fort />
            <Stat label={tl('language')} valeur={(v('locale') || 'fr').toUpperCase()} />
            <Link href={`/${locale}/admin/permissions`} className="ad-chip ad-chip-acc hover:underline">
              <ShieldCheck className="w-3 h-3 mr-1" /> {tl('seeRoles')}
            </Link>
          </>
        )}

        {/* Changement rapide de statut, sans ouvrir la fiche. */}
        <div className="flex items-center gap-1 ms-auto">
          {statut !== 'active' && (
            <button className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs" disabled={busy} onClick={() => onStatus('active')}>
              <ShieldCheck className="w-3.5 h-3.5" /> {tl('activate')}
            </button>
          )}
          {statut !== 'pending' && (
            <button className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs" disabled={busy} onClick={() => onStatus('pending')}>
              <Clock className="w-3.5 h-3.5" /> {tl('setPending')}
            </button>
          )}
          {statut !== 'blocked' && (
            <button className="ad-btn ad-btn-ghost !py-1 !px-2 text-xs" disabled={busy} onClick={() => onStatus('blocked')}>
              <ShieldOff className="w-3.5 h-3.5" /> {tl('block')}
            </button>
          )}
        </div>
      </div>
      </>
      )}
    </article>
  );
}
