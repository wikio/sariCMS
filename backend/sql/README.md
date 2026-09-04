# SARI CMS — Base de données MySQL (contexte algérien)

Ce dossier contient le schéma MySQL et les données de démarrage du CMS
**SARI Système SARL** (distribution d'équipements médicaux, Algérie).

| Fichier                    | Rôle                                                           |
| -------------------------- | -------------------------------------------------------------- |
| `schema.mysql.sql`         | Structure : base `sari_cms`, 26 tables, index, clés étrangères |
| `generate-schema.mjs`      | **Génère** `schema.mysql.sql` depuis `prisma/schema.prisma`     |
| `seed.mysql.sql`           | Données de démarrage (contexte algérien, FR / EN / AR)         |
| `generate-seed.mjs`        | Générateur du seed (reproductible, IDs déterministes)          |
| `auth-only.mysql.sql`      | **Comptes, rôles et permissions seuls** — sans catalogue        |
| `extract-auth.mjs`         | Extrait `auth-only.mysql.sql` depuis le seed                    |
| `migrate-data.mysql.sql`   | **Reprise** des jeux `data/{fr,en,ar}/*.json` — 333 lignes      |
| `migrate-data.mjs`         | Générateur de la reprise (dates converties, `legacyId` posés)   |
| `migrate-commerce.mysql.sql` | **Migration additive** : tables `orders`, `quotes`, `job_applications` |
| `migrate-authors.mysql.sql`  | **Migration additive** : table `authors` + `news_articles.authorId`    |
| `setup-env.mjs`            | Crée `backend/.env` (pilote MySQL + secrets JWT aléatoires)     |
| `test-auth-sql.mjs`        | Vérifie hachages, types de comptes et rejeu de `auth-only`      |
| `test-commerce-sql.mjs`    | Vérifie la migration commerce (rejeu sur SQLite)                |
| `test-authors-sql.mjs`     | Vérifie la migration auteurs (rejeu sur SQLite)                 |

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

Volume repris : **333 lignes** sur 11 tables — services (12), solutions (27),
produits (45), auteurs (42), actualités (45), événements (45), carrières (45),
partenaires (18), témoignages (12), carrousel (12), pages (30).

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
node sql/generate-schema.mjs   # schema.mysql.sql, depuis prisma/schema.prisma
node sql/generate-seed.mjs     # seed.mysql.sql (contenu de démonstration)
node sql/migrate-data.mjs      # migrate-data.mysql.sql (reprise des JSON)
```

Après toute modification de `prisma/schema.prisma`, régénérez le schéma :
c'est ce qui garantit que le SQL et le modèle Prisma ne divergent plus.
