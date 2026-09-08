# SARI CMS — Base de données MySQL (contexte algérien)

Ce dossier contient le schéma MySQL et les données de démarrage du CMS
**SARI Système SARL** (distribution d'équipements médicaux, Algérie).

| Fichier                    | Rôle                                                           |
| -------------------------- | -------------------------------------------------------------- |
| `schema.mysql.sql`         | Structure : base `sari_cms`, 28 tables, index, clés étrangères |
| `generate-schema.mjs`      | **Génère** `schema.mysql.sql` depuis `prisma/schema.prisma`     |
| `seed.mysql.sql`           | Données de démarrage (contexte algérien, FR / EN / AR)         |
| `generate-seed.mjs`        | Générateur du seed (reproductible, IDs déterministes)          |
| `auth-only.mysql.sql`      | **Comptes, rôles et permissions seuls** — sans catalogue        |
| `extract-auth.mjs`         | Extrait `auth-only.mysql.sql` depuis le seed                    |
| `migrate-data.mysql.sql`   | **Reprise** des jeux `data/{fr,en,ar}/*.json` — 333 lignes      |
| `fix-zero-dates.mysql.sql`   | **Répar**e les dates à jour ou mois zéro, partout, puis durcit les colonnes |
| `generate-fix-zero-dates.mjs` | Générateur du fichier ci-dessus, à partir de `schema.mysql.sql` |
| `migrate-data.mjs`         | Générateur de la reprise (dates converties, `legacyId` posés)   |
| `seed-legal-pages.mysql.sql`   | **Douze documents légaux** dans `pages` — sans rien toucher d'autre |
| `generate-seed-legal.mjs`  | Générateur du fichier ci-dessus, depuis `data/{langue}/legal.json` |
| `test-seed-legal-sql.mjs`  | Vérifie ce seed (rejeu sur SQLite, contenu préservé)             |
| `migrate-commerce.mysql.sql` | **Migration additive** : tables `orders`, `quotes`, `job_applications` |
| `migrate-authors.mysql.sql`  | **Migration additive** : table `authors` + `news_articles.authorId`    |
| `setup-env.mjs`            | Crée `backend/.env` (pilote MySQL + secrets JWT aléatoires)     |
| `test-auth-sql.mjs`        | Vérifie hachages, types de comptes et rejeu de `auth-only`      |
| `test-commerce-sql.mjs`    | Vérifie la migration commerce (rejeu sur SQLite)                |
| `test-authors-sql.mjs`     | Vérifie la migration auteurs (rejeu sur SQLite)                 |

## Une liste répond « The column … does not exist in the current database »

Symptôme : un écran du back-office tombe en 500 sur une colonne précise — par
exemple `newsletter_subscribers.unsubscribeReason` — alors que cette colonne est
bien dans `prisma/schema.prisma`, dans le client généré, dans les formulaires.
C'est la **base** qui est en retard : une migration a été ajoutée au dépôt et
jouée nulle part. Le cas est fréquent sur un mutualisé, où la base a été créée
en jouant `schema.mysql.sql` (ou reprise de l'ancien site) et non par `prisma
migrate`.

    cd backend
    npm run db:schema-check      # l'inventaire des écarts, sans rien écrire
    npm run db:schema-fix        # applique les additions
    npm run db:schema-test       # le contrôle du comparateur, sans base

`db:schema-check` lit ce que la base contient réellement (`information_schema`)
et compare à `schema.mysql.sql` ; il écrit en plus `sql/schema-sync.mysql.sql`,
le fichier des mêmes additions, jouable dans un client SQL. Le script **n'ajoute
que** : aucune colonne modifiée, aucun type changé, rien supprimé — les types
différents et les colonnes en trop sont signalés, et restent à votre main parce
qu'ils regardent des données déjà écrites.

`prisma migrate deploy` n'est pas la bonne réponse ici : il exige la table
`_prisma_migrations` qui garde la trace de ce qui a été joué, et une base
remplie à la main ne l'a pas — le déploiement voudrait recréer ce qui existe
déjà. Après `db:schema-fix`, si vous voulez que la trace existe, jouez les
`ALTER` des migrations manquantes puis `prisma migrate resolve --applied <nom>`.

Le fichier `sql/schema-sync.mysql.sql` dépend de **votre** base, pas du dépôt :
il est ignoré par git, et il se rejoue sans effet une fois la base au niveau
(chaque ordre est gardé par son comptage `information_schema`).

## Une liste administrative tombe en 500 « invalid datetime value »

`PrismaClientKnownRequestError: … The column `updatedAt` contained an invalid
datetime value with either day or month set to zero` sur un `GET /api/v1/{ressource}`
n'a rien à voir avec la requête, le filtre ou l'écran ouvert : **une seule ligne**
portant `0000-00-00`, `2026-00-11` ou `2026-07-00` suffit à faire échouer la lecture
de toute la table, parce que l'ORM hydrate la ligne entière. Ces valeurs entrent par
une reprise de données en SQL brut (ou un import de l'ancien site) quand le mode
`NO_ZERO_DATE` n'est pas actif, ou par un `INSERT` qui omet une colonne `NOT NULL`
sans défaut.

```bash
cd backend
npm run db:fix-dates -- --check     # compter, sans rien écrire
npm run db:fix-dates                # compter, réparer, recontrôler
```

`scripts/fix-zero-dates.mjs` prend la connexion déjà réglée du CMS (`DATABASE_URL`
de `backend/.env`) et applique les mêmes `UPDATE`, colonne par colonne, en annonçant
chacun avant de l'écrire — utile quand on n'a pas de console MySQL sous la main, ou
sur un mutualisé où le client n'est pas installé. Il lit les colonnes dans
`information_schema`, donc il répare aussi une table ajoutée à la main. Le fichier,
lui, se relit avant de se jouer et ne demande aucun secret :

```bash
mysql -u utilisateur -p base < backend/sql/fix-zero-dates.mysql.sql
```

Pour une seule table sous les yeux, une écriture courte suffit — et c'est exactement
ce que fait le fichier, pour toutes les tables à la fois :

```sql
SELECT id, slug, createdAt, updatedAt FROM `pages`
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%'
    OR CAST(`updatedAt` AS CHAR) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR) LIKE '%-00 %');

