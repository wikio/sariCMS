# SARI CMS — Backend (étapes 1–2)

API NestJS du CMS SARI Système. Elle remplace progressivement les fichiers JSON statiques du site vitrine Next.js (`/data/{fr,en,ar}/*.json`) par une API versionnée, authentifiée et multi-bases.

Préfixe : `/api/v1`  
Swagger : `/api/v1/docs`

---

## Décisions d’implémentation

| Sujet | Choix | Pourquoi |
|---|---|---|
| Hébergement | Process Node unique (cPanel / Passenger) | Pas de VPS, pas de Redis, pas de cache distribué |
| Cache | L1 `cache-manager` (mémoire) + L2 **Keyv fichier JSON** | Portable sans compilation native. SQLite (`CACHE_SQLITE_PATH` + `@keyv/sqlite`) reste une option si l’hôte le permet |
| Multi-BD | Pattern **Repository / Adapter**. Les services ne voient que `ICrudRepository<T>` | `DB_DRIVER=json\|mysql\|postgres\|mongodb` sans toucher au métier |
| MySQL / PostgreSQL | Prisma (schéma par défaut MySQL) | Changer `provider` + `DATABASE_URL`, puis `prisma generate && prisma migrate` |
| MongoDB | Adaptateur Mongoose générique (`strict: false`) | Même interface, collection = nom métier |
| JSON | Store fichier `storage/json/{collection}.json` | Démo et mutualisé sans SQL. **Défaut de développement** |
| IDs | UUID v4 | Portables entre drivers |
| Auth | JWT access (15 min) + refresh rotatif (7 j, hashé SHA-256) | Passport JWT, Bearer |
| 2FA | TOTP (`otplib`) **opt-in par compte** | Setup → QR / otpauth → confirmation par code. Jamais obligatoire globalement |
| RBAC | `resource:action` (`pages:update`, `users:admin`, `*`) | Inféré du verbe HTTP via `@CrudResource`, surcharge possible |
| Soft delete | `deletedAt` + corbeille + jeton de purge | `POST /:id/purge` émet un jeton (TTL 5 min), `DELETE /:id/purge?confirm=` confirme. Cron nocturne (`TRASH_RETENTION_HOURS`, défaut 30 j) |
| Vues API | `?view=list\|card\|block` | Masques de champs par module |
| i18n UI admin | `nestjs-i18n` FR / EN / AR | Header `Accept-Language` ou `x-lang` |
| i18n contenu | Table `translations` (`entityType`, `entityId`, `locale`, `field`, `value`) | Indépendante du driver |
| Audit | Collection `audit_logs` (immuable côté API) | Alimente « activité récente » |
| Recherche | SQL / JSON indexée, pagination, filtres dynamiques | Pas d’Elasticsearch à ce stade (catalogue encore petit) |
| IndexedDB | **Non utilisé côté backend** | Réservé au cache navigateur (Dexie) plus tard |

Le seed ne contient **aucune fiche catalogue réelle** : rôles, permissions, un compte admin, collections vides.

---

## Prérequis

- Node.js 20+
- Pour MySQL / PostgreSQL : serveur SQL + Prisma CLI
- Pour la démo : rien d’autre (`DB_DRIVER=json`)

```bash
cd backend
cp .env.example .env          # déjà fourni en dev
npm install
npm run seed                  # structure vide + admin
npm run start:dev             # http://localhost:3001/api/v1/docs
```

Compte seed (à changer en production) :

```
SEED_ADMIN_EMAIL=admin@sarisysteme.com
SEED_ADMIN_PASSWORD=ChangeMe_Sari2026!
```

```bash
npm test                      # BaseCrudService + News + Events + Products + groupe 3
```

---

## Changer de moteur de base

```env
# Démo / mutualisé sans SQL
DB_DRIVER=json
JSON_STORE_PATH=./storage/json

# Production MySQL (cPanel)
DB_DRIVER=mysql
DATABASE_URL=mysql://USER:PASS@127.0.0.1:3306/sari_cms

# PostgreSQL
DB_DRIVER=postgres
DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/sari_cms
# puis dans prisma/schema.prisma : provider = "postgresql"

# MongoDB
DB_DRIVER=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017/sari_cms
```

Aucune classe `*Service` n’importe Prisma ni Mongoose. Le `DatabaseModule` construit une `RepositoryFactory` au boot.

Passage MySQL → PostgreSQL : types volontairement portables (`String @db.Text`, `Json`, UUID). Modifier uniquement le `provider` Prisma.

---

## Auth & sécurité

```
POST /api/v1/auth/login              → { accessToken, refreshToken } ou { requires2fa, challengeToken }
POST /api/v1/auth/2fa/challenge      → valide le TOTP du challenge
POST /api/v1/auth/refresh            → rotation du refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/2fa/setup|enable|disable
```

- Helmet (CSP désactivé pour Swagger)
- `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`)
- Throttling global + plus strict sur login / messages de contact
- Mots de passe **bcryptjs** (12 rounds, JS pur — pas de compilation native, adapté au cPanel), politique : 10+ / maj / min / chiffre
- Secrets TOTP et hash refresh jamais renvoyés
- CORS via `CORS_ORIGINS` (+ `*.e2b.app` / `*.vercel.app` pour les previews)

---

