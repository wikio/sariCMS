#!/usr/bin/env node
/**
 * Aligne `messages/en.json` et `messages/ar.json` sur `messages/fr.json`.
 *
 * Deux écarts distincts sont traités :
 *
 * 1. Les tableaux `pages.solutionCategory.categories.*.features` et `.faq`
 *    étaient plus courts en anglais et en arabe (4 features contre 6, 1 FAQ
 *    contre 2). Ces tableaux sont lus en brut par la page catégorie
 *    (`cat.features.map(...)`), donc aucune erreur console n'apparaissait :
 *    les visiteurs anglophones et arabophones voyaient simplement moins de
 *    contenu que les visiteurs francophones.
 *
 * 2. `admin.careersFields.{cta,ctaLink,description}` manquaient en/ar, et
 *    quatre clés présentes en/ar étaient absentes du français.
 *
 * Le script complète par index sans écraser l'existant : relançable.
 *
 * Usage : node scripts/fill-locale-gaps.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

/** Traductions des `features` manquantes, indexées par le texte français. */
const FEATURES = {
  'Conformité CE médical': ['Medical CE compliance', 'مطابقة CE الطبية'],
  'Support technique 24/7': ['24/7 technical support', 'دعم تقني على مدار الساعة'],
  'Conformité HDS': ['HDS compliance', 'مطابقة معايير استضافة البيانات الصحية'],
  'Maintenance préventive': ['Preventive maintenance', 'صيانة وقائية'],
  'Stérilisation certifiée': ['Certified sterilisation', 'تعقيم معتمد'],
  'Maintenance et SAV': ['Maintenance and after-sales service', 'الصيانة وخدمة ما بعد البيع'],
  'Moniteurs néonatals': ['Neonatal monitors', 'أجهزة مراقبة حديثي الولادة'],
  'Matériel adapté enfants': ['Child-friendly equipment', 'معدات مخصصة للأطفال'],
  'Pousse-seringues': ['Syringe pumps', 'مضخات الحقن'],
  'Support 24/7 garanti': ['Guaranteed 24/7 support', 'دعم مضمون على مدار الساعة'],
  'Hébergement données santé': ['Health data hosting', 'استضافة البيانات الصحية'],
  'Applications mobiles': ['Mobile applications', 'تطبيقات الهاتف المحمول'],
  'Étuves et incubateurs': ['Ovens and incubators', 'أفران وحاضنات'],
  'Réactifs et consommables': ['Reagents and consumables', 'الكواشف والمستهلكات'],
  'Plateformes de marche': ['Gait training platforms', 'منصات إعادة تأهيل المشي'],
  'Matériel certifié CE': ['CE-certified equipment', 'معدات معتمدة CE'],
  'Écrans tactiles HD': ['HD touchscreens', 'شاشات لمس عالية الدقة'],
  'Livraison et installation incluses': [
    'Delivery and installation included',
    'التوصيل والتركيب مشمولان',
  ],
};

