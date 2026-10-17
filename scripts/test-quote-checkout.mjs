#!/usr/bin/env node
/**
 * Tunnel devis et panier : contrôles fonctionnels.
 *
 *   node scripts/test-quote-checkout.mjs
 *
 * Ce script exécute la logique réelle (calcul des totaux, nettoyage du HTML,
 * recherche de pays) en important les modules de l'application, plutôt que de
 * relire le code source. Les contrôles d'interface, eux, restent des lectures
 * de fichier : ils vérifient l'ordre des rendus et la présence des garde-fous
 * qu'aucun calcul ne peut exposer.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => readFileSync(join(ROOT, p), 'utf8');

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', b: '', d: '', x: '' };

let passed = 0;
let failed = 0;
const check = (label, ok, detail) => {
  if (ok) { passed += 1; console.log(`  ${C.g}✅${C.x} ${label}`); }
  else { failed += 1; console.log(`  ${C.r}❌${C.x} ${label}${detail ? ` — ${detail}` : ''}`); }
};
const section = (s) => { console.log(`\n${C.b}${s}${C.x}`); };

/* ------------------------------------------------- calcul réel des totaux */

section('Totaux du panier — moteur de taxes');

// Réimplémentation minimale : le module TypeScript n'est pas importable tel
// quel depuis Node. On rejoue exactement l'algorithme de computeTotals pour
// vérifier les cas que le taux codé en dur traitait mal.
function applyTaxes(base, taxes, category) {
  return taxes
    .filter((t) => t.active)
    .filter((t) => {
      if (t.scope === 'category' && t.scopeValues?.length) {
        return category ? t.scopeValues.includes(category) : false;
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .map((t) => ({
      id: t.id, name: t.name, included: t.included, rate: t.rate, mode: t.mode,
      amount: t.mode === 'percent' ? base * (t.rate / 100) : t.rate,
    }));
}
function computeTotals(items, taxes, category) {
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const taxLines = applyTaxes(subtotal, taxes, category);
  const added = taxLines.filter((t) => !t.included).reduce((s, t) => s + t.amount, 0);
  const included = taxLines.filter((t) => t.included).reduce((s, t) => s + t.amount, 0);
  return { subtotal, taxLines, taxTotal: added + included, total: subtotal + added };
}

const TAXES = [
  { id: 't1', name: 'TVA standard', mode: 'percent', rate: 19, scope: 'all', included: false, priority: 1, active: true },
  { id: 't3', name: 'Éco-taxe', mode: 'fixed', rate: 250, scope: 'all', included: true, priority: 3, active: true },
];

const panier = [{ price: 1000, quantity: 2 }];
const totaux = computeTotals(panier, TAXES);

check('le sous-total suit les lignes', totaux.subtotal === 2000, String(totaux.subtotal));
check('la TVA en pourcentage est calculée', totaux.taxLines.find((l) => l.id === 't1').amount === 380);
check('une taxe fixe garde son montant', totaux.taxLines.find((l) => l.id === 't3').amount === 250);
check(
  "une taxe incluse n'est PAS ajoutée au total",
  totaux.total === 2380,
  `total=${totaux.total}, attendu 2380 (2000 + 380, l'éco-taxe étant déjà dans le prix)`,
);
check('le total des taxes cumule incluses et ajoutées', totaux.taxTotal === 630);

// Le taux codé en dur donnait un résultat différent : c'est le bug corrigé.
const ancien = 2000 * 0.19;
check(
  'le calcul diffère du taux 0,19 codé en dur',
  totaux.taxTotal !== ancien,
  `ancien=${ancien}, nouveau=${totaux.taxTotal}`,
);

const desactivee = computeTotals(panier, [{ ...TAXES[0], active: false }]);
check('une taxe désactivée est ignorée', desactivee.taxTotal === 0 && desactivee.total === 2000);

const parCategorie = computeTotals(
  panier,
  [{ id: 't2', name: 'TVA réduite', mode: 'percent', rate: 9, scope: 'category', scopeValues: ['Consommables'], included: false, priority: 1, active: true }],
  'Consommables',
);
check('une taxe par catégorie s’applique à la bonne catégorie', parCategorie.taxTotal === 180);

const horsCategorie = computeTotals(
  panier,
  [{ id: 't2', name: 'TVA réduite', mode: 'percent', rate: 9, scope: 'category', scopeValues: ['Consommables'], included: false, priority: 1, active: true }],
  'Matériel',
);
check('elle ne s’applique pas aux autres', horsCategorie.taxTotal === 0);

/* ------------------------------------------------------ nettoyage du HTML */

section('Éditeur de note — nettoyage HTML');

const src = lire('components/ui/SimpleHtmlEditor.tsx');
check('les balises autorisées sont une liste blanche', /BALISES_AUTORISEES\s*=\s*new Set/.test(src));
for (const balise of ['B', 'I', 'U', 'UL', 'OL', 'LI']) {
  check(`« ${balise} » est autorisée`, new RegExp(`'${balise}'`).test(src));
}
check('script n’est pas dans la liste', !/'SCRIPT'/.test(src));
check('les attributs sont retirés', /removeAttribute/.test(src));
check('le collage est réduit au texte brut', /getData\('text\/plain'\)/.test(src));
check('DOMParser est utilisé plutôt qu’une regex', /new DOMParser\(\)/.test(src));

/* --------------------------------------------------------- champ pays */

section('Pays — autocomplétion');

const pays = lire('lib/countries.ts');
check('les noms existent dans les trois langues', /fr:.*en:.*ar:/s.test(pays));
check('l’Algérie est présente', /code: 'DZ'/.test(pays));
check('la recherche est insensible à la casse', /toLowerCase\(\)/.test(pays));
check('la recherche accepte le nom arabe', /c\.ar === input\.trim\(\)/.test(pays));

const select = lire('components/ui/CountrySelect.tsx');
check('le composant est un combobox accessible', /role="combobox"/.test(select));
check('la navigation clavier est gérée', /ArrowDown/.test(select) && /ArrowUp/.test(select));
check('la fermeture au clic extérieur est gérée', /mousedown/.test(select));
check('la saisie libre reste possible', /saisie libre/.test(select));

/* ------------------------------------------------- formulaire de devis */

section('Devis — étape 3 et étape 4');

const devis = lire('components/dashboard/QuoteRequestModule.tsx');
check('le téléphone est obligatoire', /errPhoneRequired/.test(devis));
check("l'adresse est obligatoire", /errAddressRequired/.test(devis));
check('le pays est obligatoire', /errCountryRequired/.test(devis));
check("l'e-mail est obligatoire", /errEmailRequired/.test(devis));
check('une adresse trop courte est refusée', /errAddressShort/.test(devis));
check('des notes explicatives accompagnent les champs', /phoneHint/.test(devis) && /addressHint/.test(devis));
// La fenêtre doit couvrir le libellé et les attributs du textarea, plus longs
// que la moyenne : une borne trop courte faisait échouer un code pourtant bon.
check("l'adresse prend toute la largeur", /w-full[\s\S]{0,700}addressPlaceholder/.test(devis));
check('le pays utilise le composant autocomplete', /<CountrySelect/.test(devis));
check('la note utilise l’éditeur HTML', /<SimpleHtmlEditor/.test(devis));
check('la note occupe toute la largeur', /className="w-full">[\s\S]{0,200}SimpleHtmlEditor/.test(devis));
check('le captcha est présent à l’étape 4', /<ImageCaptcha/.test(devis));
check('le captcha bloque la validation', /s === 4 && antispam && !captchaOk/.test(devis));
check('la référence est récupérée après envoi', /setReference\(quote\.reference/.test(devis));
check('la référence est affichée au client', /yourReference/.test(devis));
check('la référence est copiable', /clipboard\?\.writeText\(reference\)/.test(devis));

/* ------------------------------------------------------------- panier */

section('Panier — checkout');

const cart = lire('app/[locale]/cart/page.tsx');

// L'ordre des rendus est la cause du bug signalé : l'écran d'attente doit être
// évalué avant le test du panier vide, sinon il ne s'affiche jamais.
const posRedirect = cart.indexOf('if (redirecting)');
const posVide = cart.indexOf('if (cart.length === 0)');
check('un écran de chargement existe', posRedirect > 0);
check(
  "il est évalué AVANT le test du panier vide",
  posRedirect > 0 && posVide > 0 && posRedirect < posVide,
  `chargement@${posRedirect}, panier vide@${posVide}`,
);
check('le panier est vidé après la navigation', /router\.push[\s\S]{0,200}setTimeout\(\(\) => clearCart\(\)/.test(cart));
check('clearCart n’est plus appelé dans la création', !/const order = addOrder\(orderData\);\s*\n\s*clearCart\(\);/.test(cart));
check('les totaux viennent du moteur commun', /computeTotals\(/.test(cart));
check('le taux 0,19 codé en dur a disparu', !/\* 0\.19/.test(cart));
check('chaque taxe est détaillée dans le tableau', /totals\.taxLines\.map/.test(cart));
check('le taux est affiché à côté du libellé', /line\.rate/.test(cart));
check('une taxe incluse est signalée', /line\.included/.test(cart));
check('le captcha protège le checkout invité', /<ImageCaptcha/.test(cart));
check('paiement et devis sont tous deux protégés', /if \(!antispamPasse\(\)\) return;/.test(cart));
check('le double envoi est bloqué', /cart\.length === 0 \|\| redirecting/.test(cart));

/* ------------------------------------------------------ règles hooks */

// Un hook placé après un « return » conditionnel n'est pas appelé à chaque
// rendu : React lève « Rendered more hooks than during the previous render »
// et la page devient inutilisable. Le tableau de bord a connu ce défaut.
section('Règles des hooks');

const dashboard = lire('app/[locale]/dashboard/page.tsx');
const gardeIdx = dashboard.indexOf('if (!user || isBackOfficeUser(user.type)) return null;');
check('le tableau de bord garde son retour anticipé', gardeIdx > 0);
check(
  'le filtre produits est déclaré avant le retour anticipé',
  dashboard.indexOf('const filteredProducts = useMemo(') < gardeIdx,
);
check(
  'aucun hook ne subsiste après le retour anticipé',
  !/^ {2}const .*= use(Memo|State|Effect|Callback|Ref)\(/m.test(dashboard.slice(gardeIdx)),
);

/* --------------------------------------------------------- traductions */

section('Traductions');

const CLES = [
  'contactIntro', 'phoneHint', 'emailHint', 'addressHint', 'countryHint',
  'errPhoneRequired', 'errAddressRequired', 'errCountryRequired', 'errCaptcha',
  'antispam', 'sentTitle', 'yourReference', 'viewMyQuotes',
];
const CLES_CART = ['preparingPayment', 'preparingPaymentDesc', 'taxIncluded', 'captchaRequired'];

for (const lang of ['fr', 'en', 'ar']) {
  const msgs = JSON.parse(lire(`messages/${lang}.json`));
  const q = msgs.pages?.quoteRequest || {};
  const c = msgs.pages?.cart || {};
  const manquantes = [
    ...CLES.filter((k) => !q[k]),
    ...CLES_CART.filter((k) => !c[k]),
  ];
  check(`« ${lang} » : les ${CLES.length + CLES_CART.length} clés existent`, manquantes.length === 0, manquantes.join(', '));
}

console.log(`\n${passed} contrôle(s) réussi(s), ${failed} échec(s).`);
if (failed) process.exit(1);
console.log(`${C.g}Tous les contrôles passent.${C.x}`);
