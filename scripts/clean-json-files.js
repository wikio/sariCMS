// scripts/clean-json-files.js
const fs = require('fs');
const path = require('path');

const TRANSLATE_DIR = path.join(__dirname, '..', 'translate');

function cleanJsonFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // 1. Supprimer BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // 2. Supprimer caractères invisibles
    content = content
      .replace(/\uFEFF/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
    
    // 3. Tenter de parser
    try {
      const parsed = JSON.parse(content);
      
      // 4. Si succès, sauvegarder proprement
      if (content !== originalContent) {
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
        console.log(`✅ Nettoyé: ${filePath}`);
        return true;
      } else {
        console.log(`✓ Déjà propre: ${filePath}`);
        return true;
      }
    } catch (parseError) {
      console.error(`❌ JSON invalide: ${filePath}`);
      console.error(`   Erreur: ${parseError.message}`);
      
      // Afficher les 100 premiers caractères pour debug
      const preview = content.substring(0, 100);
      console.error(`   Aperçu: ${preview}...`);
      
      return false;
    }
  } catch (error) {
    console.error(`❌ Erreur lecture: ${filePath} - ${error.message}`);
    return false;
  }
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const results = processDirectory(fullPath);
      successCount += results.success;
      errorCount += results.errors;
    } else if (item.endsWith('.json')) {
      if (cleanJsonFile(fullPath)) {
        successCount++;
      } else {
        errorCount++;
      }
    }
  }
  
  return { success: successCount, errors: errorCount };
}

console.log('🧹 Nettoyage de tous les fichiers JSON dans translate/...\n');

const results = processDirectory(TRANSLATE_DIR);

console.log(`\n📊 Résumé:`);
console.log(`   ✅ Fichiers nettoyés: ${results.success}`);
console.log(`   ❌ Fichiers en erreur: ${results.errors}`);

if (results.errors > 0) {
  console.log(`\n💡 Pour les fichiers en erreur:`);
  console.log(`   1. Ouvrez-les dans VS Code`);
  console.log(`   2. Menu: File > Save with Encoding > UTF-8`);
  console.log(`   3. Validez sur https://jsonlint.com/`);
  console.log(`   4. Relancez ce script`);
}