/** Traductions des entrées de FAQ manquantes, indexées par la question française. */
const FAQ = {
  "Proposez-vous la formation à l'utilisation ?": {
    en: {
      q: 'Do you provide training on how to use the equipment?',
      a: 'Yes, a basic training session is included with every purchase. Advanced training is available as an option.',
    },
    ar: {
      q: 'هل تقدمون تدريبًا على الاستخدام؟',
      a: 'نعم، تتضمن كل عملية شراء جلسة تدريب أساسية. كما تتوفر دورات تدريبية متقدمة كخيار إضافي.',
    },
  },
  'Les IRM sont-ils compatibles avec tous les patients ?': {
    en: {
      q: 'Are the MRI scanners suitable for all patients?',
      a: 'Yes, our MRI scanners suit every patient profile, including children and people with claustrophobia (open MRI available).',
    },
    ar: {
      q: 'هل أجهزة الرنين المغناطيسي مناسبة لجميع المرضى؟',
      a: 'نعم، أجهزتنا مناسبة لجميع فئات المرضى، بمن فيهم الأطفال والأشخاص المصابون برهاب الأماكن المغلقة (يتوفر جهاز رنين مفتوح).',
    },
  },
  'Les lampes scialytiques sont-elles LED ?': {
    en: {
      q: 'Are the surgical lights LED?',
      a: 'Yes, all our surgical lights are LED with a 50,000-hour lifespan, a CRI above 95 and intensity up to 150,000 lux.',
    },
    ar: {
      q: 'هل مصابيح غرف العمليات من نوع LED؟',
      a: 'نعم، جميع مصابيحنا من نوع LED بعمر تشغيلي يبلغ 50000 ساعة، ومؤشر تجسيد لوني يفوق 95، وشدة إضاءة تصل إلى 150000 لوكس.',
    },
  },
  'Les balances sont-elles précises ?': {
    en: {
      q: 'How accurate are the scales?',
      a: 'Our paediatric scales are accurate to 5 g, with a hold function for restless babies and a tare function for nappies.',
    },
    ar: {
      q: 'ما مدى دقة الموازين؟',
      a: 'تبلغ دقة موازين الأطفال لدينا 5 غرامات، مع خاصية التثبيت للرضّع كثيري الحركة وخاصية الطرح لوزن الحفاضات.',
    },
  },
  "Les chariots d'urgence sont-ils complets ?": {
    en: {
      q: 'Do the emergency trolleys come fully equipped?',
      a: 'Yes, our trolleys ship with everything required: defibrillator, monitor, suction unit, oxygen and emergency drugs.',
    },
    ar: {
      q: 'هل عربات الطوارئ مجهزة بالكامل؟',
      a: 'نعم، تُسلَّم عرباتنا بكل ما يلزم: جهاز إزالة الرجفان، وجهاز المراقبة، وجهاز الشفط، والأكسجين، وأدوية الطوارئ.',
    },
  },
  'Proposez-vous des solutions de télémédecine ?': {
    en: {
      q: 'Do you offer telemedicine solutions?',
      a: 'Yes, we provide complete teleconsultation, tele-expertise and remote monitoring solutions with secure HD video conferencing.',
    },
    ar: {
      q: 'هل تقدمون حلول التطبيب عن بُعد؟',
      a: 'نعم، نوفر حلولًا متكاملة للاستشارة والخبرة والمراقبة عن بُعد، مع مؤتمرات فيديو عالية الدقة ومؤمّنة.',
    },
  },
  'Les réactifs sont-ils inclus ?': {
    en: {
      q: 'Are reagents included?',
      a: 'Starter reagents are included with every analyser. We then offer supply contracts at preferential rates.',
    },
    ar: {
      q: 'هل الكواشف مشمولة؟',
      a: 'تتضمن كل وحدة تحليل كواشف البدء. ونوفر بعد ذلك عقود توريد بأسعار تفضيلية.',
    },
  },
  'Les tensiomètres sont-ils certifiés médicaux ?': {
    en: {
      q: 'Are the blood pressure monitors certified as medical devices?',
      a: 'Yes, all our monitors are class IIa medical devices, CE certified with clinical validation under the ESH protocol.',
    },
    ar: {
      q: 'هل أجهزة قياس ضغط الدم معتمدة كأجهزة طبية؟',
      a: 'نعم، جميع أجهزتنا مصنفة ضمن الفئة IIa من الأجهزة الطبية، وحاصلة على شهادة CE مع تحقق سريري وفق بروتوكول ESH.',
    },
  },
  'Les défibrillateurs sont-ils faciles à utiliser ?': {
    en: {
      q: 'Are the defibrillators easy to use?',
      a: 'Yes, all our AEDs are designed for simple operation, with step-by-step voice prompts and automatic rhythm analysis in under 10 seconds.',
    },
    ar: {
      q: 'هل أجهزة إزالة الرجفان سهلة الاستخدام؟',
      a: 'نعم، صُممت جميع أجهزتنا لاستخدام بسيط، مع إرشادات صوتية خطوة بخطوة وتحليل تلقائي لنظم القلب في أقل من 10 ثوانٍ.',
    },
  },
  "Les appareils d'électrothérapie sont-ils multifonctions ?": {
    en: {
      q: 'Are the electrotherapy units multifunctional?',
      a: 'Yes, our units combine TENS, EMS, ultrasound and therapeutic laser in a single compact device.',
    },
    ar: {
      q: 'هل أجهزة العلاج الكهربائي متعددة الوظائف؟',
      a: 'نعم، تجمع أجهزتنا بين TENS وEMS والموجات فوق الصوتية والليزر العلاجي في جهاز واحد مدمج.',
    },
  },
};