UPDATE `pages` SET `updatedAt` = COALESCE(`createdAt`, NOW(3))
 WHERE `updatedAt` IS NOT NULL AND (CAST(`updatedAt` AS CHAR) LIKE '0000%'
    OR CAST(`updatedAt` AS CHAR) LIKE '%-00-%' OR CAST(`updatedAt` AS CHAR) LIKE '%-00 %');
```

Les deux partagent la même règle (`badWhere`, `fallbackFor` exportés par le
générateur) : ils réparent à l'identique, et l'un ne diverge pas de l'autre.

Le fichier — généré par `generate-fix-zero-dates.mjs` (`npm run sql:fix-zero-dates`
quand le schéma bouge), et fait de SQL écrit exprès pour être jouable dans un client
graphique : pas de procédure, pas de `DELIMITER`, pas de table temporaire — un script
qui en générait une vient de tomber, sous HeidiSQL, sur un `Unknown column 't'` qui
laissait la base intacte et l'erreur intacte aussi.

Il compte les lignes fautives table par table, les répare (`createdAt`
reprend l'`updatedAt` et réciproquement, `deletedAt` devient « maintenant » pour ne
pas ressusciter une ligne supprimée, une date facultative devient `NULL` plutôt
qu'une date inventée), rejoue le contrôle, puis remet les défauts
`DEFAULT CURRENT_TIMESTAMP(3)` sur les colonnes de date `NOT NULL` qui n'en ont pas.
Rejouable : sans ligne fautive, il ne fait rien.

Côté serveur, la même erreur est maintenant nommée (`P2023` → message disant quelle
table et quel fichier passer), et une date vide ou fausse ne part plus en base : elle
devient `NULL` sur une colonne facultative, ou est omise sur une colonne `NOT NULL`,
où son défaut joue (`backend/src/database/adapters/prisma/prisma-repository.ts`).

> 🩹 **Base déjà en production ?** N'exécutez pas `schema.mysql.sql`, qui
> commence par `DROP TABLE`. Les fichiers `migrate-*.mysql.sql` ajoutent les
> nouveautés sans rien détruire et sont rejouables :
>
> ```bash
> mysql -u root -p sari_cms < backend/sql/migrate-commerce.mysql.sql
> mysql -u root -p sari_cms < backend/sql/migrate-authors.mysql.sql
> mysql -u root -p sari_cms < backend/sql/migrate-data.mysql.sql   # contenu
> ```
>
> Les permissions des nouvelles ressources sont créées, mais **ne sont pas
> accordées automatiquement** aux rôles existants : ouvrez
> Administration → Rôles pour les cocher. Le rôle `super-admin` n'est pas
> concerné, il contourne le contrôle de permissions.

> 🔁 **Après un `git pull` qui ajoute une table (`authors`…), régénérez le
> client Prisma** — sinon l'API répond `500` sur les routes concernées avec
> « Modèle Prisma « author » introuvable dans le client généré ». Le modèle
> est bien dans `prisma/schema.prisma`, mais le client compilé dans
> `node_modules` date d'avant :
>
> ```bash
> cd backend && npx prisma generate && npm run start:dev
> ```
>
> Cela ne concerne que `DB_DRIVER=mysql` / `postgres` ; en `json` Prisma n'est
> pas chargé.

> ⚠️ **`schema.mysql.sql` ne crée aucun compte.** Il ne pose que les tables :
> la table `users` reste vide, et l'administration est inaccessible tant que
> l'un des deux fichiers de données n'a pas été importé — voir §1.

> `schema.mysql.sql` et `migrate-data.mysql.sql` sont **générés** : corrigez le
> script, pas le `.sql`. Le schéma écrit à la main avait fini par diverger de
> Prisma (colonnes `legacyId`, `parentId`, `isDefault`, `color`, `image`
> manquantes sur huit tables) ; le dériver automatiquement évite cette dérive.

> Les noms de tables (`@@map`) et de colonnes correspondent **exactement**
> au schéma Prisma (`backend/prisma/schema.prisma`) : ne les renommez pas,
> sinon le backend NestJS ne retrouvera plus ses données.

> 🔢 **Identifiants entiers** : toutes les tables utilisent une clé primaire
> `INT AUTO_INCREMENT` (1, 2, 3…) au lieu d'UUID. Les clés étrangères
> (`roleId`, `userId`, `permissionId`, `entityId`, `actorId`, …) sont des
> entiers. Pratique pour intégrer l'ID dans les codes générés
> (ex. `SARI-WCMD-00042`).

---

## 1. Importer le schéma puis les données

### Quel fichier de données importer ?

Deux jeux de contenu existent, et ils **ne se combinent pas** : leurs
identifiants se recouvrent (services 1…15 pour le seed, 1…4 puis 1001…
pour la reprise). Importer les deux mélangerait deux catalogues sur les mêmes
lignes. Choisissez selon l'usage :

| Objectif | À importer |
| -------- | ---------- |
| **Découvrir le CMS** avec un contenu de démonstration complet | `schema` → `seed` |
| **Reprendre le contenu réel du site** (fichiers `data/`) | `schema` → `auth-only` → `migrate-data` |

`auth-only.mysql.sql` contient exactement la partie authentification du seed
(120 permissions, 4 rôles, 5 comptes), sans son catalogue : c'est ce qui permet
de se connecter tout en gardant le contenu de `migrate-data`.

### Via la ligne de commande `mysql`

```bash
# 1. Schéma (crée la base sari_cms + les tables — aucun compte)
mysql -u root -p < backend/sql/schema.mysql.sql

