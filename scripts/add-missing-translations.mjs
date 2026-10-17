#!/usr/bin/env node
/**
 * Ajoute les clés de traduction appelées par le code mais absentes des
 * fichiers `messages/{fr,en,ar}.json`.
 *
 * Ces clés produisaient un `MISSING_MESSAGE` dans la console du navigateur.
 * Le français semblait épargné sur quelques écrans parce que certains
 * composants portent un repli codé en dur (`Page 1 sur 3` dans Pagination),
 * mais la clé manquait bien dans les trois langues : c'est l'anglais qui a
 * rendu le défaut visible, faute de repli.
 *
 * Le script n'écrase jamais une clé existante — il ne fait qu'ajouter ce qui
 * manque, et peut donc être relancé sans risque.
 *
 * Usage :
 *   node scripts/add-missing-translations.mjs [--dry-run]
 *
 * Vérification : `node scripts/check-translations.mjs`
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const LOCALES = ['fr', 'en', 'ar'];

/**
 * Traductions, regroupées par espace de noms.
 * Ordre des valeurs : [français, anglais, arabe].
 */
const T = {
  'components.ui.Pagination': {
    // `current` et `total` sont fournis par le composant.
    pageInfo: ['Page {current} sur {total}', 'Page {current} of {total}', 'الصفحة {current} من {total}'],
  },

  'components.layout.NotFound': {
    description: [
      "La page que vous cherchez n'existe pas ou a été déplacée.",
      'The page you are looking for does not exist or has been moved.',
      'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
    ],
    backToHome: ["Retour à l'accueil", 'Back to home', 'العودة إلى الصفحة الرئيسية'],
    goBack: ['Page précédente', 'Go back', 'الصفحة السابقة'],
    suggestions: ['Ces pages peuvent vous intéresser', 'You may be looking for', 'قد تهمك هذه الصفحات'],
    browseProducts: ['Parcourir le catalogue', 'Browse the catalogue', 'تصفح الكتالوج'],
    ourServices: ['Nos services', 'Our services', 'خدماتنا'],
    ourSolutions: ['Nos solutions', 'Our solutions', 'حلولنا'],
    needHelp: ["Besoin d'aide ?", 'Need help?', 'هل تحتاج مساعدة؟'],
    contactSupport: ['Contacter le support', 'Contact support', 'اتصل بالدعم'],
  },

  'components.layout.FloatingApplicationsButton': {
    viewApplications: ['Voir mes candidatures', 'View my applications', 'عرض ترشيحاتي'],
  },

  'pages.dashboard': {
    productsDesc: [
      'Parcourez le catalogue et ajoutez des articles à votre panier.',
      'Browse the catalogue and add items to your cart.',
      'تصفح الكتالوج وأضف المنتجات إلى سلتك.',
    ],
    addToCart: ['Ajouter au panier', 'Add to cart', 'أضف إلى السلة'],
    noProducts: ['Aucun produit ne correspond à votre recherche', 'No product matches your search', 'لا يوجد منتج يطابق بحثك'],
    noMessagesYet: ['Aucun message pour le moment', 'No messages yet', 'لا توجد رسائل حتى الآن'],
    typeMessage: ['Écrivez votre message…', 'Type your message…', 'اكتب رسالتك…'],
    sendMessage: ['Envoyer', 'Send', 'إرسال'],
    referrals: ['Parrainages', 'Referrals', 'الإحالات'],
    revenue: ['Chiffre d’affaires', 'Revenue', 'رقم الأعمال'],
    back: ['Retour', 'Back', 'رجوع'],
    from: ['De', 'From', 'من'],
  },

  'pages.login': {
    title: ['Connexion', 'Sign in', 'تسجيل الدخول'],
    email: ['Adresse e-mail', 'Email address', 'البريد الإلكتروني'],
    remember: ['Se souvenir de moi', 'Remember me', 'تذكرني'],
    loginButton: ['Se connecter', 'Sign in', 'تسجيل الدخول'],
    loggingIn: ['Connexion en cours…', 'Signing in…', 'جارٍ تسجيل الدخول…'],
    loginError: ['Identifiants incorrects', 'Incorrect credentials', 'بيانات الاعتماد غير صحيحة'],
    captchaError: ['Veuillez valider le captcha', 'Please complete the captcha', 'يرجى إكمال رمز التحقق'],
    createAccount: ['Créer un compte', 'Create an account', 'إنشاء حساب'],
    demoHint: ['Compte de démonstration', 'Demo account', 'حساب تجريبي'],
  },

  'pages.search': {
    home: ['Accueil', 'Home', 'الرئيسية'],
    loading: ['Recherche en cours…', 'Searching…', 'جارٍ البحث…'],
    startSearching: ['Lancez une recherche', 'Start searching', 'ابدأ البحث'],
    startSearchingDesc: [
      'Saisissez un mot-clé pour trouver un produit, un service ou une actualité.',
      'Enter a keyword to find a product, a service or a news item.',
      'أدخل كلمة مفتاحية للعثور على منتج أو خدمة أو خبر.',
    ],
  },

  'pages.jobs': {
    applyDisabled: [
      'Les candidatures sont closes pour cette offre.',
      'Applications are closed for this position.',
      'باب الترشح مغلق لهذا العرض.',
    ],
  },

  'pages.payment': {
    noMethod: ['Aucun moyen de paiement disponible', 'No payment method available', 'لا توجد وسيلة دفع متاحة'],
    fillPaypalEmail: ['Renseignez votre e-mail PayPal', 'Enter your PayPal email', 'أدخل بريدك الإلكتروني على PayPal'],
  },

  'pages.solutionCategory.products': {
    viewAll: ['Voir tous les produits', 'View all products', 'عرض كل المنتجات'],
  },

  'pages.quoteRequest': {
    subtitle: [
      'Suivez vos demandes de devis et leur avancement.',
      'Track your quote requests and their progress.',
      'تابع طلبات عروض الأسعار وتقدمها.',
    ],
    noRequestsDesc: [
      'Créez une demande pour recevoir une proposition chiffrée.',
      'Create a request to receive a priced proposal.',
      'أنشئ طلبًا للحصول على عرض سعر.',
    ],
    lines: ['ligne(s)', 'line(s)', 'سطر/أسطر'],
    nature: ['Nature', 'Nature', 'الطبيعة'],
    natureOther: ['Précisez la nature', 'Specify the nature', 'حدد الطبيعة'],
    duplicate: ['Dupliquer', 'Duplicate', 'نسخ'],
    duplicatedFrom: ['Dupliquée depuis', 'Duplicated from', 'منسوخة من'],
    edit: ['Modifier', 'Edit', 'تعديل'],
    note: ['Note', 'Note', 'ملاحظة'],
    notePlaceholder: [
      'Précisions utiles au chiffrage (délais, contraintes, site…)',
      'Details useful for pricing (deadlines, constraints, site…)',
      'تفاصيل مفيدة لتسعير الطلب (الآجال، القيود، الموقع…)',
    ],
    history: ['Historique', 'History', 'السجل'],
    // Étapes de l'assistant
    stepProducts: ['Produits', 'Products', 'المنتجات'],
    stepProductsDesc: [
      'Choisissez dans le catalogue ou décrivez un article sur mesure.',
      'Pick from the catalogue or describe a custom item.',
      'اختر من الكتالوج أو صف منتجًا حسب الطلب.',
    ],
    stepDetails: ['Détails', 'Details', 'التفاصيل'],
    stepContact: ['Contact', 'Contact', 'جهة الاتصال'],
    stepRecap: ['Récapitulatif', 'Summary', 'الملخص'],
    next: ['Suivant', 'Next', 'التالي'],
    previous: ['Précédent', 'Previous', 'السابق'],
    send: ['Envoyer la demande', 'Send request', 'إرسال الطلب'],
    saveDraft: ['Enregistrer le brouillon', 'Save draft', 'حفظ المسودة'],
    savedAsDraft: ['Brouillon enregistré', 'Draft saved', 'تم حفظ المسودة'],
    submitted: ['Demande envoyée', 'Request sent', 'تم إرسال الطلب'],
    // Catalogue et lignes
    catalog: ['Catalogue', 'Catalogue', 'الكتالوج'],
    searchCatalog: ['Rechercher un produit…', 'Search for a product…', 'ابحث عن منتج…'],
    noResults: ['Aucun produit trouvé', 'No product found', 'لم يتم العثور على منتج'],
    product: ['Produit', 'Product', 'المنتج'],
    special: ['Article sur mesure', 'Custom item', 'منتج حسب الطلب'],
    addSpecial: ['Ajouter un article sur mesure', 'Add a custom item', 'أضف منتجًا حسب الطلب'],
    description: ['Description', 'Description', 'الوصف'],
    unit: ['Unité', 'Unit', 'الوحدة'],
    lineTotal: ['Total ligne', 'Line total', 'إجمالي السطر'],
    subtotal: ['Sous-total', 'Subtotal', 'المجموع الفرعي'],
    taxes: ['TVA', 'VAT', 'الرسم على القيمة المضافة'],
    discount: ['Remise', 'Discount', 'الخصم'],
    totalTtc: ['Total TTC', 'Total incl. VAT', 'الإجمالي مع الرسوم'],
    // Contact et livraison
    email: ['E-mail', 'Email', 'البريد الإلكتروني'],
    phone: ['Téléphone', 'Phone', 'الهاتف'],
    address: ['Adresse', 'Address', 'العنوان'],
    country: ['Pays', 'Country', 'البلد'],
    delivery: ['Livraison', 'Delivery', 'التوصيل'],
    desiredDate: ['Date souhaitée', 'Desired date', 'التاريخ المطلوب'],
    attachFile: ['Joindre un fichier', 'Attach a file', 'إرفاق ملف'],
    downloadFile: ['Télécharger la pièce jointe', 'Download attachment', 'تنزيل المرفق'],
    downloadPdf: ['Télécharger le PDF', 'Download PDF', 'تنزيل ملف PDF'],
    // Suites données à la demande
    accept: ['Accepter', 'Accept', 'قبول'],
    refuse: ['Refuser', 'Decline', 'رفض'],
    requestRevision: ['Demander une révision', 'Request a revision', 'طلب مراجعة'],
    revisionAsked: ['Révision demandée', 'Revision requested', 'تم طلب المراجعة'],
    response: ['Réponse', 'Response', 'الرد'],
    // Messages de validation
    errNameRequired: ['Le nom est obligatoire', 'Name is required', 'الاسم مطلوب'],
    errEmail: ['Adresse e-mail invalide', 'Invalid email address', 'البريد الإلكتروني غير صالح'],
    errPhone: ['Numéro de téléphone invalide', 'Invalid phone number', 'رقم الهاتف غير صالح'],
    errNature: ['Indiquez la nature de la demande', 'Specify the nature of the request', 'حدد طبيعة الطلب'],
    errNatureOther: ['Précisez la nature', 'Please specify the nature', 'يرجى تحديد الطبيعة'],
    errNoLines: ['Ajoutez au moins un article', 'Add at least one item', 'أضف منتجًا واحدًا على الأقل'],
    errQty: ['Quantité invalide', 'Invalid quantity', 'الكمية غير صالحة'],
    errLineLimit: [
      'Nombre maximal d’articles atteint',
      'Maximum number of items reached',
      'تم بلوغ الحد الأقصى لعدد المنتجات',
    ],
    errAttachment: [
      'Pièce jointe refusée (format ou taille)',
      'Attachment rejected (format or size)',
      'تم رفض المرفق (الصيغة أو الحجم)',
    ],
  },

  'admin.imageUploader': {
    dropHere: ['Déposez une image ici', 'Drop an image here', 'أفلت صورة هنا'],
    orUrl: ['ou collez une URL', 'or paste a URL', 'أو الصق رابطًا'],
    formats: ['JPG, PNG, WebP ou SVG — 5 Mo maximum', 'JPG, PNG, WebP or SVG — 5 MB max', 'JPG أو PNG أو WebP أو SVG — 5 ميغابايت كحد أقصى'],
    preview: ['Aperçu', 'Preview', 'معاينة'],
    remove: ["Retirer l'image", 'Remove image', 'إزالة الصورة'],
    invalidType: ['Format de fichier non pris en charge', 'Unsupported file format', 'صيغة الملف غير مدعومة'],
    tooLarge: ['Fichier trop volumineux', 'File too large', 'الملف كبير جدًا'],
  },

  'admin.configEditor': {
    title: ['Éditeur de configuration', 'Configuration editor', 'محرر الإعدادات'],
    saveSuccess: ['Configuration enregistrée', 'Configuration saved', 'تم حفظ الإعدادات'],
    saveError: ["Échec de l'enregistrement", 'Save failed', 'فشل الحفظ'],
    exportSuccess: ['Configuration exportée', 'Configuration exported', 'تم تصدير الإعدادات'],
  },

  'admin.login': {
    emailPlaceholder: ['vous@exemple.com', 'you@example.com', 'you@example.com'],
    apiUnreachable: [
      "L'API est injoignable. Vérifiez qu'elle est démarrée.",
      'The API is unreachable. Check that it is running.',
      'تعذر الوصول إلى الواجهة البرمجية. تأكد من أنها قيد التشغيل.',
    ],
    verifyTotp: ['Vérifier le code', 'Verify code', 'تحقق من الرمز'],
  },

  'admin.applications': { contact: ['Contact', 'Contact', 'جهة الاتصال'] },
  'admin.currencies': { name: ['Nom', 'Name', 'الاسم'] },
  'admin.taxes': { name: ['Nom', 'Name', 'الاسم'] },
  'admin.payments': { name: ['Nom', 'Name', 'الاسم'], type: ['Type', 'Type', 'النوع'] },
  'admin.profile': { informations: ['Informations', 'Information', 'المعلومات'] },
  'admin.shopStats': { cancelled: ['Annulées', 'Cancelled', 'ملغاة'] },
};

