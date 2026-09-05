'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle, Briefcase, Building2, Globe, Mail, MapPin, Phone, Save, Shield, User, X,
} from 'lucide-react';
import { cmsAdminList } from '@/lib/cms-admin';
import { COUNTRIES, countryName, findCountry } from '@/lib/countries';
import { WILAYAS, wilayaCode, wilayaName } from '@/lib/wilayas';
import { checkPassword } from '@/lib/password-tools';
import SearchSelect, { type SearchSelectOption } from '@/components/admin/fields/SearchSelect';
import PasswordField from '@/components/admin/fields/PasswordField';

export type UserRecord = Record<string, unknown>;

const TYPES = ['admin', 'client', 'partner', 'candidate'] as const;
const STATUTS = ['active', 'pending', 'blocked'] as const;
const LANGUES = ['fr', 'en', 'ar'] as const;

// Reprend la contrainte du serveur (@IsEmail) sans dépendance supplémentaire.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
// Numéros algériens et internationaux : chiffres, espaces, points, tirets,
// parenthèses et préfixe +. La longueur utile est vérifiée à part.
const TEL_RE = /^[+()\d][\d\s.\-()]{7,}$/;

/**
 * Formulaire d'édition d'un compte.
 *
 * L'éditeur générique du CRUD affichait un champ texte par propriété, dans
 * l'ordre de l'objet renvoyé par l'API : `passwordHash` y côtoyait `ip` et
 * `totpEnabled`, sans libellé lisible ni validation. Ce formulaire regroupe
 * les champs par thème, impose les règles du serveur avant l'envoi et confie
 * les référentiels (rôle, pays, wilaya, type…) à des listes cherchables.
 */
