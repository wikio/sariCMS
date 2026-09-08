# GED, retouche et atelier — contrat de fichiers et réglage MySQL

Ce document complète `docs/ATELIER-GRAPHIQUE.md` (la conception) par le côté
**exploitation** : ce que les écrans vont chercher, où, et comment régler les deux
processus quand la base est en MySQL.

---

## 0. Les gestes, et où ils sont

| Geste | Où | Ce qui est écrit |
| --- | --- | --- |
| Retoucher une image (recadrer, filtres, détourage) | Médiathèque → icône image → **une nouvelle image** | `ged/IMG_…-edite.png` (+ le dossier d'origine si la retouche est lancée depuis une fiche métier) |
| Ouvrir une image dans l'atelier | Médiathèque → icône palette → `/admin/canvas?file=<chemin>` | rien tant qu'on n'a pas enregistré |
| Enregistrer une planche | Atelier → « Enregistrer » → *Enregistrer la planche* | `canvas/CANVA_…png` + `.svg` si vectoriel + fiche `.sari.json`, nouvelle version `-vN` à la réédition |
| Enregistrer autrement | même menu → *comme nouvelle planche* / *comme image* (`IMG_`) | un asset neuf, l'ancien reste intact |
| Importer depuis ce poste | navigateur de GED (onglet ou feuille) → *Importer*, ou glisser le fichier sur le plan | écrit dans la GED **puis** posé sur la planche |
| Poser une planche dans une page | GrapesJS → bloc « Planche graphique » → double-clic → enregistrer | l'attribut `data-sari-canvas="<module>/<fichier>"` de l'`<img>` |
| Partir d'un gabarit | Atelier → *Gabarits* (5 formats livrés) ou `/admin/canvas` → tuiles | rien : le gabarit n'est appliqué qu'au premier enregistrement |

---

## 1. La règle qui a fait tomber trois écrans d'un coup : l'URL vient du disque

Un asset de la GED est `public/uploads/<module>/<fichier>`. Mais il peut aussi être
`public/uploads/<fichier>` — un import ancien, un fichier posé à la main, un export
d'un autre outil. Dans les deux cas **l'URL publique est le chemin réel du fichier,
jamais un chemin reconstitué depuis le module** :

| Le fichier est… | Son URL est… |
| --- | --- |
| `public/uploads/ged/IMG_…_visuel.png` | `/uploads/ged/IMG_…_visuel.png` |
| `public/uploads/product_1_echographe.png` (racine) | `/uploads/product_1_echographe.png` |

Écrire `/uploads/ged/product_1_echographe.png` parce que « le module par défaut est
ged » produit exactement les trois symptômes rapportés :

- **retoucher une image** → `Image non chargeable` (l'éditeur pose un `<img>` sur une
  URL qui n'existe pas, le 404 n'a rien à charger) ;
- **ouvrir dans l'atelier** (`/admin/canvas?file=…`) → la planche s'ouvre **vide** :
  le moteur ne reçoit aucune erreur, juste une image qui ne répond pas ;
- **vignette cliquable cassée** dans le sélecteur d'actifs de GrapesJS, alors que la
  page, elle, affiche toujours bien le visuel — le `<img>` HTML, lui, ne demande pas
  de CORS.

La règle est écrite une seule fois, dans `assetUrl(module, file)` de
`lib/ged/prefix.mjs` (miroir backend : `ged-prefix.policy.ts`), et `module` vide veut
dire « racine ». Les deux jeux d'assertions la verrouillent :
`node scripts/test-ged.mjs` et `backend/src/modules/ged/ged.service.spec.ts`.

---

## 2. Les trois surfaces qui parlent à la GED

| Surface | Adresse | Écrit dans | Authentification |
| --- | --- | --- | --- |
| Routes Next | `/api/admin/ged/*` | `public/uploads`, `public/canvas` | aucune (back-office interne) |
| `POST /api/admin/upload` | le magasin historique, toujours vivant | `public/uploads` | aucune |
| API NestJS | `/api/v1/ged/*` (réécrite par Next) | le **même** arbre | JWT global (`JwtAuthGuard`) |

`lib/ged/client.ts` choisit une fois par session : l'API métier répond-elle au
`GET /health` ? Alors `surface = 'cms'`, sinon `'next'`. Trois conséquences à
connaître :

1. **Une route que le backend ne sait pas servir n'est plus bloquante** : le client
   retente sur les routes Next (repli sur 404/405/501 et sur une réponse HTML). Sans
   ce repli, démarrer l'API suffisait à casser les gabarits et l'import — le backend
   n'exposait que `canvas-export`, `assets` et `asset/state`.
2. **Une 401 ne déclenche PAS le repli** : c'est la session qui est en cause, pas la
   surface. Le front renvoie vers `/admin` plutôt que d'écrire au mauvais endroit en
   silence.
3. **Le `multipart` reste sur les routes Next** (la retouche et l'import poste un
   `FormData`) ; en parallèle, `POST /ged/assets` du backend accepte le même
   `asset` encodé en `dataUrl`.

Le contrat des deux côtés, champ par champ :

| Action du client | Next | Nest |
| --- | --- | --- |
| Lister | `GET /api/admin/ged/assets` | `GET /ged/assets` |
| Fiche + état | `GET /api/admin/ged/asset?file=` | `GET /ged/asset?file=` |
| État seul | `GET …/asset/state?file=` | `GET /ged/asset/state?file=` |
| Écrire un blob | `POST /api/admin/ged/assets` (multipart) | `POST /ged/assets` (`dataUrl`) |
| Corriger la fiche | `PATCH /api/admin/ged/asset` | `PATCH /ged/asset` |
| Renommer | `PUT /api/admin/ged/asset` | `PUT /ged/asset` |
| Supprimer | `DELETE …/asset?file=&history=1` | `DELETE /ged/asset?file=&history=1` |
| Rattacher un JSON | `POST …/asset/state` | `POST /ged/asset/state` |
| Enregistrer une planche | `POST /api/admin/ged/canvas-export` | `POST /ged/canvas-export` |
| Gabarits | `GET|POST|DELETE /api/admin/ged/templates` | `GET /ged/templates`, `GET /ged/templates/:id`, `POST`, `DELETE ?id=` |

Deux détails d'API qui ont leur importance côté frontend, puisqu'ils sont la cause
directe de pannes silencieuses :

- `POST /ged/canvas-export` attend **`file`** pour la cible d'une réédition (alias
  `target`, `overwrite`) et accepte un `png` **en base64 nu** comme en `data:` URL.
  Passer à côté : au lieu de créer la version 2 de la planche, on écrit une planche
  neuve, et les pages publiées continuent d'afficher l'ancienne.
