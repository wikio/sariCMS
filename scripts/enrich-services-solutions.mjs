#!/usr/bin/env node
/**
 * Enrichit les fiches Services et Solutions des trois langues.
 *
 * Ce que le script ajoute, et pourquoi :
 *
 *   • services — `color` et `image` : les deux colonnes existent en base et
 *     sont lues par ServiceCard, mais aucune fiche ne les renseignait, d'où
 *     des cartes sans visuel ni couleur d'accent. Les teintes reprennent la
 *     palette déjà utilisée par les solutions.
 *   • services — FAQ portée de 2 à 5 questions, alignée sur le niveau de
 *     détail des solutions et sur les questions réellement posées à un
 *     distributeur d'équipements médicaux en Algérie (douane, devise,
 *     agrément, délais d'importation).
 *   • solutions — FAQ complétée à 5 questions par catégorie.
 *
 * Le script est idempotent : une question déjà présente (comparée sur son
 * libellé normalisé) n'est jamais dupliquée. Il peut donc être relancé après
 * une reprise de données sans polluer les fiches.
 *
 * Usage :
 *   node scripts/enrich-services-solutions.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const LOCALES = ['fr', 'en', 'ar'];

// --------------------------------------------------------------------------
// Habillage visuel des services (colonnes color/image, jamais renseignées)
// --------------------------------------------------------------------------

const SERVICE_STYLE = {
  1: {
    color: 'sari-blue',
    image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=1920',
  },
  2: {
    color: 'green-500',
    image: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=1920',
  },
  3: {
    color: 'orange-500',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1920',
  },
  4: {
    color: 'purple-500',
    image: 'https://images.unsplash.com/photo-1583912268183-a34d41fe464a?w=1920',
  },
};

// --------------------------------------------------------------------------
// FAQ additionnelles — services
// --------------------------------------------------------------------------

const SERVICE_FAQ = {
  1: {
    fr: [
      {
        q: 'Vos équipements sont-ils homologués pour le marché algérien ?',
        a: "Oui. Chaque appareil est livré avec sa certification CE et son marquage ISO 13485, et nous fournissons le dossier technique exigé par l'Agence nationale des produits pharmaceutiques pour l'enregistrement des dispositifs médicaux.",
      },
      {
        q: 'Gérez-vous les formalités douanières et le transit ?',
        a: "Nous prenons en charge l'importation de bout en bout : domiciliation bancaire, dédouanement au port d'Alger ou d'Oran, et acheminement jusqu'à votre établissement. Vous ne traitez qu'un seul interlocuteur.",
      },
      {
        q: 'Quelles facilités de paiement proposez-vous ?',
        a: 'Nous acceptons le virement bancaire, la lettre de crédit documentaire et, pour les structures publiques, le paiement sur bon de commande administratif. Un échelonnement est possible sur les équipements lourds.',
      },
    ],
    en: [
      {
        q: 'Is your equipment approved for the Algerian market?',
        a: 'Yes. Every device ships with CE certification and ISO 13485 marking, and we provide the technical file required by the national pharmaceutical products agency to register medical devices.',
      },
      {
        q: 'Do you handle customs clearance and freight?',
        a: 'We manage the full import chain: bank domiciliation, clearance at the port of Algiers or Oran, and delivery to your facility. You deal with a single point of contact.',
      },
      {
        q: 'What payment terms do you offer?',
        a: 'We accept bank transfer, documentary letter of credit and, for public institutions, payment against an administrative purchase order. Instalments are available on heavy equipment.',
      },
    ],
    ar: [
      {
        q: 'هل معداتكم معتمدة في السوق الجزائرية؟',
        a: 'نعم. يُسلَّم كل جهاز بشهادة CE وعلامة ISO 13485، ونوفر الملف التقني الذي تطلبه الوكالة الوطنية للمواد الصيدلانية لتسجيل الأجهزة الطبية.',
      },
      {
        q: 'هل تتكفلون بالإجراءات الجمركية والنقل؟',
        a: 'نتولى سلسلة الاستيراد كاملة: التوطين البنكي، والتخليص الجمركي في ميناء الجزائر أو وهران، والتوصيل إلى مؤسستكم. تتعاملون مع جهة واحدة فقط.',
      },
      {
        q: 'ما هي تسهيلات الدفع المتاحة؟',
        a: 'نقبل التحويل البنكي والاعتماد المستندي، وبالنسبة للمؤسسات العمومية الدفع مقابل سند طلب إداري. كما يمكن تقسيط ثمن المعدات الثقيلة.',
      },
    ],
  },
  2: {
    fr: [
      {
        q: 'La formation est-elle dispensée en arabe ?',
        a: "Nos formateurs interviennent en arabe, en français ou en anglais selon la préférence de votre équipe. Les supports écrits sont remis dans les trois langues.",
      },
      {
        q: "Combien de temps dure la mise en service d'un plateau technique ?",
        a: "Comptez une à deux journées pour un appareil isolé, et de trois à cinq jours pour un plateau complet incluant le raccordement, l'étalonnage et la validation des mesures.",
      },
      {
        q: 'Délivrez-vous une attestation aux participants ?',
        a: "Chaque participant reçoit une attestation nominative précisant les modules suivis, document utile lors des inspections et des démarches d'accréditation.",
      },
    ],
    en: [
      {
        q: 'Is the training delivered in Arabic?',
        a: 'Our trainers work in Arabic, French or English depending on your team’s preference. Written material is handed over in all three languages.',
      },
      {
        q: 'How long does commissioning a technical unit take?',
        a: 'Allow one to two days for a single device, and three to five days for a complete unit including connection, calibration and measurement validation.',
      },
      {
        q: 'Do participants receive a certificate?',
        a: 'Each participant receives a personal certificate listing the modules completed — a useful document during inspections and accreditation procedures.',
      },
    ],
    ar: [
      {
        q: 'هل يقدَّم التدريب باللغة العربية؟',
        a: 'يعمل مدربونا بالعربية أو الفرنسية أو الإنجليزية حسب تفضيل فريقكم، وتُسلَّم المستندات المكتوبة باللغات الثلاث.',
      },
      {
        q: 'كم تستغرق عملية تشغيل منصة تقنية؟',
        a: 'يستغرق الأمر يومًا إلى يومين لجهاز واحد، ومن ثلاثة إلى خمسة أيام لمنصة كاملة تشمل التوصيل والمعايرة والتحقق من القياسات.',
      },
      {
        q: 'هل تمنحون شهادة للمشاركين؟',
        a: 'يتلقى كل مشارك شهادة اسمية تحدد الوحدات التي أتمها، وهي وثيقة مفيدة عند عمليات التفتيش وإجراءات الاعتماد.',
      },
    ],
  },
  3: {
    fr: [
      {
        q: "Quel est votre délai d'intervention en cas de panne ?",
        a: "Sous contrat premium, un technicien intervient sous 24 heures à Alger et sous 48 heures dans le reste du pays. Un diagnostic à distance est lancé dès l'appel afin d'apporter la bonne pièce.",
      },
      {
        q: 'Disposez-vous des pièces détachées en stock ?',
        a: 'Notre magasin d’Alger conserve les pièces d’usure des gammes que nous distribuons. Les pièces spécifiques sont commandées auprès du fabricant sous sept à dix jours ouvrés.',
      },
      {
        q: "Fournissez-vous un équipement de remplacement pendant l'immobilisation ?",
        a: "Les contrats premium incluent le prêt d'un appareil équivalent dès lors que la réparation dépasse 72 heures, afin que votre activité ne s'interrompe pas.",
      },
    ],
    en: [
      {
        q: 'How fast do you respond to a breakdown?',
        a: 'Under a premium contract a technician arrives within 24 hours in Algiers and 48 hours elsewhere in the country. Remote diagnosis starts as soon as you call so the right part is brought along.',
      },
      {
        q: 'Do you keep spare parts in stock?',
        a: 'Our Algiers warehouse holds wear parts for the ranges we distribute. Device-specific parts are ordered from the manufacturer within seven to ten working days.',
      },
      {
        q: 'Do you provide replacement equipment during downtime?',
        a: 'Premium contracts include the loan of an equivalent device whenever a repair exceeds 72 hours, so your activity is never interrupted.',
      },
    ],
    ar: [
      {
        q: 'ما هي مدة التدخل في حالة العطل؟',
        a: 'بموجب العقد المميز يصل التقني خلال 24 ساعة في الجزائر العاصمة وخلال 48 ساعة في باقي الولايات، ويبدأ التشخيص عن بُعد فور اتصالكم لإحضار القطعة المناسبة.',
      },
      {
        q: 'هل تتوفر لديكم قطع الغيار في المخزون؟',
        a: 'يحتفظ مستودعنا بالجزائر العاصمة بقطع الاستهلاك للتشكيلات التي نوزعها، أما القطع الخاصة فتُطلب من المصنّع خلال سبعة إلى عشرة أيام عمل.',
      },
      {
        q: 'هل توفرون جهازًا بديلًا أثناء فترة التوقف؟',
        a: 'تتضمن العقود المميزة إعارة جهاز مماثل متى تجاوز الإصلاح 72 ساعة، حتى لا يتوقف نشاطكم.',
      },
    ],
  },
  4: {
    fr: [
      {
        q: 'Assurez-vous un réapprovisionnement automatique ?',
        a: "Nous établissons un calendrier de livraison fondé sur votre consommation réelle, avec alerte avant rupture. Vous gardez la main pour ajuster les quantités à tout moment.",
      },
      {
        q: 'Comment garantissez-vous la chaîne du froid ?',
        a: "Les produits thermosensibles voyagent en conteneurs réfrigérés avec enregistreur de température ; le relevé est joint au bon de livraison et archivé pendant trois ans.",
      },
      {
        q: 'Livrez-vous dans les wilayas du Sud ?',
        a: "Oui, nous desservons l'ensemble du territoire, y compris Tamanrasset, Adrar et Illizi. Les délais y sont majorés de deux à quatre jours selon la liaison routière.",
      },
    ],
    en: [
      {
        q: 'Do you offer automatic replenishment?',
        a: 'We set a delivery schedule based on your actual consumption, with an alert before you run out. You can adjust quantities at any time.',
      },
      {
        q: 'How is the cold chain guaranteed?',
        a: 'Temperature-sensitive products travel in refrigerated containers fitted with a data logger; the record is attached to the delivery note and archived for three years.',
      },
      {
        q: 'Do you deliver to the southern wilayas?',
        a: 'Yes, we cover the whole country including Tamanrasset, Adrar and Illizi. Lead times there are two to four days longer depending on the road link.',
      },
    ],
    ar: [
      {
        q: 'هل توفرون إعادة تموين تلقائية؟',
        a: 'نضع جدول تسليم يستند إلى استهلاككم الفعلي مع تنبيه قبل نفاد المخزون، ويبقى بإمكانكم تعديل الكميات في أي وقت.',
      },
      {
        q: 'كيف تضمنون سلسلة التبريد؟',
        a: 'تُنقل المنتجات الحساسة للحرارة في حاويات مبردة مزودة بمسجل حرارة، ويُرفق التقرير بوصل التسليم ويُحفظ لمدة ثلاث سنوات.',
      },
      {
        q: 'هل تسلّمون إلى ولايات الجنوب؟',
        a: 'نعم، نغطي كامل التراب الوطني بما في ذلك تمنراست وأدرار وإليزي، مع آجال إضافية من يومين إلى أربعة أيام حسب الرابط الطرقي.',
      },
    ],
  },
};

// --------------------------------------------------------------------------
// FAQ additionnelles — solutions (communes à toutes les catégories)
// --------------------------------------------------------------------------

const SOLUTION_FAQ = {
  fr: [
    {
      q: 'Proposez-vous une démonstration avant l’achat ?',
      a: "Nous organisons une démonstration dans votre service, avec vos propres cas d'usage, ou une visite de site chez un confrère déjà équipé. C'est la meilleure façon de valider l'ergonomie avec les utilisateurs finaux.",
    },
    {
      q: 'Quelle garantie couvre ces équipements ?',
      a: "La garantie constructeur est de 24 mois pièces et main-d'œuvre, extensible à 60 mois. Elle couvre les défauts de fabrication et inclut les mises à jour logicielles de sécurité.",
    },
    {
      q: 'Ces dispositifs s’intègrent-ils à notre système d’information ?',
      a: "Les appareils communicants sont compatibles DICOM et HL7, ce qui permet leur raccordement à un PACS ou à un dossier patient informatisé existant. Notre équipe technique valide l'interopérabilité avant la mise en production.",
    },
  ],
  en: [
    {
      q: 'Can we see a demonstration before buying?',
      a: 'We arrange a demonstration in your own department, using your real use cases, or a site visit to a peer already equipped. It is the best way to validate ergonomics with the end users.',
    },
    {
      q: 'What warranty covers this equipment?',
      a: 'The manufacturer warranty runs for 24 months, parts and labour, extendable to 60 months. It covers manufacturing defects and includes security software updates.',
    },
    {
      q: 'Do these devices integrate with our information system?',
      a: 'Connected devices support DICOM and HL7, so they plug into an existing PACS or electronic patient record. Our technical team validates interoperability before going live.',
    },
  ],
  ar: [
    {
      q: 'هل تقدمون عرضًا توضيحيًا قبل الشراء؟',
      a: 'ننظم عرضًا توضيحيًا داخل مصلحتكم باستخدام حالاتكم الفعلية، أو زيارة ميدانية لمؤسسة زميلة مجهزة بالفعل، وهي أفضل وسيلة للتحقق من سهولة الاستعمال مع المستخدمين النهائيين.',
    },
    {
      q: 'ما هو الضمان الذي يغطي هذه المعدات؟',
      a: 'ضمان المصنّع 24 شهرًا يشمل القطع واليد العاملة، وقابل للتمديد إلى 60 شهرًا. يغطي عيوب التصنيع ويتضمن تحديثات البرمجيات الأمنية.',
    },
    {
      q: 'هل تندمج هذه الأجهزة مع نظام المعلومات لدينا؟',
      a: 'الأجهزة المتصلة متوافقة مع معياري DICOM وHL7، ما يسمح بربطها بنظام PACS أو بملف المريض الإلكتروني القائم. ويتحقق فريقنا التقني من التشغيل البيني قبل الإنتاج.',
    },
  ],
};

// --------------------------------------------------------------------------

/** Clé de comparaison d'une question, insensible à la casse et aux espaces. */
const key = (q) =>
  String(q ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?؟.!]/g, '')
    .trim();