export default function UserForm({
  record,
  locale,
  saving = false,
  onCancel,
  onSave,
}: {
  record: UserRecord;
  locale: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (payload: UserRecord) => void;
}) {
  const t = useTranslations('admin.userForm');
  const creation = !record.id;

  const [form, setForm] = useState<UserRecord>(() => ({ ...record }));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<SearchSelectOption[]>([]);
  const [touche, setTouche] = useState(false);

  useEffect(() => { setForm({ ...record }); setPassword(''); setErrors({}); setTouche(false); }, [record]);

  // Les rôles viennent de la base : les coder en dur désynchroniserait le
  // formulaire dès qu'un rôle est ajouté depuis Administration → Rôles.
  useEffect(() => {
    let vivant = true;
    cmsAdminList('roles')
      .then((list) => {
        if (!vivant) return;
        setRoles(
          (list as Record<string, unknown>[]).map((r) => ({
            value: String(r.id),
            label: String(r.name || r.slug || r.id),
            hint: String(r.description || r.slug || ''),
          })),
        );
      })
      .catch(() => { /* Droits insuffisants : le champ reste vide, sans bloquer. */ });
    return () => { vivant = false; };
  }, []);

  const champ = (k: string) => String(form[k] ?? '');
  const set = (k: string, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const { [k]: _o, ...reste } = p; return reste; });
    setTouche(true);
  };

  const paysOptions = useMemo<SearchSelectOption[]>(
    () => COUNTRIES.map((c) => ({ value: countryName(c, locale), label: countryName(c, locale), hint: c.code })),
    [locale],
  );
  const wilayaOptions = useMemo<SearchSelectOption[]>(
    () => WILAYAS.map((w) => ({ value: wilayaName(w, locale), label: wilayaName(w, locale), hint: wilayaCode(w) })),
    [locale],
  );
  const typeOptions = useMemo<SearchSelectOption[]>(
    () => TYPES.map((v) => ({ value: v, label: t(`type.${v}`), hint: t(`typeHint.${v}`) })),
    [t],
  );
  const statutOptions = useMemo<SearchSelectOption[]>(
    () => STATUTS.map((v) => ({ value: v, label: t(`status.${v}`), hint: t(`statusHint.${v}`) })),
    [t],
  );
  const langueOptions = useMemo<SearchSelectOption[]>(
    () => LANGUES.map((v) => ({ value: v, label: t(`locale.${v}`), hint: v.toUpperCase() })),
    [t],
  );

  const estCandidat = champ('type') === 'candidate';
  const estAdmin = champ('type') === 'admin';

  /** Contrôle complet avant envoi ; renvoie les erreurs par champ. */
  const valider = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const email = champ('email').trim();
    if (!email) e.email = t('errEmailRequired');
    else if (!EMAIL_RE.test(email)) e.email = t('errEmail');

    if (!champ('firstName').trim()) e.firstName = t('errFirstNameRequired');
    if (!champ('lastName').trim()) e.lastName = t('errLastNameRequired');

    const tel = champ('phone').trim();
    // Le téléphone reste facultatif côté serveur, mais s'il est renseigné il
    // doit être exploitable par le service commercial.
    if (tel && (!TEL_RE.test(tel) || tel.replace(/\D/g, '').length < 8)) e.phone = t('errPhone');

    if (!champ('type')) e.type = t('errTypeRequired');
    if (!champ('status')) e.status = t('errStatusRequired');

    const pays = champ('country').trim();
    if (pays && !findCountry(pays)) e.country = t('errCountryUnknown');

    if (creation && !password) e.password = t('errPasswordRequired');
    if (password && !checkPassword(password).valid) e.password = t('errPasswordWeak');

    return e;
  };

  const enregistrer = () => {
    const e = valider();
    setErrors(e);
    if (Object.keys(e).length) {
      // Ramène le premier champ fautif à l'écran : sur un formulaire long,
      // une erreur en haut passe inaperçue depuis le bas de la modale.
      const premier = document.getElementById(`uf-${Object.keys(e)[0]}`);
      premier?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      premier?.focus?.();
      return;
    }
    const payload: UserRecord = { ...form };
    // Un mot de passe vide en édition signifie « inchangé » : l'envoyer
    // écraserait le mot de passe existant par une chaîne vide.
    if (password) payload.password = password;
    else delete payload.password;
    onSave(payload);
  };

  const Erreur = ({ k }: { k: string }) =>
    errors[k] ? (
      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--ad-danger)' }}>
        <AlertCircle className="w-3 h-3 shrink-0" /> {errors[k]}
      </p>
    ) : null;

  const Champ = ({
    k, label, note, icon: Icon, requis, children,
  }: {
    k: string; label: string; note?: string; icon?: React.ElementType; requis?: boolean; children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor={`uf-${k}`} className="block text-sm font-bold mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: 'var(--ad-accent)' }} />}
        {label}
        {requis && <span style={{ color: 'var(--ad-danger)' }}>*</span>}
      </label>
      {children}
      {note && !errors[k] && (
        <p className="text-xs mt-1" style={{ color: 'var(--ad-muted)' }}>{note}</p>
      )}
      <Erreur k={k} />
    </div>
  );

  const Section = ({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) => (
    <section className="space-y-3">
      <div className="border-b pb-2" style={{ borderColor: 'var(--ad-line)' }}>
        <h3 className="text-sm font-black uppercase tracking-wider">{titre}</h3>
        {sousTitre && <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>{sousTitre}</p>}
      </div>
      {children}
    </section>
  );

  const clsInput = (k: string) => 'ad-input';
  const styleInput = (k: string) => (errors[k] ? { borderColor: 'var(--ad-danger)' } : undefined);

  return (
    <div className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <div
          className="ad-card p-3 flex items-start gap-2 text-sm"
          style={{ borderColor: 'var(--ad-danger)', color: 'var(--ad-danger)' }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('summaryErrors', { count: Object.keys(errors).length })}</span>
        </div>
      )}

      <Section titre={t('sectionIdentity')} sousTitre={t('sectionIdentityHint')}>
        <div className="grid md:grid-cols-2 gap-3">
          <Champ k="firstName" label={t('firstName')} icon={User} requis note={t('firstNameHint')}>
            <input
              id="uf-firstName"
              className={clsInput('firstName')}
              style={styleInput('firstName')}
              value={champ('firstName')}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </Champ>
          <Champ k="lastName" label={t('lastName')} icon={User} requis note={t('lastNameHint')}>
            <input
              id="uf-lastName"
              className={clsInput('lastName')}
              style={styleInput('lastName')}
              value={champ('lastName')}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </Champ>
          <Champ k="email" label={t('email')} icon={Mail} requis note={t('emailHint')}>
            <input
              id="uf-email"
              type="email"
              className={clsInput('email')}
              style={styleInput('email')}
              value={champ('email')}
              onChange={(e) => set('email', e.target.value)}
            />
          </Champ>
          <Champ k="phone" label={t('phone')} icon={Phone} note={t('phoneHint')}>
            <input
              id="uf-phone"
              className={clsInput('phone')}
              style={styleInput('phone')}
              value={champ('phone')}
              placeholder="(+213) 550 12 34 56"
              onChange={(e) => set('phone', e.target.value)}
            />
          </Champ>
        </div>
      </Section>

      <Section titre={t('sectionAccess')} sousTitre={t('sectionAccessHint')}>
        <div className="grid md:grid-cols-2 gap-3">
          <Champ k="type" label={t('typeLabel')} icon={Shield} requis note={t('typeNote')}>
            <SearchSelect
              id="uf-type"
              value={champ('type')}
              onChange={(v) => set('type', v)}
              options={typeOptions}
              allowEmpty={false}
              error={Boolean(errors.type)}
              placeholder={t('typePlaceholder')}
            />
          </Champ>
          <Champ k="status" label={t('statusLabel')} icon={Shield} requis note={t('statusNote')}>
            <SearchSelect
              id="uf-status"
              value={champ('status')}
              onChange={(v) => set('status', v)}
              options={statutOptions}
              allowEmpty={false}
              error={Boolean(errors.status)}
              placeholder={t('statusPlaceholder')}
            />
          </Champ>
          <Champ k="roleId" label={t('role')} icon={Shield} note={estAdmin ? t('roleNoteAdmin') : t('roleNote')}>
            <SearchSelect
              id="uf-roleId"
              value={champ('roleId')}
              onChange={(v) => set('roleId', v ? v : null)}
              options={roles}
              emptyLabel={t('noRole')}
              placeholder={t('rolePlaceholder')}
            />
          </Champ>
          <Champ k="locale" label={t('localeLabel')} icon={Globe} note={t('localeNote')}>
            <SearchSelect
              id="uf-locale"
              value={champ('locale')}
              onChange={(v) => set('locale', v)}
              options={langueOptions}
              allowEmpty={false}
              placeholder={t('localePlaceholder')}
            />
          </Champ>
        </div>

        <Champ
          k="password"
          label={creation ? t('password') : t('passwordChange')}
          icon={Shield}
          requis={creation}
          note={creation ? t('passwordHint') : t('passwordKeepHint')}
        >
          <PasswordField
            id="uf-password"
            value={password}
            required={creation}
            onChange={(v) => { setPassword(v); setErrors((p) => { const { password: _o, ...r } = p; return r; }); setTouche(true); }}
          />
        </Champ>
      </Section>

      <Section titre={t('sectionCompany')} sousTitre={t('sectionCompanyHint')}>
        <div className="grid md:grid-cols-2 gap-3">
          <Champ k="company" label={t('company')} icon={Building2} note={t('companyHint')}>
            <input
              id="uf-company"
              className={clsInput('company')}
              value={champ('company')}
              onChange={(e) => set('company', e.target.value)}
            />
          </Champ>
          <Champ k="position" label={t('position')} icon={Briefcase} note={t('positionHint')}>
            <input
              id="uf-position"
              className={clsInput('position')}
              value={champ('position')}
              onChange={(e) => set('position', e.target.value)}
            />
          </Champ>
        </div>
      </Section>

      <Section titre={t('sectionLocation')} sousTitre={t('sectionLocationHint')}>
        <div className="space-y-3">
          <Champ k="address" label={t('address')} icon={MapPin} note={t('addressHint')}>
            <textarea
              id="uf-address"
              rows={2}
              className="ad-textarea"
              value={champ('address')}
              placeholder={t('addressPlaceholder')}
              onChange={(e) => set('address', e.target.value)}
            />
          </Champ>
          <div className="grid md:grid-cols-2 gap-3">
            <Champ k="wilaya" label={t('wilaya')} icon={MapPin} note={t('wilayaHint')}>
              <SearchSelect
                id="uf-wilaya"
                value={champ('wilaya')}
                onChange={(v) => set('wilaya', v)}
                options={wilayaOptions}
                allowFree
                placeholder={t('wilayaPlaceholder')}
              />
            </Champ>
            <Champ k="country" label={t('country')} icon={Globe} note={t('countryHint')}>
              <SearchSelect
                id="uf-country"
                value={champ('country')}
                onChange={(v) => set('country', v)}
                options={paysOptions}
                allowFree
                error={Boolean(errors.country)}
                placeholder={t('countryPlaceholder')}
              />
            </Champ>
          </div>
        </div>
      </Section>

      {estCandidat && (
        <Section titre={t('sectionCandidate')} sousTitre={t('sectionCandidateHint')}>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Champ k="experience" label={t('experience')} icon={Briefcase} note={t('experienceHint')}>
                <input
                  id="uf-experience"
                  className={clsInput('experience')}
                  value={champ('experience')}
                  onChange={(e) => set('experience', e.target.value)}
                />
              </Champ>
              <Champ k="cvUrl" label={t('cvUrl')} icon={Briefcase} note={t('cvUrlHint')}>
                <input
                  id="uf-cvUrl"
                  className={clsInput('cvUrl')}
                  value={champ('cvUrl')}
                  placeholder="https://…"
                  onChange={(e) => set('cvUrl', e.target.value)}
                />
              </Champ>
            </div>
            <Champ k="motivation" label={t('motivation')} note={t('motivationHint')}>
              <textarea
                id="uf-motivation"
                rows={4}
                className="ad-textarea"
                value={champ('motivation')}
                onChange={(e) => set('motivation', e.target.value)}
              />
            </Champ>
          </div>
        </Section>
      )}

      <div
        className="flex flex-wrap justify-end gap-2 pt-4 border-t sticky bottom-0 py-3"
        style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface)' }}
      >
        <button type="button" className="ad-btn ad-btn-ghost" onClick={onCancel}>
          <X className="w-4 h-4" /> {t('cancel')}
        </button>
        <button type="button" className="ad-btn ad-btn-primary" disabled={saving || (!touche && !creation)} onClick={enregistrer}>
          <Save className="w-4 h-4" /> {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
