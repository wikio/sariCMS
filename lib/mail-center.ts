/**
 * lib/mail-center.ts — le centre de courrier du CMS.
 *
 * Ce fichier est le **cœur isomorphe** du module : il décrit ce que le CMS peut
 * envoyer (modules, événements, variables), comment un message est rendu
 * (fusion des variables + gabarit), et il porte les valeurs par défaut. Il
 * n'importe **ni `fs` ni `next/server`**, donc il est utilisable aussi bien par
 * les routes API (serveur) que par l'écran d'administration (navigateur).
 *
 * Le stockage, lui, vit dans `lib/mail-center-store.ts` : les réglages sont des
 * fichiers JSON sous `data/mail/`, conformément à la convention du projet
 * (`data/seo.json`, `data/verification.json`) — **rien n'est écrit en base**.
 *
 * Pourquoi un gabarit séparé du corps du message : un même habillage (logo,
 * couleurs, pied de page légal, lien de désinscription) doit s'appliquer à tous
 * les messages sans être recopié dans chacun d'eux. Le gabarit expose un bloc
 * « Corps du message » à l'endroit où le texte de l'événement vient se loger.
 */

/* ------------------------------------------------------------------ Types */

export type MailModuleId =
  | 'orders'
  | 'quotes'
  | 'contact'
  | 'applications'
  | 'newsletter'
  | 'users'
  | 'stock';

/** Une variable de fusion disponible dans les objets et les corps de message. */
export interface MailVarDef {
  /** Clé utilisée dans le texte : `{{nom_client}}`. */
  key: string;
  label: string;
  /** Valeur d'exemple, pour l'aperçu et les envois de test. */
  sample: string;
  /** Regroupement affiché dans la palette de variables. */
  group: 'societe' | 'destinataire' | 'document' | 'montants' | 'dates' | 'liens';
}

export interface MailEventDef {
  id: string;
  label: string;
  /** Ce qui déclenche l'envoi, en une phrase — évite les envois surprises. */
  description: string;
  /** Clés de variables proposées pour cet événement. */
  vars: string[];
  /** Un événement « interne » part vers l'entreprise, pas vers le visiteur. */
  internal?: boolean;
}

export interface MailModuleDef {
  id: MailModuleId;
  label: string;
  description: string;
  events: MailEventDef[];
}

/** Réglage d'un événement : ce qui part réellement. */
export interface MailEventConfig {
  enabled: boolean;
  subject: string;
  /** Corps HTML du message, avec ses `{{variables}}`. */
  body: string;
  /** Gabarit appliqué autour du corps — `''` = envoi du corps seul. */
  layoutId: string;
  /** Destinataire supplémentaire (copie cachée), vide = aucun. */
  bcc: string;
  /**
   * Garde-fou anti-doublon : deux envois du même événement vers le même
   * destinataire sont espacés d'au moins ce nombre d'heures. `0` désactive.
   */
  minIntervalHours: number;
}

/* ------------------------------------------------------------- Gabarits */

export type MailBlockType =
  | 'logo'
  | 'title'
  | 'text'
  | 'button'
  | 'divider'
  | 'image'
  | 'content'
  | 'footer';

export interface MailBlock {
  id: string;
  type: MailBlockType;
  /** Texte du bloc (titre, paragraphe, libellé du bouton…). */
  text?: string;
  /** Cible du bouton ou source de l'image. */
  href?: string;
  align?: 'left' | 'center' | 'right';
  /** Le bloc accepte les `{{variables}}`. */
  vars?: boolean;
}

export interface MailTheme {
  background: string;
  card: string;
  accent: string;
  text: string;
  muted: string;
  radius: number;
  /** Logo affiché en en-tête (chemin GED ou URL). */
  logoUrl: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  /** Pied de page : mention légale + lien de désinscription. */
  showLegal: boolean;
  legalText: string;
  showUnsubscribe: boolean;
  unsubscribeUrl: string;
}

