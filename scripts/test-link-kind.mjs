#!/usr/bin/env node
/**
 * scripts/test-link-kind.mjs — la règle « interne ou externe », jouée à plat.
 *
 * Ce que ces assertions protègent, en une phrase : un lien saisi dans
 * l'administration doit être enregistré sous la forme que la vitrine sait servir.
 * Le pied de page préfixait tout par la langue, `https://exemple.com` y est donc
 * devenu `/fr/https://exemple.com` ; le bandeau, lui, laissait l'adresse intacte.
 * Deux interprétations d'un même enregistrement : le lien marche ici, casse là.
 *
 *   node scripts/test-link-kind.mjs        (aucun serveur, aucune base)
 */
import assert from 'node:assert/strict';

// Le module est importé tel quel : `lib/link-kind.mjs` n'importe rien du tout et ne
// dépend d'aucun paquet, donc `node` le lit sans transpileur ni serveur — la règle est
// testée là même où elle est écrite, et non dans une copie qui serait libre de dériver.
// Les langues admises entrent par paramètre, comme partout ailleurs : c'est
// `lib/i18n.ts` qui les déclare, ce test les répète exprès pour rester autonome.
const LOCALES = ['fr', 'en', 'ar'];
const { isExternalLink, normalizeInternalHref, stripLocalePrefix, looksLikeBareDomain, schemeIt, externalLinkAttrs, menuHref } =
  await import('../lib/link-kind.mjs');


let done = 0;
const check = (label, fn) => {
  try { fn(); done += 1; console.log(`  ✅ ${label}`); }
  catch (err) { console.log(`  ❌ ${label}\n     ${err.message.split('\n')[0]}`); process.exitCode = 1; }
};

console.log('\nUn lien qui sort du site se reconnaît');
check('schémas, //, contact direct', () => {
  for (const h of ['https://exemple.com', 'http://x.d/a', '//cdn.exemple.com/a.png', 'mailto:a@b.d', 'tel:+21360000', 'sms:+21360000', 'whatsapp://send']) {
    assert.equal(isExternalLink(h), true, h);
  }
});
check('un chemin du site ne l’est pas', () => {
  for (const h of ['/contact', 'contact', '#section', '', '/', '/https://exemple.com']) {
    assert.equal(isExternalLink(h), false, h);
  }
});

console.log('\nUn chemin interne s’enregistre sans la langue');
check('préfixe de langue retiré', () => {
  assert.equal(normalizeInternalHref('/fr/contact', LOCALES), '/contact');
  assert.equal(normalizeInternalHref('/ar/news/3-solution', LOCALES), '/news/3-solution');
  assert.equal(normalizeInternalHref('/fr', LOCALES), '/');
  assert.deepEqual(stripLocalePrefix('/fr/x', LOCALES), { path: '/x', stripped: 'fr' });
});
check('une page qui ressemble à une langue est conservée', () => {
  assert.equal(normalizeInternalHref('/france', LOCALES), '/france');
  assert.equal(normalizeInternalHref('/prod-2024', LOCALES), '/prod-2024');
  assert.deepEqual(stripLocalePrefix('/france', LOCALES), { path: '/france', stripped: null });
});
check('barre initiale posée, slash de fin retiré', () => {
  assert.equal(normalizeInternalHref('contact', LOCALES), '/contact');
  assert.equal(normalizeInternalHref('contact/', LOCALES), '/contact');
  assert.equal(normalizeInternalHref('/a//b', LOCALES), '/a/b');
  assert.equal(normalizeInternalHref('', LOCALES), '');
  assert.equal(normalizeInternalHref('#resultats', LOCALES), '#resultats', 'une ancrage ne se préfixe pas');
});

console.log('\nUne adresse nue devient une adresse, pas un chemin');
check('exemple.com → https://exemple.com', () => {
  assert.equal(looksLikeBareDomain('exemple.com'), true);
  assert.equal(looksLikeBareDomain('www.exemple.com/c'), false, 'un chemin le rend déjà exploitable');
  assert.equal(looksLikeBareDomain('/x'), false);
  assert.equal(schemeIt('exemple.com'), 'https://exemple.com');
  assert.equal(schemeIt('mailto:a@b.d'), 'mailto:a@b.d', 'un schéma existant ne se double pas');
  assert.equal(schemeIt('//cdn.exemple.com'), '//cdn.exemple.com');
});

console.log('\nLa vitrine sert le lien, le hors-site reste intact');
check('menuHref : interne préfixé, externe intact', () => {
  assert.equal(menuHref('https://exemple.com/c', 'fr', LOCALES), 'https://exemple.com/c');
  assert.equal(menuHref('mailto:a@b.d', 'fr', LOCALES), 'mailto:a@b.d');
  assert.equal(menuHref('/contact', 'fr', LOCALES), '/fr/contact');
  assert.equal(menuHref('contact', 'ar', LOCALES), '/ar/contact');
  assert.equal(menuHref('#resultats', 'fr', LOCALES), '/fr/resultats');
});
check('menuHref : un préfixe déjà posé est repris, pas doublé', () => {
  // Le sous-menu généré (`entityUrl`) arrive préfixé : le re-préfixer ferait un 404.
  assert.equal(menuHref('/en/solutions/echo', 'fr', LOCALES), '/fr/solutions/echo');
  assert.equal(menuHref('/fr', 'ar', LOCALES), '/ar');
  assert.equal(menuHref('/fr/', 'ar', LOCALES), '/ar');
});
check('menuHref : le vide et le racine mènent à l’accueil', () => {
  assert.equal(menuHref('', 'fr', LOCALES), '/fr');
  assert.equal(menuHref('/', 'fr', LOCALES), '/fr');
  assert.equal(menuHref('#', 'fr', LOCALES), '/fr');
});

console.log('\nHors du site : un onglet, et rien qui fuise');
check('attributs de cible', () => {
  assert.deepEqual(externalLinkAttrs('https://exemple.com'), { target: '_blank', rel: 'noopener noreferrer' });
  assert.deepEqual(externalLinkAttrs('//cdn.exemple.com/a.png'), { target: '_blank', rel: 'noopener noreferrer' });
  assert.deepEqual(externalLinkAttrs('mailto:a@b.d'), {}, 'une messagerie, pas un onglet');
  assert.deepEqual(externalLinkAttrs('/contact'), {});
});

const code = process.exitCode ? 1 : 0;
console.log(code ? '\n❌ La règle « interne ou externe » ne tient pas.' : `\n✅ ${done} assertion(s) sur la règle « interne ou externe ».`);
process.exit(code);
