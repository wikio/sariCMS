# Récupérer le code et basculer sur MySQL

Guide de bout en bout : récupérer le travail, importer la base, brancher le
backend, vérifier. Comptez une trentaine de minutes.

> Référence technique détaillée des fichiers SQL : `backend/sql/README.md`.

---

## 1. Récupérer le code

Tout le travail est sur la branche **`arena/01a05393-saricms`**, poussée sur
GitHub, et rassemblée dans la **[pull request #4](https://github.com/wikio/sariCMS/pull/4)**.

```bash
git fetch origin arena/01a05393-saricms
git checkout arena/01a05393-saricms
git pull
```

Vérifiez que vous êtes au bon endroit — le dernier commit doit être
`feat(data): slugs multilingues, reprise MySQL et schéma régénéré` :

```bash
git log --oneline -7
```

<details>
<summary>Les sept commits attendus</summary>

| Commit | Objet |
| --- | --- |
| `a6097f5` | Slugs multilingues, reprise MySQL, schéma régénéré |
| `1e4abc0` | URLs de services homogènes, changement de langue fiable |
| `5189f22` | Carrousel d'accueil anglais (resté en français) |
| `f4f185f` | Changement de langue : résolution de l'id traduit |
| `9304e7b` | Format de date configurable |
| `037061f` | Produits liés multilingues, corrections de build |
| `e81f69f` | Solutions : couleurs, icônes, URLs `id-slug` |

</details>

Installez les dépendances (les deux projets sont séparés) :

```bash
npm install                 # vitrine Next.js
cd backend && npm install   # API NestJS
```

---

## 2. Importer la base MySQL

### 2.1 Créer la base et les tables

En ligne de commande :

```bash
mysql -u root -p < backend/sql/schema.mysql.sql
```

Ou, sur un hébergement mutualisé (cPanel), via **phpMyAdmin** → onglet
**Importer** → `backend/sql/schema.mysql.sql`.

> Au premier import, phpMyAdmin affiche une vingtaine d'« avertissements » :
> ce sont des notes émises par les gardes `IF EXISTS`, pas des erreurs. Elles
> disparaissent au second import.

> ⚠️ **`schema.mysql.sql` commence par une vingtaine de `DROP TABLE`.** Il est écrit
> pour une base **vierge** : le relancer sur une base qui contient déjà votre
> contenu efface les tables concernées. Ne l'exécutez que si vous voulez
> repartir de zéro — et exportez avant (`mysqldump sari_cms > sauvegarde.sql`).
> Si votre base existe déjà, voyez le point **2.1 bis**.

Le fichier livré est régénéré depuis `prisma/schema.prisma` ; il contient donc
déjà les deux tables de l'administration de l'accueil (`home_sections`,
`newsletter_subscribers`). Après un `schema.mysql.sql`, **il n'y a rien d'autre à
créer**.

### 2.1 bis Base déjà en place : ajouter seulement ce qui manque

Cas fréquent : la base tourne depuis un moment, son contenu est dedans, et il ne
manque que les tables des dernières évolutions (symptôme typique, une erreur de
l'API du genre `The table home_sections does not exist in the current database`).
On n'importe **pas** le schéma complet, on applique la partie additive.

**Option 1 — Prisma, propre (recommandée).** Les migrations antérieures ne sont
pas toujours inscrites dans le registre `_prisma_migrations` (base créée à la
main, ou import partiel). On aligne le registre sans rien exécuter, puis on
applique les migrations qui manquent :

```bash
cd backend
for m in 20260825_add_slug_to_partners 20260825_add_startdate_to_events \
         20260825_add_translation_fields 20260825_add_translation_to_all_modules \
         20260826_add_color_image_to_services; do
  npx prisma migrate resolve --applied "$m"
done
npx prisma migrate deploy
```

> Ne pas ajouter les migrations de septembre à cette liste : `migrate resolve
> --applied` inscrit « fait » sans rien exécuter. Si la base ne contient pas
> encore `home_sections`, la marquer appliquée la fait définitivement sauter.
> On ne déclare appliquée que ce que la base contient réellement — d'où le
> contrôle de §2.1 ter.

`migrate deploy` ne lance alors que les migrations manquantes, toutes
strictement additives : `20260906_add_home_sections_and_newsletter` (deux
`CREATE TABLE`, `home_sections` et `newsletter_subscribers`),
`20260907_add_newsletter_unsubscribe_reason` (deux colonnes et un index sur
`newsletter_subscribers` — le motif et le commentaire saisis dans le formulaire
public de désabonnement), puis
`20260919_add_password_reset_tokens` (une `CREATE TABLE`,
`password_reset_tokens` — les jetons de « Mot de passe oublié ? », hachés en
SHA-256, à usage unique), puis
`20260919_add_order_shipment_fields` (cinq colonnes NULLables sur `orders` :
`trackingNumber`, `carrier`, `shippedAt`, `deliveredAt`, `paidAt` — le numéro de
suivi, le transporteur et les dates d'expédition, de livraison et de règlement
que les gabarits de mail `order_shipped`, `order_delivered` et `order_payment`
attendaient sans qu'aucun champ ne permette de les saisir), puis
`20260921_add_coupons_and_tax_rules` (deux `CREATE TABLE`, `coupons` et
`tax_rules` — le catalogue de promotions et les taux d'imposition, qui ne
vivaient que dans le `localStorage` du navigateur d'administration), puis
`20260922_add_payment_records` (une `CREATE TABLE`, `payment_records` — le relevé
d'encaissements de l'écran *Journal des paiements*, lui aussi enfermé dans un seul
navigateur). Aucune donnée existante n'est touchée : trois tables neuves, cinq
colonnes NULLables.

Le blocage en cours chez l'exploitant — `P3018` / erreur 1060 « Duplicate column
name » sur `20260919_add_order_shipment_fields`, la colonne `trackingNumber` ayant
déjà été ajoutée à la main — se résout comme décrit plus bas dans ce fichier ;
`20260922_add_payment_records` ne demande rien de particulier une fois le blocage
levé, et sa `CREATE TABLE` ne peut pas entrer en conflit avec une colonne existante
puisqu'elle ne crée qu'une table neuve.

**Option 2 — sans Prisma (hébergement mutualisé).** Le fichier de migration est
du SQL autonome, il s'importe dans la base déjà sélectionnée et ne contient pas
de `USE` :

```bash
mysql -u root -p sari_cms < backend/prisma/migrations/20260906_add_home_sections_and_newsletter/migration.sql
mysql -u root -p sari_cms < backend/prisma/migrations/20260907_add_newsletter_unsubscribe_reason/migration.sql
mysql -u root -p sari_cms < backend/prisma/migrations/20260919_add_password_reset_tokens/migration.sql
mysql -u root -p sari_cms < backend/prisma/migrations/20260919_add_order_shipment_fields/migration.sql
```

Dans cet ordre : la deuxième ajoute des colonnes à la table créée par la
première. La troisième est indépendante — une table neuve, `password_reset_tokens`,
qui ne touche à rien d'existant.

Attention : des `CREATE TABLE` et `ALTER TABLE` simples, pas d'`IF NOT EXISTS`. À
ne lancer qu'une fois — ou relisez le fichier et remplacez-les par
`CREATE TABLE IF NOT EXISTS` avant.

Pour la mise à jour du 2026-09-21, ce travail est déjà fait :
`sql/migrate-coupons-taxes.mysql.sql` reprend les deux `CREATE TABLE` en
`IF NOT EXISTS` et garde chaque `ALTER TABLE orders` par une lecture d'
`information_schema`. Lui est **rejouable**, contrairement au fichier de
migration brut :

```bash
mysql -u root -p sari_cms < backend/sql/migrate-coupons-taxes.mysql.sql
mysql -u root -p sari_cms < backend/sql/migrate-payment-records.mysql.sql
```

`migrate-payment-records.mysql.sql` est du même bois : `CREATE TABLE IF NOT EXISTS`,
chaque index protégé par une lecture d'`information_schema`, rejouable, et un
contrôle de colonnes en dernière requête. Il ne touche aucune table existante, donc
il peut être passé avant, après, ou à la place de `migrate deploy` pour sa part. Il
ne crée **pas** les permissions `payments` (ni `coupons`, ni `taxes`) : c'est le
rôle de `sql/fix-permissions.mysql.sql`, à passer après, et l'attribution aux rôles
reste une décision de l'exploitant dans Administration → Rôles. Sans ces lignes,
l'écran répond 403 — le symptôme le plus probable d'une migration réussie à moitié.

Il couvre d'ailleurs les deux migrations d'un seul coup (`20260919_add_order_shipment_fields`
et `20260921_add_coupons_and_tax_rules`), ce qui évite d'avoir à décider lequel
des deux a déjà été joué à moitié.

**Option 3 — `prisma db push`.** Crée les tables et colonnes manquantes d'après
`schema.prisma`, sans jamais supprimer une colonne existante.

```bash
cd backend && npx prisma generate && npx prisma db push
```

Inconvénient : rien n'est écrit dans `_prisma_migrations`. Si vous reprenez
`migrate deploy` plus tard, Prisma voudra rejouer des migrations déjà appliquées
— marquez-les alors avec `migrate resolve --applied` comme à l'option 1.

**Contrôle, quelle que soit l'option :**

```sql
SHOW TABLES LIKE 'home_sections';        -- une ligne
SHOW TABLES LIKE 'newsletter_subscribers';
SELECT COUNT(*) FROM home_sections;      -- 0 est normal : voir 2.2 bis
```

### 2.1 ter `Error: P3009` — une migration est marquée échouée

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260907_add_newsletter_unsubscribe_reason` migration started at … failed
```

Prisma bloque tout tant qu'une ligne de `_prisma_migrations` est en échec, et sa
sortie ne dit ni pourquoi, ni si les objets existent déjà. C'est pourtant ce qui
détermine la réparation :

| État réel de la base | Commande |
|---|---|
| tous les objets de la migration existent | `npx prisma migrate resolve --applied <migration>` |
| aucun n'existe | `npx prisma migrate resolve --rolled-back <migration>` |
| une partie seulement | compléter à la main, puis `--applied` |

L'état partiel est un cas réel : MySQL n'a pas de DDL transactionnel, un `ALTER`
peut passer pendant que le `CREATE INDEX` qui suit échoue.

**Un outil fait ce constat pour vous**, en lecture seule — il ne modifie ni la
base ni `_prisma_migrations`, il imprime la commande à lancer :

```bash
cd backend
npm run db:migration-diagnose                 # toutes les migrations échouées
npm run db:migration-diagnose 20260907_add_newsletter_unsubscribe_reason
```

Il lit l'erreur enregistrée dans `_prisma_migrations.logs`, extrait du
`migration.sql` les tables, colonnes et index attendus, les compare à
`information_schema`, puis donne le constat objet par objet et la commande
exacte. Sa logique de décision est couverte par `npm run db:migration-diagnose-test`
(26 assertions sur les vraies migrations du dépôt) ; l'accès base lui-même ne
l'est pas, faute de MySQL dans l'environnement de contrôle.

Relancez ensuite `npx prisma migrate deploy` : il enchaîne sur les migrations
suivantes.

### 2.1 quater `P3018` avec `ERROR 1060` — la base a déjà la colonne

`P3009` dit « une migration est restée marquée échouée ». `P3018` dit autre
chose, et c'est le cas rencontré sur la base de production de SARI :

```
Error: P3018
Migration failed for ... 20260919_add_order_shipment_fields
Database error: Duplicate column name 'trackingNumber'
```

Le sens exact : MySQL ne rend pas le DDL transactionnel. Une migration de cinq
`ALTER TABLE` qui échoue au deuxième ordre a déjà passé le premier,
définitivement. La base se trouve donc **à moitié migrée** pendant que Prisma la
croit non migrée — et rejoue tout, y compris la colonne qui existe déjà.

Le remède n'est pas de forcer le registre : c'est d'aligner la base sur ce que
la migration attend, puis de le déclarer. `sql/migrate-coupons-taxes.mysql.sql`
fait exactement cela, puisque chaque ajout est gardé par `information_schema` —
les colonnes présentes sont laissées tranquilles, les absentes créées.

```bash
cd backend
mysql -u root -p sari_cms < sql/migrate-coupons-taxes.mysql.sql
npx prisma migrate resolve --applied 20260919_add_order_shipment_fields
npx prisma migrate resolve --applied 20260921_add_coupons_and_tax_rules
npx prisma migrate deploy        # doit répondre « no pending migrations »
```

Contrôle, dans la même base :

```sql
SHOW COLUMNS FROM `orders` LIKE 'trackingNumber';   -- 1 ligne
SHOW COLUMNS FROM `orders` LIKE 'paidAt';            -- 1 ligne
SHOW TABLES LIKE 'coupons';                          -- 1 ligne
SHOW TABLES LIKE 'tax_rules';                        -- 1 ligne
```

Un `migrate resolve --applied` posé à tort est rattrapable : la ligne vit dans
`_prisma_migrations` et se corrige en base. Un `ALTER TABLE` mal joué, lui, se
voit à la première écriture — d'où l'intérêt de contrôler avant de déclarer.

### 2.2 Charger les données

Deux jeux sont disponibles, **choisissez-en un** :

| Fichier | Contenu | Quand l'utiliser |
| --- | --- | --- |
| `backend/sql/migrate-data.mysql.sql` | **Vos données actuelles** reprises depuis `data/{fr,en,ar}/` — 291 lignes, 10 tables | Cas normal : vous voulez retrouver le contenu du site |
| `backend/sql/seed.mysql.sql` | Jeu de démonstration + comptes utilisateurs et permissions | Base vierge, ou pour disposer des comptes d'administration |

```bash
mysql -u root -p sari_cms < backend/sql/migrate-data.mysql.sql
```

> **Les deux sont compatibles.** Le seed apporte les rôles, permissions et
> comptes ; la reprise apporte le contenu éditorial. Si vous voulez les deux,
> importez le seed **en premier**, puis la reprise : celle-ci réécrit les
> lignes de contenu qu'elle recouvre (`ON DUPLICATE KEY UPDATE`) sans toucher
> aux comptes.

### 2.2 bis Ce que la reprise ne charge pas, et pourquoi

`migrate-data.mysql.sql` ne couvre que les tables de **contenu** (services,
solutions, produits, auteurs, actualités, événements, carrières, partenaires,
témoignages, carrousel, pages). Les deux tables d'administration restent vides
après l'import, et c'est voulu :

- `home_sections` — un enregistrement par bloc et par langue, **unicité
  `(key, locale)`**. Une table vide ne veut pas dire une page vide : la vitrine
  reprend les fichiers du site, et le studio affiche ces mêmes données. Pour les
  figer : **Administration → Page d'accueil → « Reprendre les données du site »**.
  Comportement détaillé dans [PAGE-ACCUEIL.md](./PAGE-ACCUEIL.md), section
  « Reprendre le contenu déjà publié ».
- `newsletter_subscribers` — la liste d'abonnement se remplit par les formulaires
  du site (et par l'écran **Administration → Newsletter**), elle n'a rien à
  reprendre des fichiers. Si vous migrez une liste existante, un
  `INSERT INTO newsletter_subscribers (email, locale, status, source, createdAt, updatedAt)
  VALUES (…)` par adresse suffit : l'adresse est la clé métier, en minuscules.

### 2.3 Créer l'utilisateur applicatif

```sql
CREATE USER 'sari'@'localhost' IDENTIFIED BY 'UN_MOT_DE_PASSE_FORT';
GRANT ALL PRIVILEGES ON sari_cms.* TO 'sari'@'localhost';
FLUSH PRIVILEGES;
```

---

## 3. Brancher le backend sur MySQL

**Le plus simple est de laisser l'assistant écrire le fichier** — il pose le
driver, l'URL et génère les secrets JWT, et garde l'ancien fichier en
`.env.bak` :

```bash
node backend/sql/setup-env.mjs --force --driver mysql \
  --url "mysql://sari:UN_MOT_DE_PASSE_FORT@127.0.0.1:3306/sari_cms"
```

(`node backend/sql/setup-env.mjs --driver json` pour revenir au mode fichiers.)

À la main, dans `backend/.env` :

```dotenv
DB_DRIVER=mysql
DATABASE_URL="mysql://sari:UN_MOT_DE_PASSE_FORT@127.0.0.1:3306/sari_cms"
```

Puis, **une seule fois**, générez le client Prisma :

```bash
cd backend
npx prisma generate
npm run start:dev
```

> ⚠️ **Sans `prisma generate`, le backend retombe silencieusement sur le
> driver JSON** et votre base MySQL ne sera jamais lue. Au démarrage, le log
> doit afficher `Database driver: mysql`. S'il affiche `json`, c'est que la
> génération a échoué. Un `seed` qui annonce « JSON seed written » pendant que
> vous croyez être sur MySQL a la même cause : `DB_DRIVER` absent ou à `json`.

> ⚠️ Deux pièges de `.env` : sans `JWT_ACCESS_SECRET`, la connexion au back-office
> échoue avec `secretOrPrivateKey must have a value` ; et `npm run start:dev`
> (**watch**) ne recharge **pas** l'environnement — après une modification de
> `.env`, arrêtez et relancez le processus.

Lancez la vitrine dans un second terminal :

```bash
npm run dev
```

---

## 4. Vérifier que tout fonctionne

### 4.1 L'API renvoie bien le `legacyId`

C'est le point critique : sans ce champ, le changement de langue retombe sur
la mauvaise fiche.

```bash
curl "http://localhost:3001/api/v1/public/services?locale=fr"
```

Chaque entrée doit comporter `legacyId`, `locale` et `slug`. Si `legacyId`
est absent, l'import des données ne s'est pas fait correctement.

### 4.2 Les versions linguistiques sont reliées

```bash
curl "http://localhost:3001/api/v1/public/services/1-vente-equipements/translations"
```

Réponse attendue : **trois** entrées avec des ids **différents**.

| Langue | id | slug |
| --- | --- | --- |
| fr | 1 | `vente-equipements` |
| en | 1001 | `equipment-sales` |
| ar | 2001 | `بيع-المعدات` |

### 4.3 Le changement de langue dans le navigateur

1. Ouvrez `http://localhost:3000/fr/services/1-vente-equipements`
2. Ouvrez la console du navigateur (F12)
3. Basculez en anglais avec le sélecteur de langue

L'URL doit devenir `/en/services/1001-equipment-sales` — **notez le changement
d'identifiant**, c'est tout l'objet de la correction. La console affiche le
détail de la résolution :

```
[i18n-switch] services « 1-vente-equipements » fr → en
  ✅ étape 1 — endpoint /translations : langues ["fr","en","ar"]
     id 1 → 1001, segment « 1001-equipment-sales »
```

Un message `❌ étape 4 — aucune traduction trouvée` signale que les fiches ne
partagent pas de `legacyId` : reprenez l'étape 2.2.

---

## 5. Ce qui reste à votre main

### Décisions à prendre

| Sujet | Situation | Ce qui est attendu de vous |
| --- | --- | --- |
| **Import à blanc** | Le SQL a été validé par un parseur MySQL et rejoué dans une base, mais **jamais exécuté sur un vrai serveur MySQL** (les binaires étaient inaccessibles dans l'environnement de développement) | Importez d'abord sur une base de test, pas en production |
| **Contenu des FAQ** | 12 questions ajoutées aux services, 27 aux solutions, sur des sujets métier (homologation ANPP, douane, wilayas du Sud, chaîne du froid) | Relisez et ajustez : ce sont des formulations plausibles, pas vos engagements contractuels |
| **Visuels des services** | Quatre images Unsplash génériques ont été posées, faute de visuels existants | Remplacez par vos propres photos |
| **Comptes de démonstration** | `seed.mysql.sql` crée des comptes avec le mot de passe `ChangeMe_Sari2026!` | À changer immédiatement si vous importez le seed |

### Anomalies signalées, volontairement non corrigées

- **`lib/page-templates.ts`** (lignes 73, 102-104, 116, 118) — la condition
  `lang === 'ar' ? arabe : français` n'a pas de branche anglaise : les
  gabarits du constructeur de pages produisent du français en anglais.
  Hors périmètre des demandes, j'attends votre accord.
- **`/{locale}/jobs` renvoie 404** — le dossier ne contient qu'une page de
  détail, sans index, contrairement à `/careers`. Antérieur à ces travaux ;
  dites-moi si `/jobs` doit exister ou si les liens doivent pointer vers
  `/careers`.
- **`admin/payments`** — appel à `t()` en portée de module, hors composant.

---

## 6. Régénérer les fichiers

Les `.sql` sont **générés** : modifiez le script, jamais le `.sql`.

```bash
# après toute modification de prisma/schema.prisma
node backend/sql/generate-schema.mjs      # ou : npm run sql:schema, depuis backend/
npm run db:schema-test                    # le dump doit couvrir tous les modèles Prisma

# après toute modification des fichiers data/
node scripts/add-slugs.mjs        # slugs + legacyId (--dry-run pour simuler)
node backend/sql/migrate-data.mjs # régénère l'import
```

`npm run db:schema-test` vérifie que `sql/schema.mysql.sql` contient bien une
table par `@@map` du schéma Prisma, dans les deux sens. Sans ce contrôle, un
modèle ajouté sans régénération du dump reste invisible jusqu'à la première
liste qui tombe en 500 chez le client — le client Prisma, lui, connaît la table.

**Pour les migrations à venir, ne plus écrire de fichier `migrate-*.mysql.sql` à
la main.** Le besoin est couvert de façon générale : `npm run db:schema-check`
lit la base réelle dans `information_schema`, le compare au dump, et écrit
`sql/schema-sync.mysql.sql` — additions seules, chaque ordre gardé par sa propre
vérification, donc rejouable. Le fichier `migrate-coupons-taxes.mysql.sql` de
cette mise à jour suit le même gabarit, mais il restera figé : c'est un
rattrapage daté, pas un modèle.

Import direct, sans fichier intermédiaire :

```bash
node backend/sql/migrate-data.mjs --execute \
  --url "mysql://sari:MOT_DE_PASSE@127.0.0.1:3306/sari_cms"
```

Options utiles : `--truncate` (vide les tables avant import), `--dry-run`
(simulation), `--out CHEMIN` (autre destination).

---

## 7. Revenir en arrière

Le driver JSON reste disponible : il suffit de remettre `DB_DRIVER=json` dans
`backend/.env` et de redémarrer. Les fichiers `data/` n'ont pas été
supprimés — ils ont seulement gagné les champs `slug` et `legacyId`, que
l'ancien code ignore sans dommage.
