# Système de Traduction Multilingue - Guide d'Implémentation

## Vue d'ensemble

Ce document explique l'architecture du système de traduction multilingue pour les événements et les actualités dans SARI CMS.

## Architecture de la Base de Données

### Structure Parent-Enfant

Chaque contenu (événement/actualité) suit une structure **parent-enfant** :

```
┌─────────────────────────────────────────────────────────────┐
│  PARENT (Français - locale='fr')                            │
│  - id: 5                                                    │
│  - legacyId: 'news_5_abc123'                                │
│  - parentId: NULL                                           │
│  - isDefault: TRUE                                          │
│  - title: 'Mon Article'                                     │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ CHILD (EN)    │ │ CHILD (AR)    │ │ CHILD (ES)    │
│ id: 12        │ │ id: 18        │ │ id: 25        │
│ legacyId:     │ │ legacyId:     │ │ legacyId:     │
│ 'news_5_abc…' │ │ 'news_5_abc…' │ │ 'news_5_abc…' │
│ parentId: 5   │ │ parentId: 5   │ │ parentId: 5   │
│ isDefault:    │ │ isDefault:    │ │ isDefault:    │
│ FALSE         │ │ FALSE         │ │ FALSE         │
│ title:        │ │ title:        │ │ title:        │
│ 'My Article'  │ │ 'مقالي'       │ │ 'Mi Artículo' │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Champs Clés

#### 1. `legacyId` (String)
- **Rôle** : Identifiant unique partagé entre toutes les versions linguistiques
- **Format** : `'news_5_abc123'` ou `'event_12_xyz789'`
- **Usage** : Routage et recherche de toutes les traductions d'un contenu
- **Exemple** :
  ```typescript
  // Trouver toutes les traductions d'un article
  const translations = await prisma.newsArticle.findMany({
    where: { legacyId: 'news_5_abc123' }
  });
  // → Retourne les versions FR, EN, AR, etc.
  ```

#### 2. `parentId` (Int, nullable)
- **Rôle** : Référence à l'enregistrement parent (version française)
- **Valeur** : `NULL` pour les parents, `id` du parent pour les enfants
- **Usage** : Navigation rapide vers la version originale
- **Exemple** :
  ```typescript
  // Trouver le parent d'une traduction
  const translation = await prisma.newsArticle.findUnique({
    where: { id: 12 },
    include: { parent: true }
  });
  // → translation.parent contient la version française
  ```

#### 3. `isDefault` (Boolean)
- **Rôle** : Marque la version par défaut à afficher
- **Valeur** : `TRUE` pour le français, `FALSE` pour les traductions
- **Usage** : Filtrage dans l'admin et la vitrine
- **Exemple** :
  ```typescript
  // Afficher uniquement les contenus par défaut dans l'admin
  const defaultArticles = await prisma.newsArticle.findMany({
    where: { isDefault: true, deletedAt: null }
  });
  ```

## Migration de la Base de Données

### Étape 1 : Exécuter la Migration SQL

```bash
cd backend
mysql -u votre_user -p votre_database < prisma/migrations/20260825_add_translation_fields/migration.sql
```

Ou avec Prisma CLI :

```bash
cd backend
npx prisma migrate dev --name add_translation_fields
```

### Étape 2 : Vérifier la Migration

```sql
-- Vérifier que les champs ont été ajoutés
DESCRIBE news_articles;
DESCRIBE events;

-- Vérifier que les données ont été migrées
SELECT 
  'news_articles' as table_name,
  COUNT(*) as total,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french,
  SUM(CASE WHEN parentId IS NOT NULL THEN 1 ELSE 0 END) as linked
FROM news_articles;
```

## Utilisation dans le Code

### 1. Créer un Nouvel Article avec Traductions

```typescript
import { generateLegacyId } from '@/lib/translation-utils';

// Étape 1 : Créer le parent (français)
const legacyId = generateLegacyId(); // 'news_123_abc123'

const parentArticle = await prisma.newsArticle.create({
  data: {
    locale: 'fr',
    slug: 'mon-article',
    title: 'Mon Article',
    category: 'Innovation',
    publicationDate: new Date('2026-09-20T15:00:00.000Z'),
    legacyId,
    isDefault: true,
    parentId: null,
    // ... autres champs
  }
});

// Étape 2 : Créer les traductions
const englishTranslation = await prisma.newsArticle.create({
  data: {
    locale: 'en',
    slug: 'my-article',
    title: 'My Article',
    category: 'Innovation',
    publicationDate: parentArticle.publicationDate, // Même date
    legacyId, // Même legacyId !
    isDefault: false,
    parentId: parentArticle.id, // Lien vers le parent
    // ... autres champs traduits
  }
});