# 2a. Parcours « démonstration » : contenu algérien complet + comptes
mysql -u root -p sari_cms < backend/sql/seed.mysql.sql

# 2b. Parcours « contenu réel » : comptes seuls, puis reprise des JSON
mysql -u root -p sari_cms < backend/sql/auth-only.mysql.sql
mysql -u root -p sari_cms < backend/sql/migrate-data.mysql.sql
```

> Sans l'étape 2, `SELECT * FROM users` ne renvoie rien et aucune connexion
> n'est possible : le schéma seul ne crée pas de compte.

### Via phpMyAdmin (cPanel / hébergement mutualisé)

1. Ouvrir **phpMyAdmin** → sélectionner la base cible (ex. `u830983108_sari_cms`).
2. Onglet **Importer** → `backend/sql/schema.mysql.sql` → **Exécuter**.
3. Re-choisir `backend/sql/seed.mysql.sql` → **Exécuter**.

> ⚠️ Le fichier `seed.mysql.sql` ne contient **pas** de `USE` : il s'importe dans
> la base actuellement sélectionnée (ou passée en argument au CLI). Aucune
> modification nécessaire même si votre base porte un préfixe d'hébergeur.

> 🔁 Le seed utilise **`INSERT IGNORE`** avec des identifiants déterministes :
> vous pouvez le **ré-importer à volonté** — les lignes déjà présentes sont
> ignorées (pas de doublon), seules les lignes manquantes sont ajoutées.
> Pratique après un import interrompu.

### « Avertissements » affichés par phpMyAdmin (normaux)

Au premier import du schéma, phpMyAdmin affiche ~23 « avertissements ».
Ce ne sont **pas des erreurs** : ce sont des **notes** d'information émises par
les gardes `IF EXISTS` / `IF NOT EXISTS` :

- `Note 1051 : Unknown table '...'` → 22 fois (les tables n'existaient pas
  encore lors du premier `DROP TABLE IF EXISTS`).
- `Note 1007 : Can't create database; database exists` → 1 fois (la base a
  déjà été créée dans le panneau de l'hébergeur).

