#!/usr/bin/env node
/**
 * Script pour importer les données JSON dans la base de données
 * Usage: node scripts/import-json-to-db.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001/api/v1';
const DATA_DIR = path.join(__dirname, '..', 'data');

// Configuration - à modifier selon votre environnement
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sarisysteme.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe_Sari2026!';

let authToken = null;

async function login() {
  console.log('🔐 Authentification...');
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('Réponse login:', JSON.stringify(data, null, 2).substring(0, 200));
  
  // Essayer différents formats de réponse
  authToken = data.accessToken || data.token || data.access_token;
  
  if (!authToken) {
    throw new Error('Token not found in login response. Keys: ' + Object.keys(data).join(', '));
  }
  
  console.log('✓ Authentifié (token: ' + authToken.substring(0, 20) + '...)\n');
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function importSolutions() {
  console.log('\n📦 Import des solutions...');
  
  const frData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fr', 'solution-categories.json'), 'utf-8'));
  
  for (const item of frData) {
    console.log(`  → ${item.title}`);
    
    // Créer la version française
    const created = await apiCall('/solutions', 'POST', {
      title: item.title,
      slug: item.id,
      icon: item.icon,
      color: item.color,
      image: item.image,
      shortDesc: item.shortDesc,
      fullDesc: item.fullDesc,
      features: item.features || [],
      faq: item.faq || [],
      productIds: item.productIds || [],
      status: 'published',
      locale: 'fr',
    });
    
    const id = created.id || created.data?.id;
    console.log(`    ✓ FR créé (ID: ${id})`);
    
    // Importer les traductions
    for (const lang of ['en', 'ar']) {
      try {
        const langData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang, 'solution-categories.json'), 'utf-8'));
        const translated = langData.find(d => d.id === item.id);
        
        if (translated) {
          await apiCall(`/solutions/${id}/translate`, 'POST', {
            locale: lang,
            title: translated.title,
            slug: translated.id,
            icon: translated.icon,
            color: translated.color,
            image: translated.image,
            shortDesc: translated.shortDesc,
            fullDesc: translated.fullDesc,
            features: translated.features || [],
            faq: translated.faq || [],
          });
          console.log(`    ✓ ${lang.toUpperCase()} traduit`);
        }
      } catch (error) {
        console.log(`    ⚠ ${lang.toUpperCase()} non trouvé`);
      }
    }
  }
}

async function importServices() {
  console.log('\n🔧 Import des services...');
  
  const frData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fr', 'services.json'), 'utf-8'));
  
  for (const item of frData) {
    console.log(`  → ${item.title}`);
    
    const created = await apiCall('/services', 'POST', {
      title: item.title,
      slug: item.slug || item.id,
      icon: item.icon,
      color: item.color,
      image: item.image,
      shortDesc: item.shortDesc,
      fullDesc: item.fullDesc,
      features: item.features || [],
      faq: item.faq || [],
      status: 'published',
      locale: 'fr',
    });
    
    const id = created.id || created.data?.id;
    console.log(`    ✓ FR créé (ID: ${id})`);
    
    for (const lang of ['en', 'ar']) {
      try {
        const langData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang, 'services.json'), 'utf-8'));
        const translated = langData.find(d => (d.slug || d.id) === (item.slug || item.id));
        
        if (translated) {
          await apiCall(`/services/${id}/translate`, 'POST', {
            locale: lang,
            title: translated.title,
            slug: translated.slug || translated.id,
            icon: translated.icon,
            color: translated.color,
            image: translated.image,
            shortDesc: translated.shortDesc,
            fullDesc: translated.fullDesc,
            features: translated.features || [],
            faq: translated.faq || [],
          });
          console.log(`    ✓ ${lang.toUpperCase()} traduit`);
        }
      } catch (error) {
        console.log(`    ⚠ ${lang.toUpperCase()} non trouvé`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Import des données JSON dans la base de données');
  console.log(`📁 Dossier de données: ${DATA_DIR}`);
  console.log(`🌐 API: ${API_BASE}`);
  
  try {
    await login();
    await importSolutions();
    await importServices();
    
    console.log('\n✅ Import terminé avec succès !');
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'import:', error);
    process.exit(1);
  }
}

main();