- Le champ `file` d'un `multipart` est **la partie binaire** : la destination
  s'appelle `target`. Confondre les deux écrivait un fichier nommé `[object File]`.

---

## 3. Réglage backend (MySQL)

### 3.1 Le `.env`

`backend/.env.example` livre `DB_DRIVER=json` : avec une base MySQL remplie, l'API
lit alors `storage/json` et **ignore la base**. Le script du dépôt bascule le pilote,
pose l'URL de connexion et régénère les secrets JWT :

```bash
cd backend
node sql/setup-env.mjs --host 127.0.0.1 --port 3306 --user sari --password secret --database sari_cms
# ou, si vous avez déjà une URL complète :
node sql/setup-env.mjs --url "mysql://sari:secret@127.0.0.1:3306/sari_cms"
```

Les lignes qui comptent ensuite, dans le même fichier :

```ini
DB_DRIVER=mysql
DATABASE_URL="mysql://sari:secret@127.0.0.1:3306/sari_cms"
PORT=3001                     # si 3001 est pris, mettez 5001 ici ET dans le front
CORS_ORIGINS=http://localhost:5000,http://localhost:3000

# GED de l'atelier (facultatif : par défaut ../public/uploads et ../public/canvas)
GED_UPLOAD_DIR=
GED_CANVAS_DIR=
GED_PREFIX_OVERRIDES=           # ex. {"audio":{"prefix":"SND_","module":"media"}}
```

### 3.2 La base

**Aucune migration n'est nécessaire pour la GED ni pour l'atelier** : la GED est un
système de fichiers et il n'y a pas de table `media`/`asset`. Le module `GedModule`
ne dépend pas de Prisma. Vous pouvez donc mettre à jour le dépôt sans toucher au
schéma.