Ces notes sont attendues, sans conséquence, et disparaissent au second import
(les tables existent alors). Pour les visualiser : `SHOW WARNINGS;`

### Créer l'utilisateur applicatif (recommandé)

```sql
CREATE USER 'sari'@'localhost' IDENTIFIED BY 'VOTRE_MOT_DE_PASSE_FORT';
GRANT ALL PRIVILEGES ON sari_cms.* TO 'sari'@'localhost';
FLUSH PRIVILEGES;
```

---

## 2. Brancher le backend sur MySQL

> ⚠️ **`backend/.env` n'existe pas après un clone** : il est ignoré par git, le
> dépôt ne fournit que `backend/.env.example`. Et cet exemple propose
> `DB_DRIVER=json` — recopié tel quel, l'API lit les fichiers de
> `storage/json` et **ignore complètement votre base MySQL**, même remplie.
> C'est la cause la plus fréquente d'un « la connexion ne marche pas »
> alors que les comptes sont bien en base.

### Génération assistée (recommandé)

```bash
# Base locale
node backend/sql/setup-env.mjs --user root --password SECRET --database sari_cms

# Hébergeur distant
node backend/sql/setup-env.mjs \
  --host 31.170.160.167 --user u830983108_sari_cms \
  --password SECRET --database u830983108_sari_cms
```

Le script part de `.env.example`, bascule `DB_DRIVER` sur `mysql`, encode les
identifiants dans l'URL (un mot de passe contenant `@` ou `:` casserait l'URL
sinon) et remplace les deux secrets JWT — l'exemple contient
`change-me-…`, refusé en production. Ajoutez `--force` pour écraser un `.env`
existant (une sauvegarde `.env.bak` est conservée).

### Ou manuellement, dans `backend/.env` :

```dotenv
DB_DRIVER=mysql
DATABASE_URL="mysql://sari:VOTRE_MOT_DE_PASSE_FORT@127.0.0.1:3306/sari_cms"
JWT_ACCESS_SECRET=…48 octets aléatoires…
JWT_REFRESH_SECRET=…48 octets aléatoires…
```

Puis (une seule fois, pour générer le client Prisma) :