export interface MailLayout {
  id: string;
  name: string;
  updatedAt: string;
  blocks: MailBlock[];
  theme: MailTheme;
}

/* -------------------------------------------------------- Politique d'envoi */

export interface MailPolicy {
  /** Interrupteur général : coupé, plus aucun module n'envoie. */
  masterEnabled: boolean;
  /** Plafond d'envois par jour, tous modules confondus. */
  dailyCap: number;
  /** Plafond d'envois par destinataire et par jour. */
  perRecipientDailyCap: number;
  /** Fenêtre de dédoublonnage par clé (`type-id-événement`), en minutes. */
  dedupeWindowMinutes: number;
  quietHours: { enabled: boolean; from: string; to: string };
  /** Nombre de jours d'historique conservés dans `data/mail/sent-log.json`. */
  logRetentionDays: number;
}

export interface MailCenterConfig {
  policy: MailPolicy;
  /** Configurations par événement, indexées par identifiant d'événement. */
  modules: Record<string, MailEventConfig>;
  layouts: MailLayout[];
}

/** Une ligne de l'historique d'envoi (fichier, pas base de données). */
export interface MailSentEntry {
  id: string;
  at: string;
  module: MailModuleId | string;
  event: string;
  to: string;
  subject: string;
  dedupeKey: string;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
  messageId?: string;
  error?: string;
}

/* ------------------------------------------------------------- Catalogue */

/** Toutes les variables de fusion connues du centre de courrier. */
export const MAIL_VARS: MailVarDef[] = [
  { key: 'nom_societe', label: 'Nom société', sample: 'SARI Système', group: 'societe' },
  { key: 'adresse_societe', label: 'Adresse société', sample: '12 rue des Frères Bouadou, Alger', group: 'societe' },
  { key: 'telephone_societe', label: 'Téléphone société', sample: '+213 21 00 00 00', group: 'societe' },
  { key: 'email_societe', label: 'E-mail société', sample: 'contact@sarisysteme.com', group: 'societe' },
  { key: 'site_societe', label: 'Site web', sample: 'https://sarisysteme.com', group: 'societe' },

  { key: 'nom_client', label: 'Nom du destinataire', sample: 'Dr. Amina Belkacem', group: 'destinataire' },
  { key: 'email_client', label: 'E-mail du destinataire', sample: 'a.belkacem@clinique.dz', group: 'destinataire' },
  { key: 'telephone_client', label: 'Téléphone du destinataire', sample: '+213 555 00 00 00', group: 'destinataire' },
  { key: 'societe_client', label: 'Société du destinataire', sample: 'Clinique El Azhar', group: 'destinataire' },

  { key: 'numero_commande', label: 'N° commande', sample: 'SARI-WCMD-00042', group: 'document' },
  { key: 'numero_devis', label: 'N° devis', sample: 'SARI-WDEV-00017', group: 'document' },
  { key: 'numero_facture', label: 'N° facture', sample: 'SARI-FAC-00009', group: 'document' },
  { key: 'reference_candidature', label: 'Réf. candidature', sample: 'SARI-CAND-00031', group: 'document' },
  { key: 'offre_emploi', label: 'Offre d’emploi', sample: 'Technicien biomédical', group: 'document' },
  { key: 'produit', label: 'Produit', sample: 'Échographe portable US-220', group: 'document' },
  { key: 'quantite', label: 'Quantité', sample: '2', group: 'document' },
  { key: 'transporteur', label: 'Transporteur', sample: 'Express Logistics', group: 'document' },
  { key: 'suivi_colis', label: 'N° de suivi', sample: 'DZ123456789', group: 'document' },
  { key: 'message_client', label: 'Message du visiteur', sample: 'Bonjour, je souhaite un devis…', group: 'document' },

  { key: 'montant_ht', label: 'Montant HT', sample: '180 000,00 DA', group: 'montants' },
  { key: 'montant_remise', label: 'Montant remise', sample: '9 000,00 DA', group: 'montants' },
  { key: 'montant_livraison', label: 'Frais de livraison', sample: '2 500,00 DA', group: 'montants' },
  { key: 'montant_tva', label: 'Montant TVA', sample: '31 380,00 DA', group: 'montants' },
  { key: 'montant_ttc', label: 'Montant TTC', sample: '204 880,00 DA', group: 'montants' },

  { key: 'date_document', label: 'Date du document', sample: '18/09/2026', group: 'dates' },
  { key: 'date_livraison', label: 'Date de livraison', sample: '25/09/2026', group: 'dates' },
  { key: 'date_reapprovisionnement', label: 'Date de réapprovisionnement', sample: '02/10/2026', group: 'dates' },
  { key: 'date_expiration', label: 'Date d’expiration', sample: '18/10/2026', group: 'dates' },

  { key: 'lien_document', label: 'Lien vers le document', sample: 'https://sarisysteme.com/fr/dashboard', group: 'liens' },
  { key: 'lien_espace_client', label: 'Lien espace client', sample: 'https://sarisysteme.com/fr/dashboard', group: 'liens' },
  { key: 'lien_desinscription', label: 'Lien de désinscription', sample: 'https://sarisysteme.com/fr/newsletter?unsub=JETON', group: 'liens' },
];

