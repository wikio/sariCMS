// scripts/build-messages.js
const fs = require('fs');
const path = require('path');

const TRANSLATE_DIR = path.join(__dirname, '..', 'translate');
const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const LOCALES = ['fr', 'en', 'ar'];

function loadJsonRecursive(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      result[item] = loadJsonRecursive(fullPath);
    } else if (item.endsWith('.json')) {
      const name = item.replace('.json', '');
      try {
        let content = fs.readFileSync(fullPath, 'utf-8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        content = content.trim();
        
        if (content === '') {
          result[name] = {};
          fs.writeFileSync(fullPath, '{}', 'utf-8');
          continue;
        }
        
        result[name] = JSON.parse(content);
      } catch (e) {
        result[name] = {};
        console.warn(`  ⚠️  Fichier vide/erreur: ${item}`);
      }
    }
  }
  return result;
}

// ✅ NETTOYAGE AGRESSIF : supprime les espaces des CLÉS ET VALEURS
function deepClean(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return item.trim();
      return deepClean(item);
    });
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      // ✅ TRIM sur la CLÉ (supprime espaces avant/après)
      const cleanKey = key.trim();
      const value = obj[key];
      
      if (typeof value === 'string') {
        // ✅ TRIM sur la VALEUR
        cleaned[cleanKey] = value.trim();
      } else {
        cleaned[cleanKey] = deepClean(value);
      }
    }
    return cleaned;
  }
  return obj;
}

if (!fs.existsSync(MESSAGES_DIR)) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
}

console.log('🚀 Génération des fichiers messages (nettoyage agressif)...\n');

LOCALES.forEach(locale => {
  const localeDir = path.join(TRANSLATE_DIR, locale);
  if (!fs.existsSync(localeDir)) {
    console.warn(`⚠️  Dossier manquant: ${localeDir}`);
    return;
  }
  
  console.log(`🔄 Traitement de ${locale}...`);
  const merged = loadJsonRecursive(localeDir);
  
  // ✅ Nettoyage profond
  const cleaned = deepClean(merged);
  
  const outputPath = path.join(MESSAGES_DIR, `${locale}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2), 'utf-8');
  
  // Afficher les namespaces de premier niveau pour vérification
  const namespaces = Object.keys(cleaned);
  console.log(`✅ ${locale}.json généré (${namespaces.length} namespaces): ${namespaces.join(', ')}`);
});

console.log('\n🎉 Terminé ! Vérifiez que les clés n\'ont plus d\'espaces.');
console.log('💡 Test: node -e "const m=require(\'./messages/fr.json\'); console.log(Object.keys(m.index || {}))"');