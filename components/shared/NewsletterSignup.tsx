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
 * - champ piège (`website`) rempli par les robots → la demande est ignorée ;
 * - une adresse déjà désinscrite est réactivée plutôt que dupliquée ;
 * - message de confirmation propre à la langue de la page.
 */
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle, Loader2, Mail, Send } from 'lucide-react';
import { subscribeToNewsletter } from '@/lib/newsletter-admin';

export type NewsletterVariant = 'band' | 'card' | 'inline';

export interface NewsletterTopic {
  id: string;
  label: string;
}

interface NewsletterSignupProps {
  /** Bloc d'origine enregistré avec l'adresse : `home.newsletter`, `news.detail`, `footer`… */
  source: string;
  variant?: NewsletterVariant;
  /** Libellés personnalisés saisis dans le studio ; les tradutions du site servent de repli. */
  labels?: Partial<Record<'title' | 'description' | 'placeholder' | 'submit' | 'legal' | 'successTitle' | 'successDesc' | 'error', string>>;
  topics?: NewsletterTopic[];
  /** Cases à cocher : le consentement explicite est enregistré avec l'adresse. */
  requireConsent?: boolean;
  /** Double opt-in : on prévient qu'un courriel de confirmation va suivre. */
  doubleOptIn?: boolean;
  className?: string;
  /** Petits textes additionnels affichés sous le champ (bandeau de confiance). */
  children?: React.ReactNode;
}

const FIELD = 'px-6 py-4 rounded-lg text-sari-dark bg-white focus:outline-none focus:ring-4 focus:ring-sari-lime/50';

export default function NewsletterSignup({
  source,
  variant = 'band',
  labels = {},
  topics = [],
  requireConsent = false,
  doubleOptIn = false,
  className = '',
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

  const submit = async (event: React.FormEvent) => {
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
    setState('sending');
    setError('');
    const result = await subscribeToNewsletter({
      email: email.trim(),
      locale,
      source,
      consent: true,
      topics: topics.length ? picked : undefined,
    });
    if (!result.ok) {
      setState('error');
      setError(result.message || copy.error);
      return;
    }
    setEmail('');
    setPicked([]);
    setState('done');
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
          {doubleOptIn ? t('checkYourInbox') : copy.successDesc}
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
        <form onSubmit={submit} className={variant === 'band' ? 'max-w-xl mx-auto' : ''} noValidate>
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
    </div>
  );
}