```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

> Sans `prisma generate`, le backend retombe sur le driver JSON
> (`DB_DRIVER=json`) — le schéma SQL importé ne serait alors pas utilisé.

---

## 2 bis. Reprendre les données des fichiers JSON

Les jeux `data/{fr,en,ar}/*.json` (contenu actuel du site) se transposent en
MySQL avec :

```bash
cd backend
node sql/migrate-data.mjs                    # écrit migrate-data.mysql.sql
mysql -u root -p sari_cms < sql/migrate-data.mysql.sql
```

Import direct, sans passer par un fichier :

```bash
node sql/migrate-data.mjs --execute \
  --url "mysql://sari:MOT_DE_PASSE@127.0.0.1:3306/sari_cms"
```

Options : `--truncate` (vide les tables avant l'import), `--out CHEMIN`
(autre destination que le fichier par défaut).

### Ce que la reprise garantit

| Point | Traitement |
| ----- | ---------- |
| **Ids en collision** | Les JSON réutilisent l'id 1 en fr, en et ar. Le français conserve ses ids, l'anglais est décalé de +1000, l'arabe de +2000. Les URLs françaises déjà indexées restent valides. |
| **Lien entre langues** | Les trois versions d'une fiche partagent un `legacyId` (`svc-1`, `news-3`…). C'est lui qui permet au sélecteur de langue de retrouver l'id de la fiche dans la langue cible ; sans lui le site garde l'id courant, qui désigne une autre fiche. |
| **Dates littérales** | « 15 Janvier 2024 », « 15 يناير 2024 » ou la plage « 15-18 Mars 2024 » deviennent des `DATETIME`. Une plage alimente `startDate` **et** `endDate`. Le libellé d'origine reste affiché par la vitrine. |
| **Rejouable** | `ON DUPLICATE KEY UPDATE` : réimporter met à jour au lieu d'échouer. |

Volume repris : **350 lignes** sur 11 tables — services (12), solutions (27),
produits (45), auteurs (42), actualités (45), événements (45), carrières (45),
partenaires (18), témoignages (12), carrousel (12), pages (47).

Les 47 pages comprennent les 12 documents légaux de `legal.json` (quatre par
langue : mentions, confidentialité, conditions, à propos), rangés sous
`kind = 'legal'` avec leur type dans `category` — voir
`docs/PAGES-LEGALES.md`. Une page importée avec `kind = 'content'`, valeur qui
ne figure dans aucun écran, restait en base sans jamais s'afficher ni se
modifie.

### Slugs et legacyId dans les fichiers JSON

La reprise attend un `slug` et un `legacyId` sur chaque fiche. Le script qui
les pose dans `data/` se lance depuis la racine du dépôt :

```bash
node scripts/add-slugs.mjs --dry-run   # aperçu
node scripts/add-slugs.mjs             # écriture
```

Les slugs arabes restent en alphabet arabe (`بيع-المعدات`) : les navigateurs
les encodent de façon transparente et le référencement local y gagne.

---

## 3. Comptes de démonstration

Mot de passe **identique pour tous les comptes** (à changer immédiatement) :

```
ChangeMe_Sari2026!
```

| Email                      | Rôle            | Type      |
| -------------------------- | --------------- | --------- |
| `admin@sarisysteme.com`    | Super Admin     | admin     |
| `gestion@sarisysteme.com`  | Administrateur  | admin     |
| `client@clinique-elafia.dz`| —               | client    |
| `contact@meditech.dz`      | —               | partner   |
| `mohamed.saidi@gmail.com`  | —               | candidate |

Ces comptes couvrent les **quatre types acceptés par l'API**
(`admin | client | partner | candidate`, voir
`src/modules/users/entities/user.entity.ts`). Le tableau de bord de la vitrine
teste ce champ (`user.type === 'partner'`) : n'y mettez pas les libellés
traduits des fichiers `data/` (« partenaire », « شريك »), qui ne servent qu'à
l'affichage.

Pour régénérer un hash (si vous changez le mot de passe) :

```bash
node -e "console.log(require('bcryptjs').hashSync('NouveauMotDePasse', 10))"
```

Vérifier que les hachages en base correspondent bien aux mots de passe
annoncés, et que le fichier se rejoue sans doublon :

```bash
node backend/sql/test-auth-sql.mjs
```

---

## 3 bis. Dépannage : « impossible de se connecter »

| Symptôme | Cause probable | Correction |
| -------- | -------------- | ---------- |
| `SELECT * FROM users` ne renvoie rien | Seul `schema.mysql.sql` a été importé — il ne crée aucun compte | Importer `auth-only.mysql.sql` (ou `seed.mysql.sql`) |
| Les comptes sont en base mais la connexion échoue | `backend/.env` absent, ou resté sur `DB_DRIVER=json` : l'API lit `storage/json` au lieu de MySQL | `node backend/sql/setup-env.mjs …` |
| `DB_DRIVER=mysql` mais l'API lit toujours les fichiers | Client Prisma non généré | `cd backend && npx prisma generate` |
| `Account is not active` | Le compte existe avec `status = 'pending'` (cas de `mohamed.saidi@gmail.com`) | `UPDATE users SET status = 'active' WHERE email = '…';` |
| `Invalid credentials` sur un compte existant | Mot de passe ou hachage incorrect | `node backend/sql/test-auth-sql.mjs` |

Diagnostic rapide :

```sql
SELECT id, email, type, status, roleId FROM users;
SELECT COUNT(*) FROM permissions;   -- attendu : 100
SELECT COUNT(*) FROM role_permissions;  -- attendu : 237
```

---

## 3 ter. Une ressource n'apparaît pas dans « Rôles et permissions »

Symptôme : un écran du back-office est listé dans le menu mais répond 403, et
la grille des permissions ne montre aucune ligne pour cette ressource — ou ne
la montre que pour les rôles créés à la main. Ce n'est pas un bug d'affichage :
les lignes manquent dans la table `permissions`.

Le cas se présente à chaque ressource ajoutée depuis le dernier seed — `authors`
(fiches auteurs des actualités), `home` (blocs de la page d'accueil),
`newsletter` — et il est particulièrement tordu pour les **rôles verrouillés**
(`super-admin`, `admin`, `editor`, `viewer`, `isSystem = 1`) : l'écran refuse d'y
cocher une case, à juste titre, puisque leur barème est redéfini par le dépôt.
Une ressource qui leur manque ne peut donc pas leur être accordée à la main, ni
jamais.

    cd backend
    npm run sql:fix-permissions        # régénère fix-permissions.mysql.sql
    mysql -u utilisateur -p base < sql/fix-permissions.mysql.sql

Le fichier est écrit, pas calculé : ni procédure, ni table temporaire, ni
`PREPARE`, ni `DELIMITER` — il se joue tel quel dans HeidiSQL ou phpMyAdmin, en
un bloc ou section par section. Il est rejouable. La section 1 diagnostique
(permissions absentes, liens manquants, liens en trop, écart entre
`role_permissions` et `roles.permissionIds`), la section 2 insère ce qui manque,
la 3 applique le barème aux quatre rôles verrouillés, la 4 remet le JSON du rôle
à l'heure, la 5 contrôle. Les rôles que vous avez créés ne sont pas touchés.

Le barème vit dans `sql/permissions-catalog.mjs`, qui lit
`src/common/constants/permissions.ts` : la liste des ressources ne peut plus
rester en arrière du code, la génération échoue si les deux divergent. Après
avoir ajouté une ressource au backend, relancez `npm run sql:fix-permissions`
**et** `npm run sql:seed`, puis redémarrez le backend (les permissions sont
mises en cache avec la session).

## 3 quater. L'écran « Pages légales » est vide

Symptôme : les quatre documents existent dans le dépôt — `data/fr/legal.json`
et ses deux traductions — la vitrine les publie, mais l'écran
**Administration → Pages légales** ne listerait rien, et une fiche créée à la
main n'apparaît pas non plus là où on l'attend. Dans une base reprise à la main,
les lignes `pages` des documents légaux sont soit absentes, soit présentes sous
une famille que l'écran filtre mal (`kind` autre que `legal`, `category` laissé
vide ou rempli d'un libellé en toutes lettres).

    cd backend
    npm run sql:seed-legal           # régénère seed-legal-pages.mysql.sql
    mysql -u utilisateur -p base < sql/seed-legal-pages.mysql.sql

Un fichier pour ces douze lignes seulement, et non un rappel de
`migrate-data.mysql.sql` : la reprise complète réécrit produits, actualités et
visuels. Celui-ci ne touche que la table `pages`, uniquement les lignes dont
l'`slug` est `mentions`, `privacy`, `conditions` ou `about`, et **jamais un texte
déjà rédigé** — `ON DUPLICATE KEY UPDATE` ne remplit `title` et `content` qu'ils
sont vides. Il se relance donc sans risque ; il remet à plat la famille et le
type, ce qui suffit à faire réapparaître une fiche qui était là, publiée, et
invisible.

La section 1 compte ce que l'administration voit, la 2 répare les lignes
mal classées, la 3 insère les douze documents, la 4 les contrôle, la 5 explique
les liens courts du pied de page. Vérification sans serveur MySQL :

    node sql/test-seed-legal-sql.mjs      # ou npm run sql:test-legal

Côté site, les adresses sont `/fr/legal/mentions`, `/fr/legal/privacy`,
`/fr/legal/conditions`, `/fr/legal/about` — et `/fr/legal` en liste les quatre.
Les formes courtes (`/fr/privacy`, `/fr/terms`, `/fr/mentions`…), que le pied de
page a gardées en base, sont renvoyées sur le document par `next.config.mjs`.

## 4. Contenu inclus (contexte algérien)

- **Identité** : SARI Système SARL — 17 Lot ONAB, Cité SONELGAZ, Gué de
  Constantine, Alger. RC, NIF, NIS, capital en **DZD**.
- **Pages légales** (FR/EN/AR) : mentions légales, confidentialité (réf.
  **loi n° 18-07 du 10 juin 2018**, ANPDP), CGV (prix en DZD, TVA 19 % / 9 %,
  livraison sur les **58 wilayas**, paiement CIB/Edahabia/virement/chèque).
- **Catalogue** : 6 produits médicaux (prix DZD), 5 services, 9 catégories de
  solutions, 5 partenaires (dont représentations officielles en Algérie).
- **Carrières** : offres localisées par wilaya (Alger, Oran, Blida, Constantine),
  salaires en DZD.
- **Témoignages** : médecins et cliniques algériens (CHU Mustapha Pacha,
  Clinique El Afia, Clinique Ibn Rochd, EPH Beni Messous).
- **Événements / actualités** : SIMEM (SAFEX Alger), journées médicales, etc.
- **RBAC** : 4 rôles (`super-admin`, `admin`, `editor`, `viewer`) et
  120 permissions (`resource:action`).
- **Langues** : `fr`, `en`, `ar` sur l'ensemble du contenu vitrine.

---

## 5. Régénérer les fichiers SQL

```bash
cd backend
node sql/generate-schema.mjs        # schema.mysql.sql, depuis prisma/schema.prisma
node sql/generate-seed.mjs          # seed.mysql.sql (contenu de démonstration)
node sql/migrate-data.mjs           # migrate-data.mysql.sql (reprise des JSON)
node sql/generate-fix-zero-dates.mjs # fix-zero-dates.mysql.sql (dates au zéro)
node scripts/schema-sync.mjs          # sql/schema-sync.mysql.sql (base en retard sur le schéma)
node sql/generate-fix-permissions.mjs # fix-permissions.mysql.sql (rôles verrouillés)
node sql/generate-seed-legal.mjs      # seed-legal-pages.mysql.sql (documents légaux)
```

Après toute modification de `prisma/schema.prisma`, régénérez le schéma :
c'est ce qui garantit que le SQL et le modèle Prisma ne divergent plus.
