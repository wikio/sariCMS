# Script d'import des données JSON vers la base de données

Ce script permet d'importer les données JSON statiques dans la base de données MySQL via l'API backend.

## 📋 Prérequis

1. **Backend doit tourner** sur `http://localhost:3001`
2. **Node.js 18+** (pour avoir fetch natif)
3. **Fichiers JSON** dans le dossier `data/` :
   - `data/fr/solution-categories.json`
   - `data/fr/services.json`
   - `data/en/solution-categories.json` (optionnel)
   - `data/en/services.json` (optionnel)
   - `data/ar/solution-categories.json` (optionnel)
   - `data/ar/services.json` (optionnel)

## 🚀 Utilisation

```bash
node scripts/import-json-to-db.js
```

## 📊 Ce qui est importé

### Solutions
- Titre, slug, icône, couleur
- Image, description courte, description complète
- Features (caractéristiques)
- FAQ
- ProductIds (produits associés)
- Traductions FR/EN/AR

### Services
- Titre, slug, icône, couleur
- Image, description courte, description complète
- Features (engagements)
- FAQ
- Traductions FR/EN/AR

## 🔄 Flux d'import

1. **Lecture** des fichiers JSON dans `data/fr/`
2. **Création** des entrées en français via l'API
3. **Lecture** des traductions dans `data/en/` et `data/ar/`
4. **Ajout** des traductions via l'API `/translate`

## 📝 Exemple de sortie

```
🚀 Import des données JSON dans la base de données
📁 Dossier de données: /path/to/sariCMS/data
🌐 API: http://localhost:3001/api/v1

📦 Import des solutions...
  → Diagnostic médical
    ✓ FR créé (ID: 1)
    ✓ EN traduit
    ✓ AR traduit
  → Chirurgie
    ✓ FR créé (ID: 2)
    ✓ EN traduit
    ✓ AR traduit

🔧 Import des services...
  → Maintenance préventive
    ✓ FR créé (ID: 1)
    ✓ EN traduit
    ✓ AR traduit

✅ Import terminé avec succès !
```

## ⚠️ Notes importantes

- Le script utilise `fetch` natif de Node.js 18+
- Aucune dépendance externe n'est nécessaire
- Les IDs sont générés automatiquement par la base de données
- Les slugs sont importés tels quels depuis les fichiers JSON
- Si une traduction n'existe pas, elle est ignorée (pas d'erreur)

## 🐛 Dépannage

### Erreur "API error 404"
- Vérifiez que le backend tourne sur `http://localhost:3001`
- Vérifiez que les endpoints `/public/solutions` et `/public/services` existent

### Erreur "ENOENT: no such file or directory"
- Vérifiez que les fichiers JSON existent dans `data/fr/`, `data/en/`, `data/ar/`
- Vérifiez les noms de fichiers (solution-categories.json, services.json)

### Erreur "API error 400"
- Vérifiez la structure des fichiers JSON
- Vérifiez que tous les champs requis sont présents

## 🔧 Personnalisation

Pour ajouter d'autres modules (products, news, events, etc.), ajoutez des fonctions similaires à `importSolutions()` et `importServices()` dans le script.

Exemple pour les products :

```javascript
async function importProducts() {
  console.log('\n📦 Import des produits...');
  const frData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fr', 'products.json'), 'utf-8'));
  
  for (const item of frData) {
    // ... logique d'import
  }
}
```

Puis appelez-la dans `main()` :

```javascript
async function main() {
  await importSolutions();
  await importServices();
  await importProducts(); // Ajouter ici
}
```
