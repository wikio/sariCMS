'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Briefcase, Building2, Calendar, CheckCircle, Copy, ExternalLink, FileText, Globe, Mail,
  MapPin, Pencil, Phone, Shield, User, X,
} from 'lucide-react';
import { userRecordHref } from '@/lib/user-links';
import { findCountry } from '@/lib/countries';
import { findWilaya, wilayaCode } from '@/lib/wilayas';
import DateText from '@/components/shared/DateText';

type UserRecord = Record<string, unknown>;

/**
 * Fiche de consultation d'un compte : lecture seule, en un coup d'œil.
 *
 * Le CRUD n'offrait que l'édition : consulter un compte obligeait à ouvrir le
 * formulaire, au risque d'une modification involontaire. Cette vue affiche les
 * mêmes données sans champ modifiable, avec les valeurs mises en forme
 * (wilaya avec son code, pays reconnu, dates localisées) plutôt que brutes.
 */
export default function UserSheet({
  record,
  locale,
  onClose,
  onEdit,
}: {
  record: UserRecord;
  locale: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const t = useTranslations('admin.userForm');
  const v = (k: string) => String(record[k] ?? '').trim();

  /**
   * Libellé traduit, avec repli sur la valeur brute.
   *
   * Les valeurs viennent de la base : un type ou un statut hérité d'un import
   * peut ne pas figurer dans les traductions. `t()` lèverait alors une
   * exception « MISSING_MESSAGE » qui ferait planter toute la fiche, d'où le
   * test préalable avec `t.has`.
   */
  const libelle = (cle: string, brut: string) => (brut && t.has?.(cle) ? t(cle) : brut);

  const type = v('type');
  const statut = v('status');
  const lienMetier = userRecordHref(locale, type, record.email);

  const pays = findCountry(v('country'));
  const wil = findWilaya(v('wilaya'));

  const copier = (texte: string) => { navigator.clipboard?.writeText(texte).catch(() => undefined); };

  const Ligne = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--ad-muted)' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--ad-muted)' }}>{label}</div>
        <div className="text-sm font-semibold break-words">{children}</div>
      </div>
    </div>
  );

  const Bloc = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
    <section>
      <h3 className="text-xs font-black uppercase tracking-wider mb-1 pb-1 border-b" style={{ borderColor: 'var(--ad-line)' }}>
        {titre}
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--ad-line)' }}>{children}</div>
    </section>
  );

  const vide = <span style={{ color: 'var(--ad-muted)' }}>—</span>;

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--ad-accent), #0d7a9e)' }}
        >
          {(v('firstName') || v('email') || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black truncate">
            {[v('firstName'), v('lastName')].filter(Boolean).join(' ') || v('email') || '—'}
          </h2>
          <button
            type="button"
            className="text-sm truncate flex items-center gap-1 hover:underline"
            style={{ color: 'var(--ad-muted)' }}
            title={t('copyEmail')}
            onClick={() => copier(v('email'))}
          >
            {v('email')} <Copy className="w-3 h-3" />
          </button>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {type && <span className="ad-chip ad-chip-acc">{libelle(`type.${type}`, type)}</span>}
            {statut && (
              <span className={`ad-chip ${statut === 'active' ? 'ad-chip-ok' : statut === 'blocked' ? 'ad-chip-warn' : 'ad-chip-mute'}`}>
                {libelle(`status.${statut}`, statut)}
              </span>
            )}
            {record.totpEnabled === true && (
              <span className="ad-chip ad-chip-ok"><CheckCircle className="w-3 h-3 mr-1 inline" />{t('totpOn')}</span>
            )}
          </div>
        </div>
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onClose} title={t('close')}>
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
        <Bloc titre={t('sectionIdentity')}>
          <Ligne icon={Mail} label={t('email')}>{v('email') || vide}</Ligne>
          <Ligne icon={Phone} label={t('phone')}>
            {v('phone') ? <a href={`tel:${v('phone').replace(/\s/g, '')}`} className="hover:underline">{v('phone')}</a> : vide}
          </Ligne>
          <Ligne icon={Globe} label={t('localeLabel')}>
            {v('locale') ? libelle(`locale.${v('locale')}`, v('locale')) : vide}
          </Ligne>
        </Bloc>

        <Bloc titre={t('sectionAccess')}>
          <Ligne icon={Shield} label={t('typeLabel')}>
            {type ? (
              lienMetier ? (
                <Link href={lienMetier} className="hover:underline inline-flex items-center gap-1" style={{ color: 'var(--ad-accent)' }}>
                  {libelle(`type.${type}`, type)} <ExternalLink className="w-3 h-3" />
                </Link>
              ) : libelle(`type.${type}`, type)
            ) : vide}
          </Ligne>
          <Ligne icon={Shield} label={t('statusLabel')}>
            {statut ? libelle(`status.${statut}`, statut) : vide}
          </Ligne>
          <Ligne icon={Shield} label={t('role')}>
            {v('roleId') ? `#${v('roleId')}` : <span style={{ color: 'var(--ad-muted)' }}>{t('noRole')}</span>}
          </Ligne>
        </Bloc>

        <Bloc titre={t('sectionCompany')}>
          <Ligne icon={Building2} label={t('company')}>{v('company') || vide}</Ligne>
          <Ligne icon={Briefcase} label={t('position')}>{v('position') || vide}</Ligne>
        </Bloc>

        <Bloc titre={t('sectionLocation')}>
          <Ligne icon={MapPin} label={t('address')}>{v('address') || vide}</Ligne>
          <Ligne icon={MapPin} label={t('wilaya')}>
            {wil ? `${wilayaCode(wil)} — ${v('wilaya')}` : v('wilaya') || vide}
          </Ligne>
          <Ligne icon={Globe} label={t('country')}>
            {pays ? `${v('country')} (${pays.code})` : v('country') || vide}
          </Ligne>
        </Bloc>

        {type === 'candidate' && (
          <Bloc titre={t('sectionCandidate')}>
            <Ligne icon={Briefcase} label={t('experience')}>{v('experience') || vide}</Ligne>
            <Ligne icon={FileText} label={t('cvUrl')}>
              {v('cvUrl') ? (
                <a href={v('cvUrl')} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1" style={{ color: 'var(--ad-accent)' }}>
                  {t('openCv')} <ExternalLink className="w-3 h-3" />
                </a>
              ) : vide}
            </Ligne>
            <Ligne icon={User} label={t('motivation')}>{v('motivation') || vide}</Ligne>
          </Bloc>
        )}

        <Bloc titre={t('sectionMeta')}>
          <Ligne icon={Calendar} label={t('createdAt')}>
            {record.createdAt ? <DateText value={String(record.createdAt)} /> : vide}
          </Ligne>
          <Ligne icon={Calendar} label={t('updatedAt')}>
            {record.updatedAt ? <DateText value={String(record.updatedAt)} /> : vide}
          </Ligne>
          <Ligne icon={Globe} label={t('lastIp')}>{v('ip') || vide}</Ligne>
        </Bloc>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--ad-line)' }}>
        <button type="button" className="ad-btn ad-btn-ghost" onClick={onClose}>{t('close')}</button>
        {onEdit && (
          <button type="button" className="ad-btn ad-btn-primary" onClick={onEdit}>
            <Pencil className="w-4 h-4" /> {t('edit')}
          </button>
        )}
      </div>
    </div>
  );
}
