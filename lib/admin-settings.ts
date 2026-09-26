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

export interface CodeFormats {
  /** Format du numéro de devis (ex. SARI-WDEV-{ID}). */
  quote: string;
  /** Format du numéro de commande (ex. SARI-WCMD{XX}-{ID}). */
  order: string;
  /** Format du numéro de facture (ex. SARI-WFAV{XX}-{ID}). */
  invoice: string;
  /** Format du code produit / SKU (ex. SARI-WPRO{XX}-{ID}). */
  product: string;
}

export interface ErpSettings {
  /** ERP externe activé (facturation par API). */
  enabled: boolean;
  /** URL de base de l'API ERP. */
  apiUrl: string;
  /** Clé d'API / jeton d'authentification. */
  apiKey: string;
}

export interface InvoicingSettings {
  /** Une commande doit être confirmée + payée avant de lier une facture. */
  requirePaidToInvoice: boolean;
  /** Tenter automatiquement la récupération de facture par API. */
  autoFetchInvoice: boolean;
}

export interface DateSettings {
  /**
   * Format d'affichage des dates. Soit un préréglage (`short`, `medium`,
   * `long`, `full`, `iso`), soit un motif libre composé de jetons
   * (`DD/MM/YYYY HH:mm`). Voir `lib/date-format.ts`.
   */
  format: string;
  /** Motif utilisé quand la valeur porte aussi une heure. */
  dateTimeFormat: string;
  /** Afficher l'heure lorsque la valeur en contient une. */
  showTime: boolean;
}

export interface AdminSettings {
  defaultLocale: 'fr' | 'en' | 'ar';
  skuFormat: string;
  /** Format d'affichage des dates, admin et vitrine. */
  dates: DateSettings;
  cropWidth: number;
  cropHeight: number;
  restockMessage: string;
  /** Logo du site vitrine (URL). Surcharge le logo configuré dans les données du site. */
  siteLogo: string;
  /** Connexion requise par défaut pour postuler à une offre d'emploi. */
  requireAuthToApply: boolean;
  security: SecuritySettings;
  smtp: SmtpSettings;
  db: DbSettings;
  quote: QuoteSettings;
  codes: CodeFormats;
  erp: ErpSettings;
  invoicing: InvoicingSettings;
}

const KEY = 'sari_admin_settings';

export const DEFAULT_SETTINGS: AdminSettings = {
  defaultLocale: 'fr',
  skuFormat: 'PRO-{ID}',
  dates: {
    format: 'medium',
    dateTimeFormat: 'medium',
    showTime: true,
  },
  cropWidth: 800,
  cropHeight: 600,
  restockMessage: 'Votre commande sera traitée dans les meilleurs délais, un nouvel arrivage étant prévu le {{date_reapprovisionnement}}.',
  siteLogo: '',
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
  codes: {
    quote: 'SARI-WDEV-{ID}',
    order: 'SARI-WCMD{XX}-{ID}',
    invoice: 'SARI-WFAV{XX}-{ID}',
    product: 'SARI-WPRO{XX}-{ID}',
  },
  erp: {
    enabled: false,
    apiUrl: '',
    apiKey: '',
  },
  invoicing: {
    requirePaidToInvoice: true,
    autoFetchInvoice: false,
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
      dates: { ...DEFAULT_SETTINGS.dates, ...(parsed.dates || {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
      smtp: { ...DEFAULT_SETTINGS.smtp, ...(parsed.smtp || {}) },
      db: { ...DEFAULT_SETTINGS.db, ...(parsed.db || {}) },
      quote: { ...DEFAULT_SETTINGS.quote, ...(parsed.quote || {}) },
      codes: { ...DEFAULT_SETTINGS.codes, ...(parsed.codes || {}) },
      erp: { ...DEFAULT_SETTINGS.erp, ...(parsed.erp || {}) },
      invoicing: { ...DEFAULT_SETTINGS.invoicing, ...(parsed.invoicing || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAdminSettings(next: AdminSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function nextSku(format = loadAdminSettings().codes.product): string {
  const n = Number(typeof window !== 'undefined' ? localStorage.getItem('sari_sku_seq') : 0) + 1;
  if (typeof window !== 'undefined') localStorage.setItem('sari_sku_seq', String(n));
  const y = new Date().getFullYear();
  const yy = String(y % 100).padStart(2, '0');
  return format
    .replace(/\{XX\}/g, yy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{ID\}/g, String(n).padStart(5, '0'));
}
