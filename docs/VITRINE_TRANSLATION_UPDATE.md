# Guide de Mise à Jour - Système de Traduction Vitrine

## État Actuel du Frontend

### ✅ Ce qui est déjà implémenté

#### 1. Routage par legacyId
Les pages de détail utilisent déjà `legacyId` pour le routage :

```typescript
// app/[locale]/news/[id]/page.tsx
const legacyId = extractLegacyId(rawIdParam);

let found: News | undefined;
if (legacyId) {
  // Rechercher par legacyId d'abord
  found = news.find((n) => n.legacyId === legacyId);
}

// Fallback sur la recherche par id/slug si legacyId non trouvé
if (!found) {
  found = news.find((n) => matchesEntity(n, idString) || matchesEntity(n, rawIdParam));
}
```

#### 2. Génération d'URLs avec legacyId
Les liens utilisent `buildMultilingualUrl()` :

```typescript
// Navigation précédent/suivant
<Link href={buildMultilingualUrl(
  `/${locale}/news`, 
  prevArticle.legacyId || String(prevArticle.id), 
  prevArticle.slug
)}>

// Articles liés
<Link href={buildMultilingualUrl(
  `/${locale}/news`, 
  article.legacyId || String(article.id), 
  article.slug
)}>
```

### ❌ Ce qui doit être amélioré

#### 1. Fallback sur le français si traduction manquante
Actuellement, si un utilisateur visite `/en/news/mon-article` et qu'il n'y a pas de traduction anglaise, la page retourne une erreur 404.

**Solution** : Ajouter un fallback automatique sur la version française.

## Mise à Jour Requise du Backend

### Endpoint : `/public/news`

#### Comportement Actuel
```typescript
// Backend retourne probablement :
SELECT * FROM news_articles WHERE locale = 'en' AND status = 'published';
// → Retourne uniquement les articles en anglais
```

#### Comportement Requis
```typescript
// Backend doit retourner :
// 1. Articles dans la langue demandée
// 2. + Articles français qui n'ont pas de traduction dans la langue demandée

SELECT 
  COALESCE(translated.id, parent.id) as id,
  COALESCE(translated.title, parent.title) as title,
  COALESCE(translated.slug, parent.slug) as slug,
  COALESCE(translated.locale, parent.locale) as locale,
  parent.legacyId,
  parent.isDefault
FROM news_articles parent
LEFT JOIN news_articles translated 
  ON translated.legacyId = parent.legacyId 
  AND translated.locale = 'en'
WHERE parent.locale = 'fr'
  AND parent.isDefault = TRUE
  AND parent.status = 'published'
  AND parent.deletedAt IS NULL;
```

### Endpoint : `/public/news/:id`

#### Comportement Actuel
```typescript
// Backend retourne probablement :
SELECT * FROM news_articles WHERE id = 5 AND locale = 'en';
// → Retourne null si pas de traduction anglaise
```

#### Comportement Requis
```typescript
// Backend doit :
// 1. Chercher dans la langue demandée
// 2. Fallback sur le français si non trouvé

-- Option A : Par legacyId
SELECT * FROM news_articles 
WHERE legacyId = 'news_5_abc123' 
  AND (locale = 'en' OR (locale = 'fr' AND isDefault = TRUE))
ORDER BY (locale = 'en') DESC
LIMIT 1;

-- Option B : Par ID avec fallback
SELECT * FROM news_articles 
WHERE (id = 5 AND locale = 'en')
   OR (parentId = 5 AND locale = 'en')
   OR (id = 5 AND locale = 'fr' AND isDefault = TRUE)
ORDER BY (locale = 'en') DESC
LIMIT 1;
```

## Mise à Jour Requise du Frontend

### 1. Améliorer getNews() pour supporter le fallback

**Fichier** : `lib/data.ts`