const VAR_KEYS = MAIL_VARS.map((v) => v.key);
const varsOf = (...keys: string[]) => keys.filter((k) => VAR_KEYS.includes(k));

/** Identité + montants + dates : le socle commun à presque tous les messages. */
const COMMON = [
  'nom_societe', 'adresse_societe', 'telephone_societe', 'email_societe', 'site_societe',
  'nom_client', 'email_client', 'societe_client',
];
const MONEY = ['montant_ht', 'montant_remise', 'montant_livraison', 'montant_tva', 'montant_ttc'];

/**
 * Les modules du CMS capables d'envoyer un email, et leurs événements.
 *
 * Cette liste est la **source de vérité** de l'écran d'administration : un
 * événement absent d'ici ne peut pas être configuré ni envoyé. Les identifiants
 * reprennent ceux de l'ancien `lib/notify-store.ts` (`order_confirmed`,
 * `quote_sent`…) pour que les messages déjà écrits restent valables.
 */
export const MAIL_CATALOG: MailModuleDef[] = [
  {
    id: 'orders',
    label: 'Commandes',
    description: 'Suivi d’une commande passée sur la vitrine ou saisie dans l’administration.',
    events: [
      {
        id: 'order_confirmed',
        label: 'Commande confirmée',
        description: 'Au passage de la commande à « en traitement » — une seule fois.',
        vars: varsOf(...COMMON, 'numero_commande', 'date_document', ...MONEY, 'lien_espace_client'),
      },
      {
        id: 'order_shipped',
        label: 'Commande expédiée',
        description: 'Au passage au statut « expédiée ».',
        vars: varsOf(...COMMON, 'numero_commande', 'date_livraison', 'transporteur', 'suivi_colis', 'montant_ttc'),
      },
      {
        id: 'order_delivered',
        label: 'Commande livrée',
        description: 'Au passage au statut « livrée ».',
        vars: varsOf(...COMMON, 'numero_commande', 'date_livraison', 'montant_ttc'),
      },
      {
        id: 'order_cancelled',
        label: 'Commande annulée',
        description: 'Au passage au statut « annulée ».',
        vars: varsOf(...COMMON, 'numero_commande', 'date_document', 'montant_ttc'),
      },
      {
        id: 'order_payment',
        label: 'Paiement reçu',
        description: 'Quand un paiement est rapproché de la commande.',
        vars: varsOf(...COMMON, 'numero_commande', 'numero_facture', 'date_document', 'montant_ttc'),
      },
    ],
  },
  {
    id: 'quotes',
    label: 'Devis',
    description: 'Cycle de vie d’un devis, de l’envoi à l’acceptation.',
    events: [
      {
        id: 'quote_sent',
        label: 'Devis envoyé',
        description: 'Quand le devis passe à « répondu ».',
        vars: varsOf(...COMMON, 'numero_devis', 'date_document', 'date_expiration', ...MONEY, 'lien_document'),
      },
      {
        id: 'quote_accepted',
        label: 'Devis accepté',
        description: 'Quand le devis est accepté (ou transformé en commande).',
        vars: varsOf(...COMMON, 'numero_devis', 'numero_commande', 'date_document', 'montant_ttc'),
      },
      {
        id: 'quote_expired',
        label: 'Devis expiré',
        description: 'Rappel unique à l’échéance de validité du devis.',
        vars: varsOf(...COMMON, 'numero_devis', 'date_expiration', 'montant_ttc', 'lien_document'),
      },
    ],
  },
  {
    id: 'contact',
    label: 'Formulaire de contact',
    description: 'Messages reçus depuis la vitrine.',
    events: [
      {
        id: 'contact_received',
        label: 'Accusé de réception (visiteur)',
        description: 'Un seul email au visiteur, à la réception de son message.',
        vars: varsOf(...COMMON, 'date_document', 'message_client'),
      },
      {
        id: 'contact_alert',
        label: 'Alerte interne',
        description: 'Prévenir l’entreprise — regrouper dans un digest plutôt qu’un email par message.',
        internal: true,
        vars: varsOf('nom_societe', 'nom_client', 'email_client', 'telephone_client', 'societe_client', 'date_document', 'message_client'),
      },
    ],
  },
  {
    id: 'applications',
    label: 'Candidatures',
    description: 'Candidatures déposées sur les offres d’emploi.',
    events: [
      {
        id: 'application_received',
        label: 'Accusé de réception (candidat)',
        description: 'Un seul email au candidat, au dépôt de sa candidature.',
        vars: varsOf(...COMMON, 'reference_candidature', 'offre_emploi', 'date_document'),
      },
      {
        id: 'application_alert',
        label: 'Alerte interne',
        description: 'Prévenir le recruteur — digest quotidien recommandé.',
        internal: true,
        vars: varsOf('nom_societe', 'nom_client', 'email_client', 'telephone_client', 'reference_candidature', 'offre_emploi', 'date_document'),
      },
    ],
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Liste de diffusion — uniquement sur consentement explicite.',
    events: [
      {
        id: 'newsletter_welcome',
        label: 'Confirmation d’inscription',
        description: 'Un seul email, à l’inscription. Contient le lien de désinscription.',
        vars: varsOf(...COMMON, 'lien_desinscription'),
      },
      {
        id: 'newsletter_campaign',
        label: 'Campagne',
        description: 'Diffusion — réservée aux adresses au statut « abonné » avec consentement.',
        vars: varsOf(...COMMON, 'lien_desinscription', 'lien_document'),
      },
    ],
  },
  {
    id: 'users',
    label: 'Comptes clients',
    description: 'Création de compte et sécurité.',
    events: [
      {
        id: 'user_welcome',
        label: 'Bienvenue',
        description: 'Un seul email, à la création du compte.',
        vars: varsOf(...COMMON, 'lien_espace_client'),
      },
      {
        id: 'user_password_reset',
        label: 'Réinitialisation du mot de passe',
        description: 'À la demande expresse de l’utilisateur. Lien à usage unique.',
        vars: varsOf(...COMMON, 'lien_document'),
      },
    ],
  },
  {
    id: 'stock',
    label: 'Stock & réapprovisionnement',
    description: 'Rupture et nouvel arrivage.',
    events: [
      {
        id: 'stock_backorder',
        label: 'Réapprovisionnement prévu',
        description: 'Un seul email par produit en rupture, à la commande concernée.',
        vars: varsOf(...COMMON, 'numero_commande', 'produit', 'quantite', 'date_reapprovisionnement'),
      },
    ],
  },
];

