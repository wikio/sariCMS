# SARI CMS — Configurer MySQL, SMTP et créer les tables (procédure complète)

> 🔢 **Identifiants entiers** : toutes les tables ont une clé primaire
> `INT AUTO_INCREMENT` (pas d'UUID). Les codes (devis, commande, facture)
> peuvent intégrer directement l'ID numérique — ex. `SARI-WCMD-00042`.

Cette procédure couvre la mise en place du **backend NestJS** sur un serveur de
base de données : configuration de **MySQL**, création des **tables** et des
**données**, puis configuration **SMTP** pour les emails.

> Chemin des fichiers utilisés :
> - Schéma MySQL : `backend/sql/schema.mysql.sql`
> - Données (contexte algérien) : `backend/sql/seed.mysql.sql`
> - Variables d'environnement : `backend/.env.example` → copier en `backend/.env`

---

## 0. Prérequis

| Élément                | Version requise                |
| ---------------------- | ------------------------------ |
| Node.js                | 18+ (recommandé : 20 LTS)      |
| MySQL                  | 8.0+ (ou MariaDB 10.4+)        |
| Accès serveur          | SSH (VPS/dédié) **ou** cPanel  |
| `npm`                  | livré avec Node.js             |

---

## 1. Configurer MySQL (créer la base et l'utilisateur)

### Option A — VPS / serveur dédié (accès SSH)

**1.1. Installer MySQL** (exemple Ubuntu/Debian) :

```bash
sudo apt update
sudo apt install -y mysql-server
sudo mysql_secure_installation   # définir le mot de passe root, retirer les comptes anonymes…
```

**1.2. Créer la base, l'utilisateur et les droits** :

```bash
sudo mysql -u root -p
```

Puis, dans le prompt `mysql>` :

```sql
-- Base de données (utf8mb4 pour l'arabe et le français)
CREATE DATABASE IF NOT EXISTS sari_cms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Utilisateur applicatif
CREATE USER 'sari'@'localhost' IDENTIFIED BY 'UN_MOT_DE_PASSE_TRES_FORT';
GRANT ALL PRIVILEGES ON sari_cms.* TO 'sari'@'localhost';
FLUSH PRIVILEGES;

-- Vérifier
SHOW DATABASES;
EXIT;
```

> Remplacez `UN_MOT_DE_PASSE_TRES_FORT` par un vrai mot de passe.
> Si le backend tourne sur une autre machine que MySQL, utilisez
> `'sari'@'%'` (ou l'IP du serveur) **et** ouvrez le port 3306 au pare-feu.

### Option B — cPanel / hébergement mutualisé

1. Se connecter à **cPanel**.
2. **MySQL® Databases** :
   - **Create New Database** → nom : `sari_cms`
   - **Add New User** → `sari_utilisateur` + mot de passe fort
   - **Add User To Database** → cocher **ALL PRIVILEGES** → *Make Changes*
3. Noter le **nom de base complet** et l'**utilisateur complet** affichés par
   cPanel (ex. `cpanel_sari_cms` et `cpanel_sari_utilisateur`) : ce sont eux
   qu'on mettra dans `DATABASE_URL`.

> En mutualisé, l'hôte MySQL est souvent `localhost` (voir « Remote MySQL »
> si le backend est hébergé ailleurs).

---

## 2. Créer les tables + importer les données

### Option A — Ligne de commande `mysql` (SSH)

Depuis la racine du projet :

```bash
# 1) Schéma : crée les 22 tables
mysql -u sari -p sari_cms < backend/sql/schema.mysql.sql

# 2) Données : contenu algérien (FR/EN/AR)
mysql -u sari -p sari_cms < backend/sql/seed.mysql.sql
```

> Si vous utilisez l'utilisateur root : `mysql -u root -p < backend/sql/schema.mysql.sql`
> (le script crée et sélectionne la base `sari_cms` automatiquement).

### Option B — phpMyAdmin (cPanel)

1. Ouvrir **phpMyAdmin** → sélectionner la base `sari_cms`.
2. Onglet **Importer** → choisir `backend/sql/schema.mysql.sql` → **Exécuter**.
3. Re-choisir `backend/sql/seed.mysql.sql` → **Exécuter**.

### Vérification

```sql
USE u830983108_sari_cms;           -- ← votre nom de base réel
SHOW TABLES;                       -- 22 tables attendues
SELECT COUNT(*) FROM products;     -- 18 (6 produits × 3 langues)
SELECT COUNT(*) FROM users;        -- 5 comptes de démo
SELECT COUNT(*) FROM permissions;  -- 100
```

> **« Avertissements: 23 » au premier import = normal.** Ce sont des **notes**
> (pas des erreurs) : `Unknown table` sur les 22 `DROP TABLE IF EXISTS` d'une
> base vierge + `Can't create database; database exists` (base déjà créée dans
> le panneau d'hébergement). Vérifier avec `SHOW WARNINGS;` — niveau « Note ».

---

## 3. Configurer le backend (`backend/.env`)

Copier le modèle puis éditer :

```bash
cd backend
cp .env.example .env
nano .env
```

### 3.1. Section base de données (MySQL)

```dotenv
DB_DRIVER=mysql
DATABASE_URL="mysql://sari:UN_MOT_DE_PASSE_TRES_FORT@127.0.0.1:3306/sari_cms"
```

| Champ         | Exemple                                    | Remarque |
| ------------- | ------------------------------------------ | -------- |
| utilisateur   | `sari` (ou `cpanel_sari_utilisateur`)      | créé à l'étape 1 |
| mot de passe  | `UN_MOT_DE_PASSE_TRES_FORT`                | entre `:` et `@` |
| hôte          | `127.0.0.1` / `localhost` / IP du serveur  | |
| port          | `3306`                                     | |
| base          | `sari_cms` (ou `cpanel_sari_cms`)          | |

> ⚠️ Caractères spéciaux dans le mot de passe : les **encoder en URL**
> (ex. `@` → `%40`, `#` → `%23`, `:` → `%3A`).

### 3.2. Générer le client Prisma (obligatoire pour MySQL)

```bash
cd backend
npx prisma generate
```

> Sans cette étape, le backend démarre avec le driver JSON par défaut
> (`DB_DRIVER=json`) et MySQL ne sera pas utilisé.

### 3.3. Secrets JWT (à changer impérativement)

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copier la sortie dans `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET`.

### 3.4. Démarrer et vérifier

```bash
npm run start:dev
```

Logs attendus :

```
Database driver: mysql
SARI CMS API listening on http://0.0.0.0:3001/api/v1
```

En cas d'erreur de connexion : vérifier `DATABASE_URL`, l'existence de la base
(`SHOW DATABASES;`), et le pare-feu du port 3306.

---

## 4. Configurer SMTP (emails)

Le backend utilise `nodemailer`. Le comportement dépend de `SMTP_HOST` :

- **`SMTP_HOST` vide** → mode **fichier** : les emails sont journalisés dans
  `backend/storage/mail/outbox.json` (aucun envoi réel). Pratique en dev.
- **`SMTP_HOST` renseigné** → envoi réel via le serveur SMTP.

### 4.1. Variables

```dotenv
SMTP_HOST=smtp.votre-domaine.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@sarisysteme.com
SMTP_PASS=VOTRE_MOT_DE_PASSE_EMAIL
SMTP_FROM="SARI Système <noreply@sarisysteme.com>"
```

| Variable      | Rôle |
| ------------- | ---- |
| `SMTP_HOST`   | hôte du serveur SMTP |
| `SMTP_PORT`   | **587** (STARTTLS) ou **465** (SSL) |
| `SMTP_SECURE` | `true` pour SSL implicite (port 465) ; `false` pour STARTTLS (port 587) |
| `SMTP_USER`   | compte email complet (ex. `contact@mondomaine.com`) |
| `SMTP_PASS`   | mot de passe de la boîte mail |
| `SMTP_FROM`   | expéditeur : `"Nom <email@domaine>"` |

### 4.2. Ports — tableau récapitulatif

| Port | Chiffrement | `SMTP_SECURE` | Usage |
| ---- | ----------- | ------------- | ----- |
| 587  | STARTTLS    | `false`       | recommandé |
| 465  | SSL         | `true`        | alternative |
| 25   | (aucun)     | `false`       | souvent bloqué |

### 4.3. Exemples par fournisseur

**cPanel / hébergement mutualisé** (recommandé pour ce projet) :

```dotenv
SMTP_HOST=mail.sarisysteme.com     # souvent "mail.<domaine>" (voir « Email Accounts »)
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@sarisysteme.com
SMTP_PASS=mot_de_passe_de_la_boite
SMTP_FROM="SARI Système <noreply@sarisysteme.com>"
```

**Gmail** (nécessite la 2FA + un *mot de passe d'application*) :

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=votre.adresse@gmail.com
SMTP_PASS=mot_de_passe_application_16_caracteres
```

**OVH** :

```dotenv
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@sarisysteme.com
SMTP_PASS=mot_de_passe
# SMTP_FROM doit correspondre à l'expéditeur autorisé (la boîte configurée)
```

### 4.4. Tester l'envoi

Via l'API (nécessite un jeton admin) :

```bash
curl -X POST http://127.0.0.1:3001/api/v1/mail/send \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"vous@example.com","subject":"Test SARI","html":"<p>Email de test</p>"}'
```

Vérifier l'historique :

```bash
curl http://127.0.0.1:3001/api/v1/mail/outbox \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

> En mode fichier (SMTP_HOST vide), l'email apparaît dans
> `backend/storage/mail/outbox.json`.

---

## 5. Lier le frontend Next.js au backend

Dans le dossier racine (`.env.local`) :

```dotenv
NEXT_PUBLIC_CMS_API_URL=/api/v1
CMS_API_INTERNAL_URL=http://127.0.0.1:3001/api/v1
```

Et dans `backend/.env`, autoriser l'origine du frontend :

```dotenv
CORS_ORIGINS=https://votre-domaine.com
```

---

## 6. Récapitulatif de la mise en production

```bash
# 1) Base de données
mysql -u root -p < backend/sql/schema.mysql.sql
mysql -u root -p < backend/sql/seed.mysql.sql

# 2) Backend
cd backend
cp .env.example .env        # puis renseigner DB_DRIVER=mysql, DATABASE_URL, SMTP_*
npx prisma generate
npm run build
npm run start:prod          # (ou un process manager : pm2 start dist/main.js)
```

---

## 7. Dépannage rapide

| Symptôme | Cause probable | Solution |
| -------- | -------------- | -------- |
| `Access denied for user` | mauvais user/pass ou droits | revérifier `DATABASE_URL` et `GRANT ALL` |
| `Unknown database` | base non créée ou nom différent | `SHOW DATABASES;` puis corriger `DATABASE_URL` |
| `ECONNREFUSED 3306` | MySQL non démarré / port fermé | `sudo systemctl status mysql` + pare-feu |
| Backend démarre en `json` | `DB_DRIVER` non changé ou pas de `prisma generate` | vérifier `.env` + `npx prisma generate` |
| Email non reçu | port/chiffrement faux, ou FROM non autorisé | tester 465/587, `SMTP_SECURE` adapté |
| Gmail refuse l'envoi | mot de passe normal au lieu du mot de passe d'appli | activer 2FA + créer un app password |