/** Libellés `admin.careersFields` manquants. */
const CAREERS_FIELDS = {
  cta: ['CTA label', 'نص زر الإجراء'],
  ctaLink: ['CTA link', 'رابط زر الإجراء'],
  description: ['Text', 'النص'],
};

/** Clés présentes en/ar mais absentes du français. */
const CAREERS_FIELDS_FR = {
  auto: 'Auto',
  groupCatalogue: 'Catalogue',
  'groupMédias': 'Médias',
  groupTechnique: 'Technique',
};

// --------------------------------------------------------------------------

const load = (l) => JSON.parse(readFileSync(resolve(ROOT, 'messages', `${l}.json`), 'utf8'));
const fr = load('fr');
const bundles = { en: load('en'), ar: load('ar') };
const report = { en: { features: 0, faq: 0, fields: 0 }, ar: { features: 0, faq: 0, fields: 0 } };
const unknown = new Set();

const frCats = fr.pages.solutionCategory.categories;

for (const [locale, bundle] of Object.entries(bundles)) {
  const cats = bundle.pages?.solutionCategory?.categories;
  if (!cats) continue;

  for (const [key, frCat] of Object.entries(frCats)) {
    const cat = cats[key];
    if (!cat) continue;

    // Les tableaux sont complétés par index : les entrées déjà traduites
    // restent intactes, seules les positions absentes sont ajoutées.
    const frFeatures = frCat.features || [];
    if (Array.isArray(cat.features)) {
      for (let i = cat.features.length; i < frFeatures.length; i += 1) {
        const src = frFeatures[i];
        const tr = FEATURES[src.text];
        if (!tr) { unknown.add(`feature: ${src.text}`); continue; }
        cat.features.push({ icon: src.icon, text: locale === 'en' ? tr[0] : tr[1] });
        report[locale].features += 1;
      }
    }

    const frFaq = frCat.faq || [];
    if (Array.isArray(cat.faq)) {
      for (let i = cat.faq.length; i < frFaq.length; i += 1) {
        const src = frFaq[i];
        const tr = FAQ[src.q];
        if (!tr) { unknown.add(`faq: ${src.q}`); continue; }
        cat.faq.push({ q: tr[locale].q, a: tr[locale].a });
        report[locale].faq += 1;
      }
    }
  }

  const cf = (bundle.admin ||= {}).careersFields ||= {};
  for (const [key, [en, ar]] of Object.entries(CAREERS_FIELDS)) {
    if (!(key in cf)) { cf[key] = locale === 'en' ? en : ar; report[locale].fields += 1; }
  }
}

// Les quatre clés que le français n'avait pas.
const frCf = (fr.admin ||= {}).careersFields ||= {};
let frAdded = 0;
for (const [key, value] of Object.entries(CAREERS_FIELDS_FR)) {
  if (!(key in frCf)) { frCf[key] = value; frAdded += 1; }
}

if (!DRY) {
  writeFileSync(resolve(ROOT, 'messages', 'fr.json'), `${JSON.stringify(fr, null, 2)}\n`, 'utf8');
  for (const [locale, bundle] of Object.entries(bundles)) {
    writeFileSync(resolve(ROOT, 'messages', `${locale}.json`), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  }
}

console.log(DRY ? '— SIMULATION —\n' : '— Écarts entre langues comblés —\n');
for (const [locale, r] of Object.entries(report)) {
  console.log(`  ${locale} : ${r.features} feature(s), ${r.faq} FAQ, ${r.fields} libellé(s) admin`);
}
console.log(`  fr : ${frAdded} libellé(s) admin`);
if (unknown.size) {
  console.log('\n  ⚠️  Sans traduction fournie :');
  for (const u of unknown) console.log(`     ${u}`);
}
console.log('\nVérification : node scripts/check-translations.mjs');
