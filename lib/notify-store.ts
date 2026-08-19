export interface NotifyMessage {
  id: string;
  name: string;
  trigger: string;
  subject: string;
  body: string;
  active: boolean;
  locale: string;
}

export const MERGE_VARS = [
  { key: '{{nom_societe}}', label: 'Nom société' },
  { key: '{{adresse_societe}}', label: 'Adresse société' },
  { key: '{{telephone_societe}}', label: 'Téléphone société' },
  { key: '{{email_societe}}', label: 'E-mail société' },
  { key: '{{nom_client}}', label: 'Nom client' },
  { key: '{{email_client}}', label: 'E-mail client' },
  { key: '{{numero_commande}}', label: 'N° commande' },
  { key: '{{numero_devis}}', label: 'N° devis' },
  { key: '{{montant_ttc}}', label: 'Montant TTC' },
  { key: '{{date_reapprovisionnement}}', label: 'Date réappro' },
  { key: '{{produit}}', label: 'Produit' },
];

export const TRIGGERS = [
  { value: 'stock_backorder', label: 'Dépassement de stock / réappro' },
  { value: 'order_confirmed', label: 'Commande confirmée' },
  { value: 'order_shipped', label: 'Commande expédiée' },
  { value: 'order_delivered', label: 'Commande livrée' },
  { value: 'quote_sent', label: 'Devis envoyé' },
  { value: 'quote_accepted', label: 'Devis accepté' },
  { value: 'coupon_applied', label: 'Coupon appliqué' },
  { value: 'welcome', label: 'Bienvenue client' },
];

const KEY = 'sari_notify_messages';

const DEFAULT_MESSAGES: NotifyMessage[] = [
  {
    id: 'm1',
    name: 'Réapprovisionnement prévu',
    trigger: 'stock_backorder',
    subject: 'Votre commande {{numero_commande}} sera traitée dès réapprovisionnement',
    body: '<p>Bonjour {{nom_client}},</p><p>Le produit <strong>{{produit}}</strong> est temporairement en rupture. Un nouvel arrivage est prévu le <strong>{{date_reapprovisionnement}}</strong>. Votre commande {{numero_commande}} sera traitée dans les meilleurs délais.</p><p>{{nom_societe}} · {{telephone_societe}}</p>',
    active: true,
    locale: 'fr',
  },
  {
    id: 'm2',
    name: 'Confirmation de commande',
    trigger: 'order_confirmed',
    subject: 'Confirmation de votre commande {{numero_commande}}',
    body: '<p>Bonjour {{nom_client}},</p><p>Nous avons bien reçu votre commande <strong>{{numero_commande}}</strong> d’un montant de {{montant_ttc}}.</p><p>{{nom_societe}}</p>',
    active: true,
    locale: 'fr',
  },
  {
    id: 'm3',
    name: 'Devis envoyé',
    trigger: 'quote_sent',
    subject: 'Votre devis {{numero_devis}}',
    body: '<p>Bonjour {{nom_client}},</p><p>Veuillez trouver ci-joint votre devis {{numero_devis}} d’un montant de {{montant_ttc}}.</p>',
    active: true,
    locale: 'fr',
  },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadMessages() {
  return read(KEY, DEFAULT_MESSAGES);
}

export function saveMessages(rows: NotifyMessage[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function messageByTrigger(trigger: string, locale = 'fr') {
  return loadMessages().find((m) => m.active && m.trigger === trigger && m.locale === locale)
    || loadMessages().find((m) => m.active && m.trigger === trigger);
}