const arabicTranslation = await prisma.newsArticle.create({
  data: {
    locale: 'ar',
    slug: 'مقالي',
    title: 'مقالي',
    category: 'ابتكار',
    publicationDate: parentArticle.publicationDate,
    legacyId,
    isDefault: false,
    parentId: parentArticle.id,
    // ... autres champs traduits
  }
});
```

### 2. Récupérer un Article avec Toutes ses Traductions

```typescript
// Méthode 1 : Par legacyId (recommandé pour le routage)
const articleWithTranslations = await prisma.newsArticle.findMany({
  where: { legacyId: 'news_5_abc123' }
});

// Méthode 2 : Par ID avec jointure
const parentArticle = await prisma.newsArticle.findUnique({
  where: { id: 5 },
  include: {
    translations: {
      where: { parentId: 5 }
    }
  }
});
```

### 3. Afficher le Contenu dans la Vitrine

```typescript
// Dans app/[locale]/news/[id]/page.tsx
export default async function NewsDetailPage({ params }: { params: { id: string, locale: string } }) {
  const legacyId = extractLegacyId(params.id);
  
  // Chercher d'abord dans la locale demandée
  let article = await prisma.newsArticle.findFirst({
    where: { legacyId, locale: params.locale }
  });
  
  // Fallback sur le français si traduction non trouvée
  if (!article) {
    article = await prisma.newsArticle.findFirst({
      where: { legacyId, locale: 'fr' }
    });
  }
  
  if (!article) {
    notFound();
  }
  
  return <NewsDetail article={article} />;
}
```

### 4. Filtrer dans l'Admin

```typescript
// Afficher uniquement les contenus par défaut (français)
const articles = await prisma.newsArticle.findMany({
  where: {
    isDefault: true,
    deletedAt: null
  },
  include: {
    _count: {
      select: {
        translations: true // Nombre de traductions
      }
    }
  }
});

// Afficher dans l'UI
articles.map(article => (
  <div key={article.id}>
    <h3>{article.title}</h3>
    <span>{article._count.translations} traductions</span>
  </div>
));
```

### 5. Gérer les Dates

```typescript
import { formatDate, formatDateRange, hasTime } from '@/lib/date-utils';

// Date simple
const dateStr = formatDate(article.publicationDate, 'fr', {
  includeTime: hasTime(article.publicationDate)
});
// → "20 septembre 2026 à 15:00" ou "20 septembre 2026"

// Plage de dates (événements)
const dateRange = formatDateRange(event.publicationDate, event.endDate, 'fr');
// → "20 septembre 2026 au 22 septembre 2026"

// Logique d'affichage
function DisplayEventDate({ event }: { event: Event }) {
  const hasEndDate = event.endDate && event.endDate !== event.publicationDate;
  const showTime = hasTime(event.publicationDate);
  
  if (hasEndDate) {
    return <span>{formatDateRange(event.publicationDate, event.endDate, 'fr')}</span>;
  } else if (showTime) {
    return <span>{formatDate(event.publicationDate, 'fr', { includeTime: true })}</span>;
  } else {
    return <span>{formatDate(event.publicationDate, 'fr')}</span>;
  }
}
```

## Requêtes SQL Utiles

### Trouver les Traductions Manquantes

```sql
-- Articles français sans traduction anglaise
SELECT parent.id, parent.title, parent.slug
FROM news_articles parent
LEFT JOIN news_articles child 
  ON child.legacyId = parent.legacyId AND child.locale = 'en'
WHERE parent.locale = 'fr' 
  AND parent.isDefault = TRUE
  AND child.id IS NULL
  AND parent.deletedAt IS NULL;

-- Événements avec traductions incomplètes
SELECT 
  parent.id,
  parent.title,
  COUNT(child.id) as translation_count,
  GROUP_CONCAT(child.locale) as available_locales
FROM events parent
LEFT JOIN events child ON child.parentId = parent.id
WHERE parent.locale = 'fr' 
  AND parent.isDefault = TRUE
  AND parent.deletedAt IS NULL
GROUP BY parent.id
HAVING translation_count < 2; -- Moins de 2 traductions (en, ar)
```

### Statistiques de Traduction

```sql
-- Vue d'ensemble des traductions
SELECT 
  'news_articles' as content_type,
  COUNT(DISTINCT legacyId) as unique_contents,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french,
  SUM(CASE WHEN locale = 'en' THEN 1 ELSE 0 END) as english,
  SUM(CASE WHEN locale = 'ar' THEN 1 ELSE 0 END) as arabic,
  ROUND(
    SUM(CASE WHEN locale != 'fr' THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END), 0),
    2
  ) as translation_coverage_percent
