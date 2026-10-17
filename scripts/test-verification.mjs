#!/usr/bin/env node
/**
 * scripts/test-verification.mjs — les garde-fous du système de vérification.
 *
 * Comme `test-ged.mjs`, ce fichier ne se fierait pas à un navigateur qu'il n'a
 * pas : il tranche les fonctions pures de `lib/verification.ts` pour les exécuter
 * telles quelles, et il lit les accords (page ↔ API ↔ catalogue) dans les
 * sources. Ce qui est vérifié ici, en trois étages :
 *
 *   1. le pur : la comparaison des codes de l'API (« 01 » vaut « 1 », « A » ne
 *      vaut pas « 1 »), l'extraction par chemin pointé, le catalogue nettoyé ;
 *   2. le contrat de la route publique : captcha d'abord, limites de forme
 *      ensuite, repli local explicite, et surtout — jamais de « valide » par
 *      défaut pour un code inconnu ;
 *   3. la chaîne complète, du lien de QR à l'écran : les deux routes publiques
 *      montent la même expérience, `?code&key` continue de marcher, le
 *      pré-remplissage ne saute pas le contrôle anti-robot, et l'onglet des
 *      paramètres comme l'écran du catalogue parlent à `/api/admin/verification`.
 */
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let passed = 0;
function report(label, error) {
  if (error) {
    console.error(`  ✗ ${label}\n    ${error.message}`);
    process.exitCode = 1;
  } else {
    passed += 1;
    console.log(`  ✓ ${label}`);
  }
}
const ok = (label, fn) => {
  try {
    fn();
    report(label);
  } catch (error) {
    report(label, error);
  }
};
const acheck = async (label, fn) => {
  try {
    await fn();
    report(label);
  } catch (error) {
    report(label, error);
  }
};

const lib = await import('../lib/verification.ts');

console.log('lib/verification.ts — les fonctions pures');

ok('pickPath suit les chemins pointés et rend undefined plutôt que de tomber', () => {
  const raw = { data: { result: { code: '1', type: 'facture_vente' } }, other: 0 };
  assert.equal(lib.pickPath(raw, 'data.result.code'), '1');
  assert.equal(lib.pickPath(raw, 'data.absent.code'), undefined);
  assert.equal(lib.pickPath(raw, ''), undefined);
  assert.equal(lib.pickPath(null, 'a'), undefined);
});

ok('la valeur de l\'API se compare en chaîne, avec tolérance numérique', () => {
  assert.ok(lib.codeValuesMatch('1', '1'));
  assert.ok(lib.codeValuesMatch('01', '1'));
  assert.ok(lib.codeValuesMatch('VALID', 'valid'));
  assert.ok(!lib.codeValuesMatch('10', '1'));
  assert.ok(!lib.codeValuesMatch('A', '1'));
});

ok('le catalogue trouve l\'entrée active, jamais une désactivée', () => {
  const codes = [
    { id: 'a', code: '1', semantic: 'valid', active: true, labels: { fr: 'Valide' }, showDetails: true, sortOrder: 1 },
    { id: 'b', code: '9', semantic: 'neutral', active: false, labels: {}, showDetails: false, sortOrder: 2 },
  ].map((c) => lib.normalizeCodeDef(c));
  assert.equal(lib.findCodeDef(codes, '1')?.id, 'a');
  assert.equal(lib.findCodeDef(codes, '01')?.id, 'a');
  assert.equal(lib.findCodeDef(codes, '9'), null, 'un code retiré du service ne répond plus');
  assert.equal(lib.findCodeDef(codes, '77'), null);
});