```typescript
export async function getNews(locale: string): Promise<News[]> {
  return fromCmsOrJson(locale, 'news', [], async () => {
    // Le backend doit retourner :
    // - Articles dans la langue demandée
    // - + Articles français sans traduction
    const rows = await cmsPublicList<Record<string, unknown>>('news', locale);
    
    // Mapper les résultats
    const news = rows.length ? rows.map(mapNews) : [];
    
    // Si pas de résultats et locale != 'fr', essayer avec le français
    if (news.length === 0 && locale !== 'fr') {
      console.warn(`Aucun article trouvé pour locale=${locale}, fallback sur fr`);
      const frRows = await cmsPublicList<Record<string, unknown>>('news', 'fr');
      return frRows.length ? frRows.map(mapNews) : [];
    }
    
    return news;
  });
}
```

### 2. Améliorer getNewsById() pour le fallback

**Fichier** : `lib/data.ts`

```typescript
export async function getNewsById(locale: string, id: number | string): Promise<News | null> {
  // Essayer d'abord dans la langue demandée
  let remote = await cmsPublicOne<Record<string, unknown>>('news', String(id), locale);
  
  // Fallback sur le français si non trouvé
  if (!remote && locale !== 'fr') {
    console.warn(`Article ${id} non trouvé pour locale=${locale}, fallback sur fr`);
    remote = await cmsPublicOne<Record<string, unknown>>('news', String(id), 'fr');
  }
  
  if (remote) return mapNews(remote);
  
  // Fallback sur la recherche locale
  const news = await getNews(locale);
  return news.find((n) => matchesEntity(n, id)) || null;
}
```

### 3. Améliorer la page de détail pour le fallback

**Fichier** : `app/[locale]/news/[id]/page.tsx`

```typescript
useEffect(() => {
  const loadArticle = async () => {
    // Charger les articles dans la langue courante
    let news = await getNews(locale);
    
    // Essayer d'extraire le legacyId de l'URL
    const legacyId = extractLegacyId(rawIdParam);
    
    let found: News | undefined;
    
    // Recherche par legacyId
    if (legacyId) {
      found = news.find((n) => n.legacyId === legacyId);
    }
    
    // Fallback sur id/slug
    if (!found) {
      found = news.find((n) => matchesEntity(n, idString) || matchesEntity(n, rawIdParam));
    }
    
    // Si toujours pas trouvé et locale != 'fr', charger les articles français
    if (!found && locale !== 'fr') {
      console.warn(`Article non trouvé en ${locale}, tentative en français`);
      news = await getNews('fr');
      
      if (legacyId) {
        found = news.find((n) => n.legacyId === legacyId);
      }
      if (!found) {
        found = news.find((n) => matchesEntity(n, idString) || matchesEntity(n, rawIdParam));
      }
    }
    
    if (found) {
      setItem(found);
      // ... reste du code
    } else {
      setItem(null);
    }
  };
  
  if (idString || rawIdParam) {
    loadArticle();
  }
}, [idString, rawIdParam, locale]);
```

### 4. Ajouter un indicateur de langue dans l'UI

Si l'article affiché n'est pas dans la langue demandée, afficher un avertissement :

```typescript
// Dans app/[locale]/news/[id]/page.tsx
const isTranslatedContent = item?.locale === locale;

return (
  <PageVisibilityGuard visibilityKey="module.news">
    {/* Avertissement si contenu non traduit */}
    {!isTranslatedContent && (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 py-3">
        <div className="container mx-auto px-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
            ⚠️ {locale === 'en' 
              ? 'This article is only available in French.' 
              : locale === 'ar'
              ? 'هذه المقالة متوفرة فقط بالفرنسية.'
              : 'Cet article n\'est disponible qu\'en français.'}
          </p>
        </div>
      </div>
    )}
    
    {/* Reste du contenu */}
    <div className="pt-32 pb-24 min-h-screen">
      {/* ... */}
    </div>
  </PageVisibilityGuard>
);
```

### 5. Filtrer les listes pour n'afficher que les parents

**Fichier** : `app/[locale]/news/page.tsx`