FROM news_articles
WHERE deletedAt IS NULL

UNION ALL

SELECT 
  'events' as content_type,
  COUNT(DISTINCT legacyId) as unique_contents,
  SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END) as french,
  SUM(CASE WHEN locale = 'en' THEN 1 ELSE 0 END) as english,
  SUM(CASE WHEN locale = 'ar' THEN 1 ELSE 0 END) as arabic,
  ROUND(
    SUM(CASE WHEN locale != 'fr' THEN 1 ELSE 0 END) * 100.0 / 
    NULLIF(SUM(CASE WHEN locale = 'fr' THEN 1 ELSE 0 END), 0),
    2
  ) as translation_coverage_percent
FROM events
WHERE deletedAt IS NULL;
```

## Bonnes Pratiques

### ✅ À Faire

1. **Toujours définir `legacyId`** lors de la création d'un contenu
2. **Marquer `isDefault = true`** uniquement pour la version française
3. **Lier `parentId`** pour toutes les traductions
4. **Utiliser le même `publicationDate`** pour toutes les versions linguistiques
5. **Filtrer par `isDefault = true`** dans les listes admin
6. **Chercher par `legacyId`** pour le routage multilingue

### ❌ À Éviter

1. **Ne pas créer de traductions orphelines** (sans `legacyId` ou `parentId`)
2. **Ne pas avoir plusieurs `isDefault = true`** pour le même `legacyId`
3. **Ne pas modifier le `legacyId`** après création
4. **Ne pas supprimer le parent** sans supprimer ou réassigner les enfants

## Les chaînes de l’interface — `messages/`, l’atelier `translate/`, le contrôle

### Qui lit quoi, depuis ce lot

| Endroit | Qui le lit | Rôle |
|---|---|---|
| `messages/{fr,en,ar}.json` | le site, à chaque requête (`i18n/request.ts`) | la source, suivie par git |
| `translate/<locale>/**.json` | l’écran d’administration « Traductions » | l’atelier : une vue par écran, dérivée des messages |
| `translate/<locale>.json` | repli du site si le déploiement n’embarque que la copie | fichier généré, ignoré par git |

Avant : le site chargeait `translate/<locale>.json`, une copie fabriquée par `npm run
merge:translations` au démarrage du serveur ; l’atelier écrivait dans
`translate/<locale>/`, que personne ne relisait. Une retouche validée depuis
l’administration ne changeait donc **rien** en ligne, un `git pull` ajoutant des clés
restait invisible tant que le script n’était pas rejoué, et `translate/fr/admin.json`
(1 655 clés, ancien export plat) faisait de l’ombre au dossier `translate/fr/admin/`
(965 clés) — l’écran listait les deux sous le même nom, et React s’en plaignait.

Depuis :

- **le site lit la source** : `i18n/request.ts` charge `messages/<locale>.json` à la
  requête, avec un cache par date de modification (une `stat`, pas un parsing de
  4 037 clés), puis `translate/<locale>.json` en repli et l’`import()` compilé en
  dernier recours. Aucun script de concaténation, aucun redémarrage.
- **enregistrer depuis l’écran écrit aux trois endroits**, dans l’ordre : le fichier de
  l’atelier, la branche correspondante de `messages/<locale>.json`, puis la copie
  `translate/<locale>.json` régénérée à l’identique (`lib/translate-store.ts`). Si le
  disque est en lecture seule, la réponse le dit et le bandeau de l’écran le répète
  au lieu de sourire pour rien.
- **`npm run intl:sync`** remet l’atelier d’aplomb quand `messages/` a bougé à la main
  (un ajout de clés, un `git pull`) ; la règle de découpage est dans
  `lib/intl-tree.mjs`, ~250 fichiers par langue.

### La règle de découpage, et pourquoi une règle

Un objet dont aucune valeur n’est un objet tient dans un fichier :
`admin/newsletter.json` ⇄ `admin.newsletter`. Un objet qui a des enfants-objets devient
un dossier, et ses valeurs feuilles se ramassent dans `_root.json` — sinon elles
n’auraient nulle part où vivre. Les tableaux restent des feuilles (`faq.0.q` est une
clé comme une autre). Le mapping est donc bijectif dans les deux sens : c’est ce qui
permet à l’écran d’écrire un fichier et de savoir exactement quelle branche des
messages il représente. `npm run intl:test` (32 assertions) rejoue l’aller-retour sur
les trois langues, vérifie qu’un enregistrement ne mange jamais les voisins, et
qu’aucun doublon fichier/dossier ne peut sortir de la règle.

`scripts/build-messages.js`, l’ancien « régénérer les messages depuis l’atelier », est
mort : il écraserait `admin.newsletter` et consorts, absents de l’export plat. Il
refuse désormais de tourner sans `--force`.

### Un namespace en double exemplaire va dans `_legacy/`

Les fichiers que la règle ne produit plus — l’export plat, un namespace rebaptisé — ne
sont pas supprimés : le dépôt en porte 8 par langue, dont 1 644 clés d’`admin.menu`,
`admin.login`, `admin.dataManager` que `messages/` ignore, et les jeter serait effacer
du texte sans que personne ne l’ait décidé. `npm run intl:sync` les range sous
`translate/<locale>/_legacy/` (arborescence conservée), où ils ne font plus de l’ombre
au dossier du même nom. L’API refuse d’y écrire : un vestige se reprend dans
`messages/<locale>.json`, puis se resynchronise. Et si un fichier plat d’un namespace
qui a déjà son dossier était enregistré, il écraserait d’un coup toute la branche —
l’API répond 409 avec la phrase qui va bien, plutôt que de le faire.

### Le contrôle

```bash
npm run intl:check   # bloquant (sortie 1) : c’est ce qu’appelle `npm run build`
npm run intl:warn    # le même rapport sans bloquer : `npm run dev` le joue à chaque démarrage
npm run intl:sync    # remet l’atelier d’aplomb (écrit)
npm run intl:test    # la règle de découpage, 32 assertions, sans serveur
```

Le contrôle part du code, pas des fichiers : comparer le *nombre* de clés de trois
fichiers ne prouve rien, ils peuvent être identiques et passer à côté d’une clé que
l’interface réclame. Il relève les espaces déclarés par `useTranslations`, les appels
`t('…')`, vérifie dans les trois langues, puis exige que l’atelier et la copie du site
soient d’aplomb avec les messages. Les clés construites à la volée
(`t('field' + x)`, un nom de champ dans une variable) lui échappent volontairement — il
ne devine pas la portée des variables.

Une clé appelée par le code qui n’existe dans aucun fichier ne casse rien à
l’écriture du composant : le navigateur crache `MISSING_MESSAGE: Could not resolve
admin.newsletter.consentYes` et la place reste vide à l’écran. C’est exactement comme
cela s’est présenté sur le détail d’un abonné à la newsletter (`consentYes` /
`consentNo`, absents des trois langues).

## Dépannage

### Problème : Traductions non liées

```sql
-- Trouver les traductions orphelines
SELECT * FROM news_articles 
WHERE parentId IS NULL 
  AND locale != 'fr' 
  AND deletedAt IS NULL;

-- Corriger en liant au parent par slug
UPDATE news_articles AS child
INNER JOIN news_articles AS parent 
  ON child.slug = parent.slug 
  AND parent.locale = 'fr'
SET 
  child.parentId = parent.id,
  child.legacyId = parent.legacyId
WHERE child.locale != 'fr' 
  AND child.parentId IS NULL;
```

### Problème : Plusieurs isDefault pour le même legacyId

```sql
-- Trouver les conflits
SELECT legacyId, COUNT(*) as default_count
FROM news_articles
WHERE isDefault = TRUE AND deletedAt IS NULL
GROUP BY legacyId
HAVING default_count > 1;

-- Corriger en gardant uniquement le français comme défaut
UPDATE news_articles
SET isDefault = (locale = 'fr')
WHERE legacyId IN (
  SELECT legacyId FROM (
    SELECT legacyId
    FROM news_articles
    WHERE isDefault = TRUE AND deletedAt IS NULL
    GROUP BY legacyId
    HAVING COUNT(*) > 1
  ) AS conflicts
);
```

## Évolution Future

### Améliorations Possibles

1. **Contraintes de base de données** :
   ```sql
   -- S'assurer qu'un seul isDefault par legacyId
   CREATE UNIQUE INDEX unique_default_per_legacy 
   ON news_articles(legacyId) 
   WHERE isDefault = TRUE;
   ```

2. **Triggers automatiques** :
   ```sql
   -- Auto-générer legacyId à l'insertion
   CREATE TRIGGER before_insert_news
   BEFORE INSERT ON news_articles
   FOR EACH ROW
   SET NEW.legacyId = IFNULL(NEW.legacyId, CONCAT('news_', UUID()));
   ```

3. **Vue matérialisée** pour les statistiques de traduction

4. **API de traduction automatique** (DeepL, Google Translate)

## Support

Pour toute question ou problème, consultez :
- Documentation Prisma : https://www.prisma.io/docs
- Issues GitHub : https://github.com/votre-repo/issues
- Contact : dev@sari-systeme.dz
