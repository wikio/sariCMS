// components/shared/NewsletterSignup.tsx
'use client';

/**
 * Formulaire d'abonnement à la newsletter, réutilisable sur tout le site.
 *
 * L'adresse est envoyée à `/api/newsletter`, qui l'enregistre côté serveur
 * (API CMS quand elle répond, fichier `data/newsletter.json` sinon) : rien
 * n'est stocké dans le navigateur, et l'administrateur retrouve chaque inscription
 * dans « Newsletter », avec sa langue et son bloc d'origine.
 *
 * `variant` adapte seulement l'habillage ; le comportement est commun :
 * - premier clic sur « S'inscrire » : rien n'est encore envoyé, une fenêtre de
 *   confirmation s'ouvre (adresse relue, nom et note facultatifs, captcha en
 *   image) — c'est là que l'inscription part réellement ;
 * - le champ piège (`website`) rempli par les robots → la demande est ignorée ;
 * - l'adresse déjà présente dans la liste est signalée au visiteur au lieu
 *   d'annoncer une nouvelle inscription, une adresse retirée est réactivée ;
 * - message de confirmation propre à la langue de la page ;
 * - un petit lien de désabonnement sous le champ, qui ouvre le formulaire public
 *   en reprenant l'adresse saisie (`showUnsubscribeLink`).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle, CheckCircle, Loader2, Mail, Pencil, RefreshCcw, Send, ShieldQuestion,
} from 'lucide-react';
import {
  fetchNewsletterCaptcha,
  type NewsletterStatus,
  subscribeToNewsletter,
} from '@/lib/newsletter-admin';

export type NewsletterVariant = 'band' | 'card' | 'inline';

export interface NewsletterTopic {
  id: string;
  label: string;
}

interface NewsletterSignupProps {
  /** Bloc d'origine enregistré avec l'adresse : `home.newsletter`, `news.detail`, `footer`… */
  source: string;
  variant?: NewsletterVariant;
  /** Libellés personnalisés saisis dans le studio ; les traductions du site servent de repli. */
  labels?: Partial<Record<'title' | 'description' | 'placeholder' | 'submit' | 'legal' | 'successTitle' | 'successDesc' | 'error', string>>;
  topics?: NewsletterTopic[];
  /** Cases à cocher : le consentement explicite est enregistré avec l'adresse. */
  requireConsent?: boolean;
  /** Double opt-in : on prévient qu'un courriel de confirmation va suivre. */
  doubleOptIn?: boolean;
  className?: string;
  /** Petit lien « Se désabonner » sous le champ — la loi le demande, autant le rendre visible. */
  showUnsubscribeLink?: boolean;
  /** Petits textes additionnels affichés sous le champ (bandeau de confiance). */
  children?: React.ReactNode;
}

const FIELD = 'px-6 py-4 rounded-lg text-sari-dark bg-white focus:outline-none focus:ring-4 focus:ring-sari-lime/50';

/** Libellés de la fenêtre de confirmation, traduits une seule fois. */
type Copy = Record<string, string>;