ok('normalizeCodeDef borne, trie par défaut et refuse les sémantismes inconnus', () => {
  const def = lib.normalizeCodeDef({ code: ' 4 ', semantic: 'definitely-not', labels: { fr: ' X '.repeat(80) }, sortOrder: 'x' }, 6);
  assert.equal(def.code, '4');
  assert.equal(def.semantic, 'neutral');
  assert.ok(def.labels.fr && def.labels.fr.length <= 160);
  assert.equal(def.sortOrder, 7, 'un sortOrder non numérique prend l\'index + 1');
  assert.equal(def.active, true, 'une ligne nouvelle est active tant que l\'agent n\'a pas coché le contraire');
});

ok('sanitizeCodes exige l\'unicité et un « valide » au monde', () => {
  const rows = [
    { code: '1', semantic: 'valid', labels: { fr: 'OK' } },
    { code: '4', semantic: 'neutral', labels: { fr: 'Nuance' } },
  ];
  assert.equal(lib.sanitizeCodes(rows).length, 2);
  assert.throws(() => lib.sanitizeCodes([...rows, { code: '1', semantic: 'valid', labels: {} }]), /deux fois/);
  assert.throws(() => lib.sanitizeCodes([{ code: '5', semantic: 'neutral', labels: {} }]), /au moins un code/);
});

await acheck('le repli local répond sans l\'API, introuvable sinon, et jamais sur une moitié du couple', async () => {
  const codes = lib.defaultVerificationStore().codes;
  const found = await lib.verifyLocally('fr', 'SARI-FAC24-00001', 'CTdxXe6ZdFVzWQ==', codes);
  assert.ok(found, 'le couple de démonstration doit répondre');
  assert.equal(found.outcome.semantic, 'valid');
  assert.equal(found.document.type, 'facture_vente', 'Type vient de la réponse, pas d\'un supposé');
  assert.ok(found.document.issuer);
  assert.equal(await lib.verifyLocally('fr', 'SARI-FAC24-00001', 'mauvaise-cle', codes), null, 'un code connu avec une clé fausse ne doit rien dire de plus');
  assert.equal(await lib.verifyLocally('fr', 'SARI-INCONNU-00000', 'X', codes), null);
  const revoke = await lib.verifyLocally('fr', 'SARI-BCV24-00001', 'Xy98Zw76Vu54Ts32==', codes);
  assert.equal(revoke?.outcome.semantic, 'revoked');
  assert.match(revoke?.outcome.description || revoke?.document.message || '', /annul|retir/i, 'le motif de révocation remonte');
});

await acheck('le magasin survit à un JSON tronqué et lui préfère quand même le fichier écrit', async () => {
  const file = path.join(ROOT, 'data', 'verification.json');
  const before = await readFile(file, 'utf8');
  try {
    await writeFile(file, '{"api": {"enabled": true, "url":', 'utf8');
    const store = await lib.readVerificationStore();
    assert.equal(store.api.enabled, false, 'tronqué → les défauts, API éteinte');
    assert.ok(store.codes.some((c) => c.semantic === 'valid'));
    const next = lib.defaultVerificationStore();
    next.api.url = 'https://exemple.test/verify';
    await lib.writeVerificationStore(next);
    const back = await lib.readVerificationStore();
    assert.equal(back.api.url, 'https://exemple.test/verify');
    assert.equal(back.codes.length, 4);
  } finally {
    await writeFile(file, before, 'utf8');
  }
});

ok('les statuts HTTP suivent les codes machine', () => {
  assert.equal(lib.verificationStatus('INTROUVABLE'), 404);
  assert.equal(lib.verificationStatus('TROP_DE_TENTATIVES'), 429);
  assert.equal(lib.verificationStatus('API_INJOIGNABLE'), 502);
  assert.equal(lib.verificationStatus('REPONSE_API'), 502);
  assert.equal(lib.verificationStatus('CAPTCHA'), 400);
});

// ---------------------------------------------------------------------------
// 2) La route publique, lue comme un contrat.
// ---------------------------------------------------------------------------
console.log('app/api/verification/check — le parcours du contrôle');

const check = read('app/api/verification/check/route.ts');

