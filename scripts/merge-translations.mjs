// scripts/merge-translations.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = ['fr', 'en', 'ar'];

locales.forEach(locale => {
  // Lire directement depuis messages/{locale}.json
  const messagesFile = path.join(__dirname, '..', 'messages', `${locale}.json`);
  const outputFile = path.join(__dirname, '..', 'translate', `${locale}.json`);
  
  // S'assurer que le dossier translate existe
  const translateDir = path.join(__dirname, '..', 'translate');
  if (!fs.existsSync(translateDir)) {
    fs.mkdirSync(translateDir, { recursive: true });
  }
  
  if (!fs.existsSync(messagesFile)) {
    console.log(`⚠️ Fichier non trouvé : ${messagesFile}`);
    return;
  }

  try {
    // Copier directement le contenu de messages/{locale}.json vers translate/{locale}.json
    const content = fs.readFileSync(messagesFile, 'utf8');
    fs.writeFileSync(outputFile, content);
    console.log(`✅ Traductions copiées avec succès : messages/${locale}.json -> translate/${locale}.json`);
  } catch (e) {
    console.error(`❌ Erreur lors de la copie ${messagesFile}:`, e);
  }
});