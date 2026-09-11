'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ServerCaptchaProps {
  onChange?: (ok: boolean) => void;
  className?: string;
  dark?: boolean;
  locale?: string;
}

export default function ServerCaptcha({
  onChange,
  className = '',
  dark = false,
  locale = 'fr',
}: ServerCaptchaProps) {
  const t = useTranslations('components.ServerCaptcha');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaImageUrl, setCaptchaImageUrl] = useState<string>('');
  const [input, setInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  const fetchCaptcha = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contact/captcha', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCaptchaId(data.id);
        setCaptchaImageUrl(data.imageUrl);
        setInput('');
        setVerified(false);
        onChange?.(false);
      }
    } catch {
      // silencieux, on réessaiera au clic sur refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    fetchCaptcha();
  }, []);

  const handleVerify = async () => {
    if (!captchaId || !input.trim()) return;
    try {
      const res = await fetch('/api/contact/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaId, captchaAnswer: input }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setVerified(true);
          onChange?.(true);
          return;
        }
      }
    } catch {
      // ignoré
    }
    // Échec : nouveau captcha
    fetchCaptcha();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInput(v);
    if (v.length >= 5) {
      handleVerify();
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
          ) : (
            <img
              src={captchaImageUrl}
              alt="CAPTCHA"
              width="120"
              height="44"
              style={{ display: 'block' }}
            />
          )}
        </button>
        <input
          className="ad-input flex-1 uppercase tracking-[0.3em] font-bold text-center"
          value={input}
          onChange={handleInputChange}
          placeholder="CODE"
          aria-label="Saisir le code affiché"
          disabled={loading || verified}
        />
        <button
          type="button"
          className="ad-btn ad-btn-icon ad-btn-ghost shrink-0"
          onClick={fetchCaptcha}
          disabled={loading}
          title={t('refresh')}
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