# Utilisateurs, rôles et données métier

Comment les comptes et les listes métier (clients, partenaires, candidatures,
commandes, devis) sont stockés et qui accède à quoi.

---

## 1. Une seule table pour tous les comptes

Il n'existe **pas** de table `clients`, `partenaires` ou `candidats`. Tous les
comptes vivent dans `users`, distingués par la colonne `type` :

| `type` | Rôle | Écran du back-office |
|---|---|---|
| `admin` | Administrateur du CMS | *Utilisateurs*, *Rôles & permissions* |
| `client` | Client (commandes, devis) | *Clients* |
| `partner` | Partenaire / revendeur | *Comptes partenaires* |
| `candidate` | Candidat à une offre | *Candidatures* |

Les écrans *Clients* et *Comptes partenaires* interrogent la même ressource
`/users`, filtrée par `type`. Modifier une fiche client revient donc à modifier
la ligne `users` correspondante.

> **À ne pas confondre** avec les libellés traduits affichés dans l'interface
> (« Client », « Partenaire »…). Les valeurs stockées sont toujours les quatre
> identifiants anglais ci-dessus.

### Champs métier portés par `users`

Le même enregistrement porte les champs propres à chaque profil :

- **partenaire** : `partnerCode`, `partnerKey`, `company` ;
- **candidat** : `position`, `experience`, `motivation`, `cvUrl` ;
- **commun** : `phone`, `address`, `wilaya`, `country`, `locale`, `avatar`.

### Email unique

`email` porte une contrainte `UNIQUE KEY users_email_key` en base, doublée d'un
contrôle applicatif (`uniqueFields: ['email']`). Créer un second compte avec le
même email renvoie une erreur `409 Conflict`. L'email est donc la clé naturelle
qui relie un compte à ses commandes, devis et candidatures.

### Lien vers la fiche métier

Dans *Utilisateurs*, le badge de type de chaque ligne est cliquable : il ouvre
la vue métier correspondante, filtrée sur l'email du compte
(`lib/user-links.ts`). C'est un lien de navigation, pas une jointure : les deux
écrans montrent le même enregistrement.

---

## 2. Séparation des espaces

Deux espaces distincts, désormais étanches :

| Espace | URL | Public |
|---|---|---|
| Back-office | `/{locale}/admin` | `admin` **uniquement** |
| Espace personnel | `/{locale}/dashboard` | `client`, `partner`, `candidate` |

### Ce qui était ouvert

`/auth/login` authentifie les quatre types de comptes — c'est normal, les
clients ont besoin de se connecter. Mais la garde du back-office ne vérifiait
que la **présence** d'un jeton, jamais son **type** : un client qui saisissait
ses identifiants sur `/admin` obtenait une session d'administration valide.

### Ce qui contrôle l'accès aujourd'hui

Trois niveaux, du plus proche de l'utilisateur au plus profond :

1. **Page de connexion admin** (`app/[locale]/admin/page.tsx`) : si le compte
   authentifié n'est pas de type `admin`, la session est effacée et un message
   explicite s'affiche.
2. **Layout du back-office** (`components/admin/AdminLayout.tsx`) : à chaque
   navigation, un compte non-`admin` est déconnecté et renvoyé vers
   `/dashboard`.
3. **API** : les routes d'administration exigent une permission
   (`@RequirePermissions`). Un compte client, sans rôle, reçoit `403` — y
   compris en appelant l'API directement, hors navigateur.

Symétriquement, un administrateur qui ouvre `/dashboard` est redirigé vers le
back-office, et le rendu est bloqué pendant la redirection pour éviter un
affichage fugitif.

Test de non-régression : `node scripts/test-access-control.mjs`.

---

## 3. Rôles et permissions

### Modèle

- `permissions` : catalogue `ressource:action`, soit **115 entrées**
  (23 ressources × 5 actions : `create`, `read`, `update`, `delete`, `admin`).
- `roles` : un rôle porte un `slug` unique et sa liste de permissions.
- `users.roleId` : rattache un administrateur à un rôle.

`super-admin` détient la permission `*` (tout). Les rôles marqués `isSystem`
ne sont pas modifiables depuis l'interface.

### Écran *Rôles & permissions*

- créer un rôle (nom, identifiant, description) ;
- cocher/décocher chaque case de la matrice — chaque clic est enregistré ;
- cliquer sur le nom d'une ressource pour basculer toute la ligne ;
- « Tout cocher » / « Tout décocher » ;
- supprimer un rôle non système.

### Pourquoi la matrice ne réagissait pas

Trois défauts cumulés, tous corrigés :