## Contrat CRUD (tous les modules métier)

```
GET    /{resource}                         liste : search, filter, sort, page, view
GET    /{resource}/autocomplete?q=&field=
GET    /{resource}/trash
GET    /{resource}/:id?view=block
POST   /{resource}
PATCH  /{resource}/:id
DELETE /{resource}/:id                     soft delete
POST   /{resource}/:id/restore
POST   /{resource}/:id/purge               → { confirm, expiresIn }
DELETE /{resource}/:id/purge?confirm=
```

Filtres dynamiques :

```
?filter[status]=published
?filter={"rating":{"gte":4},"locale":"fr"}
?search=échographe&sortBy=updatedAt&sortOrder=desc&page=1&limit=20&view=card
```

### Endpoints publics (vitrine, sans JWT)

| Méthode | Chemin | Usage |
|---|---|---|
| GET | `/public/pages` `/public/pages/:slug` | Pages publiées |
| GET | `/public/faqs` | FAQ |
| GET | `/public/testimonials` | Témoignages |
| GET | `/public/menus` `/public/menus/:location` | Navigation |
| GET | `/public/contact?locale=fr` | Coordonnées |
| GET | `/public/news` `/public/news/:slug` | Actualités |
| GET | `/public/events` `/public/events/:slug` | Événements |
| GET | `/public/products` `/public/products/:slug` | Catalogue |
| GET | `/public/services` `/public/services/:slug` | Prestations |
| GET | `/public/partners` | Partenaires |
| GET | `/public/careers` `/public/careers/:slug` | Offres d’emploi |
| GET | `/public/solutions` `/public/solutions/:slug` | Catégories de solutions |
| GET | `/public/hero` | Slides hero |
| POST | `/contact/messages` | Formulaire de contact (throttlé) |
| GET | `/health` | Driver + uptime |

---

## Modules livrés (groupes 1 à 3)

**Groupe 1** — `auth`, `users`, `roles`, `permissions`  
**Groupe 2** — `pages` (kinds `legal|about|generic`, subtypes `simple|gallery|flyer|slide|scroll|full`), `faqs`, `testimonials`, `menus`, `contact`  
**Groupe 3** — `services`, `partners`, `careers`, `solutions`, `hero`  
**Transverse** — `translations`, `audit-logs`, `settings` (purge corbeille)  
**Socle tests** — `news` (stats auteur), `events` (agenda JSON), `products` (galerie, specs, options)

Les groupes 4–8 restants (GED, newsletter, GrapesJS, e-shop commandes…) réutilisent `BaseCrudService` / `BaseCrudController` sans réécrire le CRUD.

Arborescence imposée par module :

```
modules/<name>/
  <name>.module.ts
  <name>.controller.ts
  <name>.service.ts
  dto/
  entities/
  repository/          # l’implémentation vit dans database/adapters/*
```

---

## Passenger / cPanel

1. Application Node.js pointant sur `backend/`  
2. Startup file : `dist/main.js` (`npm run build`)  
3. Variables d’environnement du `.env` recopiées dans l’UI cPanel  
4. `PORT` est fourni par Passenger — `main.ts` écoute `0.0.0.0`  
5. `DB_DRIVER=mysql` + `DATABASE_URL` de la base MySQL cPanel, **ou** `json` si aucun SQL n’est provisionné

Le cache fichier (`storage/cache/keyv.json`) et le store JSON doivent être persistants et **non partagés** entre plusieurs process. Un seul process Passenger est l’hypothèse retenue.

---

## Brancher le frontend existant

`lib/data.ts` interroge d’abord l’API publique, puis retombe sur `@/data/{locale}/*.json` si le backend est down **ou** si la collection est vide (seed structurel).

Le navigateur n’appelle jamais `localhost` : il tape `/api/v1/*`, réécrit par Next vers `CMS_API_INTERNAL_URL` (défaut `http://127.0.0.1:3001/api/v1`).

```
GET /api/v1/public/pages?locale=fr&view=block
GET /api/v1/public/menus?locale=fr
GET /api/v1/public/testimonials?locale=fr&view=block
GET /api/v1/public/products?locale=fr&view=block
GET /api/v1/public/contact?locale=fr
POST /api/v1/auth/login
```

Le login admin (`/[locale]/admin`) consomme JWT + 2FA optionnelle. Le tableau de bord affiche l’état de l’API et un bouton **Importer le catalogue** (`POST /settings/import-catalog`) qui charge `data/{fr,en,ar}/*.json` dans le CMS. Les écrans Produits / Services / Actualités / Utilisateurs lisent et écrivent l’API (plus de localStorage).

---

## Tests

```
src/common/crud/base-crud.service.spec.ts   CRUD, vues, corbeille, jeton de purge, unicité
src/modules/news/news.service.spec.ts        slug, publication, stats auteur
src/modules/events/events.service.spec.ts    agenda JSON, upcoming
src/modules/products/products.service.spec.ts slug, stock, specs
src/modules/services/services.service.spec.ts slug, défauts
src/modules/partners/partners.service.spec.ts défauts
src/modules/careers/careers.service.spec.ts   slug, publishedAt
src/modules/solutions/solutions.service.spec.ts slug explicite
```

Les services sont testés contre un `ICrudRepository` mocké — aucun driver réel n’est requis.