function mergeFaq(existing, additions) {
  const out = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(out.map((item) => key(item.q)));
  let added = 0;
  for (const item of additions) {
    if (seen.has(key(item.q))) continue;
    out.push(item);
    seen.add(key(item.q));
    added += 1;
  }
  return { faq: out, added };
}

const report = [];

for (const locale of LOCALES) {
  // ---- Services -----------------------------------------------------------
  const svcPath = resolve(ROOT, 'data', locale, 'services.json');
  const services = JSON.parse(readFileSync(svcPath, 'utf8'));
  let svcFaq = 0;
  let svcStyle = 0;

  for (const service of services) {
    const style = SERVICE_STYLE[service.id];
    if (style) {
      if (!service.color) {
        service.color = style.color;
        svcStyle += 1;
      }
      if (!service.image) {
        service.image = style.image;
        svcStyle += 1;
      }
    }
    const additions = SERVICE_FAQ[service.id]?.[locale];
    if (additions) {
      const { faq, added } = mergeFaq(service.faq, additions);
      service.faq = faq;
      svcFaq += added;
    }
  }
  if (!DRY) writeFileSync(svcPath, `${JSON.stringify(services, null, 2)}\n`, 'utf8');

  // ---- Solutions ----------------------------------------------------------
  const solPath = resolve(ROOT, 'data', locale, 'solution-categories.json');
  const solutions = JSON.parse(readFileSync(solPath, 'utf8'));
  let solFaq = 0;

  for (const solution of solutions) {
    const { faq, added } = mergeFaq(solution.faq, SOLUTION_FAQ[locale]);
    solution.faq = faq;
    solFaq += added;
  }
  if (!DRY) writeFileSync(solPath, `${JSON.stringify(solutions, null, 2)}\n`, 'utf8');

  report.push({
    locale,
    svcStyle,
    svcFaq,
    solFaq,
    svcTotal: services.reduce((n, s) => n + (s.faq?.length ?? 0), 0),
    solTotal: solutions.reduce((n, s) => n + (s.faq?.length ?? 0), 0),
  });
}

console.log(DRY ? '— SIMULATION (aucune écriture) —\n' : '— Fiches enrichies —\n');
for (const r of report) {
  console.log(
    `  ${r.locale}  services : +${r.svcStyle} champs couleur/image, ` +
      `+${r.svcFaq} questions (total ${r.svcTotal})`,
  );
  console.log(`      solutions : +${r.solFaq} questions (total ${r.solTotal})`);
}