Pour le reste du site, si la base existe déjà (mutualisé, reprise d'un ancien site) :

```bash
cd backend
npx prisma generate
npm run db:schema-check     # l'inventaire des écarts schéma ↔ base, sans rien écrire
npm run db:schema-fix       # applique les additions manquantes
```

Ou, sur une base vide, le SQL livré :

```bash
mysql -u sari -p sari_cms < backend/sql/schema.mysql.sql
mysql -u sari -p sari_cms < backend/sql/seed.mysql.sql        # ou auth-only.mysql.sql
mysql -u sari -p sari_cms < backend/sql/fix-zero-dates.mysql.sql
```

`prisma migrate deploy` ne marche que si la base a été créée par Prisma ; sinon il
faut le baseliner (`npx prisma migrate resolve --applied <nom>`), comme l'explique
`backend/DATABASE_MIGRATION_INSTRUCTIONS.md`.

### 3.3 Démarrer

```bash
cd backend
npm install          # `postinstall` régénère le client Prisma
npm run start:dev
curl -s http://127.0.0.1:3001/api/v1/health   # {"success":true,…}
```

Le point dur, avec MySQL : **`public/uploads` doit être le même dossier que celui que
lit le backend**. Par défaut le backend résout `../public/uploads` depuis
`backend/`, ce qui tombe juste en monorepo. Sur deux conteneurs (front d'un côté,
API de l'autre), il faut monter le **même volume** des deux côtés, ou poser
`GED_UPLOAD_DIR` sur ce volume partagé — sinon une planche enregistrée par l'API
n'apparaît pas dans le `<img>` servi par Next.

### 3.4 Les permissions de l'admin

L'API est gardée par un JWT global : `/ged/*` n'est pas marqué `@Public()`. Comme
`/ged` est un nouveau préfixe, un compte dont les permissions sont filtrées par
ressource peut s'y voir refuser l'accès. Le back-office passe par
`cmsAdminFetch` (jeton + rafraîchissement), donc seul un compte sans droit
suffisamment large rencontre un 403. Dans ce cas, rattachez la ressource au rôle
depuis l'écran Rôles & permissions, ou laissez le repli Next travailler (voir § 2) :
les routes `/api/admin/ged/*` n'exigent pas de jeton, elles sont internes au
back-office.

---

## 4. Réglage frontend

```bash
# .env.local à la racine
NEXT_PUBLIC_CMS_API_URL=/api/v1
CMS_API_INTERNAL_URL=http://127.0.0.1:3001/api/v1
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1
```

```bash
npm install          # ajoute `fabric@^6.9.1`
npm run dev          # http://localhost:5000
```

Le numéro de port du backend ne se change qu'à **trois** endroits d'un coup :
`backend/.env` (`PORT`), `CMS_API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL`. Le navigateur,
lui, ne voit que `/api/v1` (réécriture Next) et ne bouge pas — raison pour laquelle
le front n'a jamais d'origine absolue à configurer pour les images.

### Forcer l'écriture du côté de Next

Si l'API tourne mais que son `public/uploads` n'est pas le même volume (déploiement
séparé, Docker, mutualisé), dites au client de ne pas passer par elle. Dans la
console du navigateur, sur une page d'administration :

```js
// dans la console, sur n'importe quelle page d'administration
localStorage.setItem('sari_ged_surface', 'next');   // 'cms' pour forcer l'inverse
localStorage.removeItem('sari_ged_surface');        // retour à l'auto-détection
```

…ou, plus franc, arrêtez l'API le temps de travailler les planches : la surface est
rechoisie à chaque chargement de page. L'état est volontairement mémorisé pendant une
session pour qu'un backend qui redémarre entre deux enregistrements ne change pas la
destination des fichiers en cours.

---

## 5. Panne par panne

| Symptôme | Cause à vérifier en premier | Ce qui le dit |
| --- | --- | --- |
| `Image non chargeable` (retouche) | l'URL du média ne correspond pas au chemin réel | ouvrir l'URL dans un onglet ; un 404 = fichier ailleurs |
| Atelier ouvert sur un fond blanc | même cause, plus `?file=` pointant un nom nu | la notice de l'atelier nomme maintenant l'URL fautive |
| `Encountered two children with the same key` | clé de liste = URL ou `id` tiré du nom du fichier | les écrans clés sur `file` (chemin), et `GET /api/admin/upload` déduplique |
| « Catalogue de gabarits indisponible » / gabarits qui ne se chargent pas | route Nest absente (avant ce correctif), ou `crossOrigin` hérité dans le JSON | l'atelier relit `public/canvas/templates/*.json` en statique |
| Une réédition crée un fichier neuf au lieu d'un `v2` | payload sans `file` (ou `target`) vers la cible | la fiche porte `history[]`, l'URL ne doit pas bouger |
| Fichier `[object File]` dans `public/uploads` | `file` lu comme destination dans un `multipart` | la destination s'appelle `target` |
| Images distantes (Unsplash, CDN) refusées | CORS de l'hôte distant, et non le CMS | l'atelier le dit explicitement : « n'autorise pas la lecture par le canvas » |

Le `crossOrigin` mérite une ligne de plus : Fabric écrit `crossOrigin: "anonymous"`
dans le JSON de toute image chargée avec cet attribut, et le relit tel quel. Une image
**locale** qui porte cette clé devient, chez quiconque sert le site derrière un proxy
ou sous un autre nom d'hôte (`localhost` vs `127.0.0.1`), une image qui refuse de
charger — et `loadFromJSON` rejette le document entier, donc **tous** les gabarits.
`lib/canvas/image-load.ts` tranche : même origine ⇒ on ne demande pas de CORS ; et
`normalizeDocumentCrossOrigin` purge la clé à l'entrée comme à la sortie des documents.

---

## 6. Vérifier sans navigateur

```bash
node scripts/test-ged.mjs            # 34 assertions : préfixes, versions, racine, catalogue
node scripts/check-builder-kit.mjs   # la bibliothèque du constructeur
cd backend && npx jest src/modules/ged   # 22 assertions sur le miroir backend
```

Les routes Next, à chaud, avec un `curl` (aucun jeton requis) :

```bash
curl -s "http://127.0.0.1:5000/api/admin/ged/assets?limit=3" | head -c 400
curl -s -X POST http://127.0.0.1:5000/api/admin/ged/assets \
     -F "file=@public/logo.png;type=image/png" -F "kind=image" -F "name=test-cli"
curl -s "http://127.0.0.1:5000/api/admin/ged/templates" | head -c 200
```

L'API Nest, elle, exige un jeton :

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@sarisysteme.com","password":"ChangeMe_Sari2026!"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['accessToken'])")
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:3001/api/v1/ged/assets?limit=3" | head -c 400
```