/** Tous les événements, indexés — pratique pour valider une configuration. */
export const MAIL_EVENTS: Record<string, MailEventDef & { module: MailModuleId; moduleLabel: string }> =
  MAIL_CATALOG.reduce((acc, mod) => {
    for (const ev of mod.events) acc[ev.id] = { ...ev, module: mod.id, moduleLabel: mod.label };
    return acc;
  }, {} as Record<string, MailEventDef & { module: MailModuleId; moduleLabel: string }>);

/* -------------------------------------------------------- Valeurs par défaut */

export const DEFAULT_THEME: MailTheme = {
  background: '#f4f6f8',
  card: '#ffffff',
  accent: '#0f766e',
  text: '#111827',
  muted: '#6b7280',
  radius: 10,
  logoUrl: '/logo.png',
  company: 'SARI Système',
  address: '12 rue des Frères Bouadou, Alger',
  phone: '+213 21 00 00 00',
  email: 'contact@sarisysteme.com',
  showLegal: true,
  legalText:
    'Vous recevez cet email parce qu’il concerne une demande que vous avez faite auprès de {{nom_societe}}. Aucune donnée n’est transmise à des tiers.',
  showUnsubscribe: false,
  unsubscribeUrl: '{{lien_desinscription}}',
};

export const DEFAULT_LAYOUT: MailLayout = {
  id: 'layout-defaut',
  name: 'Habillage par défaut',
  updatedAt: new Date(0).toISOString(),
  theme: DEFAULT_THEME,
  blocks: [
    { id: 'b1', type: 'logo', align: 'center' },
    { id: 'b2', type: 'content', align: 'left' },
    { id: 'b3', type: 'divider', align: 'center' },
    { id: 'b4', type: 'footer', align: 'center' },
  ],
};

