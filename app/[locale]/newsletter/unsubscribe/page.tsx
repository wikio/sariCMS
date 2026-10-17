// app/[locale]/newsletter/unsubscribe/page.tsx
'use client';

/**
 * Désabonnement de la newsletter, côté vitrine.
 *
 * Deux entrées possibles : le lien personnel reçu par courriel (`?token=`, qui
 * n'exige pas de retaper son adresse) ou la page atteinte depuis le petit lien
 * du bloc newsletter, avec l'adresse à saisir (`?email=` pré-remplit le champ).
 *
 * Le visiteur choisit ensuite un motif et peut ajouter un commentaire. Le motif
 * est enregistré sous forme de code court, la note en texte libre : les deux
 * arrivent tels quels dans la fiche de l'abonné et dans l'export CSV, ce qui est
 * la seule façon de savoir pourquoi une liste se vide.
 *
 * Une adresse absente de la liste renvoie « introuvable » sans laisser croire
 * qu'une inscription a été effacée. Aucun captcha ici : la requête ne crée rien,
 * et le débit est déjà limité côté serveur.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle, Loader2, MailX } from 'lucide-react';
import { unsubscribeFromNewsletter } from '@/lib/newsletter-admin';
import { UNSUBSCRIBE_REASONS } from '@/lib/newsletter-reasons';

export default function NewsletterUnsubscribePage() {
  const locale = useLocale();
  const t = useTranslations('pages.newsletterUnsubscribe');
  const tr = useTranslations('common.newsletterReasons');
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const presetEmail = searchParams?.get('email') || '';

  const [email, setEmail] = useState(presetEmail);
  const [reason, setReason] = useState<string>(UNSUBSCRIBE_REASONS[0]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  const needsEmail = useMemo(() => !token, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (needsEmail && !/.+@.+\..+/.test(email.trim())) {
      setError(t('emailRequired'));
      return;
    }
    setSending(true);
    setError('');
    setMissing(false);
    const result = await unsubscribeFromNewsletter({
      ...(token ? { token } : { email: email.trim() }),
      locale,
      reason,
      reasonNote: note.trim() || undefined,
    });
    setSending(false);
    if (!result.ok) {
      setError(t('error'));
      return;
    }
    if (result.status === 'not-found') {
      setMissing(true);
      return;
    }
    setDone(true);
  };

  return (
    <main className="bg-sari-gray dark:bg-sari-dark min-h-[70vh] py-16 sm:py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-xl mx-auto bg-white dark:bg-sari-dark rounded-lg shadow-lg p-6 sm:p-10">
          {done ? (
            <div className="text-center space-y-4" role="status">
              <span className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </span>
              <h1 className="text-2xl font-bold text-sari-dark dark:text-white">{t('doneTitle')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('doneDesc')}</p>
              <Link
                href={`/${locale}`}
                className="inline-block bg-sari-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-sari-dark transition-colors"
              >
                {t('backHome')}
              </Link>
            </div>
          ) : (
            <>
              <span className="w-14 h-14 rounded-full bg-sari-blue/10 flex items-center justify-center mb-5">
                <MailX className="w-7 h-7 text-sari-blue" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-sari-dark dark:text-white">{t('title')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{t('intro')}</p>

              <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
                {needsEmail ? (
                  <div>
                    <label htmlFor="unsub-email" className="block text-sm font-semibold mb-2 text-sari-dark dark:text-white">
                      {t('emailLabel')}
                    </label>
                    <input
                      id="unsub-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-sari-blue/40"
                    />
                  </div>
                ) : (
                  <p className="text-sm rounded-lg bg-sari-gray px-4 py-3 text-gray-600 dark:text-gray-300">
                    {t('recognized')}
                  </p>
                )}

                <fieldset>
                  <legend className="block text-sm font-semibold mb-3 text-sari-dark dark:text-white">
                    {t('reasonLabel')}
                  </legend>
                  <div className="space-y-2">
                    {UNSUBSCRIBE_REASONS.map((code) => (
                      <label
                        key={code}
                        className={`flex items-start gap-3 text-sm px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                          reason === code
                            ? 'border-sari-blue bg-sari-blue/5'
                            : 'border-gray-200 hover:border-sari-blue'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={code}
                          checked={reason === code}
                          onChange={() => setReason(code)}
                          className="mt-0.5 w-4 h-4"
                        />
                        <span className="text-sari-dark dark:text-gray-100">{tr.has(code) ? tr(code) : code}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="unsub-note" className="block text-sm font-semibold mb-2 text-sari-dark dark:text-white">
                    {t('noteLabel')}
                  </label>
                  <textarea
                    id="unsub-note"
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('notePlaceholder')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-sari-blue/40 resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('noteHint')}</p>
                </div>

                {missing ? (
                  <p role="alert" className="text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {t('notFound')}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-sari-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-sari-dark transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <MailX className="w-5 h-5" />}
                  {sending ? t('sendingCta') : t('submitCta')}
                </button>

                <p className="text-xs text-gray-500 text-center">{t('privacy')}</p>
              </form>

              <p className="text-sm text-gray-600 dark:text-gray-300 mt-8 pt-6 border-t border-gray-200 text-center">
                {t('again')}{' '}
                <Link href={`/${locale}#newsletter`} className="text-sari-blue font-semibold hover:underline">
                  {t('againCta')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
