export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
}

export interface DbSettings {
  driver: 'mysql' | 'postgresql' | 'mongodb' | 'json';
  url: string;
  schema: string;
}

export interface SecuritySettings {
  admin2fa: boolean;
  adminCaptcha: boolean;
  siteCaptcha: boolean;
}

export interface QuoteSettings {
  /** Nombre maximal de lignes par demande de devis (0 = illimité). */
  maxLines: number;
  /** Transformer automatiquement un devis « accepté » en commande. */
  autoTransformToOrder: boolean;
  /** Durée de validité d'un devis (en jours) avant expiration. */
  validityDays: number;
  /** Pièce jointe obligatoire pour les lignes hors-catalogue. */
  requireAttachment: boolean;
}

export interface AdminSettings {
  defaultLocale: 'fr' | 'en' | 'ar';
  skuFormat: string;
  cropWidth: number;
  cropHeight: number;
  restockMessage: string;
  /** Connexion requise par défaut pour postuler à une offre d'emploi. */
  requireAuthToApply: boolean;
  security: SecuritySettings;
  smtp: SmtpSettings;
  db: DbSettings;
  quote: QuoteSettings;
}

const KEY = 'sari_admin_settings';

export const DEFAULT_SETTINGS: AdminSettings = {
  defaultLocale: 'fr',
  skuFormat: 'PRO-{ID}',
  cropWidth: 800,
  cropHeight: 600,
  restockMessage: 'Votre commande sera traitée dans les meilleurs délais, un nouvel arrivage étant prévu le {{date_reapprovisionnement}}.',
  requireAuthToApply: false,
  security: {
    admin2fa: false,
    adminCaptcha: true,
    siteCaptcha: true,
  },
  smtp: {
    host: 'smtp.sarisysteme.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: 'SARI Système <noreply@sarisysteme.com>',
    replyTo: 'contact@sarisysteme.com',
  },
  db: {
    driver: 'mysql',
    url: 'mysql://user:pass@127.0.0.1:3306/saricms',
    schema: 'public',
  },
  quote: {
    maxLines: 100,
    autoTransformToOrder: true,
    validityDays: 30,
    requireAttachment: false,
  },
};

export function loadAdminSettings(): AdminSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
      smtp: { ...DEFAULT_SETTINGS.smtp, ...(parsed.smtp || {}) },
      db: { ...DEFAULT_SETTINGS.db, ...(parsed.db || {}) },
      quote: { ...DEFAULT_SETTINGS.quote, ...(parsed.quote || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAdminSettings(next: AdminSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function nextSku(format = loadAdminSettings().skuFormat): string {
  const n = Number(typeof window !== 'undefined' ? localStorage.getItem('sari_sku_seq') : 0) + 1;
  if (typeof window !== 'undefined') localStorage.setItem('sari_sku_seq', String(n));
  return format.replace('{ID}', String(n).padStart(5, '0'));
}
