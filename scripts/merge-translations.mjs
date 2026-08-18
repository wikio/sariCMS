// scripts/merge-translations.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = ['fr', 'en', 'ar'];

locales.forEach(locale => {
  const dir = path.join(__dirname, '..', 'translate', locale);
  const outputFile = path.join(__dirname, '..', 'translate', `${locale}.json`);
  
  if (!fs.existsSync(dir)) {
    console.log(`⚠️ Dossier non trouvé : ${dir}`);
    return;
  }

  const messages = {};

  function processDirectory(currentPath, currentObj) {
    const files = fs.readdirSync(currentPath);
    files.forEach(file => {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        currentObj[file] = {};
        processDirectory(fullPath, currentObj[file]);
      } else if (file.endsWith('.json')) {
        const fileName = file.replace('.json', '');
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          // Fusionne le contenu du fichier dans la clé correspondant au nom du fichier
          currentObj[fileName] = { ...(currentObj[fileName] || {}), ...content };
        } catch (e) {
          console.error(`❌ Erreur de parsing ${fullPath}:`, e);
        }
      }
    });
  }

  processDirectory(dir, messages);
  fs.writeFileSync(outputFile, JSON.stringify(messages, null, 2));
  console.log(`✅ Traductions fusionnées avec succès pour '${locale}' -> translate/${locale}.json`);
});