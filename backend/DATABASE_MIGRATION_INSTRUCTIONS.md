# Instructions pour appliquer les changements de base de données

## Problème
Votre base de données MySQL a déjà des données, donc `prisma migrate deploy` ne fonctionne pas directement (erreur P3005).

## Solution

### Option 1 : Appliquer le SQL manuellement (Recommandé)

1. **Connectez-vous à votre base de données MySQL** :
   ```bash
   mysql -h 31.170.160.167 -u u830983108_sari_cms -p u830983108_sari_cms
   ```

2. **Exécutez le script SQL** :
   ```sql
   source backend/add-service-columns.sql
   ```

   Ou copiez-collez directement :
   ```sql
   ALTER TABLE `services` 
   ADD COLUMN `color` VARCHAR(80) NULL AFTER `icon`;

   ALTER TABLE `services` 
   ADD COLUMN `image` VARCHAR(500) NULL AFTER `color`;
   ```

3. **Vérifiez que les colonnes ont été ajoutées** :
   ```sql
   DESCRIBE services;
   ```

4. **Redémarrez le backend** :
   ```bash
   cd backend
   npm run start:dev
   ```

### Option 2 : Baseliner la base de données avec Prisma

Si vous voulez utiliser Prisma Migrate à l'avenir :

1. **Marquez la base de données comme "baselinée"** :
   ```bash
   cd backend
   npx prisma migrate resolve --applied 20260826_add_color_image_to_services
   ```

2. **Générez le client Prisma** :
   ```bash
   npx prisma generate
   ```

3. **Redémarrez le backend** :
   ```bash
   npm run start:dev
   ```

## Vérification

Après avoir appliqué les changements, testez l'API :

```bash
curl http://localhost:3001/api/v1/services/1?view=block
```

Vous devriez voir les champs `color` et `image` dans la réponse (même s'ils sont null).

## Prochaines étapes

Une fois les colonnes ajoutées :

1. **Dans l'admin** : Allez dans Services et ajoutez des couleurs et images
2. **Dans la vitrine** : Vérifiez que les services affichent les bonnes couleurs et images
3. **Testez les traductions** : Changez de langue et vérifiez que les icônes/couleurs changent
