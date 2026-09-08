'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { checkPassword, generatePassword, PASSWORD_MIN } from '@/lib/password-tools';

/**
 * Champ mot de passe du back-office : saisie masquée, génération conforme,
 * copie et contrôle des règles en direct.
 *
 * Le formulaire précédent envoyait le mot de passe tel quel et laissait le
 * serveur refuser avec un message technique en anglais
 * (« password must contain an uppercase letter »). Les règles sont désormais
 * affichées, cochées à la frappe, et la génération produit toujours une
 * valeur acceptée.
 */
export default function PasswordField({
  value,
  onChange,
  onValidChange,
  required = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onValidChange?: (valid: boolean) => void;
  /** Création de compte : le mot de passe est exigé. En édition il est facultatif. */
  required?: boolean;
  id?: string;
}) {
  const t = useTranslations('admin.userForm');
  const [visible, setVisible] = useState(false);
  const [copie, setCopie] = useState(false);

  const analyse = checkPassword(value);
  // En édition, un champ vide signifie « ne pas changer le mot de passe » :
  // il ne doit donc pas être signalé en erreur.
  const enErreur = value.length > 0 ? !analyse.valid : required;

  const appliquer = (v: string) => {
    onChange(v);
    onValidChange?.(v.length === 0 ? !required : checkPassword(v).valid);
  };

  const generer = () => {
    const mdp = generatePassword(14);
    appliquer(mdp);
    setVisible(true);
    copier(mdp);
  };

  const copier = async (v: string) => {
    try {
      await navigator.clipboard?.writeText(v);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* Presse-papiers indisponible (contexte non sécurisé) : sans gravité. */
    }
  };

  const couleurs: Record<string, string> = {
    empty: 'var(--ad-muted)',
    weak: '#dc2626',
    medium: '#d97706',
    strong: 'var(--ad-ok)',
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/*
          Boutons logés dans le champ : `ad-affix-btn` les dimensionne (1,9 rem)
          pour laisser un jour avec la bordure, et `end-1`/`end-2` réserve
          exactement la place occupée. Les boutons `ad-btn-icon` employés
          auparavant étaient plus hauts que l'espace disponible et mordaient
          sur le cadre.
        */}
        <div className={`ad-affix flex-1 ${value ? 'end-2' : 'end-1'}`}>
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            className="ad-input font-mono"
            style={enErreur && value.length > 0 ? { borderColor: '#dc2626' } : undefined}
            value={value}
            autoComplete="new-password"
            placeholder={required ? t('passwordPlaceholder') : t('passwordKeepPlaceholder')}
            onChange={(e) => appliquer(e.target.value)}
          />
          <span className="ad-affix-end">
            {value && (
              <button
                type="button"
                className="ad-affix-btn"
                title={t('copyPassword')}
                onClick={() => copier(value)}
              >
                {copie ? <Check style={{ color: 'var(--ad-ok)' }} /> : <Copy />}
              </button>
            )}
            <button
              type="button"
              className="ad-affix-btn"
              title={visible ? t('hidePassword') : t('showPassword')}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </button>
          </span>
        </div>
        <button type="button" className="ad-btn ad-btn-ghost whitespace-nowrap" onClick={generer}>
          <RefreshCw className="w-4 h-4" /> {t('generate')}
        </button>
      </div>

      {value && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ad-surface-2)' }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${(analyse.score / 6) * 100}%`, background: couleurs[analyse.level] }}
              />
            </div>
            <span className="text-xs font-bold" style={{ color: couleurs[analyse.level] }}>
              {t(`strength.${analyse.level}`)}
            </span>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {analyse.rules.map((r) => (
              <li
                key={r.key}
                className="text-xs flex items-center gap-1"
                style={{ color: r.ok ? 'var(--ad-ok)' : 'var(--ad-muted)' }}
              >
                {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {t(`rule.${r.key}`, { min: PASSWORD_MIN })}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
