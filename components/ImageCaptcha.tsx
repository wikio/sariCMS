'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return out;
}

/** Hash déterministe d'une chaîne → pseudo-aléatoire stable (pour dessiner le SVG). */
function seeded(seed: string, i: number): number {
  let h = 2166136261;
  for (let j = 0; j < seed.length; j++) h = Math.imul(h ^ seed.charCodeAt(j), 16777619);
  h = Math.imul(h ^ i, 16777619);
  return (h >>> 0) / 4294967295;
}

/**
 * CAPTCHA « image » : un code aléatoire rendu dans un SVG déformé (rotation,
 * bruit, lignes parasites). Généré côté client uniquement (aucune divergence
 * SSR). Le composant expose une API impérative via `onReady` pour la validation.
 */
export default function ImageCaptcha({
  onReady,
  onChange,
  className = '',
  dark = false,
}: {
  onReady?: (api: { verify: (v: string) => boolean; refresh: () => void }) => void;
  onChange?: (ok: boolean) => void;
  className?: string;
  dark?: boolean;
}) {
  const t = useTranslations('components.ImageCaptcha');
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const mounted = useRef(false);

  const generate = () => {
    const c = randomCode(5);
    setCode(c);
    setInput('');
    onChange?.(false);
  };

  useEffect(() => {
    mounted.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    onReady?.({
      verify: (v) => v.trim().toUpperCase() === code,
      refresh: generate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const ink = dark ? '#0b1220' : '#111111';
  const bg = dark ? '#e8f0ff' : '#f2f7fb';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={generate}
          title="Générer un nouveau code"
          className="shrink-0 overflow-hidden"
          style={{ borderRadius: 'var(--ad-radius-sm, 8px)', border: '1px solid var(--ad-line, #e3eef2)' }}
        >
          <svg width="120" height="44" viewBox="0 0 120 44" role="img" aria-label="CAPTCHA">
            <rect width="120" height="44" fill={bg} />
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={`l${i}`}
                x1={seeded(code, i) * 120}
                y1={seeded(code, i + 10) * 44}
                x2={seeded(code, i + 20) * 120}
                y2={seeded(code, i + 30) * 44}
                stroke={ink}
                strokeOpacity={0.25}
                strokeWidth={1.2}
              />
            ))}
            {Array.from({ length: 40 }).map((_, i) => (
              <circle
                key={`d${i}`}
                cx={seeded(code, i + 40) * 120}
                cy={seeded(code, i + 80) * 44}
                r={0.8}
                fill={ink}
                fillOpacity={0.35}
              />
            ))}
            {code.split('').map((ch, i) => {
              const x = 14 + i * 22;
              const y = 29 + (seeded(code, i + 100) - 0.5) * 10;
              const rot = (seeded(code, i + 200) - 0.5) * 40;
              return (
                <text
                  key={`c${i}`}
                  x={x}
                  y={y}
                  fill={ink}
                  fontSize={22}
                  fontWeight={800}
                  fontFamily="monospace"
                  transform={`rotate(${rot.toFixed(1)} ${x} ${y})`}
                >
                  {ch}
                </text>
              );
            })}
          </svg>
        </button>
        <input
          className="ad-input flex-1 uppercase tracking-[0.3em] font-bold text-center"
          value={input}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
            setInput(v);
            onChange?.(v.trim() === code);
          }}
          placeholder="CODE"
          aria-label="Saisir le code affiché"
        />
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost shrink-0" onClick={generate} title={t("refresh")}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