export const DEFAULT_POLICY: MailPolicy = {
  masterEnabled: true,
  dailyCap: 200,
  perRecipientDailyCap: 5,
  dedupeWindowMinutes: 60,
  quietHours: { enabled: false, from: '21:00', to: '07:00' },
  logRetentionDays: 60,
};

const P = (text: string) => `<p>${text}</p>`;
const HELLO = '<p>Bonjour {{nom_client}},</p>';
const SIGN = '<p>Cordialement,<br><strong>{{nom_societe}}</strong><br>{{telephone_societe}} · {{email_societe}}</p>';

/** Corps par défaut des événements — un point de départ, pas une obligation. */
const DEFAULT_BODIES: Record<string, { subject: string; body: string }> = {
  order_confirmed: {
    subject: 'Confirmation de votre commande {{numero_commande}}',
    body: HELLO
      + P('Nous avons bien reçu votre commande <strong>{{numero_commande}}</strong> du {{date_document}}, d’un montant de <strong>{{montant_ttc}}</strong>.')
      + P('Elle est en cours de préparation. Vous recevrez un nouvel email dès son expédition.')
      + SIGN,
  },
  order_shipped: {
    subject: 'Votre commande {{numero_commande}} est expédiée',
    body: HELLO
      + P('Votre commande <strong>{{numero_commande}}</strong> a été confiée à {{transporteur}}.')
      + P('Numéro de suivi : <strong>{{suivi_colis}}</strong> — livraison estimée le {{date_livraison}}.')
      + SIGN,
  },
  order_delivered: {
    subject: 'Votre commande {{numero_commande}} a été livrée',
    body: HELLO
      + P('Votre commande <strong>{{numero_commande}}</strong> a été livrée le {{date_livraison}}.')
      + P('Une question sur un article ? Répondez simplement à cet email.')
      + SIGN,
  },
  order_cancelled: {
    subject: 'Annulation de votre commande {{numero_commande}}',
    body: HELLO
      + P('Votre commande <strong>{{numero_commande}}</strong> du {{date_document}} a été annulée.')
      + P('Aucun montant ne vous sera facturé. Notre équipe reste à votre disposition.')
      + SIGN,
  },
  order_payment: {
    subject: 'Paiement reçu — commande {{numero_commande}}',
    body: HELLO
      + P('Nous avons bien reçu votre règlement de <strong>{{montant_ttc}}</strong> pour la commande {{numero_commande}}.')
      + P('Référence facture : {{numero_facture}}.')
      + SIGN,
  },
  quote_sent: {
    subject: 'Votre devis {{numero_devis}}',
    body: HELLO
      + P('Veuillez trouver votre devis <strong>{{numero_devis}}</strong> d’un montant de <strong>{{montant_ttc}}</strong>.')
      + P('Il reste valable jusqu’au {{date_expiration}}. Nous restons à votre disposition pour toute précision.')
      + SIGN,
  },
  quote_accepted: {
    subject: 'Devis {{numero_devis}} accepté',
    body: HELLO
      + P('Nous vous confirmons l’acceptation de votre devis <strong>{{numero_devis}}</strong>.')
      + P('Votre commande <strong>{{numero_commande}}</strong> est enregistrée et sera traitée dans les meilleurs délais.')
      + SIGN,
  },
  quote_expired: {
    subject: 'Votre devis {{numero_devis}} arrive à échéance',
    body: HELLO
      + P('Votre devis <strong>{{numero_devis}}</strong> expire le {{date_expiration}}.')
      + P('Souhaitez-vous que nous le prolongions ? Répondez à cet email et nous nous en occupons.')
      + SIGN,
  },
  contact_received: {
    subject: 'Nous avons bien reçu votre message',
    body: HELLO
      + P('Merci de nous avoir écrits. Votre message du {{date_document}} est bien arrivé et va être traité par notre équipe.')
      + P('Nous revenons vers vous sous un jour ouvré.')
      + SIGN,
  },
  contact_alert: {
    subject: '[{{nom_societe}}] Nouveau message de {{nom_client}}',
    body: '<p>Message reçu le {{date_document}}.</p>'
      + '<p><strong>De :</strong> {{nom_client}} — {{email_client}} — {{telephone_client}}</p>'
      + '<p><strong>Société :</strong> {{societe_client}}</p>'
      + '<blockquote>{{message_client}}</blockquote>',
  },
  application_received: {
    subject: 'Votre candidature {{reference_candidature}} a bien été reçue',
    body: HELLO
      + P('Nous avons bien reçu votre candidature pour le poste <strong>{{offre_emploi}}</strong> (référence {{reference_candidature}}).')
      + P('Notre équipe recrutement l’étudie et revient vers vous rapidement.')
      + SIGN,
  },
  application_alert: {
    subject: '[{{nom_societe}}] Nouvelle candidature — {{offre_emploi}}',
    body: '<p>Candidature <strong>{{reference_candidature}}</strong> reçue le {{date_document}}.</p>'
      + '<p><strong>Candidat :</strong> {{nom_client}} — {{email_client}} — {{telephone_client}}</p>'
      + '<p><strong>Poste :</strong> {{offre_emploi}}</p>',
  },
  newsletter_welcome: {
    subject: 'Votre inscription est confirmée',
    body: HELLO
      + P('Merci de votre inscription à la lettre d’information de {{nom_societe}}.')
      + P('Vous pouvez vous désinscrire à tout moment depuis le lien en bas de chacun de nos emails.')
      + '<p><a href="{{lien_desinscription}}">Me désinscrire</a></p>',
  },
  newsletter_campaign: {
    subject: 'Les nouveautés {{nom_societe}}',
    body: HELLO + P('Voici nos dernières actualités.') + '<p><a href="{{lien_document}}">Lire la suite</a></p>',
  },
  user_welcome: {
    subject: 'Bienvenue chez {{nom_societe}}',
    body: HELLO
      + P('Votre compte est créé. Vous pouvez suivre vos commandes et retrouver vos devis depuis votre espace client.')
      + '<p><a href="{{lien_espace_client}}">Accéder à mon espace</a></p>'
      + SIGN,
  },
  user_password_reset: {
    subject: 'Réinitialiser votre mot de passe',
    body: HELLO
      + P('Une demande de réinitialisation a été faite pour votre compte. Le lien ci-dessous est valable une fois.')
      + '<p><a href="{{lien_document}}">Choisir un nouveau mot de passe</a></p>'
      + P('Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.')
      + SIGN,
  },
  stock_backorder: {
    subject: 'Votre commande {{numero_commande}} : réapprovisionnement prévu',
    body: HELLO
      + P('Le produit <strong>{{produit}}</strong> (quantité {{quantite}}) est temporairement en rupture.')
      + P('Un nouvel arrivage est prévu le <strong>{{date_reapprovisionnement}}</strong>. Votre commande {{numero_commande}} sera traitée dès réception.')
      + SIGN,
  },
};