ok('le captcha est vérifié avant toute sortie vers l\'API externe', () => {
  const captcha = check.indexOf('verifyCaptcha(');
  const api = check.indexOf('callVerificationApi(');
  assert.ok(captcha > 0 && api > captcha, 'l\'appel sortant doit venir après la garde captcha');
  assert.match(check, /rateLimited\(`verification:\$\{clientIp\(req\)\}`/, 'le débit porte un seau propre à la vérification');
});

ok('les deux champs sont exigés, dans des formes bornées', () => {
  assert.match(check, /if \(!code \|\| !hash\) return fail\(/);
  assert.match(check, /CODE_SHAPE\.test\(code\)/);
  assert.match(check, /KEY_SHAPE\.test\(hash\)/);
});

ok('un code hors catalogue est une anomalie, jamais un feu vert par défaut', () => {
  assert.match(check, /absent[e]? du catalogue/);
  const branch = check.slice(check.indexOf('const def = findCodeDef'), check.indexOf('const def = findCodeDef') + 700);
  assert.match(branch, /'REPONSE_API'/);
  assert.ok(!/findCodeDef[\s\S]{0,200}?semantic:\s*'valid'/.test(branch), 'aucune valeur par défaut « valide » ne doit traîner');
});

ok('le repli local se signale à la page', () => {
  assert.match(check, /notice = 'api_injoignable'/);
  assert.match(check, /fallbackToLocal/);
});

const status = read('app/api/verification/status/route.ts');
const libSrc = read('lib/verification.ts');
ok('le mode est public sans exposer d\'URL ni de clés', () => {
  assert.match(status, /publicVerificationStatus\(\)/);
  const i = libSrc.indexOf('export async function publicVerificationStatus');
  assert.ok(i > 0, 'la fonction doit être trouvée');
  const body = libSrc.slice(i, libSrc.indexOf('\n}', i) + 2);
  assert.ok(body.includes('enabled'), 'le corps doit avoir été saisi');
  assert.ok(!body.includes('apiKey'), 'la clé d\'API ne doit jamais être lue par ce statut');
  assert.ok(!/\burl:/.test(body), 'l\'URL de l\'API ne doit pas être un champ de ce statut (sa simple présence dans un booléen est permise)');
});

// ---------------------------------------------------------------------------
// 3) La chaîne complète page ↔ catalogue ↔ réglages.
// ---------------------------------------------------------------------------
console.log('la chaîne, du QR à l\'écran');

const rootPage = read('app/[locale]/verification/page.tsx');
const segCode = read('app/[locale]/verification/[code]/page.tsx');
const segPage = read('app/[locale]/verification/[code]/[hash]/page.tsx');
const experience = read('components/verification/VerificationExperience.tsx');
const settings = read('components/admin/VerificationSettingsSection.tsx');
const crud = read('app/[locale]/admin/verification-codes/page.tsx');

ok('les trois routes publiques montent la même expérience, sans juger dans le routeur', () => {
  assert.match(rootPage, /VerificationExperience/);
  assert.match(segPage, /VerificationExperience/);
  // le QR qui ne porte que le code ne doit plus tomber sur la 404 du site
  assert.match(segCode, /VerificationExperience/);
  assert.match(segCode, /decodeSegmentParam\(params\.code\)/);
  assert.match(segCode, /fromQr=\{Boolean\(code\)\}/);
  assert.match(segPage, /decodeSegmentParam\(params\.code\)/);
  assert.match(segPage, /decodeSegmentParam\(params\.hash\)/);
  assert.ok(!/verifyLocally|callVerificationApi/.test(segPage), 'le segment ne décide rien : c\'est /api/verification/check qui juge');
  assert.match(rootPage, /sp\.hash\)? \|\| decodeSegmentParam\(sp\.key\)/, '?code&key (les liens historiques) continue d\'être accepté');
});

ok('un lien sans clé réclame la clé, pas une page d\'erreur', () => {
  const guards = experience.slice(experience.indexOf('const inputCode'), experience.indexOf('if (!captcha'));
  assert.match(guards, /form\.keyMissing/);
  assert.match(guards, /form\.codeMissing/);
});

ok('sous un feu vert, plus de récépissé — le repli local reste seul visible', () => {
  const meta = experience.slice(experience.indexOf('const renderMeta'), experience.indexOf('const renderMeta') + 900);
  assert.match(meta, /r\.status === 'valid' && !r\.notice/);
  assert.match(meta, /return null/);
});

ok('la description du verdict respire sous le bloc Type + Émetteur', () => {
  assert.match(experience, /border-l-4 border-green-500 p-4 rounded mt-6/);
});

ok('le pré-remplissage ne saute jamais le contrôle anti-robot', () => {
  assert.match(experience, /fromQr/);
  assert.match(experience, /handleVerify = async/);
  const handler = experience.slice(experience.indexOf('const handleVerify'), experience.indexOf('const resetVerification'));
  assert.match(handler, /if \(!captcha \|\| !captchaAnswer\.trim\(\)\)/, 'sans réponse au captcha, pas de requête sortante');
  // et surtout : aucune vérification automatique à l'entrée
  const effectBlocks = experience.match(/useEffect\(\(\) => \{[\s\S]{0,400}?\}, \[[^\]]*\]\);/g) || [];
  assert.ok(!effectBlocks.some((b) => b.includes('handleVerify()')), 'aucun effet ne déclenche handleVerify');
});