1. **Comparaison de types.** La page construisait un ensemble d'ids provenant
   de l'API (entiers en MySQL) puis testait leur appartenance sous forme de
   chaîne : `ids.has("1")` est toujours faux quand l'ensemble contient `1`.
   Aucune case ne pouvait apparaître cochée, et le rôle actif ne se
   sélectionnait pas non plus (`"1" === 1`).
2. **Validation trop stricte.** Le DTO exigeait `@IsUUID('4')` sur
   `permissionIds`, et `@IsUUID()` sur `roleId`. En base MySQL les ids sont des
   entiers : toute tentative d'enregistrement était rejetée. Remplacé par
   `IsEntityId`, qui accepte les deux formes.
3. **Liste tronquée.** L'API plafonne `limit` à 100 ; avec 115 permissions, une
   requête unique en perdait 15 sans le signaler. La page pagine désormais.

La liste des ressources est lue depuis la base au lieu d'être figée dans le
code — elle ne peut plus diverger du backend.

---

## 4. Commandes, devis et candidatures

### Avant

Ces trois listes n'existaient pas en base. Elles étaient stockées dans le
`localStorage` du navigateur :

- invisibles depuis un autre poste ou un autre navigateur ;
- perdues au vidage du cache ;
- aucune sauvegarde possible.

### Maintenant

Trois tables, et le CRUD complet exposé par l'API :

| Table | Route | Contenu |
|---|---|---|
| `orders` | `/api/v1/orders` | Commandes, lignes, facture, paiement |
| `quotes` | `/api/v1/quotes` | Demandes de devis et réponse commerciale |
| `job_applications` | `/api/v1/applications` | Candidatures |

Points de conception :

- `userId` relie l'enregistrement au compte (`ON DELETE SET NULL` : supprimer
  un compte ne détruit pas l'historique commercial) ;
- `job_applications.careerId` pointe vers l'offre (`careers`) ;
- `orders.code` et `quotes.reference` sont uniques ;
- montants en `DECIMAL(14,2)` — `DECIMAL(10,2)` plafonnait à 99 999 999,99, en
  deçà d'une commande B2B en dinars ;
- tout changement de statut alimente `history` automatiquement, côté serveur.

### Migration de la persistance

Une soixantaine d'appels synchrones (`loadOrders()`, `saveQuotes(...)`) étaient
répartis dans une douzaine d'écrans. Plutôt que de tout réécrire en `await`,
`lib/crm-sync.ts` traite le `localStorage` comme un cache :

- à l'ouverture du back-office, `pullAll()` télécharge la base et remplit le
  cache ;
- les écrans lisent et écrivent le cache comme avant ;
- chaque écriture est répliquée vers l'API en arrière-plan.

La base fait autorité. En cas de coupure réseau l'écran reste utilisable et la
synchronisation reprend au chargement suivant.

> Les données déjà présentes dans un navigateur ne sont pas envoyées
> automatiquement : elles remonteront au premier enregistrement depuis cet
> écran, ou peuvent être ressaisies. Pensez à ouvrir le back-office sur le
> poste qui détient l'historique avant de vider son cache.

---

## 5. Mise à jour d'une base existante

`backend/sql/schema.mysql.sql` commence par des `DROP TABLE` : **ne pas
l'utiliser sur une base en production**. Pour ajouter les trois tables sans
rien détruire :

```bash
mysql -u UTILISATEUR -p BASE < backend/sql/migrate-commerce.mysql.sql
```

Le fichier est purement additif (`CREATE TABLE IF NOT EXISTS`) et rejouable.

Puis, le schéma Prisma ayant changé :

```bash
cd backend && npx prisma generate && npm run start:dev
```

Vérification sans MySQL : `node backend/sql/test-commerce-sql.mjs`.

---

## 6. Récapitulatif des fichiers

| Fichier | Rôle |
|---|---|
| `lib/admin-session.ts` | `isAdminUser`, `hasAdminAccess`, `isBackOfficeUser` |
| `lib/user-links.ts` | Lien compte → fiche métier |
| `lib/crm-sync.ts` | Pont cache local ↔ API |
| `app/[locale]/admin/permissions/page.tsx` | Matrice rôles / permissions |
| `backend/src/modules/orders\|quotes\|applications/` | Modules CRUD |
| `backend/src/common/validation/entity-id.ts` | Id entier ou UUID |
| `backend/sql/migrate-commerce.mysql.sql` | Migration additive |
| `scripts/test-access-control.mjs` | Test des règles d'accès |
| `backend/sql/test-commerce-sql.mjs` | Test de la migration |