/** Configuration par défaut d'un événement (désactivé tant qu'aucun envoi n'est câblé). */
export function defaultEventConfig(eventId: string, enabled = false): MailEventConfig {
  const preset = DEFAULT_BODIES[eventId];
  const event = MAIL_EVENTS[eventId];
  return {
    enabled,
    subject: preset?.subject || event?.label || eventId,
    body: preset?.body || '<p>Bonjour {{nom_client}},</p>',
    layoutId: DEFAULT_LAYOUT.id,
    bcc: '',
    minIntervalHours: 1,
  };
}

/** Toute la configuration par défaut : chaque événement connu, désactivé. */
export function defaultMailCenterConfig(): MailCenterConfig {
  const modules: Record<string, MailEventConfig> = {};
  for (const eventId of Object.keys(MAIL_EVENTS)) modules[eventId] = defaultEventConfig(eventId);
  return { policy: DEFAULT_POLICY, modules, layouts: [DEFAULT_LAYOUT] };
}

/* ------------------------------------------------------------------ Rendu */

/** Remplace les `{{cle}}` d'un texte. Une clé absente est remplacée par une chaîne vide. */
export function mergeMailVars(text: string, vars: Record<string, string | number | undefined>): string {
  return String(text ?? '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Variables encore non résolues après fusion — à signaler à l'administrateur. */
export function unresolvedVars(text: string): string[] {
  return [...String(text ?? '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]);
}

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Échappe le HTML puis rend les liens et la mise en forme minimale : les
 * clients email ignorent les feuilles de style externes, donc tout passe en
 * attribut `style`. On n'autorise qu'un sous-ensemble de balises.
 */
export function toEmailHtml(bodyHtml: string): string {
  return String(bodyHtml ?? '')
    .replace(/<\s*br\s*\/?\s*>/gi, '<br>')
    .replace(/<p([^>]*)>/gi, '<p$1 style="margin:0 0 14px;line-height:1.65;">')
    .replace(/<blockquote([^>]*)>/gi, '<blockquote$1 style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #d1d5db;color:#4b5563;">')
    .replace(/<a\s+/gi, '<a style="color:#0f766e;" ');
}

/** Un bloc du gabarit → HTML email (table + styles en ligne). */
export function renderMailBlock(block: MailBlock, theme: MailTheme, vars: Record<string, string | number | undefined>): string {
  const text = mergeMailVars(block.text ?? '', vars);
  const href = mergeMailVars(block.href ?? '', vars);
  const align = block.align || 'left';
  const pad = 'padding:0 28px;';

  switch (block.type) {
    case 'logo': {
      const src = mergeMailVars(theme.logoUrl, vars);
      if (!src) return '';
      return `<tr><td align="${align}" style="${pad}padding-top:26px;padding-bottom:8px;">`
        + `<img src="${esc(src)}" alt="${esc(theme.company)}" width="150" style="display:block;max-width:150px;height:auto;border:0;"></td></tr>`;
    }
    case 'title':
      return `<tr><td align="${align}" style="${pad}padding-top:6px;">`
        + `<h1 style="margin:0;font-size:20px;line-height:1.35;color:${esc(theme.text)};">${esc(text)}</h1></td></tr>`;
    case 'text':
      return `<tr><td align="${align}" style="${pad}">`
        + `<div style="font-size:14px;line-height:1.65;color:${esc(theme.text)};">${esc(text)}</div></td></tr>`;
    case 'button': {
      if (!href) return '';
      return `<tr><td align="${align}" style="${pad}padding-top:10px;padding-bottom:10px;">`
        + `<a href="${esc(href)}" style="display:inline-block;background:${esc(theme.accent)};color:#ffffff;text-decoration:none;`
        + `font-size:14px;font-weight:600;padding:11px 22px;border-radius:6px;">${esc(text || 'Voir')}</a></td></tr>`;
    }
    case 'image': {
      if (!href) return '';
      return `<tr><td align="${align}" style="${pad}padding-top:10px;">`
        + `<img src="${esc(href)}" alt="${esc(text)}" width="560" style="display:block;max-width:100%;height:auto;border:0;border-radius:6px;"></td></tr>`;
    }
    case 'divider':
      return `<tr><td style="${pad}padding-top:18px;padding-bottom:6px;">`
        + `<div style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
    case 'footer': {
      const legal = theme.showLegal ? mergeMailVars(theme.legalText, vars) : '';
      const unsub = theme.showUnsubscribe
        ? `<p style="margin:8px 0 0;font-size:11px;"><a href="${esc(mergeMailVars(theme.unsubscribeUrl, vars))}" style="color:${esc(theme.muted)};">Se désinscrire</a></p>`
        : '';
      return `<tr><td align="${align}" style="${pad}padding-top:16px;padding-bottom:26px;">`
        + `<div style="font-size:12px;line-height:1.6;color:${esc(theme.muted)};">`
        + `<strong>${esc(theme.company)}</strong>`
        + (theme.address ? ` · ${esc(theme.address)}` : '')
        + (theme.phone ? ` · ${esc(theme.phone)}` : '')
        + (theme.email ? ` · ${esc(theme.email)}` : '')
        + (legal ? `<p style="margin:10px 0 0;font-size:11px;">${esc(legal)}</p>` : '')
        + unsub
        + `</div></td></tr>`;
    }
    case 'content':
    default:
      // Le corps du message est rendu par l'appelant (`__CONTENT__` est remplacé après).
      return '<tr><td style="padding:0 28px;">__CONTENT__</td></tr>';
  }
}

/**
 * Assemble le message final : gabarit (si demandé) + corps fusionné.
 * La sortie est du HTML email — tables et styles en ligne, rien d'externe.
 */
export function renderMailHtml(opts: {
  bodyHtml: string;
  layout?: MailLayout | null;
  vars: Record<string, string | number | undefined>;
}): string {
  const content = toEmailHtml(mergeMailVars(opts.bodyHtml, opts.vars));
  const layout = opts.layout;
  if (!layout) {
    return `<!doctype html><html><body style="margin:0;background:#f4f6f8;">`
      + `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;padding:24px;">${content}</div>`
      + `</body></html>`;
  }
  const theme = { ...DEFAULT_THEME, ...layout.theme };
  const rows = (layout.blocks || [])
    .map((block) => renderMailBlock(block, theme, opts.vars))
    .join('')
    .replace('__CONTENT__', content);
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta http-equiv="X-UA-Compatible" content="IE=edge"></head>`
    + `<body style="margin:0;padding:0;background:${esc(theme.background)};">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(theme.background)};">`
    + `<tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" `
    + `style="width:100%;max-width:600px;background:${esc(theme.card)};border-radius:${Number(theme.radius) || 0}px;`
    + `font-family:Arial,Helvetica,sans-serif;overflow:hidden;">`
    + (rows || `<tr><td style="padding:28px;">${content}</td></tr>`)
    + `</table></td></tr></table></body></html>`;
}

/** Valeurs d'exemple pour l'aperçu et les envois de test. */
export function sampleVars(): Record<string, string> {
  return MAIL_VARS.reduce((acc, v) => {
    acc[v.key] = v.sample;
    return acc;
  }, {} as Record<string, string>);
}
