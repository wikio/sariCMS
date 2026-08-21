# SARI CMS — Base de données MySQL (contexte algérien)

Ce dossier contient le schéma MySQL et les données de démarrage du CMS
**SARI Système SARL** (distribution d'équipements médicaux, Algérie).

| Fichier                 | Rôle                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `schema.mysql.sql`      | Structure : base `sari_cms`, 22 tables, index, clés étrangères |
| `seed.mysql.sql`        | Données de démarrage (contexte algérien, FR / EN / AR)      |
| `generate-seed.mjs`     | Générateur du seed (reproductible, IDs déterministes)       |

> Les noms de tables (`@@map`) et de colonnes correspondent **exactement**
> au schéma Prisma (`backend/prisma/schema.prisma`) : ne les renommez pas,
> sinon le backend NestJS ne retrouvera plus ses données.

---

## 1. Importer le schéma puis les données

### Via la ligne de commande `mysql`

```bash
# Schéma (crée la base sari_cms + les tables)
mysql -u root -p < backend/sql/schema.mysql.sql

# Données (contexte algérien) — sélectionner la base cible
mysql -u root -p sari_cms < backend/sql/seed.mysql.sql
```

### Via phpMyAdmin (cPanel / hébergement mutualisé)

1. Ouvrir **phpMyAdmin** → sélectionner la base cible (ex. `u830983108_sari_cms`).
2. Onglet **Importer** → `backend/sql/schema.mysql.sql` → **Exécuter**.
3. Re-choisir `backend/sql/seed.mysql.sql` → **Exécuter**.

> ⚠️ Le fichier `seed.mysql.sql` ne contient **pas** de `USE` : il s'importe dans
> la base actuellement sélectionnée (ou passée en argument au CLI). Aucune
> modification nécessaire même si votre base porte un préfixe d'hébergeur.

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

Dans `backend/.env` :

```dotenv
DB_DRIVER=mysql
DATABASE_URL="mysql://sari:VOTRE_MOT_DE_PASSE_FORT@127.0.0.1:3306/sari_cms"
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

Pour régénérer un hash (si vous changez le mot de passe) :

```bash
node -e "console.log(require('bcryptjs').hashSync('NouveauMotDePasse', 10))"
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
  100 permissions (`resource:action`).
- **Langues** : `fr`, `en`, `ar` sur l'ensemble du contenu vitrine.

---

## 5. Régénérer le seed

Toute modification du contenu se fait dans `generate-seed.mjs`, puis :

```bash
cd backend
node sql/generate-seed.mjs   # régénère seed.mysql.sql
```
