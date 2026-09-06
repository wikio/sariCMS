// components/dashboard/ProfileModule.tsx
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, Building2, Briefcase, Check, CheckCircle, Eye, EyeOff, Globe, KeyRound,
  Loader2, Mail, MapPin, Pencil, Phone, User as UserIcon, X,
} from 'lucide-react';
import { useAuth, frontToken, type User } from '@/contexts/AuthContext';
import { cmsFetch, CmsError } from '@/lib/cms';
import { checkPassword, PASSWORD_MIN } from '@/lib/password-tools';
import { WILAYAS, wilayaName } from '@/lib/wilayas';
import CountrySelect from '@/components/ui/CountrySelect';

/**
 * Profil de la vitrine : consultation, édition, changement de mot de passe.
 *
 * Le formulaire reprend les champs de la fiche d'administration à l'exception
 * de ceux qui relèvent du rôle administrateur — type de compte, statut, rôle,
 * adresse IP, double authentification, code partenaire, mot de passe
 * temporaire. Les laisser modifiables ici permettrait à n'importe quel visiteur
 * de se promouvoir administrateur ou de débloquer un compte suspendu.
 *
 * La consultation est le mode par défaut : on ouvre son profil bien plus
 * souvent pour le lire que pour le corriger, et un formulaire toujours ouvert
 * expose à des modifications involontaires.
 */

/** Champs que la personne peut modifier elle-même. */
interface Brouillon {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  address: string;
  wilaya: string;
  country: string;
  locale: string;
}

const LANGUES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

/** Construit le brouillon d'édition à partir du compte connecté. */
function versBrouillon(user: User | null, secours: string): Brouillon {
  const nomComplet = (user?.name || '').trim();
  const [prenomDeduit = '', ...resteDeduit] = nomComplet.split(' ');
  return {
    firstName: user?.firstName || prenomDeduit,
    lastName: user?.lastName || resteDeduit.join(' '),
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
    position: user?.position || '',
    address: user?.address || '',
    wilaya: user?.wilaya || '',
    country: user?.country || '',
    locale: user?.locale || secours,
  };
}