ok('la page traduit le code d\'erreur de la route, pas seulement son texte', () => {
  for (const code of ['CAPTCHA', 'TROP_DE_TENTATIVES', 'INTROUVABLE', 'FORMAT_CODE', 'PARAMETRES']) {
    assert.ok(experience.includes(`'${code}'`), `${code} doit avoir son panneau`);
  }
  assert.match(experience, /err\.code === 'INTROUVABLE'[\s\S]{0,160}not_found/);
});

ok('le catalogue administré pilote libellés et détails, avec repli sur les titres historiques', () => {
  assert.match(experience, /label: outcome\.label \|\| undefined/);
  assert.match(experience, /result\.label \|\| t\('results\.valid\.title'\)/);
  assert.match(experience, /showDetails: outcome\.showDetails !== false/);
});

ok('réglages et catalogue écrivent dans le même magasin, par la même route', () => {
  assert.match(settings, /'\/api\/admin\/verification'/);
  assert.match(crud, /'\/api\/admin\/verification'/);
  assert.match(settings, /method: 'PUT'[\s\S]{0,220}body: JSON\.stringify\(\{ api \}\)/);
  assert.match(crud, /body: JSON\.stringify\(\{ codes: rows \}\)/);
});

ok('la fiche d\'édition scrolle, valide et referme proprement', () => {
  const editor = crud.slice(crud.indexOf('function CodeEditor('));
  // le gabarit d\'une fiche d\'édition admin, c\'est ad-overlay + ad-sheet + ad-modal-body — pas un flex bricolé
  assert.match(editor, /className="ad-overlay"/, 'le voile suit la convention admin');
  assert.match(editor, /onClick=\{onCancel\}/, 'un clic hors de la carte la ferme');
  assert.match(editor, /ad-card ad-sheet w-full max-w-2xl max-h-\[92dvh\] ad-rise/, 'carte bornée, surface pleine, entrée animée');
  assert.match(editor, /className="ad-modal-body ad-scroll p-4 sm:p-6 space-y-4"/, '…et son corps défile');
  assert.match(editor, /onSubmit=\{submit\}/, 'Entrée = enregistrer, avec les gardes');
  assert.match(editor, /type="submit"/);
  assert.match(editor, /t\('editor\.needCode'\)/);
  assert.match(editor, /t\('editor\.badCode'\)/);
  assert.match(editor, /t\('editor\.duplicateCode'\)/);
  assert.match(editor, /t\('editor\.needLabel'\)/);
  assert.match(editor, /t\('editor\.badSort'\)/);
  assert.match(editor, /clash\(o\.code, code\)/, 'le doublon se juge comme le serveur : casse et 01≡1');
  assert.match(editor, /role="alert"/, 'les erreurs sont annoncées aux lecteurs d\'écran');
  assert.match(editor, /aria-invalid/, 'et rattachées au champ fautif');
  assert.match(crud, /others=\{\(codes \|\| \[\]\)\.filter\(\(c\) => c\.id !== draft\.id\)\}/, 'le contrôle de doublon ignore la ligne éditée');
  // l'aria-invalid doit être STYLÉ quelque part, sinon la validation est invisible
  const css = read('app/admin.css');
  assert.match(css, /\[aria-invalid='true'\]/);
  // la mécanique de défilement vit dans le CSS de la convention, pas dans la source :
  assert.match(css, /\.ad-sheet\s*\{[^}]*overflow: hidden/s, 'ad-sheet borne la carte');
  assert.match(css, /\.ad-modal-body\s*\{[^}]*min-height: 0/s, 'ad-modal-body laisse le corps rétrécir et défiler');
  assert.match(editor, /sticky bottom-0 z-10/, 'les actions restent sous les yeux, comme dans UserForm');
  assert.match(editor, /var\(--ad-danger\)/, 'l\'erreur est à la couleur du thème, pas à un rouge Tailwind aveugle au thème');
});

