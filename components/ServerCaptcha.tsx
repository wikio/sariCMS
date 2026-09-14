'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[ServerCaptcha]', ...args);
const logError = (...args: unknown[]) => DEBUG && console.error('[ServerCaptcha ERROR]', ...args);

interface ServerCaptchaProps {
  onChange?: (ok: boolean) => void;
  /** Appelé à chaque changement d'id/valeur — permet au parent d'envoyer le captcha au serveur lors du submit (audit C1). */
  onCaptchaData?: (data: { id: string; value: string }) => void;
  /** Si true (défaut), vérifie automatiquement côté serveur quand 5 caractères sont saisis (contact, newsletter). Si false, la vérification est déléguée au parent (login admin). */
  autoVerify?: boolean;
  className?: string;
  dark?: boolean;
  locale?: string;
  /** Endpoint API captcha (ex: '/api/contact/captcha', '/api/admin/auth/captcha') */
  endpoint?: string;
}

export default function ServerCaptcha({
  onChange,
  onCaptchaData,
  autoVerify = true,
  className = '',
  dark = false,
  locale = 'fr',
  endpoint = '/api/contact/captcha',
}: ServerCaptchaProps) {
  const t = useTranslations('components.ServerCaptcha');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaImageUrl, setCaptchaImageUrl] = useState<string>('');
  const [input, setInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  const verifyEndpoint = endpoint.replace('/captcha', '/verify-captcha');
  log('Init:', { endpoint, verifyEndpoint });

  const fetchCaptcha = async () => {
    log('Fetching captcha from:', endpoint);
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
      log('Fetch response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        log('Fetch response data:', data);
        if (data.id && data.imageUrl) {
          setCaptchaId(data.id);
          setCaptchaImageUrl(data.imageUrl);
          setInput('');
          setVerified(false);
          onChange?.(false);
          onCaptchaData?.({ id: data.id, value: '' });
          log('Captcha loaded successfully');
        } else {
          logError('Réponse invalide - missing id or imageUrl:', data);
          setCaptchaImageUrl('');
        }
      } else {
        const text = await res.text();
        logError('Erreur HTTP:', res.status, text);
        setCaptchaImageUrl('');
      }
    } catch (err) {
      logError('Erreur réseau:', err);
      setCaptchaImageUrl('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    log('Mounted, fetching initial captcha');
    fetchCaptcha();
  }, [endpoint]);

  const handleVerify = async () => {
    log('Verifying captcha:', { captchaId, input: input.trim() });
    if (!captchaId || !input.trim()) return;
    try {
      const res = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ captchaId, captchaAnswer: input }),
      });
      log('Verify response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        log('Verify response data:', data);
        if (data.ok) {
          setVerified(true);
          onChange?.(true);
          log('Captcha verified successfully');
          return;
        }
      } else {
        const text = await res.text();
        logError('Vérification échouée:', res.status, text);
      }
    } catch (err) {
      logError('Erreur vérification:', err);
    }
    log('Verification failed, NOT auto-refreshing (user must click refresh button)');
    // NE PAS auto-régénérer : l'utilisateur clique sur le bouton refresh s'il veut réessayer
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setInput(v);
    onCaptchaData?.({ id: captchaId, value: v });
    // En mode autoVerify (contact/newsletter) on vérifie immédiatement côté serveur.
    // En mode deferVerify (admin login) on laisse le parent envoyer id+value au serveur lors du POST /login,
    // afin d'éviter une double consommation (verify endpoint supprime l'entrée) et garantir
    // une vérification atomique avec les identifiants (audit C1).
    if (autoVerify && v.length === 5) {
      handleVerify();
    } else if (!autoVerify) {
      // Mode admin : on considère "ok" dès que 5 caractères sont saisis,
      // la vraie vérification sera faite côté serveur lors du login.
      if (v.length === 5) {
        onChange?.(true);
      } else if (v.length < 5) {
        onChange?.(false);
        if (verified) setVerified(false);
      }
    }
  };

  const ink = dark ? '#0b1220' : '#111111';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={fetchCaptcha}
          disabled={loading}
          title={t('refresh')}
          className="shrink-0 overflow-hidden"
          style={{ borderRadius: 'var(--ad-radius-sm, 8px)', border: '1px solid var(--ad-line, #e3eef2)' }}
        >
          {loading ? (
            <svg width="120" height="44" viewBox="0 0 120 44" role="img" aria-label="Chargement">
              <rect width="120" height="44" fill="#f2f7fb" />
              <text x="60" y="28" textAnchor="middle" fontSize="14" fill="#64748b" fontFamily="sans-serif">
                Chargement...
              </text>
            </svg>
          ) : captchaImageUrl ? (
            <img
              src={captchaImageUrl}
              alt="CAPTCHA"
              width="120"
              height="44"
              style={{ display: 'block' }}
            />
          ) : (
            <svg width="120" height="44" viewBox="0 0 120 44" role="img" aria-label="CAPTCHA indisponible">
              <rect width="120" height="44" fill="#fef2f2" />
              <text x="60" y="28" textAnchor="middle" fontSize="12" fill="#dc2626" fontFamily="sans-serif">
                Erreur chargement
              </text>
              <text x="60" y="40" textAnchor="middle" fontSize="10" fill="#991b1b" fontFamily="sans-serif">
                Cliquer pour réessayer
              </text>
            </svg>
          )}
        </button>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="ad-input flex-1 uppercase tracking-[0.3em] font-bold text-center bg-white dark:bg-[#1a1a1a] !border-2 !border-sari-blue/30 focus:!border-sari-blue focus:!ring-2 focus:!ring-sari-blue/20 shadow-sm"
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="CODE"
          aria-label="Saisir le code affiché"
          disabled={loading || verified}
          maxLength={5}
          style={{ borderColor: 'rgb(var(--color-sari-blue) / 0.3)' }}
        />
        <button
          type="button"
          className="ad-btn ad-btn-icon ad-btn-ghost shrink-0 w-11 h-11 flex items-center justify-center self-stretch"
          onClick={fetchCaptcha}
          disabled={loading}
          title={t('refresh')}
          aria-label={t('refresh')}
          style={{ borderRadius: 'var(--ad-radius-sm, 8px)', border: '1px solid var(--ad-line, #e3eef2)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {verified && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          {t('verified')}
        </p>
      )}
    </div>
  );
}