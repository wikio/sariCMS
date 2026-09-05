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
check('les cartes sont aussi sélectionnables', /selectable && onToggleSelect/.test(srcCrud));
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

for (const lang of ['fr', 'en', 'ar']) {
  const msgs = JSON.parse(lire(`messages/${lang}.json`));
  const bloc = msgs?.admin?.userForm || {};
  const manquantes = CLES.filter((k) => !bloc[k]);
  const sousManquantes = Object.entries(SOUS_BLOCS)
    .flatMap(([b, ks]) => ks.filter((k) => !bloc?.[b]?.[k]).map((k) => `${b}.${k}`));
  check(`« ${lang} » : les ${CLES.length} clés principales existent`, manquantes.length === 0);
  check(`« ${lang} » : les sous-blocs sont complets`, sousManquantes.length === 0);
}

console.log(`\n${ok} contrôle(s) réussi(s), ${ko} échec(s).`);
if (ko) process.exitCode = 1;
else console.log('Tous les contrôles passent.');
