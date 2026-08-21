#!/usr/bin/env node
/**
 * Génère `seed.mysql.sql` (données de démarrage SARI Système, contexte algérien).
 *
 * Exécution (depuis `backend/` pour résoudre bcryptjs) :
 *   node sql/generate-seed.mjs
 *
 * Identifiants déterministes (UUID v5) : relancer le script produit le même
 * fichier. Le hash bcrypt est calculé au moment de la génération puis figé
 * dans le SQL.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// UUID v5 déterministe (stable entre exécutions)
// ---------------------------------------------------------------------------
const NS = 'a6edc906-2f9f-5fb2-a373-fefd7bc73b0c';
function uuid5(name) {
  const hex = createHash('sha1').update(`${NS}:${name}`, 'utf8').digest('hex');
  // Version 5 : bits de version à 0101 et variant RFC 4122 (10xx).
  const timeHi = (parseInt(hex.slice(12, 16), 16) & 0x0fff) | 0x5000;
  const clockHi = (parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    timeHi.toString(16).padStart(4, '0'),
    clockHi.toString(16).padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-');
}
const id = (kind, key) => uuid5(`${kind}:${key}`);
const now = '2026-08-21 10:00:00.000';

// ---------------------------------------------------------------------------
// Escaping SQL
// ---------------------------------------------------------------------------
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function json(v) {
  return esc(JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// Permissions (aligné sur backend/src/common/constants/permissions.ts)
// ---------------------------------------------------------------------------
const ACTIONS = ['create', 'read', 'update', 'delete', 'admin'];
const RESOURCES = [
  'users', 'roles', 'permissions', 'pages', 'faqs', 'testimonials', 'menus',
  'contact', 'translations', 'audit', 'settings', 'news', 'events', 'products',
  'services', 'partners', 'careers', 'solutions', 'hero', 'dashboard',
];
const permKey = (r, a) => `${r}:${a}`;
const permId = (r, a) => id('perm', permKey(r, a));

const CONTENT_RESOURCES = [
  'pages', 'faqs', 'testimonials', 'menus', 'news', 'events', 'products',
  'services', 'partners', 'careers', 'solutions', 'hero', 'translations',
];

function permSetOf(pred) {
  const out = [];
  for (const r of RESOURCES) for (const a of ACTIONS) if (pred(r, a)) out.push(permKey(r, a));
  return out;
}
const rolePermKeys = {
  'super-admin': permSetOf(() => true),
  admin: permSetOf((r, a) => !['users', 'roles', 'permissions'].includes(r) && !(r === 'audit' && a !== 'read')),
  editor: permSetOf((r, a) => (CONTENT_RESOURCES.includes(r) && ['create', 'read', 'update'].includes(a)) || (r === 'dashboard' && a === 'read')),
  viewer: permSetOf((r, a) => (CONTENT_RESOURCES.includes(r) || ['contact', 'audit', 'dashboard'].includes(r)) && a === 'read'),
};

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------
const ROLES = [
  { slug: 'super-admin', name: 'Super Administrateur', desc: 'Accès complet au système (contourne le contrôle de permissions).', system: 1 },
  { slug: 'admin', name: 'Administrateur', desc: 'Gestion du contenu, du catalogue et des commandes.', system: 1 },
  { slug: 'editor', name: 'Éditeur de contenu', desc: 'Rédaction et mise à jour du contenu de la vitrine.', system: 1 },
  { slug: 'viewer', name: 'Lecteur', desc: 'Accès en lecture seule au back-office.', system: 1 },
];

// ---------------------------------------------------------------------------
// Utilisateurs — mot de passe de démo identique pour tous (voir README)
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = 'ChangeMe_Sari2026!';
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

const USERS = [
  { email: 'admin@sarisysteme.com', first: 'Karim', last: 'BENALI', type: 'admin', status: 'active', role: 'super-admin', phone: '(+213) 23 52 42 72', company: 'SARI Système SARL', wilaya: 'Alger', country: 'Algérie', position: 'Gérant' },
  { email: 'gestion@sarisysteme.com', first: 'Yasmine', last: 'CHERIF', type: 'admin', status: 'active', role: 'admin', phone: '(+213) 550 12 34 56', company: 'SARI Système SARL', wilaya: 'Alger', country: 'Algérie', position: 'Responsable commerciale' },
  { email: 'client@clinique-elafia.dz', first: 'Clinique', last: 'El Afia', type: 'client', status: 'active', phone: '(+213) 21 63 45 78', company: 'Clinique El Afia', wilaya: 'Alger', country: 'Algérie', address: 'Rue Didouche Mourad, Alger-Centre' },
  { email: 'contact@meditech.dz', first: 'MediTech', last: 'Algérie', type: 'partner', status: 'active', phone: '(+213) 41 33 22 11', company: 'MediTech Algérie', wilaya: 'Oran', country: 'Algérie' },
  { email: 'mohamed.saidi@gmail.com', first: 'Mohamed', last: 'SAIDI', type: 'candidate', status: 'pending', phone: '(+213) 661 22 33 44', wilaya: 'Constantine', country: 'Algérie', position: 'Technicien biomédical' },
];

// ---------------------------------------------------------------------------
// Coordonnées (contact_info) — contexte algérien
// ---------------------------------------------------------------------------
const CONTACT = {
  fr: {
    company: 'SARI Système SARL',
    tagline: "L'excellence médicale au service de la santé en Algérie",
    phone: '(+213) 23 52 42 72',
    email: 'contact@sarisysteme.com',
    address: '17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie',
    hours: 'Dim - Jeu : 8h00 - 17h00',
    currency: 'DZD',
    social: { facebook: 'https://facebook.com/sarisysteme', linkedin: 'https://linkedin.com/company/sari-systeme', twitter: 'https://twitter.com/sarisysteme', youtube: 'https://youtube.com/@sarisysteme' },
    extras: { wilaya: 'Alger', description: "Distribution d'équipements et consommables médicaux depuis plus de 20 ans en Algérie.", stats: { clients: '500+', experience: '20', support: '24/7', satisfaction: '98%' } },
  },
  en: {
    company: 'SARI Système SARL',
    tagline: 'Medical excellence serving healthcare in Algeria',
    phone: '(+213) 23 52 42 72',
    email: 'contact@sarisysteme.com',
    address: '17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria',
    hours: 'Sun - Thu: 8:00 AM - 5:00 PM',
    currency: 'DZD',
    social: { facebook: 'https://facebook.com/sarisysteme', linkedin: 'https://linkedin.com/company/sari-systeme', twitter: 'https://twitter.com/sarisysteme', youtube: 'https://youtube.com/@sarisysteme' },
    extras: { wilaya: 'Algiers', description: 'Distributing medical equipment and consumables in Algeria for over 20 years.', stats: { clients: '500+', experience: '20', support: '24/7', satisfaction: '98%' } },
  },
  ar: {
    company: 'ساري سيستم ش.ذ.م.م',
    tagline: 'التميز الطبي في خدمة الصحة في الجزائر',
    phone: '(+213) 23 52 42 72',
    email: 'contact@sarisysteme.com',
    address: '17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة، الجزائر',
    hours: 'الأحد - الخميس: 8:00 - 17:00',
    currency: 'DZD',
    social: { facebook: 'https://facebook.com/sarisysteme', linkedin: 'https://linkedin.com/company/sari-systeme', twitter: 'https://twitter.com/sarisysteme', youtube: 'https://youtube.com/@sarisysteme' },
    extras: { wilaya: 'الجزائر', description: 'توزيع المعدات والمستلزمات الطبية منذ أكثر من 20 عامًا في الجزائر.', stats: { clients: '500+', experience: '20', support: '24/7', satisfaction: '98%' } },
  },
};

// ---------------------------------------------------------------------------
// Menus (structure identique à data/{locale}/menu.json)
// ---------------------------------------------------------------------------
const MENUS = {
  fr: {
    main: [
      { id: 'home', label: 'Accueil', href: '/' },
      { id: 'about', label: 'À Propos', href: '/about' },
      { id: 'solutions', label: 'Solutions', href: '/solutions', submenu: [
        { label: 'Diagnostic', href: '/solutions/diagnostic', desc: 'Échographes, tensiomètres, microscopes' },
        { label: 'Cardiologie', href: '/solutions/cardiology', desc: 'ECG, défibrillateurs, moniteurs' },
        { label: 'Imagerie', href: '/solutions/imaging', desc: 'Scanners, IRM, radiologie' },
        { label: 'Chirurgie', href: '/solutions/surgery', desc: 'Instruments, autoclaves, tables opératoires' },
        { label: 'Réanimation', href: '/solutions/emergency', desc: 'Défibrillateurs, chariots d\'urgence' },
        { label: 'Laboratoire', href: '/solutions/laboratory', desc: 'Analyseurs, microscopes, centrifugeuses' },
      ] },
      { id: 'services', label: 'Services', href: '/services' },
      { id: 'products', label: 'Produits', href: '/products' },
      { id: 'events', label: 'Événements', href: '/events' },
      { id: 'news', label: 'Actualités', href: '/news' },
      { id: 'careers', label: 'Carrières', href: '/careers' },
      { id: 'contact', label: 'Contact', href: '/contact' },
    ],
    nav: [
      { id: 'home', label: 'Accueil', href: '/' },
      { id: 'about', label: 'À Propos', href: '/about' },
      { id: 'solutions', label: 'Solutions', href: '/solutions' },
      { id: 'services', label: 'Services', href: '/services' },
      { id: 'products', label: 'Produits', href: '/products' },
      { id: 'news', label: 'Actualités', href: '/news' },
      { id: 'careers', label: 'Carrières', href: '/careers' },
      { id: 'contact', label: 'Contact', href: '/contact' },
    ],
    legal: [
      { id: 'mentions', label: 'Mentions Légales', href: '/legal/mentions' },
      { id: 'privacy', label: 'Confidentialité', href: '/legal/privacy' },
      { id: 'conditions', label: 'Conditions d\'utilisation', href: '/legal/conditions' },
      { id: 'verification', label: 'Vérification', href: '/verification' },
    ],
  },
  en: {
    main: [
      { id: 'home', label: 'Home', href: '/' },
      { id: 'about', label: 'About', href: '/about' },
      { id: 'solutions', label: 'Solutions', href: '/solutions', submenu: [
        { label: 'Diagnostic', href: '/solutions/diagnostic', desc: 'Ultrasound, blood pressure monitors, microscopes' },
        { label: 'Cardiology', href: '/solutions/cardiology', desc: 'ECG, defibrillators, monitors' },
        { label: 'Imaging', href: '/solutions/imaging', desc: 'CT, MRI, radiology' },
        { label: 'Surgery', href: '/solutions/surgery', desc: 'Instruments, autoclaves, operating tables' },
        { label: 'Emergency', href: '/solutions/emergency', desc: 'Defibrillators, crash carts' },
        { label: 'Laboratory', href: '/solutions/laboratory', desc: 'Analyzers, microscopes, centrifuges' },
      ] },
      { id: 'services', label: 'Services', href: '/services' },
      { id: 'products', label: 'Products', href: '/products' },
      { id: 'events', label: 'Events', href: '/events' },
      { id: 'news', label: 'News', href: '/news' },
      { id: 'careers', label: 'Careers', href: '/careers' },
      { id: 'contact', label: 'Contact', href: '/contact' },
    ],
    nav: [
      { id: 'home', label: 'Home', href: '/' },
      { id: 'about', label: 'About', href: '/about' },
      { id: 'solutions', label: 'Solutions', href: '/solutions' },
      { id: 'services', label: 'Services', href: '/services' },
      { id: 'products', label: 'Products', href: '/products' },
      { id: 'news', label: 'News', href: '/news' },
      { id: 'careers', label: 'Careers', href: '/careers' },
      { id: 'contact', label: 'Contact', href: '/contact' },
    ],
    legal: [
      { id: 'mentions', label: 'Legal Notice', href: '/legal/mentions' },
      { id: 'privacy', label: 'Privacy Policy', href: '/legal/privacy' },
      { id: 'conditions', label: 'Terms & Conditions', href: '/legal/conditions' },
      { id: 'verification', label: 'Verification', href: '/verification' },
    ],
  },
  ar: {
    main: [
      { id: 'home', label: 'الرئيسية', href: '/' },
      { id: 'about', label: 'من نحن', href: '/about' },
      { id: 'solutions', label: 'الحلول', href: '/solutions', submenu: [
        { label: 'التشخيص', href: '/solutions/diagnostic', desc: 'أجهزة الموجات فوق الصوتية، أجهزة قياس الضغط، المجاهر' },
        { label: 'أمراض القلب', href: '/solutions/cardiology', desc: 'تخطيط القلب، أجهزة الصدمات، الشاشات' },
        { label: 'التصوير', href: '/solutions/imaging', desc: 'الماسح الضوئي، الرنين المغناطيسي، الأشعة' },
        { label: 'الجراحة', href: '/solutions/surgery', desc: 'الأدوات، المعقمات، طاولات العمليات' },
        { label: 'الطوارئ', href: '/solutions/emergency', desc: 'أجهزة الصدمات، عربات الطوارئ' },
        { label: 'المختبر', href: '/solutions/laboratory', desc: 'أجهزة التحليل، المجاهر، أجهزة الطرد المركزي' },
      ] },
      { id: 'services', label: 'الخدمات', href: '/services' },
      { id: 'products', label: 'المنتجات', href: '/products' },
      { id: 'events', label: 'الفعاليات', href: '/events' },
      { id: 'news', label: 'الأخبار', href: '/news' },
      { id: 'careers', label: 'الوظائف', href: '/careers' },
      { id: 'contact', label: 'اتصل بنا', href: '/contact' },
    ],
    nav: [
      { id: 'home', label: 'الرئيسية', href: '/' },
      { id: 'about', label: 'من نحن', href: '/about' },
      { id: 'solutions', label: 'الحلول', href: '/solutions' },
      { id: 'services', label: 'الخدمات', href: '/services' },
      { id: 'products', label: 'المنتجات', href: '/products' },
      { id: 'news', label: 'الأخبار', href: '/news' },
      { id: 'careers', label: 'الوظائف', href: '/careers' },
      { id: 'contact', label: 'اتصل بنا', href: '/contact' },
    ],
    legal: [
      { id: 'mentions', label: 'الإشعار القانوني', href: '/legal/mentions' },
      { id: 'privacy', label: 'سياسة الخصوصية', href: '/legal/privacy' },
      { id: 'conditions', label: 'الشروط والأحكام', href: '/legal/conditions' },
      { id: 'verification', label: 'التحقق', href: '/verification' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Pages légales + À propos (contexte algérien)
// ---------------------------------------------------------------------------
const PAGES = {
  fr: {
    mentions: {
      title: 'Mentions Légales',
      content:
        '<p class="mb-4"><strong>Raison sociale :</strong> SARI Système SARL</p>' +
        '<p class="mb-4"><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p>' +
        '<p class="mb-4"><strong>Capital social :</strong> 10 000 000 DZD (dix millions de dinars algériens)</p>' +
        '<p class="mb-4"><strong>Registre de Commerce (RC) :</strong> Alger n° 16/00-1234567B21</p>' +
        '<p class="mb-4"><strong>NIF (Numéro d\'Identification Fiscale) :</strong> 002116001234567</p>' +
        '<p class="mb-4"><strong>NIS (Numéro d\'Identification Statistique) :</strong> 09876543210016</p>' +
        '<p class="mb-4"><strong>Siège social :</strong> 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie</p>' +
        '<p class="mb-4"><strong>Téléphone :</strong> (+213) 23 52 42 72</p>' +
        '<p class="mb-4"><strong>Email :</strong> contact@sarisysteme.com</p>' +
        '<p class="mb-4"><strong>Directeur de la publication :</strong> Karim BENALI, Gérant</p>' +
        '<p class="mb-4"><strong>Hébergeur :</strong> Hébergement local algérien (datacenter Alger)</p>' +
        '<p class="mb-4">Les présentes mentions légales sont établies conformément à la législation algérienne en vigueur.</p>',
    },
    privacy: {
      title: 'Politique de Confidentialité',
      content:
        '<p class="mb-4">SARI Système SARL accorde une grande importance à la protection de vos données à caractère personnel, conformément à la <strong>loi n° 18-07 du 10 juin 2018</strong> relative à la protection des personnes physiques dans le traitement des données à caractère personnel.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">1. Responsable du traitement</h3>' +
        '<p class="mb-4">SARI Système SARL, 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">2. Données collectées</h3>' +
        '<p class="mb-4">Nom, email, téléphone, entreprise et contenu des demandes (devis, contact, candidature).</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">3. Finalités</h3>' +
        '<p class="mb-4">Traitement de vos demandes, suivi commercial et respect de nos obligations légales.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">4. Vos droits</h3>' +
        '<p class="mb-4">Vous disposez des droits d\'accès, de rectification et d\'opposition auprès de l\'<strong>ANPDP</strong> (Autorité Nationale de Protection des Données à caractère Personnel). Contact : dpo@sarisysteme.com</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">5. Cookies</h3>' +
        '<p class="mb-4">Notre site utilise des cookies pour améliorer votre expérience de navigation.</p>',
    },
    conditions: {
      title: 'Conditions Générales de Vente',
      content:
        '<p class="mb-4">Les présentes CGV s\'appliquent à toutes les ventes de produits et services réalisées par SARI Système SARL sur le territoire algérien.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Article 1 : Prix</h3>' +
        '<p class="mb-4">Les prix sont indiqués en <strong>Dinar Algérien (DZD)</strong> hors taxes. La TVA au taux en vigueur (19% ou 9% selon les produits) s\'ajoute au prix HT.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Article 2 : Commandes</h3>' +
        '<p class="mb-4">Toute commande doit être confirmée par écrit (email ou bon de commande signé). Accusé de réception sous 48h ouvrées.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Article 3 : Livraison</h3>' +
        '<p class="mb-4">Livraison sur les <strong>58 wilayas</strong>. Délais indicatifs de 3 à 15 jours ouvrés selon la wilaya et la disponibilité.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Article 4 : Paiement</h3>' +
        '<p class="mb-4">Virement bancaire, chèque, carte CIB / Edahabia ou paiement à la livraison selon accord préalable.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Article 5 : Garantie</h3>' +
        '<p class="mb-4">Garantie constructeur de 12 à 36 mois selon les équipements. Le SAV est assuré par nos techniciens agréés.</p>',
    },
    about: {
      title: 'À Propos de SARI Système',
      content:
        '<p class="mb-4">Fondée en 2003 à Alger, SARI Système SARL s\'est imposée comme un acteur majeur de la distribution d\'équipements et de consommables médicaux en Algérie.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Notre Mission</h3>' +
        '<p class="mb-4">Accompagner les établissements de santé publics et privés des 58 wilayas avec des équipements fiables, certifiés et un service de proximité.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Nos Valeurs</h3>' +
        '<ul class="list-disc pl-6 mb-4 space-y-2"><li>Qualité et conformité aux normes internationales</li><li>Réactivité et SAV de proximité</li><li>Expertise biomédicale</li><li>Engagement envers la santé publique algérienne</li></ul>',
    },
  },
  en: {
    mentions: {
      title: 'Legal Notice',
      content:
        '<p class="mb-4"><strong>Company name:</strong> SARI Système SARL</p>' +
        '<p class="mb-4"><strong>Legal form:</strong> Limited Liability Company (SARL)</p>' +
        '<p class="mb-4"><strong>Share capital:</strong> DZD 10,000,000</p>' +
        '<p class="mb-4"><strong>Trade Register (RC):</strong> Algiers n° 16/00-1234567B21</p>' +
        '<p class="mb-4"><strong>Tax ID (NIF):</strong> 002116001234567</p>' +
        '<p class="mb-4"><strong>Statistical ID (NIS):</strong> 09876543210016</p>' +
        '<p class="mb-4"><strong>Registered office:</strong> 17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria</p>' +
        '<p class="mb-4"><strong>Phone:</strong> (+213) 23 52 42 72</p>' +
        '<p class="mb-4"><strong>Email:</strong> contact@sarisysteme.com</p>' +
        '<p class="mb-4"><strong>Publisher:</strong> Karim BENALI, Manager</p>' +
        '<p class="mb-4"><strong>Hosting:</strong> Local Algerian hosting (Algiers datacenter)</p>',
    },
    privacy: {
      title: 'Privacy Policy',
      content:
        '<p class="mb-4">SARI Système SARL protects your personal data in accordance with <strong>Law n° 18-07 of June 10, 2018</strong> on the protection of individuals in the processing of personal data.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">1. Data controller</h3><p class="mb-4">SARI Système SARL, Algiers, Algeria.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">2. Collected data</h3><p class="mb-4">Name, email, phone, company and request contents.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">3. Your rights</h3><p class="mb-4">Access, rectification and objection rights with the ANPDP. Contact: dpo@sarisysteme.com</p>',
    },
    conditions: {
      title: 'Terms and Conditions of Sale',
      content:
        '<p class="mb-4">These terms apply to all sales made by SARI Système SARL in Algeria.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">1. Prices</h3><p class="mb-4">Prices are in <strong>Algerian Dinar (DZD)</strong>, VAT excluded (19% or 9%).</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">2. Delivery</h3><p class="mb-4">Delivery to all <strong>58 wilayas</strong>, 3 to 15 business days.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">3. Payment</h3><p class="mb-4">Bank transfer, cheque, CIB / Edahabia card or cash on delivery.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">4. Warranty</h3><p class="mb-4">12 to 36 months manufacturer warranty.</p>',
    },
    about: {
      title: 'About SARI Système',
      content:
        '<p class="mb-4">Founded in 2003 in Algiers, SARI Système SARL is a leading distributor of medical equipment and consumables in Algeria.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">Our Mission</h3><p class="mb-4">Support public and private healthcare facilities across the 58 wilayas with reliable, certified equipment and local service.</p>',
    },
  },
  ar: {
    mentions: {
      title: 'الإشعار القانوني',
      content:
        '<p class="mb-4"><strong>الاسم التجاري:</strong> ساري سيستم ش.ذ.م.م</p>' +
        '<p class="mb-4"><strong>الشكل القانوني:</strong> شركة ذات مسؤولية محدودة (ش.ذ.م.م)</p>' +
        '<p class="mb-4"><strong>رأس المال:</strong> 10,000,000 دج</p>' +
        '<p class="mb-4"><strong>السجل التجاري:</strong> الجزائر رقم 16/00-1234567B21</p>' +
        '<p class="mb-4"><strong>الرقم الجبائي (NIF):</strong> 002116001234567</p>' +
        '<p class="mb-4"><strong>الرقم الإحصائي (NIS):</strong> 09876543210016</p>' +
        '<p class="mb-4"><strong>المقر الاجتماعي:</strong> 17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة</p>' +
        '<p class="mb-4"><strong>الهاتف:</strong> (+213) 23 52 42 72</p>' +
        '<p class="mb-4"><strong>البريد الإلكتروني:</strong> contact@sarisysteme.com</p>' +
        '<p class="mb-4"><strong>مدير النشر:</strong> كريم بن علي، المسير</p>',
    },
    privacy: {
      title: 'سياسة الخصوصية',
      content:
        '<p class="mb-4">تحمي ساري سيستم بياناتك الشخصية وفقًا <strong>للقانون رقم 18-07 المؤرخ في 10 جوان 2018</strong> المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">1. مسؤول المعالجة</h3><p class="mb-4">ساري سيستم ش.ذ.م.م، الجزائر العاصمة.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">2. البيانات المجمعة</h3><p class="mb-4">الاسم، البريد الإلكتروني، الهاتف، المؤسسة ومحتوى الطلبات.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">3. حقوقك</h3><p class="mb-4">حقوق الوصول والتصحيح والاعتراض لدى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي. للتواصل: dpo@sarisysteme.com</p>',
    },
    conditions: {
      title: 'الشروط والأحكام العامة للبيع',
      content:
        '<p class="mb-4">تنطبق هذه الشروط على جميع مبيعات ساري سيستم في الجزائر.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">1. الأسعار</h3><p class="mb-4">الأسعار بالدينار الجزائري (DZD) دون احتساب الرسم على القيمة المضافة (19% أو 9%).</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">2. التوصيل</h3><p class="mb-4">التوصيل إلى جميع الولايات الـ58 خلال 3 إلى 15 يوم عمل.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">3. الدفع</h3><p class="mb-4">تحويل بنكي، شيك، بطاقة CIB / الذهبية أو الدفع عند الاستلام.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">4. الضمان</h3><p class="mb-4">ضمان المصنع من 12 إلى 36 شهرًا.</p>',
    },
    about: {
      title: 'من نحن — ساري سيستم',
      content:
        '<p class="mb-4">تأسست ساري سيستم في عام 2003 بالجزائر العاصمة، وأصبحت فاعلًا رئيسيًا في توزيع المعدات والمستلزمات الطبية في الجزائر.</p>' +
        '<h3 class="text-xl font-bold mb-3 mt-6">مهمتنا</h3><p class="mb-4">مرافقة المؤسسات الصحية العمومية والخاصة عبر 58 ولاية بمعدات موثوقة ومعتمدة وخدمة قريبة.</p>',
    },
  },
};

// ---------------------------------------------------------------------------
// Produits (prix en DZD)
// ---------------------------------------------------------------------------
const PRODUCTS = {
  fr: [
    { slug: 'echographe-portable-pro-x1', name: 'Échographe Portable Pro X1', cat: 'Diagnostic', price: '1 450 000 DZD', sku: 'SARI-ECH-001', desc: 'Échographe portable avec sondes convexes et linéaires, idéal pour les cabinets et les structures mobiles.', delivery: '5-10 jours ouvrés' },
    { slug: 'lit-examen-electrique-premium', name: "Lit d'Examen Électrique Premium", cat: 'Équipements', price: '320 000 DZD', sku: 'SARI-LIT-002', desc: 'Lit d\'examen électrique à hauteur variable, structure renforcée.', delivery: '10-15 jours ouvrés' },
    { slug: 'sterilisateur-autoclave-classe-b', name: 'Stérilisateur Autoclave Classe B', cat: 'Chirurgie', price: '480 000 DZD', sku: 'SARI-STR-003', desc: 'Autoclave Classe B conforme aux normes, cycles rapides.', delivery: '7-12 jours ouvrés' },
    { slug: 'tensiometre-digital-pro', name: 'Tensiomètre Digital Pro', cat: 'Diagnostic', price: '28 500 DZD', sku: 'SARI-TEN-004', desc: 'Tensiomètre électronique professionnel avec brassard adulte.', delivery: '3-5 jours ouvrés' },
    { slug: 'moniteur-signes-vitaux-5-parametres', name: 'Moniteur de Signes Vitaux 5 Paramètres', cat: 'Réanimation', price: '265 000 DZD', sku: 'SARI-MON-005', desc: 'Moniteur multiparamétrique : ECG, SpO2, PNIA, température, respiration.', delivery: '7-12 jours ouvrés' },
    { slug: 'defibrillateur-biphasique', name: 'Défibrillateur Biphasique', cat: 'Urgence', price: '690 000 DZD', sku: 'SARI-DEF-006', desc: 'Défibrillateur biphasique avec mode AED et moniteur intégré.', delivery: '7-12 jours ouvrés' },
  ],
  en: [
    { slug: 'portable-ultrasound-pro-x1', name: 'Portable Ultrasound Pro X1', cat: 'Diagnostic', price: 'DZD 1,450,000', sku: 'SARI-ECH-001', desc: 'Portable ultrasound with convex and linear probes.', delivery: '5-10 business days' },
    { slug: 'premium-electric-examination-table', name: 'Premium Electric Examination Table', cat: 'Equipment', price: 'DZD 320,000', sku: 'SARI-LIT-002', desc: 'Electric examination table with adjustable height.', delivery: '10-15 business days' },
    { slug: 'class-b-autoclave-sterilizer', name: 'Class B Autoclave Sterilizer', cat: 'Surgery', price: 'DZD 480,000', sku: 'SARI-STR-003', desc: 'Class B autoclave with fast cycles.', delivery: '7-12 business days' },
    { slug: 'digital-pro-blood-pressure-monitor', name: 'Digital Pro Blood Pressure Monitor', cat: 'Diagnostic', price: 'DZD 28,500', sku: 'SARI-TEN-004', desc: 'Professional electronic blood pressure monitor.', delivery: '3-5 business days' },
    { slug: '5-parameter-vital-signs-monitor', name: '5-Parameter Vital Signs Monitor', cat: 'Intensive Care', price: 'DZD 265,000', sku: 'SARI-MON-005', desc: 'Multiparameter monitor: ECG, SpO2, NIBP, temperature, respiration.', delivery: '7-12 business days' },
    { slug: 'biphasic-defibrillator', name: 'Biphasic Defibrillator', cat: 'Emergency', price: 'DZD 690,000', sku: 'SARI-DEF-006', desc: 'Biphasic defibrillator with AED mode and built-in monitor.', delivery: '7-12 business days' },
  ],
  ar: [
    { slug: 'echographe-portable-pro-x1', name: 'جهاز الموجات فوق الصوتية المحمول Pro X1', cat: 'التشخيص', price: '1,450,000 دج', sku: 'SARI-ECH-001', desc: 'جهاز موجات فوق صوتية محمول بمجسات محدبة وخطية.', delivery: '5-10 أيام عمل' },
    { slug: 'lit-examen-electrique-premium', name: 'سرير فحص كهربائي فاخر', cat: 'المعدات', price: '320,000 دج', sku: 'SARI-LIT-002', desc: 'سرير فحص كهربائي بارتفاع قابل للتعديل.', delivery: '10-15 يوم عمل' },
    { slug: 'sterilisateur-autoclave-classe-b', name: 'معقم أوتوكلاف الفئة B', cat: 'الجراحة', price: '480,000 دج', sku: 'SARI-STR-003', desc: 'معقم أوتوكلاف من الفئة B بدورات سريعة.', delivery: '7-12 يوم عمل' },
    { slug: 'tensiometre-digital-pro', name: 'جهاز قياس ضغط الدم الرقمي الاحترافي', cat: 'التشخيص', price: '28,500 دج', sku: 'SARI-TEN-004', desc: 'جهاز قياس ضغط الدم الإلكتروني الاحترافي.', delivery: '3-5 أيام عمل' },
    { slug: 'moniteur-signes-vitaux-5-parametres', name: 'جهاز مراقبة العلامات الحيوية 5 معايير', cat: 'الإنعاش', price: '265,000 دج', sku: 'SARI-MON-005', desc: 'جهاز مراقبة متعدد المعايير: تخطيط القلب، تشبع الأكسجين، الضغط، الحرارة، التنفس.', delivery: '7-12 يوم عمل' },
    { slug: 'defibrillateur-biphasique', name: 'جهاز صدمات القلب ثنائي الطور', cat: 'الطوارئ', price: '690,000 دج', sku: 'SARI-DEF-006', desc: 'جهاز صدمات ثنائي الطور مع وضع AED وشاشة مدمجة.', delivery: '7-12 يوم عمل' },
  ],
};

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const SERVICES = {
  fr: [
    { slug: 'vente-equipements', title: "Vente d'Équipements Médicaux", icon: 'shopping-cart', desc: 'Large gamme d\'équipements neufs et reconditionnés pour les structures de santé.' },
    { slug: 'installation-mise-en-service', title: 'Installation & Mise en Service', icon: 'settings', desc: 'Installation, calibration et mise en service par nos techniciens agréés.' },
    { slug: 'maintenance-sav', title: 'Maintenance & SAV', icon: 'wrench', desc: 'Contrats de maintenance préventive et corrective avec pièces d\'origine.' },
    { slug: 'formation-personnel', title: 'Formation du Personnel Soignant', icon: 'graduation-cap', desc: 'Formation à l\'utilisation des équipements sur site ou dans nos locaux.' },
    { slug: 'conseil-ingenierie', title: 'Conseil & Ingénierie Biomédicale', icon: 'clipboard', desc: 'Étude des besoins et accompagnement dans les appels d\'offres.' },
  ],
  en: [
    { slug: 'equipment-sales', title: 'Medical Equipment Sales', icon: 'shopping-cart', desc: 'Wide range of new and refurbished equipment for healthcare facilities.' },
    { slug: 'installation-commissioning', title: 'Installation & Commissioning', icon: 'settings', desc: 'Installation, calibration and commissioning by certified technicians.' },
    { slug: 'maintenance-after-sales', title: 'Maintenance & After-Sales', icon: 'wrench', desc: 'Preventive and corrective maintenance contracts with original parts.' },
    { slug: 'staff-training', title: 'Healthcare Staff Training', icon: 'graduation-cap', desc: 'On-site training on equipment use.' },
    { slug: 'biomedical-consulting', title: 'Biomedical Consulting', icon: 'clipboard', desc: 'Needs assessment and tender support.' },
  ],
  ar: [
    { slug: 'vente-equipements', title: 'بيع المعدات الطبية', icon: 'shopping-cart', desc: 'تشكيلة واسعة من المعدات الجديدة والمجددة للمؤسسات الصحية.' },
    { slug: 'installation-mise-en-service', title: 'التركيب والتشغيل', icon: 'settings', desc: 'التركيب والمعايرة والتشغيل من قبل تقنيين معتمدين.' },
    { slug: 'maintenance-sav', title: 'الصيانة وخدمة ما بعد البيع', icon: 'wrench', desc: 'عقود صيانة وقائية وتصحيحية بقطع أصلية.' },
    { slug: 'formation-personnel', title: 'تكوين الطاقم الطبي', icon: 'graduation-cap', desc: 'تكوين حول استخدام المعدات في الموقع أو بمقرنا.' },
    { slug: 'conseil-ingenierie', title: 'الاستشارة والهندسة الطبية', icon: 'clipboard', desc: 'دراسة الاحتياجات والمرافقة في طلبات العروض.' },
  ],
};

// ---------------------------------------------------------------------------
// Partenaires
// ---------------------------------------------------------------------------
const PARTNERS = {
  fr: [
    { name: 'MediTech Algérie', category: 'Distributeur', website: 'https://meditech.dz' },
    { name: 'Mindray — Représentant officiel Algérie', category: 'Fabricant', website: 'https://mindray.com' },
    { name: 'Philips Healthcare', category: 'Fabricant', website: 'https://philips.com' },
    { name: 'GE Healthcare', category: 'Fabricant', website: 'https://gehealthcare.com' },
    { name: 'HealForce Medical', category: 'Fabricant', website: 'https://healforce.com' },
  ],
  en: [
    { name: 'MediTech Algeria', category: 'Distributor', website: 'https://meditech.dz' },
    { name: 'Mindray — Official representative in Algeria', category: 'Manufacturer', website: 'https://mindray.com' },
    { name: 'Philips Healthcare', category: 'Manufacturer', website: 'https://philips.com' },
    { name: 'GE Healthcare', category: 'Manufacturer', website: 'https://gehealthcare.com' },
    { name: 'HealForce Medical', category: 'Manufacturer', website: 'https://healforce.com' },
  ],
  ar: [
    { name: 'ميديتك الجزائر', category: 'موزع', website: 'https://meditech.dz' },
    { name: 'مايندراي — الممثل الرسمي في الجزائر', category: 'مصنع', website: 'https://mindray.com' },
    { name: 'فيليبس للرعاية الصحية', category: 'مصنع', website: 'https://philips.com' },
    { name: 'جي إي للرعاية الصحية', category: 'مصنع', website: 'https://gehealthcare.com' },
    { name: 'هيل فورس الطبية', category: 'مصنع', website: 'https://healforce.com' },
  ],
};

// ---------------------------------------------------------------------------
// Carrières (wilayas + salaires en DZD)
// ---------------------------------------------------------------------------
const CAREERS = {
  fr: [
    { slug: 'technicien-biomedical', title: 'Technicien Biomédical H/F', type: 'CDI', loc: 'Alger', salary: '45 000 - 70 000 DZD', desc: 'Maintenance et installation des équipements médicaux.' },
    { slug: 'ingenieur-commercial-medical', title: 'Ingénieur Commercial Médical', type: 'CDI', loc: 'Oran', salary: '60 000 - 90 000 DZD', desc: 'Développement du portefeuille clients (hôpitaux, cliniques).' },
    { slug: 'responsable-logistique', title: 'Responsable Logistique', type: 'CDD', loc: 'Blida', salary: '50 000 - 75 000 DZD', desc: 'Gestion des stocks et de la distribution sur les 58 wilayas.' },
    { slug: 'technico-commercial-imagerie', title: 'Technico-Commercial Imagerie Médicale', type: 'CDI', loc: 'Constantine', salary: '55 000 - 85 000 DZD', desc: 'Vente et démonstration des solutions d\'imagerie.' },
  ],
  en: [
    { slug: 'biomedical-technician', title: 'Biomedical Technician (M/F)', type: 'Permanent', loc: 'Algiers', salary: 'DZD 45,000 - 70,000', desc: 'Maintenance and installation of medical equipment.' },
    { slug: 'medical-sales-engineer', title: 'Medical Sales Engineer', type: 'Permanent', loc: 'Oran', salary: 'DZD 60,000 - 90,000', desc: 'Develop the client portfolio (hospitals, clinics).' },
    { slug: 'logistics-manager', title: 'Logistics Manager', type: 'Contract', loc: 'Blida', salary: 'DZD 50,000 - 75,000', desc: 'Stock and distribution management across the 58 wilayas.' },
    { slug: 'imaging-sales-specialist', title: 'Medical Imaging Sales Specialist', type: 'Permanent', loc: 'Constantine', salary: 'DZD 55,000 - 85,000', desc: 'Sales and demo of imaging solutions.' },
  ],
  ar: [
    { slug: 'technicien-biomedical', title: 'تقني بيوطبي (م/ج)', type: 'عقد دائم', loc: 'الجزائر', salary: '45,000 - 70,000 دج', desc: 'صيانة وتركيب المعدات الطبية.' },
    { slug: 'ingenieur-commercial-medical', title: 'مهندس تجاري طبي', type: 'عقد دائم', loc: 'وهران', salary: '60,000 - 90,000 دج', desc: 'تطوير محفظة العملاء (مستشفيات، عيادات).' },
    { slug: 'responsable-logistique', title: 'مسؤول اللوجستيك', type: 'عقد محدد', loc: 'البليدة', salary: '50,000 - 75,000 دج', desc: 'إدارة المخزون والتوزيع عبر 58 ولاية.' },
    { slug: 'technico-commercial-imagerie', title: 'تقني تجاري في التصوير الطبي', type: 'عقد دائم', loc: 'قسنطينة', salary: '55,000 - 85,000 دج', desc: 'بيع وعرض حلول التصوير الطبي.' },
  ],
};

// ---------------------------------------------------------------------------
// Solutions (catégories)
// ---------------------------------------------------------------------------
const SOLUTIONS = {
  fr: [
    { slug: 'diagnostic', title: 'Diagnostic & Imagerie', desc: 'Échographes, tensiomètres et appareils de diagnostic de proximité.' },
    { slug: 'cardiology', title: 'Cardiologie', desc: 'ECG, défibrillateurs et moniteurs cardiaques.' },
    { slug: 'imaging', title: 'Imagerie Médicale', desc: 'Radiologie, scanner et solutions d\'imagerie.' },
    { slug: 'surgery', title: 'Chirurgie', desc: 'Instruments, autoclaves et tables opératoires.' },
    { slug: 'pediatrics', title: 'Pédiatrie', desc: 'Couveuses, balances et lampes de photothérapie.' },
    { slug: 'emergency', title: 'Urgence & Réanimation', desc: 'Défibrillateurs, chariots d\'urgence et ventilation.' },
    { slug: 'informatics', title: 'Informatique Médicale', desc: 'DMP, télémédecine et PACS/RIS.' },
    { slug: 'laboratory', title: 'Laboratoire', desc: 'Analyseurs, microscopes et centrifugeuses.' },
    { slug: 'rehabilitation', title: 'Rééducation', desc: 'Tables de kinésithérapie et électrothérapie.' },
  ],
  en: [
    { slug: 'diagnostic', title: 'Diagnostics & Imaging', desc: 'Ultrasound, blood pressure monitors and point-of-care devices.' },
    { slug: 'cardiology', title: 'Cardiology', desc: 'ECG, defibrillators and cardiac monitors.' },
    { slug: 'imaging', title: 'Medical Imaging', desc: 'Radiology, CT and imaging solutions.' },
    { slug: 'surgery', title: 'Surgery', desc: 'Instruments, autoclaves and operating tables.' },
    { slug: 'pediatrics', title: 'Pediatrics', desc: 'Incubators, scales and phototherapy lamps.' },
    { slug: 'emergency', title: 'Emergency & Intensive Care', desc: 'Defibrillators, crash carts and ventilation.' },
    { slug: 'informatics', title: 'Medical Informatics', desc: 'EMR, telemedicine and PACS/RIS.' },
    { slug: 'laboratory', title: 'Laboratory', desc: 'Analyzers, microscopes and centrifuges.' },
    { slug: 'rehabilitation', title: 'Rehabilitation', desc: 'Physiotherapy tables and electrotherapy.' },
  ],
  ar: [
    { slug: 'diagnostic', title: 'التشخيص والتصوير', desc: 'أجهزة الموجات فوق الصوتية وأجهزة قياس الضغط وأجهزة التشخيص.' },
    { slug: 'cardiology', title: 'أمراض القلب', desc: 'تخطيط القلب وأجهزة الصدمات وشاشات القلب.' },
    { slug: 'imaging', title: 'التصوير الطبي', desc: 'الأشعة والماسح الضوئي وحلول التصوير.' },
    { slug: 'surgery', title: 'الجراحة', desc: 'الأدوات والمعقمات وطاولات العمليات.' },
    { slug: 'pediatrics', title: 'طب الأطفال', desc: 'الحضانات والموازين ومصابيح العلاج الضوئي.' },
    { slug: 'emergency', title: 'الطوارئ والإنعاش', desc: 'أجهزة الصدمات وعربات الطوارئ والتهوية.' },
    { slug: 'informatics', title: 'المعلوماتية الطبية', desc: 'الملف الطبي والتطبيب عن بعد وأنظمة PACS/RIS.' },
    { slug: 'laboratory', title: 'المختبر', desc: 'أجهزة التحليل والمجاهر وأجهزة الطرد المركزي.' },
    { slug: 'rehabilitation', title: 'إعادة التأهيل', desc: 'طاولات العلاج الطبيعي والعلاج الكهربائي.' },
  ],
};

// ---------------------------------------------------------------------------
// Témoignages (médecins algériens)
// ---------------------------------------------------------------------------
const TESTIMONIALS = {
  fr: [
    { name: 'Dr. Amine KHALFI', role: 'Directeur Médical', clinic: 'Clinique El Afia, Alger', text: 'SARI Système nous accompagne depuis 10 ans. Réactivité et qualité des équipements exceptionnelles, avec un SAV toujours disponible.', rating: 5 },
    { name: 'Dr. Salima BOUZID', role: 'Cheffe de service Imagerie', clinic: 'CHU Mustapha Pacha, Alger', text: 'Installation rapide et formation du personnel très professionnelle. Un partenaire de confiance pour notre service.', rating: 5 },
    { name: 'Dr. Yacine HAMDI', role: 'Cardiologue', clinic: 'Clinique Ibn Rochd, Oran', text: 'Le moniteur et le défibrillateur livrés étaient conformes et parfaitement calibrés. Je recommande vivement.', rating: 5 },
    { name: 'Dr. Nadia MERABET', role: 'Pharmacienne Hospitalière', clinic: 'EPH Beni Messous, Alger', text: 'Un accompagnement de A à Z, de l\'étude du besoin jusqu\'à la maintenance. Très satisfaite du suivi.', rating: 4 },
  ],
  en: [
    { name: 'Dr. Amine KHALFI', role: 'Medical Director', clinic: 'El Afia Clinic, Algiers', text: 'SARI Système has supported us for 10 years. Outstanding responsiveness and equipment quality with an always-available after-sales service.', rating: 5 },
    { name: 'Dr. Salima BOUZID', role: 'Head of Imaging', clinic: 'Mustapha Pacha University Hospital, Algiers', text: 'Fast installation and very professional staff training. A trusted partner for our department.', rating: 5 },
    { name: 'Dr. Yacine HAMDI', role: 'Cardiologist', clinic: 'Ibn Rochd Clinic, Oran', text: 'The monitor and defibrillator delivered were compliant and perfectly calibrated. Highly recommended.', rating: 5 },
    { name: 'Dr. Nadia MERABET', role: 'Hospital Pharmacist', clinic: 'Beni Messous EPH, Algiers', text: 'End-to-end support from needs assessment to maintenance. Very satisfied.', rating: 4 },
  ],
  ar: [
    { name: 'د. أمين خالفي', role: 'المدير الطبي', clinic: 'عيادة العافية، الجزائر', text: 'ترافقنا ساري سيستم منذ 10 سنوات. سرعة الاستجابة وجودة المعدات استثنائية مع خدمة ما بعد البيع متاحة دائمًا.', rating: 5 },
    { name: 'د. سليمة بوزيد', role: 'رئيسة مصلحة التصوير', clinic: 'المستشفى الجامعي مصطفى باشا، الجزائر', text: 'تركيب سريع وتكوين احترافي للطاقم. شريك موثوق لمصلحتنا.', rating: 5 },
    { name: 'د. ياسين حمدي', role: 'طبيب قلب', clinic: 'عيادة ابن رشد، وهران', text: 'الشاشة وجهاز الصدمات المسلّمان كانا مطابقين ومعايرين بشكل مثالي. أنصح بهما بشدة.', rating: 5 },
    { name: 'د. نادية مرابط', role: 'صيدلانية استشفائية', clinic: 'المؤسسة العمومية الاستشفائية بني مسوس، الجزائر', text: 'مرافقة شاملة من دراسة الحاجة إلى الصيانة. راضية جدًا عن المتابعة.', rating: 4 },
  ],
};

// ---------------------------------------------------------------------------
// Hero slides
// ---------------------------------------------------------------------------
const HERO = {
  fr: [
    { title: 'Équipements Médicaux de Pointe', subtitle: 'Distribution et installation sur les 58 wilayas', desc: 'Nous accompagnons hôpitaux, cliniques et cabinets avec des équipements certifiés et un service de proximité.', cta: 'Découvrir nos solutions', link: '/solutions' },
    { title: 'Service Après-Vente 24/7', subtitle: 'Techniciens agréés dans toute l\'Algérie', desc: 'Maintenance préventive et corrective avec pièces d\'origine.', cta: 'Nos services', link: '/services' },
    { title: 'Partenaires des Grands Fabricants', subtitle: 'Représentation officielle en Algérie', desc: 'Mindray, Philips, GE Healthcare et bien d\'autres.', cta: 'Voir le catalogue', link: '/products' },
  ],
  en: [
    { title: 'State-of-the-Art Medical Equipment', subtitle: 'Distribution and installation across the 58 wilayas', desc: 'We support hospitals, clinics and practices with certified equipment and local service.', cta: 'Discover our solutions', link: '/solutions' },
    { title: '24/7 After-Sales Service', subtitle: 'Certified technicians across Algeria', desc: 'Preventive and corrective maintenance with original parts.', cta: 'Our services', link: '/services' },
    { title: 'Partners of Leading Manufacturers', subtitle: 'Official representation in Algeria', desc: 'Mindray, Philips, GE Healthcare and more.', cta: 'View catalog', link: '/products' },
  ],
  ar: [
    { title: 'معدات طبية متطورة', subtitle: 'التوزيع والتركيب عبر 58 ولاية', desc: 'نرافق المستشفيات والعيادات بمعدات معتمدة وخدمة قريبة.', cta: 'اكتشف حلولنا', link: '/solutions' },
    { title: 'خدمة ما بعد البيع 24/7', subtitle: 'تقنيون معتمدون في كامل التراب الوطني', desc: 'صيانة وقائية وتصحيحية بقطع أصلية.', cta: 'خدماتنا', link: '/services' },
    { title: 'شركاء كبار المصنعين', subtitle: 'تمثيل رسمي في الجزائر', desc: 'مايندراي، فيليبس، جي إي للرعاية الصحية وغيرها.', cta: 'تصفح الكتالوج', link: '/products' },
  ],
};

// ---------------------------------------------------------------------------
// Actualités
// ---------------------------------------------------------------------------
const NEWS = {
  fr: [
    { slug: 'participation-simem-2026', title: 'SARI Système au SIMEM 2026', category: 'Événement', classification: 'Salon', sujet: 'Salon médical', readTime: '3 min', date: '2026-04-10 09:00:00.000', desc: 'Retrouvez-nous au Salon International du Médical, SAFEX Alger.', content: '<p>SARI Système exposera ses dernières solutions d\'imagerie et de réanimation au SIMEM 2026.</p>' },
    { slug: 'nouvelle-gamme-echographes-portables', title: 'Nouvelle gamme d\'échographes portables', category: 'Produits', classification: 'Innovation', sujet: 'Imagerie', readTime: '4 min', date: '2026-03-02 09:00:00.000', desc: 'Échographes portables avec IA intégrée pour la médecine de proximité.', content: '<p>Une gamme compacte et connectée, pensée pour les structures mobiles et les zones éloignées.</p>' },
    { slug: 'partenariat-chu-mustapha-pacha', title: 'Partenariat avec le CHU Mustapha Pacha', category: 'Institutionnel', classification: 'Partenariat', sujet: 'Santé publique', readTime: '2 min', date: '2026-01-20 09:00:00.000', desc: 'Équipement du service d\'imagerie du CHU d\'Alger.', content: '<p>Signature d\'une convention pour l\'équipement et la maintenance du plateau d\'imagerie.</p>' },
  ],
  en: [
    { slug: 'sari-systeme-at-simem-2026', title: 'SARI Système at SIMEM 2026', category: 'Event', classification: 'Trade show', sujet: 'Medical fair', readTime: '3 min', date: '2026-04-10 09:00:00.000', desc: 'Meet us at the International Medical Exhibition, SAFEX Algiers.', content: '<p>SARI Système will showcase its latest imaging and intensive care solutions at SIMEM 2026.</p>' },
    { slug: 'new-portable-ultrasound-range', title: 'New portable ultrasound range', category: 'Products', classification: 'Innovation', sujet: 'Imaging', readTime: '4 min', date: '2026-03-02 09:00:00.000', desc: 'Portable ultrasounds with built-in AI for point-of-care medicine.', content: '<p>A compact, connected range designed for mobile units and remote areas.</p>' },
    { slug: 'partnership-with-mustapha-pacha-hospital', title: 'Partnership with Mustapha Pacha University Hospital', category: 'Institutional', classification: 'Partnership', sujet: 'Public health', readTime: '2 min', date: '2026-01-20 09:00:00.000', desc: 'Equipping the imaging department of the Algiers hospital.', content: '<p>Signing of an agreement to equip and maintain the imaging platform.</p>' },
  ],
  ar: [
    { slug: 'participation-simem-2026', title: 'ساري سيستم في SIMEM 2026', category: 'حدث', classification: 'معرض', sujet: 'المعرض الطبي', readTime: '3 د', date: '2026-04-10 09:00:00.000', desc: 'زورونا في الصالون الدولي للطب، قصر المعارض SAFEX الجزائر.', content: '<p>ستعرض ساري سيستم أحدث حلول التصوير والإنعاش في SIMEM 2026.</p>' },
    { slug: 'nouvelle-gamme-echographes-portables', title: 'تشكيلة جديدة من أجهزة الموجات فوق الصوتية المحمولة', category: 'منتجات', classification: 'ابتكار', sujet: 'التصوير', readTime: '4 د', date: '2026-03-02 09:00:00.000', desc: 'أجهزة محمولة بذكاء اصطناعي مدمج للطب القريب.', content: '<p>تشكيلة مدمجة ومتصلة، مصممة للوحدات المتنقلة والمناطق النائية.</p>' },
    { slug: 'partenariat-chu-mustapha-pacha', title: 'شراكة مع المستشفى الجامعي مصطفى باشا', category: 'مؤسساتي', classification: 'شراكة', sujet: 'الصحة العمومية', readTime: '2 د', date: '2026-01-20 09:00:00.000', desc: 'تجهيز مصلحة التصوير بمستشفى الجزائر.', content: '<p>توقيع اتفاقية لتجهيز وصيانة منصة التصوير.</p>' },
  ],
};

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------
const EVENTS = {
  fr: [
    { slug: 'simem-2026', title: 'SIMEM 2026 — Salon International du Médical', type: 'Salon', date: '2026-04-15 09:00:00.000', loc: 'SAFEX, Pins Maritimes, Alger', desc: 'Stand B12 — démonstrations d\'imagerie et de réanimation.' },
    { slug: 'journees-medicales-alger', title: 'Journées Médicales d\'Alger', type: 'Congrès', date: '2026-06-05 09:00:00.000', loc: 'Hôtel El Aurassi, Alger', desc: 'Conférence sur les nouvelles technologies biomédicales.' },
    { slug: 'forum-sante-oran', title: 'Forum Santé Oran', type: 'Forum', date: '2026-09-18 09:00:00.000', loc: 'Centre des Conventions d\'Oran', desc: 'Rencontres avec les professionnels de la santé de l\'Ouest.' },
  ],
  en: [
    { slug: 'simem-2026', title: 'SIMEM 2026 — International Medical Exhibition', type: 'Trade show', date: '2026-04-15 09:00:00.000', loc: 'SAFEX, Pins Maritimes, Algiers', desc: 'Booth B12 — imaging and intensive care demos.' },
    { slug: 'algiers-medical-days', title: 'Algiers Medical Days', type: 'Congress', date: '2026-06-05 09:00:00.000', loc: 'El Aurassi Hotel, Algiers', desc: 'Conference on new biomedical technologies.' },
    { slug: 'oran-health-forum', title: 'Oran Health Forum', type: 'Forum', date: '2026-09-18 09:00:00.000', loc: 'Oran Convention Centre', desc: 'Meetings with Western Algeria healthcare professionals.' },
  ],
  ar: [
    { slug: 'simem-2026', title: 'SIMEM 2026 — الصالون الدولي للطب', type: 'معرض', date: '2026-04-15 09:00:00.000', loc: 'قصر المعارض SAFEX، الصنوبر البحري، الجزائر', desc: 'الجناح B12 — عروض التصوير والإنعاش.' },
    { slug: 'journees-medicales-alger', title: 'الأيام الطبية للجزائر', type: 'مؤتمر', date: '2026-06-05 09:00:00.000', loc: 'فندق الأوراسي، الجزائر', desc: 'محاضرة حول التقنيات الطبية الحيوية الجديدة.' },
    { slug: 'forum-sante-oran', title: 'منتدى الصحة بوهران', type: 'منتدى', date: '2026-09-18 09:00:00.000', loc: 'مركز المؤتمرات، وهران', desc: 'لقاءات مع مهنيي الصحة في الغرب الجزائري.' },
  ],
};

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
const FAQS = {
  fr: [
    { q: 'Livrez-vous sur tout le territoire algérien ?', a: 'Oui, nous livrons sur les 58 wilayas. Les délais varient de 3 à 15 jours ouvrés selon la wilaya et la disponibilité du produit.', cat: 'Livraison' },
    { q: 'Quels sont les modes de paiement acceptés ?', a: 'Virement bancaire, chèque, carte CIB / Edahabia et paiement à la livraison selon accord préalable.', cat: 'Paiement' },
    { q: 'Les prix sont-ils affichés en dinar algérien ?', a: 'Oui, tous nos prix sont en Dinar Algérien (DZD), hors TVA (19% ou 9% selon les produits).', cat: 'Tarifs' },
    { q: 'Proposez-vous une garantie et un service après-vente ?', a: 'Oui, garantie constructeur de 12 à 36 mois et SAV assuré par nos techniciens agréés sur l\'ensemble du territoire.', cat: 'Garantie' },
  ],
  en: [
    { q: 'Do you deliver across Algeria?', a: 'Yes, we deliver to all 58 wilayas. Lead times range from 3 to 15 business days.', cat: 'Delivery' },
    { q: 'Which payment methods are accepted?', a: 'Bank transfer, cheque, CIB / Edahabia card and cash on delivery subject to prior agreement.', cat: 'Payment' },
    { q: 'Are prices displayed in Algerian Dinar?', a: 'Yes, all prices are in Algerian Dinar (DZD), VAT excluded (19% or 9%).', cat: 'Pricing' },
    { q: 'Do you provide warranty and after-sales service?', a: 'Yes, 12 to 36 months manufacturer warranty with nationwide after-sales support.', cat: 'Warranty' },
  ],
  ar: [
    { q: 'هل توصلون عبر كامل التراب الجزائري؟', a: 'نعم، نوصل إلى جميع الولايات الـ58. تتراوح الآجال بين 3 و15 يوم عمل.', cat: 'التوصيل' },
    { q: 'ما هي وسائل الدفع المقبولة؟', a: 'تحويل بنكي، شيك، بطاقة CIB / الذهبية والدفع عند الاستلام بموافقة مسبقة.', cat: 'الدفع' },
    { q: 'هل الأسعار معروضة بالدينار الجزائري؟', a: 'نعم، جميع أسعارنا بالدينار الجزائري (DZD)، دون احتساب الرسم على القيمة المضافة (19% أو 9%).', cat: 'الأسعار' },
    { q: 'هل توفرون ضمانًا وخدمة ما بعد البيع؟', a: 'نعم، ضمان المصنع من 12 إلى 36 شهرًا وخدمة ما بعد البيع عبر كامل التراب الوطني.', cat: 'الضمان' },
  ],
};

// ---------------------------------------------------------------------------
// Messages de contact (exemples)
// ---------------------------------------------------------------------------
const MESSAGES = [
  { name: 'Dr. Farid MEZIANE', email: 'farid.meziane@polyclinique.dz', phone: '(+213) 21 44 55 66', subject: 'devis', message: 'Bonjour, je souhaite un devis pour 3 moniteurs multiparamétriques et 2 défibrillateurs.', status: 'new' },
  { name: 'Mme. Karima BENSAID', email: 'k.bensaid@clinique-sante.dz', phone: '(+213) 550 11 22 33', subject: 'sav', message: 'Nous avons besoin d\'une intervention de maintenance sur notre autoclave.', status: 'read' },
  { name: 'M. Rachid HADDAD', email: 'r.haddad@cabinet.dz', phone: '(+213) 770 44 55 66', subject: 'partenariat', message: 'Je souhaite devenir revendeur agréé dans la wilaya de Sétif.', status: 'new' },
];

// ---------------------------------------------------------------------------
// Paramètres (settings)
// ---------------------------------------------------------------------------
const SETTINGS = [
  { key: 'site_logo', group: 'general', value: { url: '' } },
  { key: 'require_auth_to_apply', group: 'commerce', value: { enabled: false } },
  { key: 'restock_message', group: 'commerce', value: { message: 'Votre commande sera traitée dans les meilleurs délais. Nouvel arrivage prévu le {{date_reapprovisionnement}}.' } },
  { key: 'code_formats', group: 'commerce', value: { quote: 'SARI-WDEV-{ID}', order: 'SARI-WCMD{XX}-{ID}', invoice: 'SARI-WFAV{XX}-{ID}', product: 'SARI-WPRO{XX}-{ID}' } },
];

// ---------------------------------------------------------------------------
// Génération SQL
// ---------------------------------------------------------------------------
const L = [];
const push = (s) => L.push(s);

push('-- =============================================================================');
push('-- SARI CMS — Données de démarrage (contexte algérien)');
push('-- Généré par backend/sql/generate-seed.mjs — ne pas éditer à la main.');
push('-- Mot de passe de démo (tous les comptes) : ' + DEMO_PASSWORD);
push('-- =============================================================================');
push('');
push('SET NAMES utf8mb4;');
push('USE `sari_cms`;');
push('');
push('-- ---------------------------------------------------------------------------');
push('-- Permissions');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `permissions` (`id`, `resource`, `action`, `description`, `createdAt`, `updatedAt`) VALUES');
const permRows = [];
const PERM_DESC = { create: 'Créer', read: 'Consulter', update: 'Modifier', delete: 'Supprimer', admin: 'Administrer' };
for (const r of RESOURCES) for (const a of ACTIONS) {
  permRows.push(`(${esc(permId(r, a))}, ${esc(r)}, ${esc(a)}, ${esc(PERM_DESC[a] + ' ' + r)}, ${esc(now)}, ${esc(now)})`);
}
push(permRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Rôles');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `roles` (`id`, `name`, `slug`, `description`, `isSystem`, `permissionIds`, `createdAt`, `updatedAt`) VALUES');
const roleRows = ROLES.map((role) => {
  const rid = id('role', role.slug);
  const perms = rolePermKeys[role.slug];
  const permIds = perms.map((k) => { const [rr, aa] = k.split(':'); return permId(rr, aa); });
  return `(${esc(rid)}, ${esc(role.name)}, ${esc(role.slug)}, ${esc(role.desc)}, ${role.system}, ${json(permIds)}, ${esc(now)}, ${esc(now)})`;
});
push(roleRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- role_permissions (liens rôles ↔ permissions)');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `role_permissions` (`roleId`, `permissionId`) VALUES');
const rpRows = [];
for (const role of ROLES) {
  const rid = id('role', role.slug);
  for (const k of rolePermKeys[role.slug]) {
    const [rr, aa] = k.split(':');
    rpRows.push(`(${esc(rid)}, ${esc(permId(rr, aa))})`);
  }
}
push(rpRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Utilisateurs');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `users` (`id`, `email`, `passwordHash`, `firstName`, `lastName`, `phone`, `company`, `type`, `status`, `locale`, `roleId`, `address`, `wilaya`, `country`, `position`, `createdAt`, `updatedAt`) VALUES');
const userRows = USERS.map((u) => {
  const rid = u.role ? id('role', u.role) : null;
  return `(${esc(id('user', u.email))}, ${esc(u.email)}, ${esc(passwordHash)}, ${esc(u.first)}, ${esc(u.last)}, ${esc(u.phone ?? null)}, ${esc(u.company ?? null)}, ${esc(u.type)}, ${esc(u.status)}, 'fr', ${esc(rid)}, ${esc(u.address ?? null)}, ${esc(u.wilaya ?? null)}, ${esc(u.country ?? null)}, ${esc(u.position ?? null)}, ${esc(now)}, ${esc(now)})`;
});
push(userRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Coordonnées (contact_info)');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `contact_info` (`id`, `locale`, `company`, `tagline`, `phone`, `email`, `address`, `hours`, `currency`, `social`, `extras`, `createdAt`, `updatedAt`) VALUES');
const contactRows = Object.entries(CONTACT).map(([loc, c]) => {
  return `(${esc(id('contact', loc))}, ${esc(loc)}, ${esc(c.company)}, ${esc(c.tagline)}, ${esc(c.phone)}, ${esc(c.email)}, ${esc(c.address)}, ${esc(c.hours)}, ${esc(c.currency)}, ${json(c.social)}, ${json(c.extras)}, ${esc(now)}, ${esc(now)})`;
});
push(contactRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Menus');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `menus` (`id`, `locale`, `name`, `location`, `items`, `status`, `createdAt`, `updatedAt`) VALUES');
const menuRows = [];
for (const loc of Object.keys(MENUS)) {
  const m = MENUS[loc];
  menuRows.push(`(${esc(id('menu', loc + ':main'))}, ${esc(loc)}, 'Menu principal', 'main', ${json(m.main)}, 'published', ${esc(now)}, ${esc(now)})`);
  menuRows.push(`(${esc(id('menu', loc + ':footer-nav'))}, ${esc(loc)}, 'Navigation pied de page', 'footer-nav', ${json(m.nav)}, 'published', ${esc(now)}, ${esc(now)})`);
  menuRows.push(`(${esc(id('menu', loc + ':footer-legal'))}, ${esc(loc)}, 'Liens légaux', 'footer-legal', ${json(m.legal)}, 'published', ${esc(now)}, ${esc(now)})`);
}
push(menuRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Pages légales + À propos');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `pages` (`id`, `slug`, `locale`, `kind`, `subtype`, `title`, `content`, `status`, `publishedAt`, `sortOrder`, `createdAt`, `updatedAt`) VALUES');
const pageRows = [];
for (const loc of Object.keys(PAGES)) {
  for (const [key, p] of Object.entries(PAGES[loc])) {
    pageRows.push(`(${esc(id('page', loc + ':' + key))}, ${esc(key)}, ${esc(loc)}, ${esc(key === 'about' ? 'about' : 'legal')}, 'simple', ${esc(p.title)}, ${esc(p.content)}, 'published', ${esc(now)}, ${key === 'about' ? 1 : 0}, ${esc(now)}, ${esc(now)})`);
  }
}
push(pageRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Produits');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `products` (`id`, `locale`, `slug`, `name`, `category`, `sku`, `price`, `shortDesc`, `image`, `inStock`, `stockQty`, `currency`, `sortOrder`, `deliveryTime`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES');
const productRows = [];
for (const loc of Object.keys(PRODUCTS)) {
  PRODUCTS[loc].forEach((p, i) => {
    productRows.push(`(${esc(id('product', loc + ':' + p.slug))}, ${esc(loc)}, ${esc(p.slug)}, ${esc(p.name)}, ${esc(p.cat)}, ${esc(p.sku)}, ${esc(p.price)}, ${esc(p.desc)}, NULL, 1, 10, 'DZD', ${i + 1}, ${esc(p.delivery)}, 'published', ${esc(now)}, ${esc(now)}, ${esc(now)})`);
  });
}
push(productRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Services');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `services` (`id`, `locale`, `slug`, `title`, `icon`, `shortDesc`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES');
const serviceRows = [];
for (const loc of Object.keys(SERVICES)) {
  SERVICES[loc].forEach((s, i) => {
    serviceRows.push(`(${esc(id('service', loc + ':' + s.slug))}, ${esc(loc)}, ${esc(s.slug)}, ${esc(s.title)}, ${esc(s.icon)}, ${esc(s.desc)}, ${i + 1}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(serviceRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Partenaires');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `partners` (`id`, `locale`, `name`, `category`, `website`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES');
const partnerRows = [];
for (const loc of Object.keys(PARTNERS)) {
  PARTNERS[loc].forEach((p, i) => {
    partnerRows.push(`(${esc(id('partner', loc + ':' + i))}, ${esc(loc)}, ${esc(p.name)}, ${esc(p.category)}, ${esc(p.website)}, ${i + 1}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(partnerRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Carrières');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `careers` (`id`, `locale`, `slug`, `title`, `type`, `location`, `salary`, `shortDesc`, `sortOrder`, `legacyId`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES');
const careerRows = [];
for (const loc of Object.keys(CAREERS)) {
  CAREERS[loc].forEach((c, i) => {
    careerRows.push(`(${esc(id('career', loc + ':' + c.slug))}, ${esc(loc)}, ${esc(c.slug)}, ${esc(c.title)}, ${esc(c.type)}, ${esc(c.loc)}, ${esc(c.salary)}, ${esc(c.desc)}, ${i + 1}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)}, ${esc(now)})`);
  });
}
push(careerRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Solutions');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `solutions` (`id`, `locale`, `slug`, `title`, `shortDesc`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES');
const solutionRows = [];
for (const loc of Object.keys(SOLUTIONS)) {
  SOLUTIONS[loc].forEach((s, i) => {
    solutionRows.push(`(${esc(id('solution', loc + ':' + s.slug))}, ${esc(loc)}, ${esc(s.slug)}, ${esc(s.title)}, ${esc(s.desc)}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(solutionRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Témoignages');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `testimonials` (`id`, `locale`, `name`, `role`, `clinic`, `text`, `rating`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES');
const testimonialRows = [];
for (const loc of Object.keys(TESTIMONIALS)) {
  TESTIMONIALS[loc].forEach((t, i) => {
    testimonialRows.push(`(${esc(id('testimonial', loc + ':' + i))}, ${esc(loc)}, ${esc(t.name)}, ${esc(t.role)}, ${esc(t.clinic)}, ${esc(t.text)}, ${t.rating}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(testimonialRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Hero slides');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `hero_slides` (`id`, `locale`, `title`, `subtitle`, `description`, `cta`, `ctaLink`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES');
const heroRows = [];
for (const loc of Object.keys(HERO)) {
  HERO[loc].forEach((h, i) => {
    heroRows.push(`(${esc(id('hero', loc + ':' + i))}, ${esc(loc)}, ${esc(h.title)}, ${esc(h.subtitle)}, ${esc(h.desc)}, ${esc(h.cta)}, ${esc(h.link)}, ${i + 1}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(heroRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Actualités');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `news_articles` (`id`, `locale`, `slug`, `title`, `category`, `classification`, `sujet`, `authorName`, `date`, `readTime`, `shortDesc`, `fullContent`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES');
const newsRows = [];
for (const loc of Object.keys(NEWS)) {
  NEWS[loc].forEach((n) => {
    newsRows.push(`(${esc(id('news', loc + ':' + n.slug))}, ${esc(loc)}, ${esc(n.slug)}, ${esc(n.title)}, ${esc(n.category)}, ${esc(n.classification)}, ${esc(n.sujet)}, 'SARI Système', ${esc(n.date)}, ${esc(n.readTime)}, ${esc(n.desc)}, ${esc(n.content)}, 'published', ${esc(n.date)}, ${esc(now)}, ${esc(now)})`);
  });
}
push(newsRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Événements');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `events` (`id`, `locale`, `slug`, `title`, `type`, `date`, `location`, `shortDesc`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES');
const eventRows = [];
for (const loc of Object.keys(EVENTS)) {
  EVENTS[loc].forEach((e) => {
    eventRows.push(`(${esc(id('event', loc + ':' + e.slug))}, ${esc(loc)}, ${esc(e.slug)}, ${esc(e.title)}, ${esc(e.type)}, ${esc(e.date)}, ${esc(e.loc)}, ${esc(e.desc)}, 'published', ${esc(e.date)}, ${esc(now)}, ${esc(now)})`);
  });
}
push(eventRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- FAQ');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `faqs` (`id`, `locale`, `question`, `answer`, `category`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES');
const faqRows = [];
for (const loc of Object.keys(FAQS)) {
  FAQS[loc].forEach((f, i) => {
    faqRows.push(`(${esc(id('faq', loc + ':' + i))}, ${esc(loc)}, ${esc(f.q)}, ${esc(f.a)}, ${esc(f.cat)}, ${i + 1}, 'published', ${esc(now)}, ${esc(now)})`);
  });
}
push(faqRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Messages de contact');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `contact_messages` (`id`, `name`, `email`, `phone`, `subject`, `message`, `status`, `createdAt`, `updatedAt`) VALUES');
const messageRows = MESSAGES.map((m, i) => {
  return `(${esc(id('message', String(i)))}, ${esc(m.name)}, ${esc(m.email)}, ${esc(m.phone)}, ${esc(m.subject)}, ${esc(m.message)}, ${esc(m.status)}, ${esc(now)}, ${esc(now)})`;
});
push(messageRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Paramètres');
push('-- ---------------------------------------------------------------------------');
push('INSERT INTO `settings` (`id`, `key`, `value`, `group`, `createdAt`, `updatedAt`) VALUES');
const settingRows = SETTINGS.map((s) => {
  return `(${esc(id('setting', s.key))}, ${esc(s.key)}, ${json(s.value)}, ${esc(s.group)}, ${esc(now)}, ${esc(now)})`;
});
push(settingRows.join(',\n') + ';');
push('');

push('-- ---------------------------------------------------------------------------');
push('-- Journal d\'audit (entrée de démarrage)');
push('-- ---------------------------------------------------------------------------');
push(`INSERT INTO \`audit_logs\` (\`id\`, \`actorId\`, \`action\`, \`resource\`, \`resourceId\`, \`payload\`, \`createdAt\`, \`updatedAt\`) VALUES (${esc(id('audit', 'bootstrap'))}, ${esc(id('user', 'admin@sarisysteme.com'))}, 'seed', 'database', NULL, ${json({ driver: 'mysql', locales: ['fr', 'en', 'ar'] })}, ${esc(now)}, ${esc(now)});`);
push('');

const out = L.join('\n');
const target = join(__dirname, 'seed.mysql.sql');
writeFileSync(target, out, 'utf8');
// eslint-disable-next-line no-console
console.log(`✅ seed.mysql.sql généré (${(out.length / 1024).toFixed(1)} Ko, ${L.length} lignes)`);
