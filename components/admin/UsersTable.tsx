'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDownAZ, ArrowUpAZ, CheckSquare, ChevronDown, Eye, MessageSquare, Pencil, Square, Trash2,
} from 'lucide-react';
import { userCode } from '@/lib/user-stats';
import UserDetails, { couleurStatut } from './UserDetails';

type UserRecord = Record<string, unknown>;

/**
 * Vue table des comptes.
 *
 * La table générique du module affichait les colonnes brutes de la ressource
 * (`email`, `status`, `type`) sans le traitement réservé aux comptes : ni code
 * du compte, ni coordonnées, ni activité, et aucun moyen de déplier une ligne.
 * Passer d'une vue à l'autre faisait donc perdre la moitié des informations.
 *
 * Cette table reprend la présentation de la vue module — nom, puis courriel et
 * code en dessous — et déplie le même bloc de détail dans une ligne
 * supplémentaire, ce qui est la façon usuelle de montrer un détail en table
 * sans casser l'alignement des colonnes.
 */
export default function UsersTable({
  rows,
  locale,
  selected,
  busy = false,
  onToggleSelect,
  onToggleSelectAll,
  onConsult,
  onEdit,
  onDelete,
  onMessage,
  onStatus,
  sortKey,
  sortDir,
  toggleSort,
}: {
  rows: UserRecord[];
  locale: string;
  selected: string[];
  busy?: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onConsult: (row: UserRecord) => void;
  onEdit: (row: UserRecord) => void;
  onDelete: (id: string) => void;
  onMessage: (row: UserRecord) => void;
  onStatus: (row: UserRecord, statut: string) => void;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  toggleSort: (key: string) => void;
}) {
  const t = useTranslations('admin.userForm');
  const tl = useTranslations('admin.userList');

  // Plusieurs lignes peuvent rester dépliées : on compare des comptes en
  // les mettant côte à côte, refermer la précédente à chaque ouverture
  // empêcherait précisément cet usage.
  const [ouverts, setOuverts] = useState<string[]>([]);
  const basculer = (id: string) =>
    setOuverts((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));

  const libelle = (cle: string, brut: string) => (brut && t.has?.(cle) ? t(cle) : brut);
  const fleche = (cle: string) =>
    sortKey !== cle ? null : sortDir === 'asc'
      ? <ArrowUpAZ className="inline w-3 h-3 ms-1" />
      : <ArrowDownAZ className="inline w-3 h-3 ms-1" />;

  const toutSelectionne = rows.length > 0 && rows.every((r) => selected.includes(String(r.id)));

  return (
    <div className="ad-card overflow-x-auto ad-rise ad-rise-3">
      <table className="ad-table">
        <thead>
          <tr>
            <th className="w-8">
              <button
                className="ad-btn ad-btn-icon ad-btn-ghost !p-1"
                onClick={onToggleSelectAll}
                title={tl('selectAll')}
                aria-pressed={toutSelectionne}
              >
                {toutSelectionne ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            </th>
            <th className="w-8" />
            <th onClick={() => toggleSort('lastName')} className="cursor-pointer">
              {tl('columnUser')} {fleche('lastName')}
            </th>
            <th onClick={() => toggleSort('type')} className="cursor-pointer hidden md:table-cell">
              {tl('columnType')} {fleche('type')}
            </th>
            <th onClick={() => toggleSort('status')} className="cursor-pointer hidden md:table-cell">
              {tl('columnStatus')} {fleche('status')}
            </th>
            <th className="text-right">{tl('columnActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row.id);
            const v = (k: string) => String(row[k] ?? '').trim();
            const type = v('type');
            const statut = v('status');
            const email = v('email');
            const nom = [v('firstName'), v('lastName')].filter(Boolean).join(' ') || email || '—';
            const ouvert = ouverts.includes(id);

            return (
              <Fragment key={id}>
                <tr style={selected.includes(id) ? { background: 'color-mix(in srgb, var(--ad-accent) 7%, transparent)' } : undefined}>
                  <td className="w-8">
                    <button
                      className="ad-btn ad-btn-icon ad-btn-ghost !p-1"
                      onClick={() => onToggleSelect(id)}
                      title={tl('select')}
                      aria-pressed={selected.includes(id)}
                    >
                      {selected.includes(id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* La flèche ouvre le détail sous la ligne. */}
                  <td className="w-8">
                    <button
                      className="ad-btn ad-btn-icon ad-btn-ghost !p-1"
                      onClick={() => basculer(id)}
                      title={ouvert ? tl('hideDetails') : tl('showDetails')}
                      aria-expanded={ouvert}
                      aria-controls={`detail-${id}`}
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
                    </button>
                  </td>

                  {/* Nom, puis courriel et code du compte en dessous. */}
                  <td>
                    <div className="font-semibold truncate">{nom}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs" style={{ color: 'var(--ad-muted)' }}>
                      <a href={`mailto:${email}`} className="hover:underline truncate">{email}</a>
                      <code className="font-mono font-bold shrink-0" title={tl('userCode')}>
                        {userCode(type, row.id)}
                      </code>
                    </div>
                    {/* Sur petit écran les colonnes type et statut sont
                        masquées : les pastilles rejoignent l'identité. */}
                    <div className="flex flex-wrap items-center gap-1 mt-1 md:hidden">
                      {type && <span className="ad-chip ad-chip-acc">{libelle(`type.${type}`, type)}</span>}
                      {statut && <span className={`ad-chip ${couleurStatut(statut)}`}>{libelle(`status.${statut}`, statut)}</span>}
                    </div>
                  </td>

                  <td className="hidden md:table-cell">
                    {type && <span className="ad-chip ad-chip-acc">{libelle(`type.${type}`, type)}</span>}
                  </td>
                  <td className="hidden md:table-cell">
                    {statut && <span className={`ad-chip ${couleurStatut(statut)}`}>{libelle(`status.${statut}`, statut)}</span>}
                  </td>

                  <td className="text-right whitespace-nowrap">
                    <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => onMessage(row)} title={tl('sendMessage')}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button className="ad-btn ad-btn-icon ad-btn-ghost ms-1" onClick={() => onConsult(row)} title={tl('consult')}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="ad-btn ad-btn-icon ad-btn-ghost ms-1" onClick={() => onEdit(row)} title={tl('edit')}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="ad-btn ad-btn-icon ad-btn-danger ms-1" onClick={() => onDelete(id)} title={tl('trash')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>

                {/*
                  Détail sur une ligne pleine largeur. Rendu seulement à
                  l'ouverture : monter ces blocs pour chaque compte
                  alourdirait une liste de plusieurs centaines de lignes.
                */}
                {ouvert && (
                  <tr id={`detail-${id}`}>
                    <td colSpan={6} className="!pt-0">
                      <div
                        className="rounded-lg p-3"
                        style={{ background: 'var(--ad-surface-2)' }}
                      >
                        <UserDetails
                          record={row}
                          locale={locale}
                          busy={busy}
                          onStatus={(statutCible) => onStatus(row, statutCible)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="p-6 text-center text-sm" style={{ color: 'var(--ad-muted)' }}>
          {tl('emptyList')}
        </p>
      )}
    </div>
  );
}
