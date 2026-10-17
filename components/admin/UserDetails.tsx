'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Briefcase, Building2, Clock, FileText, MapPin, Package, Phone, ShieldCheck, ShieldOff,
} from 'lucide-react';
import { candidateStatsFor, clientStats, type CandidateStats, type ClientStats } from '@/lib/user-stats';
import { wilayaCode, findWilaya } from '@/lib/wilayas';

type UserRecord = Record<string, unknown>;

/** Petite information factuelle : icône, libellé, valeur. */
function Info({ icon: Icon, children, title }: { icon: React.ElementType; children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={title}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ad-muted)' }} />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Compteur d'activité. Mis en avant lorsqu'il est non nul. */
function Stat({ label, valeur, fort = false }: { label: string; valeur: number | string; fort?: boolean }) {
  return (
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
}

/**
 * Détail d'un compte : coordonnées, activité, changement rapide de statut.
 *
 * Partagé par la vue module et la vue table. Les deux montraient auparavant
 * des informations différentes — la table se contentait des colonnes brutes —
 * alors qu'il s'agit du même compte : dupliquer ce bloc aurait garanti que les
 * deux vues divergent à la première évolution.
 */
export default function UserDetails({
  record,
  locale,
  busy = false,
  onStatus,
}: {
  record: UserRecord;
  locale: string;
  busy?: boolean;
  onStatus: (statut: string) => void;
}) {
  const tl = useTranslations('admin.userList');

  const v = (k: string) => String(record[k] ?? '').trim();
  const type = v('type');
  const statut = v('status');
  const email = v('email');

  // Les statistiques viennent du stockage local : les calculer pendant le
  // rendu casserait l'hydratation (serveur et client donneraient des valeurs
  // différentes). On les charge après le montage.
  const [stats, setStats] = useState<{ client: ClientStats | null; candidat: CandidateStats | null }>(
    { client: null, candidat: null },
  );

  // Lecture du stockage local, indisponible au rendu serveur : la faire
  // pendant le rendu produirait un écart d'hydratation. Un seul appel, après
  // montage, d'où la dérogation à la règle sur les effets.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats({
      client: type === 'client' || type === 'partner' ? clientStats(email, record.id as string) : null,
      candidat: type === 'candidate' ? candidateStatsFor(email) : null,
    });
  }, [type, email, record.id]);

  const statsClient = stats.client;
  const statsCandidat = stats.candidat;

  const wil = findWilaya(v('wilaya'));

  const aDesCoordonnees = Boolean(v('phone') || v('company') || v('position') || v('address') || v('wilaya') || v('country'));

  return (
    <>
      {aDesCoordonnees && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
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
      )}

      {/* Résumé d'activité, propre à chaque type de compte. */}
      <div className={`flex flex-wrap items-center gap-1.5 ${aDesCoordonnees ? 'mt-2' : ''}`}>
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
  );
}

/** Libellé traduit d'un type ou d'un statut, avec repli sur la valeur brute. */
export function useLibelleCompte() {
  const t = useTranslations('admin.userForm');
  return (cle: string, brut: string) => (brut && t.has?.(cle) ? t(cle) : brut);
}

/** Couleur de pastille associée à un statut de compte. */
export function couleurStatut(statut: string): string {
  return statut === 'active' ? 'ad-chip-ok' : statut === 'blocked' ? 'ad-chip-warn' : 'ad-chip-mute';
}
