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

### 2.3 Créer l'utilisateur applicatif

```sql
CREATE USER 'sari'@'localhost' IDENTIFIED BY 'UN_MOT_DE_PASSE_FORT';
GRANT ALL PRIVILEGES ON sari_cms.* TO 'sari'@'localhost';
FLUSH PRIVILEGES;
```

---

## 3. Brancher le backend sur MySQL

Dans `backend/.env` :

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
> génération a échoué.

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
node backend/sql/generate-schema.mjs

# après toute modification des fichiers data/
node scripts/add-slugs.mjs        # slugs + legacyId (--dry-run pour simuler)
node backend/sql/migrate-data.mjs # régénère l'import
```

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
