#!/usr/bin/env node
/**
 * Contrôles du module Utilisateurs du back-office.
 *
 * Couvre le formulaire d'édition (listes cherchables, validation, notes),
 * le gestionnaire de mot de passe, la fiche de consultation, la sélection
 * multiple et ses actions, ainsi que les référentiels pays et wilayas.
 *
 *   node scripts/test-user-admin.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => readFileSync(join(ROOT, p), 'utf8');

let ok = 0;
let ko = 0;
const check = (label, cond) => {
  if (cond) { ok += 1; console.log(`  ✅ ${label}`); }
  else { ko += 1; console.log(`  ❌ ${label}`); }
};
const section = (t) => console.log(`\n${t}`);

/* ------------------------------------------------------- référentiels */

section('Référentiels pays et wilayas');

// Les modules TypeScript ne sont pas importables tels quels par Node : on
// relit la source et on y vérifie ce qui doit s'y trouver.
const srcWilayas = lire('lib/wilayas.ts');
check('les 58 wilayas sont présentes', (srcWilayas.match(/\{ code: \d+/g) || []).length === 58);
check('Alger porte le code 16', /code: 16, fr: 'Alger'/.test(srcWilayas));
check('les nouvelles wilayas de 2019 figurent', /Timimoun/.test(srcWilayas) && /El Meniaa/.test(srcWilayas));
check('chaque wilaya est traduite en arabe', (srcWilayas.match(/ar: '/g) || []).length >= 58);
check('la recherche accepte un code', /\^\\d\{1,2\}\$/.test(srcWilayas));
check('la comparaison ignore les accents', /normalize\('NFD'\)/.test(srcWilayas));

/* ------------------------------------------------ mots de passe */

section('Gestionnaire de mot de passe');

const srcPwd = lire('lib/password-tools.ts');
check('la longueur minimale reprend celle du serveur', /PASSWORD_MIN = 10/.test(srcPwd));
check('les quatre règles serveur sont vérifiées', /'length'/.test(srcPwd) && /'upper'/.test(srcPwd) && /'lower'/.test(srcPwd) && /'digit'/.test(srcPwd));
check('la génération impose la composition', /const base = \[/.test(srcPwd) && /MAJ\[alea/.test(srcPwd) && /CHIFFRES\[alea/.test(srcPwd));
check('le mélange de Fisher-Yates est appliqué', /base\[j\]\] = \[base\[j\], base\[i\]\]/.test(srcPwd));
check('le tirage évite le biais du modulo', /modulo bias|limite/.test(srcPwd));
check('les caractères ambigus sont exclus', !/[O0Il1]/.test((srcPwd.match(/const MAJ = '([^']+)'/) || [])[1] || 'O'));

const dtoSrc = lire('backend/src/modules/users/dto/user.dto.ts');
check('la règle serveur est bien 10 caractères', /@MinLength\(10\)/.test(dtoSrc));

const srcChamp = lire('components/admin/fields/PasswordField.tsx');
check('le mot de passe peut être affiché', /type=\{visible \? 'text' : 'password'\}/.test(srcChamp));
check('le mot de passe peut être copié', /clipboard\?\.writeText/.test(srcChamp));
check('un indicateur de robustesse est affiché', /analyse\.score/.test(srcChamp));
check('les règles sont cochées en direct', /analyse\.rules\.map/.test(srcChamp));
check('un champ vide en édition vaut « inchangé »', /value\.length > 0 \? !analyse\.valid : required/.test(srcChamp));

/* -------------------------------------------- listes cherchables */

section('Listes déroulantes cherchables');

// Le composant AutocompleteSelect préexistant sert à d'autres écrans avec une
// autre interface (tableau de chaînes, création de valeur) : il doit rester
// intact à côté du nouveau SearchSelect.
const srcAncien = lire('components/admin/fields/AutocompleteSelect.tsx');
check("l'ancien AutocompleteSelect est préservé", /allowCreate/.test(srcAncien) && /options: string\[\]/.test(srcAncien));

const srcAuto = lire('components/admin/fields/SearchSelect.tsx');
check('le composant est un combobox accessible', /role="combobox"/.test(srcAuto) && /aria-expanded/.test(srcAuto));
check('les options sont annoncées comme telles', /role="option"/.test(srcAuto) && /aria-selected/.test(srcAuto));
check('la navigation clavier est gérée', /ArrowDown/.test(srcAuto) && /ArrowUp/.test(srcAuto) && /Escape/.test(srcAuto));
check('la fermeture au clic extérieur est gérée', /mousedown/.test(srcAuto));
check('la recherche porte aussi sur le libellé secondaire', /o\.hint \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/.test(srcAuto));
check('la saisie libre est possible au besoin', /allowFree/.test(srcAuto));

/* ---------------------------------------------- formulaire compte */

section("Formulaire d'édition d'un compte");

const srcForm = lire('components/admin/UserForm.tsx');
check('le formulaire est découpé en sections', (srcForm.match(/<Section titre=/g) || []).length >= 5);
check('chaque champ porte un libellé', /<label htmlFor=\{`uf-\$\{k\}`\}/.test(srcForm));
check('chaque champ peut porter une note', /\{note && !errors\[k\]/.test(srcForm));
check('les champs obligatoires sont signalés', /requis && <span style=\{\{ color: 'var\(--ad-danger\)' \}\}>\*/.test(srcForm));
check('le type de compte utilise une liste cherchable', /options=\{typeOptions\}/.test(srcForm));
check('le statut utilise une liste cherchable', /options=\{statutOptions\}/.test(srcForm));
check('le rôle utilise une liste cherchable', /options=\{roles\}/.test(srcForm));
check('le pays utilise une liste cherchable', /options=\{paysOptions\}/.test(srcForm));
check('la wilaya utilise une liste cherchable', /options=\{wilayaOptions\}/.test(srcForm));
check('la langue utilise une liste cherchable', /options=\{langueOptions\}/.test(srcForm));
check('les rôles sont chargés depuis la base', /cmsAdminList\('roles'\)/.test(srcForm));
check("l'e-mail est validé", /errEmailRequired/.test(srcForm) && /EMAIL_RE\.test/.test(srcForm));
check('le nom et le prénom sont obligatoires', /errFirstNameRequired/.test(srcForm) && /errLastNameRequired/.test(srcForm));
check('le téléphone saisi est contrôlé', /TEL_RE\.test/.test(srcForm));
check('le mot de passe est exigé à la création', /creation && !password/.test(srcForm));
check('un mot de passe vide en édition ne vide pas le compte', /if \(password\) payload\.password = password;\s*\n\s*else delete payload\.password;/.test(srcForm));
check('le premier champ fautif est ramené à l’écran', /scrollIntoView/.test(srcForm));
check('un résumé des erreurs est affiché', /summaryErrors/.test(srcForm));
check('les champs candidat ne sortent que pour un candidat', /\{estCandidat && \(/.test(srcForm));

/* ------------------------------------------- fiche de consultation */

section('Fiche de consultation');

const srcSheet = lire('components/admin/UserSheet.tsx');
check('la fiche ne contient aucun champ de saisie', !/<input/.test(srcSheet) && !/<textarea/.test(srcSheet));
check('la wilaya est affichée avec son code', /wilayaCode\(wil\)/.test(srcSheet));
check('le pays reconnu affiche son code ISO', /pays\.code/.test(srcSheet));
check('les dates suivent le format configuré', /<DateText/.test(srcSheet));
check('un libellé manquant ne fait pas planter la fiche', /t\.has\?\.\(cle\)/.test(srcSheet));
check("la fiche mène à l'édition", /onEdit/.test(srcSheet));
check('le type renvoie vers la vue métier', /userRecordHref/.test(srcSheet));

/* --------------------------------------------- CRUD : sélection */

section('Liste des comptes : sélection multiple et actions');

const srcCrud = lire('components/admin/AdminCrud.tsx');
check('un bouton de consultation existe', /Consulter la fiche/.test(srcCrud));
check('la sélection multiple est disponible', /const \[selected, setSelected\]/.test(srcCrud));
check('une case à cocher par ligne', /toggleSelect\(String\(row\.id\)\)/.test(srcCrud));
check('une case « tout sélectionner »', /toggleSelectAll/.test(srcCrud));
check('chaque ligne de compte est sélectionnable', /onToggleSelect=\{\(\) => onToggleSelect\?\.\(String\(row\.id\)\)\}/.test(srcCrud));
check('activation groupée', /bulkPatch\(\{ status: 'active' \}/.test(srcCrud));
check('blocage groupé', /bulkPatch\(\{ status: 'blocked' \}/.test(srcCrud));
check('mise en attente groupée', /bulkPatch\(\{ status: 'pending' \}/.test(srcCrud));
check('changement de type groupé', /bulkPatch\(\{ type: e\.target\.value \}/.test(srcCrud));
check('mise en corbeille groupée', /bulkDelete/.test(srcCrud));
check('envoi d’e-mail groupé', /bulkMail/.test(srcCrud));
check('les destinataires groupés passent en copie cachée', /bcc=/.test(srcCrud));
check('un échec partiel ne masque pas les réussites', /Promise\.allSettled/.test(srcCrud));
check('les lignes en échec restent sélectionnées', /prev\.filter\(\(id\) => !done\.includes\(id\)\)/.test(srcCrud));
check('les actions groupées demandent confirmation', /confirm\(`\$\{libelle\}/.test(srcCrud));
check('la fiche complète est relue avant édition', /cmsAdminGet\(cfg\.resource/.test(srcCrud));
check('« Nouveau » n’écrit plus de compte de remplissage', /if \(estUsers\) \{\s*\n\s*setEditing\(\{ locale, type: 'client', status: 'active' \}\);/.test(srcCrud));
check('la création passe par le formulaire dédié', /cmsAdminCreate\(cfg\.resource, payload\)/.test(srcCrud));

/* ------------------------------------------------ champ wilaya */

section('Enregistrement des champs');

const srcAdminLib = lire('lib/cms-admin.ts');
check('la wilaya fait partie des champs enregistrables', /'address', 'wilaya', 'position'/.test(srcAdminLib));
check('cmsAdminGet relit une fiche complète', /export async function cmsAdminGet/.test(srcAdminLib));
check('le DTO serveur accepte la wilaya', /wilaya\?: string;/.test(dtoSrc));

/* ------------------------------------------------ comptes de test */

section('Jeu de comptes de test');

const srcSeed = lire('scripts/seed-test-users.mjs');
const mdps = [...srcSeed.matchAll(/password: '([^']+)'/g)].map((m) => m[1]);
check('au moins 8 comptes sont prévus', (srcSeed.match(/email: 'test\./g) || []).length >= 8);
check('chaque compte a un mot de passe distinct', new Set(mdps).size === mdps.length);
check(
  'tous les mots de passe respectent la règle serveur',
  mdps.every((m) => m.length >= 10 && /[A-Z]/.test(m) && /[a-z]/.test(m) && /[0-9]/.test(m)),
);
check('les quatre types de compte sont couverts', ['admin', 'client', 'partner', 'candidate'].every((t) => srcSeed.includes(`type: '${t}'`)));
check('un compte bloqué permet de tester le refus', /status: 'blocked'/.test(srcSeed));
check('un compte en attente est prévu', /status: 'pending'/.test(srcSeed));
check('le script est idempotent', /réinitialisé/.test(srcSeed));
check('la limite de 100 du serveur est respectée', /\/users\?limit=100/.test(srcSeed));
check('l’enveloppe data.data est gérée', /corps\?\.data\?\.data/.test(srcSeed));

/* ------------------------------------------ mise en page et RTL */

section('Mise en page, RTL et responsive');

const css = lire('app/admin.css');
const iCard = css.indexOf('.ad-card {');
const iModal = css.indexOf('.ad-modal {');

// `.ad-card` impose `overflow: visible` et admin.css est chargé APRÈS
// Tailwind : une classe utilitaire `overflow-y-auto` était donc écrasée et
// le bas des formulaires longs restait inatteignable.
check('une classe de modale défilante existe', iModal > 0 && css.includes('.ad-modal-body {'));
check('elle est déclarée après .ad-card', iModal > iCard);
check('le cadre de la modale ne défile pas', /\.ad-modal \{[^}]*overflow: hidden/s.test(css));
check('le corps de la modale défile', /\.ad-modal-body \{[^}]*overflow-y: auto/s.test(css));
check('le corps peut rétrécir dans un conteneur flex', /\.ad-modal-body \{[^}]*min-height: 0/s.test(css));

check('les icônes de champ suivent le sens d’écriture', /\.ad-affix-start \{[^}]*inset-inline-start/s.test(css));
check('les boutons de champ suivent le sens d’écriture', /\.ad-affix-end \{[^}]*inset-inline-end/s.test(css));
check('la réserve de texte est logique, pas figée à gauche', /padding-inline-start/.test(css) && /padding-inline-end/.test(css));
check('la réserve dépend du nombre de boutons', /\.ad-affix\.end-1 > \.ad-input/.test(css) && /\.ad-affix\.end-2 > \.ad-input/.test(css));
check('les boutons logés dans un champ sont dimensionnés', /\.ad-affix-btn \{[^}]*width: 1\.9rem/s.test(css));

const crudSrc = lire('components/admin/AdminCrud.tsx');
check('les modales utilisent la structure défilante', (crudSrc.match(/ad-modal-body/g) || []).length >= 2);
check('la hauteur tient compte de la barre mobile', /max-h-\[92dvh\]/.test(crudSrc));
check('la recherche prend le plus de place', /flex-1 lg:min-w-\[22rem\]/.test(crudSrc));
check('les filtres ont une largeur bornée', /lg:basis-40 lg:shrink-0/.test(crudSrc));
check('la recherche utilise le décalage logique', /ad-affix has-start flex-1/.test(crudSrc));

const selSrc = lire('components/admin/fields/SearchSelect.tsx');
check('la liste cherchable n’utilise plus pl-9', !/pl-9/.test(selSrc) && /ad-affix has-start/.test(selSrc));
check('sa réserve varie selon la coche', /selection \? 'end-2' : 'end-1'/.test(selSrc));

const pwdSrc = lire('components/admin/fields/PasswordField.tsx');
check('le champ mot de passe n’utilise plus pr-20', !/pr-20/.test(pwdSrc));
check('ses boutons sont dimensionnés pour le champ', /ad-affix-btn/.test(pwdSrc));
check('sa réserve varie selon le bouton copier', /value \? 'end-2' : 'end-1'/.test(pwdSrc));

const formSrc2 = lire('components/admin/UserForm.tsx');
check('le pied du formulaire reste visible', /sticky bottom-0/.test(formSrc2));
check('les boutons s’empilent sur mobile', /flex-col-reverse sm:flex-row/.test(formSrc2));

/* ------------------------------------------- ligne utilisateur */

section('Ligne enrichie dans la liste');

const rowSrc = lire('components/admin/UserRow.tsx');
// Le détail d'un compte est partagé par la vue module et la vue table :
// il vit dans son propre fichier pour que les deux ne divergent pas.
const detSrc = lire('components/admin/UserDetails.tsx');
check('un bouton de message interne existe', /onMessage/.test(rowSrc) && /MessageSquare/.test(rowSrc));
check('le téléphone est affiché', /icon=\{Phone\}/.test(detSrc));
check('l’adresse est affichée', /icon=\{MapPin\}/.test(detSrc));
check('le code du compte est affiché', /userCode\(type, record\.id\)/.test(rowSrc));
check('les clients voient commandes et devis', /tl\('orders'\)/.test(detSrc) && /tl\('quotes'\)/.test(detSrc));
check('les candidats voient leurs candidatures', /tl\('applications'\)/.test(detSrc));
check('un lien mène aux candidatures avec le nombre', /seeApplications'\)\} \(\{statsCandidat\.applications\}\)/.test(detSrc));
check('les administrateurs voient type et rôle', /tl\('roleLabel'\)/.test(detSrc) && /tl\('seeRoles'\)/.test(detSrc));
check('des boutons changent le statut sur la ligne', /onStatus\('active'\)/.test(detSrc) && /onStatus\('blocked'\)/.test(detSrc));
check('les statistiques sont calculées après montage', /useEffect\(\(\) => \{[\s\S]{0,300}clientStats\(/.test(detSrc));
check('la mise en page est adaptée au mobile', /sm:p-4/.test(rowSrc) && /hidden sm:inline-flex/.test(rowSrc));
check('la vue module réutilise le détail partagé', /<UserDetails\b/.test(rowSrc));

const statsSrc = lire('lib/user-stats.ts');
check('les devis sont comptés sous leurs deux formes', /isQuote\)[\s\S]{0,80}quote_requested/.test(statsSrc));
check('seules les commandes réglées comptent au chiffre d’affaires', /filter\(\(o\) => \['paid', 'shipped', 'delivered'\][\s\S]{0,120}reduce/.test(statsSrc));
check('le code du compte porte un préfixe par type', /CLI/.test(statsSrc) && /CND/.test(statsSrc) && /PRT/.test(statsSrc));
check('les lectures localStorage sont protégées', /typeof window === 'undefined'/.test(statsSrc));

/* --------------------------------------------- langue du compte */

section('Langue choisie par la personne');

const authSrc = lire('contexts/AuthContext.tsx');
check('le type User porte la langue', /locale\?: string;/.test(authSrc));
check('la connexion conserve la langue du compte', /locale: u\.locale \? String\(u\.locale\) : undefined/.test(authSrc));

const loginSrc = lire('app/[locale]/connexion/page.tsx');
check('la redirection suit la langue du compte', /router\.push\(`\/\$\{langue\}\/\$\{target\}`\)/.test(loginSrc));
check('une langue inconnue est rejetée', /LANGUES_VALIDES\.includes/.test(loginSrc));

const dashSrc = lire('app/[locale]/dashboard/page.tsx');
// Le profil de la vitrine vit désormais dans son propre module : le tableau
// de bord ne fait que le monter.
const profilSrc = lire('components/dashboard/ProfileModule.tsx');
check('le tableau de bord délègue le profil au module', /<ProfileModule \/>/.test(dashSrc));
check('le profil propose de changer de langue', /profil-langue/.test(profilSrc));
check('le choix est enregistré', /localStorage\.setItem\('sari_user'/.test(profilSrc));
check('le changement est appliqué aussitôt', /router\.push\(`\/\$\{brouillon\.locale\}\/dashboard`\)/.test(profilSrc));

// Un hook après un retour conditionnel casse le rendu (React lève
// « Rendered more hooks than during the previous render »).
const gardeIdx2 = dashSrc.indexOf('if (!user || isBackOfficeUser(user.type)) return null;');
check('aucun hook après le retour anticipé', !/^ {2}const .*= use(Memo|State|Effect|Callback|Ref)\(/m.test(dashSrc.slice(gardeIdx2)));
const gardeProfil = profilSrc.indexOf('if (!user) return null;');
check('le module déclare ses hooks avant le retour anticipé',
  !/^ {2}const .*= use(Memo|State|Effect|Callback|Ref)\(/m.test(profilSrc.slice(gardeProfil, profilSrc.indexOf('function Ligne('))));

/* ------------------------------------------------- traductions */

section('Traductions');

const CLES = [
  'sectionIdentity', 'sectionAccess', 'sectionCompany', 'sectionLocation', 'sectionCandidate',
  'firstName', 'lastName', 'email', 'phone', 'typeLabel', 'statusLabel', 'role', 'localeLabel',
  'password', 'passwordChange', 'generate', 'company', 'position', 'address', 'wilaya', 'country',
  'errEmailRequired', 'errEmail', 'errFirstNameRequired', 'errLastNameRequired', 'errPhone',
  'errTypeRequired', 'errStatusRequired', 'errPasswordRequired', 'errPasswordWeak',
  'summaryErrors', 'save', 'cancel', 'close', 'edit',
];
const SOUS_BLOCS = { type: ['admin', 'client', 'partner', 'candidate'], status: ['active', 'pending', 'blocked'], locale: ['fr', 'en', 'ar'], strength: ['empty', 'weak', 'medium', 'strong'], rule: ['length', 'upper', 'lower', 'digit'] };

const CLES_LISTE = [
  'sendMessage', 'consult', 'userCode', 'orders', 'quotes', 'applications',
  'seeApplications', 'seeOrders', 'seeRoles', 'activate', 'block', 'setPending',
];

for (const lang of ['fr', 'en', 'ar']) {
  const msgs = JSON.parse(lire(`messages/${lang}.json`));
  const blocListe = msgs?.admin?.userList || {};
  const manqueListe = CLES_LISTE.filter((k) => !blocListe[k]);
  check(`« ${lang} » : les clés de la liste existent`, manqueListe.length === 0);
  check(
    `« ${lang} » : la langue du profil est traduite`,
    Boolean(msgs?.pages?.dashboard?.displayLanguage && msgs?.pages?.dashboard?.displayLanguageHint),
  );
  const bloc = msgs?.admin?.userForm || {};
  const manquantes = CLES.filter((k) => !bloc[k]);
  const sousManquantes = Object.entries(SOUS_BLOCS)
    .flatMap(([b, ks]) => ks.filter((k) => !bloc?.[b]?.[k]).map((k) => `${b}.${k}`));
  check(`« ${lang} » : les ${CLES.length} clés principales existent`, manquantes.length === 0);
  check(`« ${lang} » : les sous-blocs sont complets`, sousManquantes.length === 0);
}

/* ------------------------------------- présentation du modal et des listes */

section('Modal centré et listes déroulantes');

const cssSrc = lire('app/admin.css');

// Le thème « aurora » rend --ad-surface translucide : un modal bâti sur
// .ad-card laissait voir le voile sombre au travers.
check('la couche de fond est une classe dédiée', /\.ad-overlay\s*\{/.test(cssSrc));
check('la couche de fond est fixée au cadre visible', /\.ad-overlay\s*\{[^}]*position:\s*fixed/.test(cssSrc));
check('le modal est centré', /\.ad-overlay\s*\{[^}]*align-items:\s*center/.test(cssSrc)
  && /\.ad-overlay\s*\{[^}]*justify-content:\s*center/.test(cssSrc));
check('le panneau a un fond opaque', /--ad-sheet-surface/.test(cssSrc));
check('« aurora » impose sa propre teinte opaque',
  /\[data-admin-theme="aurora"\]\s*\.ad-sheet\s*\{[^}]*--ad-sheet-surface/.test(cssSrc));

// `.ad-modal` désignait déjà le VOILE plein écran, 300 lignes plus bas :
// réutiliser ce nom pour le panneau le transformait en voile (fiche
// décentrée, fond translucide). Le panneau s'appelle donc `.ad-sheet`.
check('le panneau ne réutilise pas le nom du voile',
  !/^\.ad-modal\s*\{[^}]*flex-direction:\s*column/m.test(cssSrc));
check('le voile reste fixé au cadre visible',
  /^\.ad-modal\s*\{[^}]*position:\s*fixed/m.test(cssSrc));
check('les panneaux du module utilisent la classe dédiée',
  (crudSrc.match(/ad-card ad-sheet /g) || []).length === 3);
check('le modal d’édition générique est un panneau',
  /ad-card ad-sheet w-full max-w-3xl/.test(crudSrc));

// Le thème pose un backdrop-filter sur .ad-card : sur un ancêtre, il crée un
// bloc conteneur qui décentre tout position:fixed imbriqué.
check('le verre dépoli épargne les panneaux',
  /\[data-admin-theme="aurora"\]\s*\.ad-card:not\(\.ad-sheet\)/.test(cssSrc));
check('le thème brutal épargne aussi les panneaux',
  /\[data-admin-theme="brutal"\]\s*\.ad-card:not\(\.ad-sheet\)/.test(cssSrc));
check('les fenêtres historiques sont opaques elles aussi',
  /\.ad-modal-card\s*\{[^}]*var\(--ad-sheet-surface/.test(cssSrc));
check('les fenêtres historiques suivent la hauteur réelle',
  /\.ad-modal-card\s*\{[^}]*max-height:\s*90dvh/.test(cssSrc));
check('plus aucun voile Tailwind dans le module', !/bg-black\/45/.test(crudSrc));
check('les trois modals utilisent la couche dédiée',
  (crudSrc.match(/className="ad-overlay"/g) || []).length === 3);

// .ad-card impose overflow:visible (les listes déroulantes en dépendent) :
// une classe dédiée est nécessaire pour rendre la sous-liste défilante.
const selectSrc = lire('components/admin/fields/SearchSelect.tsx');
check('la sous-liste a une classe défilante', /\.ad-options\s*\{/.test(cssSrc));
check('la sous-liste est plafonnée en hauteur', /\.ad-options\s*\{[^}]*max-height/.test(cssSrc));
check('la sous-liste affiche son ascenseur', /\.ad-options\s*\{[^}]*overflow-y:\s*auto/.test(cssSrc));
check('le défilement ne déborde pas sur le modal', /\.ad-options\s*\{[^}]*overscroll-behavior/.test(cssSrc));
check('la liste des pays utilise la classe', /ad-card ad-options ad-scroll/.test(selectSrc));
check('plus de conflit overflow sur la liste', !/overflow-hidden max-h-64 overflow-y-auto/.test(selectSrc));
check('la liste s’ouvre vers le haut si besoin', /versLeHaut/.test(selectSrc));
// Le défilement a lieu sur le corps du modal, pas sur la fenêtre : sans
// capture, l'écouteur ne verrait jamais l'événement.
check('la mesure suit le défilement du modal',
  /addEventListener\('scroll',\s*placer,\s*true\)/.test(selectSrc));

/* ------------------------------------------------ liste : détails repliés */

section('Liste : détails repliables');

check('la ligne a un état replié', /const \[ouvert, setOuvert\]/.test(rowSrc));
check('les détails sont masqués par défaut', /useState\(false\)/.test(rowSrc));
check('le courriel et le code sont sur la même ligne',
  /userCode\(type, record\.id\)/.test(rowSrc) && /mailto:\$\{email\}/.test(rowSrc));
check('une flèche commande l’ouverture', /ChevronDown/.test(rowSrc));
check('la flèche annonce son état', /aria-expanded=\{ouvert\}/.test(rowSrc));
check('la flèche pivote à l’ouverture', /rotate-180/.test(rowSrc));
check('le bloc de détails est conditionné', /\{ouvert && \(/.test(rowSrc));

for (const lang of ['fr', 'en', 'ar']) {
  const bloc = JSON.parse(lire(`messages/${lang}.json`))?.admin?.userList || {};
  check(`« ${lang} » : les libellés de la flèche existent`,
    Boolean(bloc.showDetails && bloc.hideDetails));
}

/* ------------------------------------------------ vue table des comptes */

section('Vue table : mêmes détails que la vue module');

const tblSrc = lire('components/admin/UsersTable.tsx');

// La table générique montrait les colonnes brutes de la ressource : passer
// d'une vue à l'autre faisait perdre la moitié des informations.
check('le module aiguille les comptes vers leur propre table',
  /view === 'table' && estUsers \?/.test(crudSrc) && /<UsersTable/.test(crudSrc));
check('la table réutilise le détail partagé', /<UserDetails\b/.test(tblSrc));
check('le nom est sur la première ligne', /\{nom\}/.test(tblSrc));
check('le courriel et le code sont en dessous',
  /mailto:\$\{email\}/.test(tblSrc) && /userCode\(type, row\.id\)/.test(tblSrc));
check('une flèche ouvre le détail', /ChevronDown/.test(tblSrc));
check('la flèche annonce son état', /aria-expanded=\{ouvert\}/.test(tblSrc));
check('la flèche pivote à l’ouverture', /rotate-180/.test(tblSrc));
check('le détail occupe une ligne pleine largeur', /colSpan=\{6\}/.test(tblSrc));
check('la flèche désigne la ligne de détail',
  /aria-controls=\{`detail-\$\{id\}`\}/.test(tblSrc) && /id=\{`detail-\$\{id\}`\}/.test(tblSrc));
check('plusieurs lignes peuvent rester ouvertes', /const \[ouverts, setOuverts\]/.test(tblSrc));
check('le détail n’est monté qu’à l’ouverture', /\{ouvert && \(/.test(tblSrc));
check('la sélection multiple est disponible', /onToggleSelectAll/.test(tblSrc));
check('les actions de la ligne sont présentes',
  ['onMessage', 'onConsult', 'onEdit', 'onDelete'].every((a) => tblSrc.includes(a)));
check('le changement de statut est relayé', /onStatus\(row, statutCible\)/.test(tblSrc));
check('les colonnes sont triables', /toggleSort\('lastName'\)/.test(tblSrc) && /toggleSort\('status'\)/.test(tblSrc));
// Les pastilles doivent rester visibles quand les colonnes disparaissent.
check('type et statut restent lisibles sur mobile', /md:hidden/.test(tblSrc));
check('les décalages suivent le sens de lecture',
  !/\bml-1\b/.test(tblSrc) && !/\bmr-1\b/.test(tblSrc.replace(/w-3 h-3 mr-1/g, '')));

for (const lang of ['fr', 'en', 'ar']) {
  const bloc = JSON.parse(lire(`messages/${lang}.json`))?.admin?.userList || {};
  check(`« ${lang} » : les en-têtes de colonnes existent`,
    ['columnUser', 'columnType', 'columnStatus', 'columnActions', 'selectAll', 'emptyList'].every((k) => bloc[k]));
}

/* --------------------------------------------------- vitrine : profil */

section('Vitrine : déconnexion et profil');

const headerSrc = lire('components/layout/Header.tsx');
check('l’en-tête est branché sur la session', /useAuth\(\)/.test(headerSrc));
check('la déconnexion appelle bien logout', /logout\(\)/.test(headerSrc));
check('plus de gestionnaire factice', !/Votre logique de logout ici/.test(headerSrc));
check('la déconnexion renvoie à l’accueil', /router\.push\(`\/\$\{locale\}`\)/.test(headerSrc));
check('le menu dépend de l’état de connexion', /isAuthenticated \?/.test(headerSrc));

check('le profil s’ouvre en consultation', /useState<'lecture' \| 'edition'>\('lecture'\)/.test(profilSrc));
check('un bouton bascule en édition', /setMode\('edition'\)/.test(profilSrc));
check('l’édition peut être annulée', /const annuler = \(\)/.test(profilSrc));

// Les champs réservés à l'administration ne doivent pas apparaître ici :
// les exposer permettrait à un visiteur de se promouvoir ou de débloquer
// un compte suspendu.
for (const interdit of ['roleId', 'totpEnabled', 'partner-code', 'temp-password']) {
  check(`le champ « ${interdit} » reste réservé à l’administration`, !profilSrc.includes(interdit));
}
check('le statut n’est pas modifiable', !/status:/.test(profilSrc));
check('le type de compte n’est pas modifiable', !/type:\s*['"]/.test(profilSrc));

for (const champ of ['firstName', 'lastName', 'phone', 'company', 'position', 'address', 'wilaya', 'country', 'locale']) {
  check(`le champ « ${champ} » est proposé`, profilSrc.includes(`${champ}:`));
}

check('le changement de mot de passe est proposé', /BlocMotDePasse/.test(profilSrc));
check('l’ancien mot de passe est exigé', /currentPassword/.test(profilSrc));
check('les règles du serveur sont réutilisées', /checkPassword|PASSWORD_MIN/.test(profilSrc));
check('la confirmation est vérifiée', /identiques/.test(profilSrc));
check('l’envoi passe par le point d’entrée dédié', /'\/auth\/change-password'/.test(profilSrc));
check('le jeton de la vitrine est utilisé', /frontToken\(\)/.test(profilSrc));
check('la limitation de débit est expliquée', /429/.test(profilSrc));

const authCtl = lire('backend/src/modules/auth/auth.controller.ts');
const authSvc = lire('backend/src/modules/auth/auth.service.ts');
check('le serveur expose le changement de mot de passe', /@Post\('change-password'\)/.test(authCtl));
check('le point d’entrée est limité en débit', /@Throttle\(\{ default: \{ limit: 5/.test(authCtl));
check('l’ancien mot de passe est vérifié', /bcrypt\.compare\(dto\.currentPassword/.test(authSvc));
check('un mot de passe inchangé est refusé', /must differ from the current one/.test(authSvc));
check('les autres sessions sont révoquées', /revokedAt: new Date\(\)\.toISOString\(\)/.test(authSvc));

for (const lang of ['fr', 'en', 'ar']) {
  const bloc = JSON.parse(lire(`messages/${lang}.json`))?.pages?.dashboard || {};
  const requises = ['changePassword', 'currentPassword', 'newPassword', 'confirmPassword',
    'pwdMismatch', 'pwdChanged', 'pwdWrongCurrent', 'profileSaved', 'firstName', 'lastName', 'wilaya', 'country'];
  check(`« ${lang} » : les clés du profil existent`, requises.every((k) => bloc[k]));
}

console.log(`\n${ok} contrôle(s) réussi(s), ${ko} échec(s).`);
if (ko) process.exitCode = 1;
else console.log('Tous les contrôles passent.');