// --------------------------------------------------------------------------

function setDeep(root, path, value) {
  const parts = path.split('.');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null || Array.isArray(node[part])) {
      node[part] = {};
    }
    node = node[part];
  }
  const leaf = parts[parts.length - 1];
  if (leaf in node) return false; // jamais d'écrasement
  node[leaf] = value;
  return true;
}

const added = { fr: 0, en: 0, ar: 0 };

for (const [index, locale] of LOCALES.entries()) {
  const path = resolve(ROOT, 'messages', `${locale}.json`);
  const bundle = JSON.parse(readFileSync(path, 'utf8'));

  for (const [namespace, keys] of Object.entries(T)) {
    for (const [key, values] of Object.entries(keys)) {
      if (setDeep(bundle, `${namespace}.${key}`, values[index])) added[locale] += 1;
    }
  }

  if (!DRY) writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
}

const planned = Object.values(T).reduce((n, keys) => n + Object.keys(keys).length, 0);
console.log(DRY ? '— SIMULATION —\n' : '— Fichiers de traduction mis à jour —\n');
console.log(`  ${planned} clés prévues par espace de noms`);
for (const locale of LOCALES) console.log(`  ${locale} : ${added[locale]} ajoutée(s)`);
console.log('\nVérification : node scripts/check-translations.mjs');
