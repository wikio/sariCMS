#!/usr/bin/env node
/**
 * Audit i18n — détecte les chaînes françaises « en dur » dans l'admin et la
 * vitrine (hors fichiers de messages). Les textes devraient passer par
 * next-intl (useTranslations / getTranslations) pour être traduits en FR/EN/AR.
 *
 * Usage :
 *   node scripts/audit-i18n.mjs [chemin...]
 *   (par défaut : components, app/[locale]/admin, lib)
 */
import fs from 'fs';
import path from 'path';

const ROOTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['components', 'app/[locale]/admin', 'lib'];

const EXTS = ['.tsx', '.ts'];

// Indices d'une chaîne « en français » (accents + mots-clés courants).
const ACCENTS = /[àâäéèêëîïôöùûüçœ]/i;
const FR_WORDS = /\b(accueil|afficher|masquer|sauvegarder|enregistrer|annuler|supprimer|rechercher|nouveau|modifier|ajouter|valider|fermer|chargement|erreur|succès|paramètres|contenu|page|bouton|action|section|menu|aucun|tous|toutes|français|anglais|arabe|vitrine|candidature|commande|panier|inscription|connexion|déconnexion|enregistré|créé|mis à jour)\b/i;

function isFrenchLike(str) {
  if (str.length < 3) return false;
  if (ACCENTS.test(str)) return true;
  return FR_WORDS.test(str);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(entry.name))) out.push(full);
  }
}

const files = [];
for (const r of ROOTS) walk(path.resolve(r), files);

const ATTRIBUTES = ['placeholder', 'title', 'label', 'alt', 'aria-label', 'defaultValue'];
const findings = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const rel = path.relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const ln = i + 1;
    // 1) Attributs JSX
    for (const attr of ATTRIBUTES) {
      const re = new RegExp(`${attr}=["'{]([^"'}]{3,})["'}]`, 'g');
      let m;
      while ((m = re.exec(line)) !== null) {
        if (isFrenchLike(m[1])) findings.push({ file: rel, line: ln, kind: attr, text: m[1].slice(0, 120) });
      }
    }
    // 2) Texte JSX entre balises
    const textRe = />([^<>{}]{3,})</g;
    let m;
    while ((m = textRe.exec(line)) !== null) {
      const text = m[1].trim();
      if (!/^[A-Za-zÀ-ÿ0-9 .,'’!?:;«»()%/\-–+]{3,}$/.test(text)) continue;
      if (isFrenchLike(text)) findings.push({ file: rel, line: ln, kind: 'jsx-text', text: text.slice(0, 120) });
    }
  });
}

// Résumé par fichier
const byFile = new Map();
for (const f of findings) byFile.set(f.file, (byFile.get(f.file) || 0) + 1);
const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

console.log('══════════════════════════════════════════════════════════════');
console.log(`Audit i18n — ${files.length} fichiers analysés, ${findings.length} chaîne(s) française(s) en dur.`);
console.log('══════════════════════════════════════════════════════════════');
for (const [f, n] of sorted.slice(0, 30)) console.log(`${String(n).padStart(4)}  ${f}`);
console.log('───');
if (findings.length) {
  console.log('Exemples (fichier:ligne [type] texte) :');
  for (const f of findings.slice(0, 25)) {
    console.log(`  ${f.file}:${f.line} [${f.kind}] ${f.text}`);
  }
}
console.log('');
console.log('Astuce : remplacez ces textes par des clés next-intl (useTranslations / getTranslations)');
console.log('puis ajoutez-les dans translate/{fr,en,ar}/**.json.');
