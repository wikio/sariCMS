#!/usr/bin/env node
/**
 * Ce que les fichiers déposés ont le droit d'être.
 *
 *   npm run upload:test
 *
 * Trois choses sont vérifiées ici, parce qu'elles se valident mutuellement et
 * qu'aucune d'elles ne fait d'erreur visible quand elle lâche :
 *
 * 1. **Le type réel d'un fichier** doit être l'un des six admis, prouvé par ses
 *    magic bytes — pas par son nom, pas par l'en-tête `Content-Type`. Un `.png`
 *    qui est en fait du HTML est refusé.
 * 2. **Un SVG est un document**, et il est servi sur l'origine du site : ouvert en
 *    haut de page, il exécute ce qu'il contient. Le nettoyage doit donc retirer
 *    script, gestionnaires d'événements, `foreignObject` et URLs `javascript:` —
 *    y compris écrites en entités XML, y compris animées par SMIL.
 * 3. **Les entêtes de `/uploads/*`** doivent rester présents : ils sont la seconde
 *    barrière, celle qui tient encore quand un fichier vérolé a été déposé sur le
 *    disque par un autre chemin (une restauration, un `scp`, un collègue).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { sanitizeSvg, sanitizeSvgBuffer, validateMagicBytes, ALLOWED_MIME_TYPES } = await import(
  pathToFileURL(join(ROOT, 'lib/upload-validation.ts')).href
);

let echecs = 0;
const ok = (label) => console.log(`  ok   ${label}`);
function check(label, condition, hint) {
  if (condition) return ok(label);
  echecs++;
  console.log(`  ÉCHEC ${label}\n       ${hint}`);
}

// ── 1. Nettoyage des SVG ─────────────────────────────────────────────────────
const SVG_CLEAN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`;
check(
  'un SVG sans script ressort intact (le nettoyage n’est pas un massicot)',
  sanitizeSvg(SVG_CLEAN).text === SVG_CLEAN && sanitizeSvg(SVG_CLEAN).removed.length === 0,
  'un logo légitime altéré par le filtre serait un défaut plus cher que celui qu’il soigne',
);

const attaques = [
  ['<script>', `<svg><script>alert(1)</script></svg>`],
  ['onload=', `<svg onload="alert(1)"><rect/></svg>`],
  ['foreignObject', `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>x()</script></body></foreignObject></svg>`],
  ['href javascript:', `<svg><a href="javascript:alert(1)"><text>x</text></a></svg>`],
  ['URL en entités XML', `<svg><a xlink:href="&#106;avascript:alert(1)">y</a></svg>`],
  ['animation SMIL vers href', `<svg><a><animate attributeName="href" values="javascript:alert(1)" begin="click"/><text>cliquez</text></a></svg>`],
  ['<iframe>', `<svg><iframe src="https://exemple.tld/x"/></svg>`],
];
for (const [nom, source] of attaques) {
  const { text, removed } = sanitizeSvg(source);
  const reste = /<script|onload|foreignObject|javascript:|<iframe/i.test(
    text
      .replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);?/g, (_m, d) => String.fromCodePoint(Number(d))),
  );
  check(`SVG piégé nettoyé : ${nom}`, removed.length > 0 && !reste, `le filtre a laissé passer quelque chose : ${text.slice(0, 90)}`);
}

check(
  'un buffer non-SVG n’est pas touché',
  (() => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const out = sanitizeSvgBuffer(png, 'image/png');
    return out.removed.length === 0 && out.buffer === png;
  })(),
  'le nettoyage est appelé pour tout fichier : un PNG doit ressortir octet pour octet',
);

check(
  'un SVG sans MIME déclaré est quand même reconnu à ses octets',
  sanitizeSvgBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>')).removed.includes('script'),
  'la route passe parfois le seul buffer (data URL de l’atelier) : le nom de fichier n’est pas une preuve',
);

// ── 2. Types refusés ────────────────────────────────────────────────────────
for (const mime of ['text/html', 'application/xhtml+xml', 'text/javascript', 'application/x-executable']) {
  check(
    `${mime} n’est pas un type admis`,
    !Object.keys(ALLOWED_MIME_TYPES).includes(mime) &&
      !validateMagicBytes(Buffer.from('<html><script>1</script></html>'), mime).valid,
    'la liste blanche doit rester courte : six types, images et documents seulement',
  );
}
check(
  'un fichier nommé .png mais plein de HTML est refusé aux magic bytes',
  !validateMagicBytes(Buffer.from('<html><body>x</body></html>'), 'image/png').valid,
  'sans cette comparaison, l’extension fait foi et n’importe quoi peut se faire passer pour une image',
);

// ── 3. Ce qui est branché autour ─────────────────────────────────────────────
const route = readFileSync(join(ROOT, 'app/api/admin/upload/route.ts'), 'utf8');
check(
  'les deux chemins d’écriture passent par sanitizeSvgBuffer',
  (route.match(/sanitizeSvgBuffer\(/g) || []).length >= 2 &&
    /import \{[^}]*sanitizeSvgBuffer[^}]*\} from '@\/lib\/upload-validation'/.test(route),
  'la GED a une écriture par fichier (multipart) et une écriture par data URL : nettoyer l’une des deux seulement laisse l’autre ouverte',
);

const cfg = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
check(
  '/uploads porte un Content-Security-Policy propre',
  /source:\s*'\/uploads\/:path\*'/.test(cfg) && /default-src 'none'/.test(cfg),
  'un fichier déposé dans la GED est servi sur l’origine du site ; son entête doit le rendre inerte',
);

const docs = readFileSync(join(ROOT, 'backend/src/modules/settings/settings-docs.service.ts'), 'utf8');
const client = readFileSync(join(ROOT, 'lib/settings-doc.ts'), 'utf8');
check(
  'une clé secrète par ligne de liste est retirée des deux côtés',
  /payments: \{ shape: 'array', itemStrip: \['apiKey'\] \}/.test(docs) &&
    /payments: \{[^}]*itemStrip: \['apiKey'\]/.test(client),
  'un secret parti dans `settings.doc_payments` se retrouve dans chaque sauvegarde de la base et recraché à tout poste autorisé',
);

console.log(echecs ? `\n  ${echecs} défaut(s) — voir ci-dessus\n` : '\n  ✓ uploads tenus : type prouvé, SVG vidé, entêtes en place\n');
process.exit(echecs ? 1 : 0);
