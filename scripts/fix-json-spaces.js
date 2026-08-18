// scripts/fix-json-spaces.js
const fs = require('fs');
const path = require('path');

// Cible les dossiers messages et translate
const DIRS_TO_FIX = [
  path.join(__dirname, '..', 'messages'),
  path.join(__dirname, '..', 'translate')
];

function fixObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'string' ? item.trim() : fixObject(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const fixed = {};
    for (const key in obj) {
      // ✅ Supprime les espaces au début et à la fin de la clé
      const cleanKey = key.trim();
      const value = obj[key];
      // ✅ Supprime les espaces au début et à la fin de la valeur texte
      fixed[cleanKey] = typeof value === 'string' ? value.trim() : fixObject(value);
    }
    return fixed;
  }
  return obj;
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        const fixed = fixObject(parsed);
        fs.writeFileSync(fullPath, JSON.stringify(fixed, null, 2), 'utf-8');
        console.log(`✅ Nettoyé : ${path.relative(path.join(__dirname, '..'), fullPath)}`);
      } catch (e) {
        console.error(`❌ Erreur dans ${file} :`, e.message);
      }
    }
  }
}

console.log('🚀 Nettoyage des espaces dans les fichiers JSON...\n');
DIRS_TO_FIX.forEach(dir => {
  console.log(`Traitement du dossier ${path.basename(dir)}...`);
  processDirectory(dir);
});
console.log('\n🎉 Terminé ! Toutes les clés et valeurs JSON sont maintenant propres.');