ok('le test de l\'onglet n\'exige pas l\'enregistrement préalable', () => {
  assert.match(settings, /\/api\/admin\/verification\/test/);
  const testRoute = read('app/api/admin/verification/test/route.ts');
  assert.match(testRoute, /enabled: true/, 'le test force la traversée, le save seul décide du drapeau');
});

// ---------------------------------------------------------------------------
// 4) Les défauts semés — la page doit fonctionner avant toute configuration.
// ---------------------------------------------------------------------------
console.log('le départ : aucun réglage posé, tout répond');

const seed = JSON.parse(read('data/verification.json'));
ok('la graine couvre les quatre codes de l\'API, et l\'API est éteinte', () => {
  assert.equal(seed.api.enabled, false);
  const byCode = Object.fromEntries(seed.codes.map((c) => [c.code, c.semantic]));
  assert.deepEqual(byCode, { 1: 'valid', 0: 'forged', 2: 'expired', 3: 'revoked' });
});

ok('les libellés existent dans les trois langues de la vitrine', () => {
  for (const c of seed.codes) {
    for (const loc of ['fr', 'en', 'ar']) {
      assert.ok(c.labels[loc], `labels.${loc} manque au code ${c.code}`);
    }
  }
});

const msgs = JSON.parse(read('messages/fr.json'));
const messagesEn = JSON.parse(read('messages/en.json'));
const messagesAr = JSON.parse(read('messages/ar.json'));
ok('les clés de la page existent dans les trois langues', () => {
  for (const m of [msgs, messagesEn, messagesAr]) {
    const v = m.pages.verification;
    for (const key of ['prefilled']) assert.ok(v[key], `pages.verification.${key}`);
    for (const key of ['api', 'demo', 'apiHelp', 'demoHelp']) assert.ok(v.mode[key], `pages.verification.mode.${key}`);
    for (const key of ['title', 'message', 'retry']) assert.ok(v.results.apiError[key], `results.apiError.${key}`);
    for (const key of ['code', 'api', 'local', 'apiUnreachable']) assert.ok(v.results.meta[key], `results.meta.${key}`);
    assert.ok(m.admin.menu.verificationCodes, 'admin.menu.verificationCodes');
    assert.ok(m.admin.verificationCodes.editor.needCode, 'le vocabulaire du catalogue est posé');
  }
});

console.log(`\n${passed} vérification(s) passées${process.exitCode ? ', avec des échecs' : ', tout est d’aplomb'}.`);