```typescript
useEffect(() => {
  const loadNews = async () => {
    const allNews = await getNews(locale);
    
    // Filtrer pour n'afficher que les articles par défaut (parents)
    // ou les traductions si elles existent
    const filteredNews = allNews.filter(article => {
      // Si l'article a un legacyId, c'est soit un parent soit une traduction
      // On veut afficher :
      // - Les parents (isDefault = true) si pas de traduction
      // - Les traductions si elles existent dans la langue courante
      
      // Le backend devrait déjà avoir fait ce filtrage
      // Mais on vérifie quand même côté frontend
      return article.isDefault || article.locale === locale;
    });
    
    setNews(filteredNews);
  };
  
  loadNews();
}, [locale]);
```

## Stratégie de Migration Progressive

### Phase 1 : Backend (Priorité Haute)

1. **Mettre à jour les endpoints backend** pour supporter :
   - Filtrage par `isDefault = true` pour les listes
   - Fallback sur le français si traduction manquante
   - Retourner `legacyId`, `parentId`, `isDefault` dans les réponses

2. **Tester avec des requêtes curl** :
   ```bash
   # Liste des articles en anglais (avec fallback)
   curl "http://localhost:3001/api/v1/public/news?locale=en"
   
   # Article spécifique en arabe (avec fallback)
   curl "http://localhost:3001/api/v1/public/news/news_5_abc123?locale=ar"
   ```

### Phase 2 : Frontend (Priorité Moyenne)

1. **Améliorer les fonctions getNews() et getNewsById()** dans `lib/data.ts`
2. **Ajouter le fallback dans les pages de détail**
3. **Ajouter l'indicateur de langue** dans l'UI

### Phase 3 : Améliorations (Priorité Basse)

1. **Sélecteur de langue** dans la page de détail pour changer de traduction
2. **Statistiques de traduction** dans l'admin
3. **Notifications** pour les articles non traduits

## Exemple de Flux Complet

### Scénario : Utilisateur visite `/en/news/mon-article`

1. **Frontend** appelle `getNews('en')`
2. **Backend** exécute :
   ```sql
   SELECT COALESCE(en.id, fr.id) as id, ...
   FROM news_articles fr
   LEFT JOIN news_articles en ON en.legacyId = fr.legacyId AND en.locale = 'en'
   WHERE fr.locale = 'fr' AND fr.isDefault = TRUE;
   ```
3. **Backend** retourne :
   - Article A (traduction EN existe) → `locale: 'en'`
   - Article B (pas de traduction EN) → `locale: 'fr'` (fallback)
4. **Frontend** affiche les deux articles
5. **Frontend** ajoute un badge "🇫🇷 Français" sur l'article B

### Scénario : Utilisateur visite `/en/news/news_5_abc123`

1. **Frontend** extrait `legacyId = 'news_5_abc123'`
2. **Frontend** appelle `getNews('en')`
3. **Frontend** cherche l'article avec `legacyId = 'news_5_abc123'`
4. **Si trouvé** → Affiche l'article (EN ou FR selon disponibilité)
5. **Si non trouvé** → 404

## Checklist de Test

- [ ] Backend retourne `legacyId`, `parentId`, `isDefault` dans les réponses
- [ ] Liste `/en/news` affiche les articles EN + FR (fallback)
- [ ] Détail `/en/news/article-en` affiche la version EN
- [ ] Détail `/en/news/article-fr` affiche la version FR avec badge
- [ ] Détail `/ar/news/article-fr` affiche la version FR avec badge
- [ ] Navigation précédent/suivant fonctionne avec legacyId
- [ ] Articles liés utilisent legacyId
- [ ] Indicateur de langue s'affiche pour le contenu non traduit

## Support

Pour toute question :
- Documentation complète : `docs/TRANSLATION_SYSTEM.md`
- Backend API : `backend/README.md`
- Issues GitHub : https://github.com/votre-repo/issues