export default function NewsletterSignup({
  source,
  variant = 'band',
  labels = {},
  topics = [],
  requireConsent = false,
  doubleOptIn = false,
  className = '',
  showUnsubscribeLink = true,
  children,
}: NewsletterSignupProps) {
  const locale = useLocale();
  const t = useTranslations('components.shared.NewsletterSignup');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [consent, setConsent] = useState(!requireConsent);
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<NewsletterStatus | ''>('');

  // Le titre et l'accroche du bloc « bandeau » viennent de ce composant ; en
  // carte latérale ou en ligne, c'est l'écran qui les porte déjà, on ne les
  // répète pas (sauf demande explicite via `labels`).
  const showOwnTitle = variant === 'band';
  const copy = {
    title: labels.title || (showOwnTitle ? t('title') : ''),
    description: labels.description || (showOwnTitle ? t('description') : ''),
    placeholder: labels.placeholder || t('placeholder'),
    submit: labels.submit || t('submit'),
    legal: labels.legal ?? t('legal'),
    successTitle: labels.successTitle || t('successTitle'),
    successDesc: labels.successDesc || t('successDesc'),
    error: labels.error || t('error'),
  };

  const modalCopy: Copy = {
    title: t('confirmTitle'),
    intro: t('confirmIntro', { email: email.trim() }),
    editEmail: t('editEmail'),
    nameLabel: t('nameLabel'),
    namePlaceholder: t('namePlaceholder'),
    notesLabel: t('notesLabel'),
    notesPlaceholder: t('notesPlaceholder'),
    topicsLabel: t('topicsLabel'),
    captchaLabel: t('captchaLabel'),
    captchaHelp: t('captchaHelp'),
    captchaPlaceholder: t('captchaPlaceholder'),
    captchaImageAlt: t('captchaImageAlt'),
    captchaRetry: t('captchaRetry'),
    newQuestion: t('newQuestion'),
    confirmCta: t('confirmCta'),
    sendingCta: t('sendingCta'),
    cancelCta: t('cancelCta'),
    alreadySubscribed: t('alreadySubscribed'),
    reactivated: t('reactivated'),
    captchaWrong: t('captchaWrong'),
    captchaLoading: t('captchaLoading'),
    error: copy.error,
  };

  /** Étape 1 : on valide la saisie puis on ouvre la fenêtre de confirmation. */
  const askConfirmation = (event: React.FormEvent) => {
    event.preventDefault();
    // Le champ piège doit rester vide ; s'il est rempli, on fait semblant d'avoir
    // inscrit l'adresse sans rien écrire.
    if (honeypot) {
      setState('done');
      return;
    }
    if (!email.trim() || !consent) {
      setState('error');
      setError(consent ? t('emailRequired') : t('consentRequired'));
      return;
    }
    setState('idle');
    setError('');
    setPendingStatus('');
    setConfirming(true);
  };

  const dark = variant !== 'inline';
  const success = (
    <div
      className={
        variant === 'inline'
          ? 'flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3'
          : 'bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg p-8 max-w-xl mx-auto animate-fade-in-up'
      }
      role="status"
    >
      <CheckCircle className={variant === 'inline' ? 'w-5 h-5 flex-shrink-0' : 'w-16 h-16 text-white mx-auto mb-4'} />
      <div className={variant === 'band' ? 'text-center' : ''}>
        {variant !== 'inline' ? <h3 className="text-2xl font-bold text-white mb-2">{copy.successTitle}</h3> : null}
        <p className={variant === 'inline' ? 'text-green-800' : 'text-blue-100'}>
          {pendingStatus === 'reactivated'
            ? t('reactivated')
            : doubleOptIn || pendingStatus === 'pending-confirmation'
              ? t('checkYourInbox')
              : copy.successDesc}
        </p>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {variant === 'band' ? (
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-white" />
        </div>
      ) : null}
      {copy.title ? (
        <h2
          className={
            variant === 'band'
              ? 'text-4xl md:text-5xl font-bold text-white mb-6'
              : variant === 'card'
                ? 'text-xl font-bold mb-4 text-center'
                : 'sr-only'
          }
        >
          {copy.title}
        </h2>
      ) : null}
      {copy.description ? (
        <p
          className={
            variant === 'band'
              ? 'text-xl text-blue-100 mb-12 max-w-2xl mx-auto'
              : variant === 'card'
                ? 'text-sm text-blue-100 mb-6 text-center'
                : 'text-sm text-gray-600 dark:text-gray-400 mb-4'
          }
        >
          {copy.description}
        </p>
      ) : null}

      {state === 'done' ? (
        success
      ) : (
        <form onSubmit={askConfirmation} className={variant === 'band' ? 'max-w-xl mx-auto' : ''} noValidate>
          <div className={variant === 'band' ? 'flex flex-col sm:flex-row gap-4' : 'flex flex-col gap-4'}>
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />
            <input
              type="email"
              required
              aria-label={copy.placeholder}
              placeholder={copy.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`flex-1 ${FIELD} ${variant === 'card' ? 'px-4 py-3' : ''}`}
            />
            <button
              type="submit"
              disabled={state === 'sending'}
              className={
                variant === 'card'
                  ? 'w-full bg-sari-lime text-sari-dark font-semibold py-3 hover:bg-white transition-colors rounded-lg disabled:opacity-60 inline-flex items-center justify-center gap-2'
                  : 'bg-sari-lime text-sari-dark px-8 py-4 font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2'
              }
            >
              {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {copy.submit}
            </button>
          </div>

          {topics.length ? (
            <fieldset className="mt-6">
              <legend className={dark ? 'text-sm text-blue-100 mb-3' : 'text-sm text-gray-600 mb-3'}>{t('topicsLabel')}</legend>
              <div className="flex flex-wrap justify-center gap-3">
                {topics.map((topic) => {
                  const on = picked.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      className={`cursor-pointer text-sm px-4 py-2 rounded-full border transition ${
                        on
                          ? 'bg-sari-lime text-sari-dark border-sari-lime font-semibold'
                          : dark
                            ? 'border-white/30 text-blue-50 hover:border-white/60'
                            : 'border-gray-300 text-gray-600 hover:border-sari-blue'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() =>
                          setPicked((prev) => (on ? prev.filter((id) => id !== topic.id) : [...prev, topic.id]))
                        }
                      />
                      {topic.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {requireConsent ? (
            <label className={`mt-6 flex items-start gap-3 text-sm ${dark ? 'text-blue-100' : 'text-gray-600'}`}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-gray-300"
              />
              <span>{t('consent')}</span>
            </label>
          ) : null}

          {copy.legal ? (
            <p className={`text-sm mt-4 ${dark ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'} ${variant === 'band' ? 'text-center' : ''}`}>
              {copy.legal}
            </p>
          ) : null}

          {state === 'error' && error ? (
            <p role="alert" className="text-sm mt-4 flex items-center justify-center gap-2 text-sari-yellow">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          ) : null}

          {children}
        </form>
      )}

      {showUnsubscribeLink ? (
        // Lien discret mais présent partout où le formulaire s'affiche : le
        // désabonnement ne doit pas être plus difficile à trouver que l'inscription.
        <p
          className={`text-xs mt-4 ${dark ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'} ${
            variant === 'band' ? 'text-center' : 'text-center sm:text-start'
          }`}
        >
          <Link
            href={`/${locale}/newsletter/unsubscribe${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
            className={`underline decoration-dotted underline-offset-4 ${dark ? 'hover:text-white' : 'hover:text-sari-blue'}`}
          >
            {t('unsubscribeLink')}
          </Link>
        </p>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          email={email}
          topics={topics}
          picked={picked}
          locale={locale}
          source={source}
          copy={modalCopy}
          titleId={`newsletter-confirm-${variant}-${source.replace(/[^a-z0-9]/gi, '')}`}
          onEmailChange={setEmail}
          onPickedChange={setPicked}
          onClose={() => setConfirming(false)}
          onDone={(status) => {
            setConfirming(false);
            setPendingStatus(status);
            setEmail('');
            setPicked([]);
            setState('done');
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Fenêtre de confirmation : relire l'adresse, ajouter un nom et une note
 * facultatifs, recopier le captcha en image, puis inscrire vraiment.
 *
 * Fermeture au clavier (Échap), au clic sur le fond, et retour du focus sur le
 * bouton qui l'a ouverte ; le code est dessiné par le serveur et d'un seul
 * usage, une mauvaise recopie en provoque un nouveau.
 */
function ConfirmDialog({
  email,
  topics,
  picked,
  locale,
  source,
  copy,
  titleId,
  onEmailChange,
  onPickedChange,
  onClose,
  onDone,
}: {
  email: string;
  topics: NewsletterTopic[];
  picked: string[];
  locale: string;
  source: string;
  copy: Copy;
  titleId: string;
  onEmailChange: (value: string) => void;
  onPickedChange: (values: string[]) => void;
  onClose: () => void;
  onDone: (status: NewsletterStatus) => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [captcha, setCaptcha] = useState<{ id: string; imageUrl: string } | null>(null);
  const [answer, setAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  /** Demande un code : à l'ouverture, sur « Nouveau code », et après une erreur. */
  const askQuestion = useCallback(async () => {
    setLoadingCaptcha(true);
    const issue = await fetchNewsletterCaptcha();
    // Une réponse vide (serveur injoignable) laisse la fenêtre utilisable : le
    // bouton de reprise permet de redemander sans tout recharger.
    setCaptcha((current) => (issue ? issue : current));
    setAnswer('');
    setCaptchaError('');
    setLoadingCaptcha(false);
  }, []);

  useEffect(() => {
    void askQuestion();
  }, [askQuestion]);

  // Fermeture, verrou du défilement et retour du focus : montés une seule fois,
  // pour qu'un simple changement d'état dans la fenêtre ne redemande pas de
  // code anti-spam ni ne vole le focus du champ en cours de saisie.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Le dialogue est centré sur le contenu ; on limite la hauteur pour que les
  // boutons restent visibles sur un petit écran.
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!captcha) {
      void askQuestion();
      return;
    }
    setSending(true);
    setNotice('');
    setCaptchaError('');
    const result = await subscribeToNewsletter({
      email: email.trim(),
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
      locale,
      source,
      consent: true,
      topics: topics.length ? picked : undefined,
      captchaId: captcha.id,
      captchaAnswer: answer,
    });
    setSending(false);
    if (!result.ok) {
      if (result.status === 'captcha-failed') {
        setCaptchaError(copy.captchaWrong);
        void askQuestion();
      } else {
        setNotice(result.message || copy.error);
      }
      return;
    }
    const status = result.status || 'created';
    if (status === 'already-subscribed') {
      // L'adresse est déjà de la liste : on le dit, et on laisse la possibilité
      // d'en saisir une autre sans quitter la fenêtre.
      setNotice(copy.alreadySubscribed);
      return;
    }
    onDone(status);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-sari-dark/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white text-sari-dark rounded-lg shadow-2xl animate-fade-in-up"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <span className="w-14 h-14 rounded-full bg-sari-blue/10 flex items-center justify-center flex-shrink-0">
              <ShieldQuestion className="w-7 h-7 text-sari-blue" />
            </span>
            <div className="min-w-0">
              <h3 id={titleId} className="text-2xl font-bold leading-tight">
                {copy.title}
              </h3>
              <p className="text-sm text-gray-600 mt-2 break-words">{copy.intro}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm bg-sari-gray rounded-lg px-4 py-3 mb-6">
            <span className="font-semibold truncate">{email}</span>
            <button
              type="button"
              className="ms-auto inline-flex items-center gap-1 text-sari-blue hover:underline"
              onClick={onClose}
            >
              <Pencil className="w-3.5 h-3.5" /> {copy.editEmail}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            {topics.length ? (
              <fieldset>
                <legend className="text-sm font-semibold mb-2">{copy.topicsLabel}</legend>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => {
                    const on = picked.includes(topic.id);
                    return (
                      <label
                        key={topic.id}
                        className={`cursor-pointer text-sm px-3 py-1.5 rounded-full border transition ${
                          on ? 'bg-sari-blue text-white border-sari-blue' : 'border-gray-300 text-gray-600 hover:border-sari-blue'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            onPickedChange(on ? picked.filter((value) => value !== topic.id) : [...picked, topic.id])
                          }
                        />
                        {topic.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div>
              <label htmlFor={`${id}-name`} className="block text-sm font-semibold mb-2">
                {copy.nameLabel}
              </label>
              <input
                ref={firstFieldRef}
                id={`${id}-name`}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.namePlaceholder}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sari-blue/40"
              />
            </div>

            <div>
              <label htmlFor={`${id}-notes`} className="block text-sm font-semibold mb-2">
                {copy.notesLabel}
              </label>
              <textarea
                id={`${id}-notes`}
                rows={3}
                value={notes}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={copy.notesPlaceholder}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sari-blue/40 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label htmlFor={`${id}-captcha`} className="block text-sm font-semibold">
                  {copy.captchaLabel}
                </label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-sari-blue hover:underline"
                  onClick={() => void askQuestion()}
                  disabled={loadingCaptcha}
                >
                  {loadingCaptcha ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-3.5 h-3.5" />
                  )}
                  {copy.newQuestion}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2" id={`${id}-captcha-help`}>
                {copy.captchaHelp}
              </p>
              {captcha ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Le code n'existe que dans cette image : rien dans le HTML,
                      rien dans l'`alt`, rien dans la réponse JSON de l'émission.
                      Un rechargement montre le même code tant que le jeton vit. */}
                  <img
                    src={captcha.imageUrl}
                    alt={copy.captchaImageAlt}
                    width={200}
                    height={68}
                    onClick={() => void askQuestion()}
                    title={copy.newQuestion}
                    className="rounded-lg border border-gray-200 cursor-pointer flex-shrink-0 self-center sm:self-start"
                  />
                  <input
                    id={`${id}-captcha`}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={copy.captchaPlaceholder}
                    aria-describedby={`${id}-captcha-help`}
                    aria-invalid={captchaError ? 'true' : undefined}
                    className="sm:flex-1 px-4 py-3 rounded-lg border border-gray-300 font-mono tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-sari-blue/40"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-gray-500 inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {copy.captchaLoading}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-sari-blue hover:underline disabled:opacity-60"
                    onClick={() => void askQuestion()}
                    disabled={loadingCaptcha}
                  >
                    {copy.captchaRetry}
                  </button>
                </div>
              )}
              {captchaError ? (
                <p role="alert" className="text-sm mt-2 text-red-600 inline-flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {captchaError}
                </p>
              ) : null}
            </div>

            {notice ? (
              <p
                role="status"
                className="text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3"
              >
                {notice}
              </p>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                className="sm:w-auto w-full px-6 py-3 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-sari-gray transition-colors"
                onClick={onClose}
                disabled={sending}
              >
                {copy.cancelCta}
              </button>
              <button
                type="submit"
                disabled={sending || !captcha}
                className="sm:flex-1 w-full bg-sari-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-sari-dark transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {sending ? copy.sendingCta : copy.confirmCta}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