export default function ProfileModule() {
  const locale = useLocale();
  const t = useTranslations('pages.dashboard');
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [mode, setMode] = useState<'lecture' | 'edition'>('lecture');
  const [brouillon, setBrouillon] = useState<Brouillon>(() => versBrouillon(user, locale));
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null);
  const [motDePasseOuvert, setMotDePasseOuvert] = useState(false);

  // La consultation lit le compte directement plutôt qu'une copie tenue à
  // jour par un effet : le compte peut arriver après le premier rendu
  // (lecture du stockage local) ou changer en cours de route, et une copie
  // resynchronisée déclencherait un rendu en cascade à chaque fois.
  const fiche = useMemo(() => versBrouillon(user, locale), [user, locale]);
  // En édition, c'est le brouillon qui fait foi : lui seul retient la saisie
  // en cours.
  const affiche = mode === 'edition' ? brouillon : fiche;

  const estClient = user?.type === 'client';
  const estPartenaire = user?.type === 'partner';
  const estCandidat = user?.type === 'candidate';
  const afficheSociete = estClient || estPartenaire;

  const libelle = (cle: string, brut: string) => (t.has?.(cle) ? t(cle) : brut);

  const wilayasTriees = useMemo(
    () => WILAYAS.map((w) => ({ valeur: wilayaName(w, locale), texte: `${w.code} — ${wilayaName(w, locale)}` })),
    [locale],
  );

  const majChamp = (cle: keyof Brouillon, valeur: string) => {
    setBrouillon((b) => ({ ...b, [cle]: valeur }));
    setMessage(null);
  };

  const annuler = () => {
    setBrouillon(fiche);
    setMode('lecture');
    setMessage(null);
  };

  /**
   * Enregistre le profil : serveur d'abord, stockage local ensuite.
   *
   * L'écriture locale a lieu même si l'API est injoignable, sinon la personne
   * perdrait sa saisie ; le message distingue les deux cas pour qu'elle sache
   * si la modification a bien atteint le serveur.
   */
  const enregistrer = async () => {
    if (!user) return;
    if (!brouillon.firstName.trim() || !brouillon.lastName.trim()) {
      setMessage({ ton: 'erreur', texte: libelle('profileNameRequired', 'Le nom et le prénom sont obligatoires.') });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brouillon.email.trim())) {
      setMessage({ ton: 'erreur', texte: libelle('profileEmailInvalid', 'Adresse e-mail invalide.') });
      return;
    }

    setEnregistrement(true);
    setMessage(null);
    const jeton = frontToken();
    let synchronise = false;

    if (jeton && user.id) {
      try {
        await cmsFetch(`/users/${user.id}`, {
          method: 'PATCH',
          token: jeton,
          json: {
            firstName: brouillon.firstName.trim(),
            lastName: brouillon.lastName.trim(),
            email: brouillon.email.trim().toLowerCase(),
            phone: brouillon.phone.trim() || undefined,
            company: brouillon.company.trim() || undefined,
            position: brouillon.position.trim() || undefined,
            address: brouillon.address.trim() || undefined,
            wilaya: brouillon.wilaya.trim() || undefined,
            country: brouillon.country.trim() || undefined,
            locale: brouillon.locale,
          },
          timeoutMs: 10000,
        });
        synchronise = true;
      } catch (err) {
        const detail = err instanceof CmsError ? err.message : '';
        setMessage({
          ton: 'erreur',
          texte: `${libelle('profileSaveOffline', 'Modifications enregistrées sur cet appareil, mais le serveur n’a pas répondu.')}${detail ? ` (${detail})` : ''}`,
        });
      }
    }

    try {
      const brut = localStorage.getItem('sari_user');
      const compte = brut ? (JSON.parse(brut) as Record<string, unknown>) : {};
      Object.assign(compte, {
        firstName: brouillon.firstName.trim(),
        lastName: brouillon.lastName.trim(),
        name: `${brouillon.firstName.trim()} ${brouillon.lastName.trim()}`.trim(),
        email: brouillon.email.trim().toLowerCase(),
        phone: brouillon.phone.trim(),
        company: brouillon.company.trim(),
        position: brouillon.position.trim(),
        address: brouillon.address.trim(),
        wilaya: brouillon.wilaya.trim(),
        country: brouillon.country.trim(),
        locale: brouillon.locale,
      });
      localStorage.setItem('sari_user', JSON.stringify(compte));
    } catch {
      /* Stockage indisponible : le rafraîchissement ci-dessous reste sans effet. */
    }

    refreshUser();
    setEnregistrement(false);
    setMode('lecture');
    if (synchronise) setMessage({ ton: 'ok', texte: libelle('profileSaved', 'Profil mis à jour.') });

    // La langue commande la version du site : on l'applique tout de suite,
    // sinon il faudrait se reconnecter pour en constater l'effet.
    if (brouillon.locale !== locale) router.push(`/${brouillon.locale}/dashboard`);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
            <UserIcon className="w-6 h-6 text-sari-blue" /> {t('myProfile')}
          </h2>
          {mode === 'lecture' ? (
            <button
              type="button"
              onClick={() => { setBrouillon(fiche); setMode('edition'); setMessage(null); }}
              className="btn-primary text-white px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> {libelle('editProfile', 'Modifier le profil')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={annuler}
                disabled={enregistrement}
                className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> {libelle('cancel', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={enregistrer}
                disabled={enregistrement}
                className="btn-primary text-white px-5 py-2.5 font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-60"
              >
                {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t('saveChanges')}
              </button>
            </div>
          )}
        </div>

        {message && (
          <div
            role="status"
            className={`mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              message.ton === 'ok'
                ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {message.ton === 'ok' ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{message.texte}</span>
          </div>
        )}

        {mode === 'lecture' ? (
          <dl className="grid md:grid-cols-2 gap-x-8 gap-y-5">
            <Ligne icon={UserIcon} label={t('fullName')} value={`${affiche.firstName} ${affiche.lastName}`.trim()} />
            <Ligne icon={Mail} label={t('email')} value={affiche.email} />
            <Ligne icon={Phone} label={t('phone')} value={affiche.phone} />
            {afficheSociete && <Ligne icon={Building2} label={t('company')} value={affiche.company} />}
            {(afficheSociete || estCandidat) && (
              <Ligne icon={Briefcase} label={libelle('position', 'Fonction')} value={affiche.position} />
            )}
            <Ligne icon={MapPin} label={libelle('address', 'Adresse')} value={affiche.address} />
            <Ligne icon={MapPin} label={libelle('wilaya', 'Wilaya')} value={affiche.wilaya} />
            <Ligne icon={Globe} label={libelle('country', 'Pays')} value={affiche.country} />
            <Ligne
              icon={Globe}
              label={t('displayLanguage')}
              value={LANGUES.find((l) => l.code === affiche.locale)?.label || affiche.locale}
            />
          </dl>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <Champ id="profil-prenom" label={libelle('firstName', 'Prénom')} requis>
              <input
                id="profil-prenom"
                type="text"
                value={brouillon.firstName}
                onChange={(e) => majChamp('firstName', e.target.value)}
                className={saisieClasse}
              />
            </Champ>
            <Champ id="profil-nom" label={libelle('lastName', 'Nom')} requis>
              <input
                id="profil-nom"
                type="text"
                value={brouillon.lastName}
                onChange={(e) => majChamp('lastName', e.target.value)}
                className={saisieClasse}
              />
            </Champ>
            <Champ id="profil-email" label={t('email')} requis>
              <input
                id="profil-email"
                type="email"
                value={brouillon.email}
                onChange={(e) => majChamp('email', e.target.value)}
                className={saisieClasse}
              />
            </Champ>
            <Champ id="profil-tel" label={t('phone')}>
              <input
                id="profil-tel"
                type="tel"
                placeholder="+213 …"
                value={brouillon.phone}
                onChange={(e) => majChamp('phone', e.target.value)}
                className={saisieClasse}
              />
            </Champ>
            {afficheSociete && (
              <Champ id="profil-societe" label={t('company')}>
                <input
                  id="profil-societe"
                  type="text"
                  value={brouillon.company}
                  onChange={(e) => majChamp('company', e.target.value)}
                  className={saisieClasse}
                />
              </Champ>
            )}
            {(afficheSociete || estCandidat) && (
              <Champ id="profil-fonction" label={libelle('position', 'Fonction')}>
                <input
                  id="profil-fonction"
                  type="text"
                  value={brouillon.position}
                  onChange={(e) => majChamp('position', e.target.value)}
                  className={saisieClasse}
                />
              </Champ>
            )}
            <Champ id="profil-adresse" label={libelle('address', 'Adresse')}>
              <input
                id="profil-adresse"
                type="text"
                value={brouillon.address}
                onChange={(e) => majChamp('address', e.target.value)}
                className={saisieClasse}
              />
            </Champ>
            <Champ id="profil-wilaya" label={libelle('wilaya', 'Wilaya')}>
              <select
                id="profil-wilaya"
                value={brouillon.wilaya}
                onChange={(e) => majChamp('wilaya', e.target.value)}
                className={saisieClasse}
              >
                <option value="">—</option>
                {wilayasTriees.map((w) => (
                  <option key={w.valeur} value={w.valeur}>{w.texte}</option>
                ))}
              </select>
            </Champ>
            <Champ id="profil-pays" label={libelle('country', 'Pays')}>
              <CountrySelect
                id="profil-pays"
                value={brouillon.country}
                onChange={(v) => majChamp('country', v)}
              />
            </Champ>
            <Champ id="profil-langue" label={t('displayLanguage')} aide={t('displayLanguageHint')}>
              <select
                id="profil-langue"
                value={brouillon.locale}
                onChange={(e) => majChamp('locale', e.target.value)}
                className={saisieClasse}
              >
                {LANGUES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </Champ>
          </div>
        )}
      </div>

      <BlocMotDePasse ouvert={motDePasseOuvert} onToggle={() => setMotDePasseOuvert((v) => !v)} />
    </div>
  );
}

const saisieClasse =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white focus:border-sari-blue outline-none rounded-lg';

/** Ligne de consultation : libellé discret, valeur lisible. */
function Ligne({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </dt>
      <dd className={`text-base ${value ? 'text-sari-dark dark:text-white' : 'text-gray-400 dark:text-gray-600 italic'}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

function Champ({
  id, label, requis, aide, children,
}: { id: string; label: string; requis?: boolean; aide?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-sari-dark dark:text-white mb-2">
        {label} {requis && <span className="text-red-500">*</span>}
      </label>
      {children}
      {aide && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{aide}</p>}
    </div>
  );
}

/**
 * Changement de mot de passe.
 *
 * Les règles sont celles du serveur (`lib/password-tools`), vérifiées pendant
 * la frappe : se voir refuser l'envoi après coup, avec un message technique en
 * anglais, est la meilleure façon de faire abandonner. L'ancien mot de passe
 * est exigé — c'est ce qui distingue ce formulaire de la réinitialisation
 * administrateur et empêche un poste laissé ouvert de verrouiller le compte.
 */
function BlocMotDePasse({ ouvert, onToggle }: { ouvert: boolean; onToggle: () => void }) {
  const t = useTranslations('pages.dashboard');
  const libelle = (cle: string, brut: string) => (t.has?.(cle) ? t(cle) : brut);

  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null);

  const analyse = useMemo(() => checkPassword(nouveau), [nouveau]);
  const identiques = nouveau.length > 0 && nouveau === confirmation;
  const pretAEnvoyer = actuel.length > 0 && analyse.valid && identiques && !envoi;

  const reglesTexte: Record<string, string> = {
    length: libelle('pwdRuleLength', `Au moins ${PASSWORD_MIN} caractères`),
    upper: libelle('pwdRuleUpper', 'Une majuscule'),
    lower: libelle('pwdRuleLower', 'Une minuscule'),
    digit: libelle('pwdRuleDigit', 'Un chiffre'),
  };

  const soumettre = async () => {
    if (!pretAEnvoyer) return;
    setEnvoi(true);
    setRetour(null);
    const jeton = frontToken();

    if (!jeton) {
      setEnvoi(false);
      setRetour({
        ton: 'erreur',
        texte: libelle('pwdNeedsSession', 'Reconnectez-vous pour changer votre mot de passe.'),
      });
      return;
    }

    try {
      await cmsFetch('/auth/change-password', {
        method: 'POST',
        token: jeton,
        json: { currentPassword: actuel, newPassword: nouveau },
        timeoutMs: 12000,
      });
      setActuel(''); setNouveau(''); setConfirmation('');
      setRetour({ ton: 'ok', texte: libelle('pwdChanged', 'Mot de passe modifié.') });
    } catch (err) {
      const statut = err instanceof CmsError ? err.status : 0;
      const texte =
        statut === 401
          ? libelle('pwdWrongCurrent', 'Mot de passe actuel incorrect.')
          : statut === 429
            ? libelle('pwdTooMany', 'Trop de tentatives. Réessayez dans une minute.')
            : statut === 400
              ? libelle('pwdRejected', 'Nouveau mot de passe refusé : il doit être différent de l’ancien et respecter les règles.')
              : libelle('pwdFailed', 'Le changement a échoué. Réessayez plus tard.');
      setRetour({ ton: 'erreur', texte });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouvert}
        className="w-full flex items-center justify-between gap-3 px-8 py-6 text-left"
      >
        <span className="text-xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-sari-blue" /> {libelle('changePassword', 'Changer mon mot de passe')}
        </span>
        <span className="text-sm font-semibold text-sari-blue">
          {ouvert ? libelle('close', 'Fermer') : libelle('open', 'Ouvrir')}
        </span>
      </button>

      {ouvert && (
        <div className="px-8 pb-8 space-y-4 border-t border-gray-200 dark:border-gray-800 pt-6">
          {retour && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                retour.ton === 'ok'
                  ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
                  : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {retour.ton === 'ok' ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{retour.texte}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Champ id="pwd-actuel" label={libelle('currentPassword', 'Mot de passe actuel')} requis>
              <div className="relative">
                <input
                  id="pwd-actuel"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={actuel}
                  onChange={(e) => { setActuel(e.target.value); setRetour(null); }}
                  className={saisieClasse}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? libelle('hidePassword', 'Masquer') : libelle('showPassword', 'Afficher')}
                  className="absolute inset-y-0 end-3 flex items-center text-gray-500 hover:text-sari-blue"
                >
                  {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Champ>
            <div className="hidden md:block" />
            <Champ id="pwd-nouveau" label={libelle('newPassword', 'Nouveau mot de passe')} requis>
              <input
                id="pwd-nouveau"
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                value={nouveau}
                onChange={(e) => { setNouveau(e.target.value); setRetour(null); }}
                className={saisieClasse}
              />
            </Champ>
            <Champ id="pwd-confirmation" label={libelle('confirmPassword', 'Confirmer le mot de passe')} requis>
              <input
                id="pwd-confirmation"
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => { setConfirmation(e.target.value); setRetour(null); }}
                className={`${saisieClasse} ${confirmation && !identiques ? 'border-red-400 dark:border-red-600' : ''}`}
              />
              {confirmation.length > 0 && !identiques && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {libelle('pwdMismatch', 'Les deux saisies diffèrent.')}
                </p>
              )}
            </Champ>
          </div>

          {nouveau.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {analyse.rules.map((regle) => (
                <li
                  key={regle.key}
                  className={`flex items-center gap-2 text-sm ${
                    regle.ok ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {regle.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                  {reglesTexte[regle.key]}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={soumettre}
            disabled={!pretAEnvoyer}
            className="btn-primary text-white px-6 py-3 font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {envoi ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
            {libelle('changePassword', 'Changer mon mot de passe')}
          </button>
        </div>
      )}
    </div>
  );
}
