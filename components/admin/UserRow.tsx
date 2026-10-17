'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckSquare, ChevronDown, Eye, MessageSquare, Pencil, Square, Trash2,
} from 'lucide-react';
import { userCode } from '@/lib/user-stats';
import UserDetails, { couleurStatut as teinteStatut } from './UserDetails';

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

  // Détail replié par défaut : la liste reste lisible d'un coup d'œil et
  // l'on déplie seulement le compte que l'on examine.
  const [ouvert, setOuvert] = useState(false);

  const libelle = (cle: string, brut: string) => (brut && t.has?.(cle) ? t(cle) : brut);

  const chipStatut = teinteStatut(statut);

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
            {statut && <span className={`ad-chip ${chipStatut}`}>{libelle(`status.${statut}`, statut)}</span>}
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
        <div
          className="mt-2.5 pt-2.5 border-t"
          style={{ borderColor: 'var(--ad-line)' }}
        >
          <UserDetails record={record} locale={locale} busy={busy} onStatus={onStatus} />
        </div>
      )}
    </article>
  );
}
