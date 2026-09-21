# Données et sauvegarde — où vit chaque information

Document d'exploitation : ce qui est en base MySQL, ce qui est sur fichier, ce
qui n'est que dans le navigateur, et quoi emporter dans une sauvegarde.

Tout ce qui suit a été relevé dans le code, pas déduit. Les chemins et les noms
de tables sont ceux du dépôt au moment de la rédaction.

> **Mise à jour.** Les coupons et les règles de taxes sont passés en base
> (`coupons`, `tax_rules`) avec les modules `CouponsModule` et `TaxesModule`. Ils
> étaient les deux seuls occupants *importants* du troisième étage décrit
> ci-dessous. Le reste — devises, taxonomies, modes de paiement, enregistrements
> de paiement, réglages de l'écran Paramètres — y est toujours, et le §4 reste
> valable pour eux.

---

## 0. L'essentiel

Le projet écrit dans **trois endroits distincts**, et ils ne se sauvegardent pas
de la même façon.

| Support | Contenu | Sauvegarde |
| --- | --- | --- |
| **MySQL** | Contenus, catalogue, commandes, devis, candidatures, comptes, rôles, permissions, pistes d'audit, réglages de visibilité et de maintenance | `mysqldump` |
| **Fichiers du serveur** | Médias (`public/uploads`), réglages SMTP, centre de courrier, SEO, newsletter, vérification | copie des dossiers |
| **Navigateur de l'administrateur** | **Coupons, taxes, devises, taxonomies, modes de paiement, enregistrements de paiement, réglages de l'écran Paramètres** | **aucune** — voir §4 |

> ⚠️ Le troisième étage est le point sensible. Ces données ne sont ni en base,
> ni sur le serveur : elles vivent dans le `localStorage` du poste qui les a
> saisies. Changer de navigateur, de poste, ou vider les données du site les
> fait disparaître.

---

## 1. Les coupons — circuit complet

### Où ils sont écrits

Table MySQL `coupons`, modèle `Coupon` de `backend/prisma/schema.prisma`,
exposée par `backend/src/modules/coupons/`.

Ils n'ont pas toujours été là. `lib/shop-store.ts` les écrivait avec un simple
`localStorage.setItem('sari_coupons', …)` et la page
`app/[locale]/admin/coupons/page.tsx` n'appelait aucune API : ni modèle Prisma,
ni module backend. Deux conséquences, dont une seule était visible :

1. le catalogue était perdu au vidage du cache et invisible d'un poste à
   l'autre ;
2. **les coupons ne fonctionnaient pas au panier.** `app/[locale]/cart/page.tsx`
   lisait `loadCoupons()` dans son propre `localStorage` — vide chez un client,
   puisque ce n'est pas le poste de l'administrateur. `read()` retombait alors
   sur `DEFAULT_COUPONS`, les trois coupons de démonstration. Un client pouvait
   donc utiliser `SARI10` et `CLINIQUE5000`, jamais un coupon réellement créé.

Le point 2 est le plus coûteux des deux : rien ne le signalait, l'écran
d'administration affichait le coupon comme actif et bien paramétré.

### Le chemin des données

| Étape | Qui | Écrit où |
| --- | --- | --- |
| Ouverture de l'écran | `hydrateShop()` → `GET /coupons/all` | base → cache |
| Modification | `saveCoupons(rows)` | cache, **puis** `POST /coupons/sync` en arrière-plan |
| Suppression | même envoi, champ `removed: [id]` | corbeille (`deletedAt`) |
| Saisie au panier | `POST /public/coupons/validate` | lecture seule, un seul coupon |

`lib/shop-sync.ts` fait les entrées/sorties, `lib/shop-mapping.ts` les
conversions (testés par `npm run shop:test`). L'interface reste synchrone : le
`localStorage` est devenu un cache, pas la source de vérité.

### Ce qu'un coupon contient

Dix-sept champs côté écran (`interface Coupon`, `lib/shop-store.ts:17`) et dix-sept
colonnes métier en base (`model Coupon`), plus l'identifiant auto-incrémenté :

| Champ écran | Colonne | Note |
| --- | --- | --- |
| `id` | `id` (auto-incrémenté) | texte côté écran, numérique en base |
| `code` | `code` `VARCHAR(40) UNIQUE` | normalisé en majuscules |
| `type` | `type` | `fixed` \| `percent`, énumération fermée |
| `amount` | `amount` `DOUBLE` | valeur du `type` |
| `maxDiscount` | `maxDiscount` | plafond en pourcentage |
| `minOrder` | `minOrder` | panier minimum |
| `start`, `end` | `startDate`, `endDate` `DATETIME(3)` | `AAAA-MM-JJ` ↔ horodatage |
| `limitGlobal`, `limitPerClient` | idem | quotas |
| `used` | `used` | compteur d'utilisations |
| `scope` | `scope` | `all` \| `category` \| `product` |
| `scopeValues`, `excludeValues` | `Json` | inclusions, exclusions |
| `stackable`, `active` | `TINYINT(1)` | cumul, activation |
| `revenue` | `revenue` `DOUBLE` | agrégat |

**Pourquoi `DOUBLE` et pas `DECIMAL`** : Prisma renvoie un `Decimal` qui se
sérialise en chaîne JSON (`"10.00"`), et `lib/commerce-math.ts:64` calcule
`coupon.amount / 100` sans coercition. Ce sont des valeurs de configuration et
des agrégats, pas des écritures comptables. Les montants de ledger — `orders`,
`quotes` et leurs lignes — restent en `DECIMAL(14,2)`.

### Ce que la base ne reprend pas

Les **utilisations** (`CouponUse`, clé `sari_coupon_uses`) restent dans le
navigateur : elles ne sont ni en base, ni synchronisées. En revanche l'effet
d'un coupon sur un document est bien en base, puisque `orders` et `quotes`
portent `coupon` (le code saisi) et `couponDiscount` (la remise accordée).

Le compteur `used` est la valeur envoyée par l'écran : poser un coupon au
panier ne l'incrmente pas côté serveur, comme avant. Un quota déclaré épuisé
doit donc être corrigé à la main.

## 2. Ce qui est dans MySQL

Trente-et-une tables, déclarées dans `backend/prisma/schema.prisma`.

| Groupe | Tables | Contenu |
| --- | --- | --- |
| Comptes | `users`, `roles`, `permissions`, `role_permissions` | identités, rôles, droits |
| Jetons | `refresh_tokens`, `password_reset_tokens` | sessions longues, réinitialisation |
| Contenus | `pages`, `news_articles`, `faqs`, `testimonials`, `menus`, `events`, `home_sections`, `hero_slides` | éditorial et structure de la vitrine |
| Catalogue | `products`, `services`, `partners`, `solutions`, `careers`, `job_applications` | offres et recrutement |
| Commerce | `orders`, `quotes`, **`coupons`**, **`tax_rules`** | commandes et devis (dont `coupon` et `couponDiscount`), catalogue de codes promo, règles de TVA |
| Relation | `contact_info`, `contact_messages`, `newsletter_subscribers` | coordonnées et inscriptions |
| Réglages | `settings`, `translations`, `audit_logs` | clés/valeurs JSON, traductions, journal |

Quatre tables méritent une note :

- **`settings`** est un magasin clé/valeur JSON. Elle porte notamment la
  visibilité du site (module `visibility`) et les réglages de maintenance
  (rétention de l'audit, planifications des purges, clé `maintenance`).
- **`audit_logs`** journalise chaque création, modification, suppression,
  restauration et purge. Sa charge utile est bornée (chaînes tronquées à
  500 caractères, objets volumineux résumés) et sa rétention est configurable —
  30 jours par défaut.
- **`coupons`** porte un `code` unique. La vérification d'unicité inclut la
  corbeille, donc un code supprimé reste réservé jusqu'à la purge automatique
  (30 jours par défaut) : c'est voulu, réutiliser un code rendrait ambigus les
  `orders.coupon` déjà enregistrés.
- **`tax_rules`** garantit « au plus une taxe par défaut » côté serveur. Cette
  règle ne tenait auparavant que dans `saveTaxes()`, donc que sur le poste qui
  enregistrait.

### Le cas particulier du pilote JSON

Si `DB_DRIVER=json`, ces mêmes « tables » deviennent des fichiers dans
`backend/storage/json/`. Ce mode sert au développement et aux démonstrations ;
en production avec MySQL, ce dossier reste vide.

---

## 3. Ce qui est sur fichier, côté serveur

### `public/uploads/` — les médias

Racine de la GED (`backend/src/modules/ged/ged.service.ts` :
`path.resolve(process.cwd(), '..', 'public', 'uploads')`). Images importées,
retouches, planches de l'atelier et leurs fiches `.sari.json`.

**Ignoré par git** (`.gitignore:25-26`, seul `.gitkeep` est suivi). Une
sauvegarde de la base sans ce dossier donne un site aux images cassées.

### `data/` — réglages et journaux applicatifs

| Fichier | Écrit par | Suivi par git |
| --- | --- | --- |
| `data/seo.json` | `lib/seo.ts` | oui |
| `data/newsletter.json` | `lib/newsletter-store.ts` | oui |
| `data/verification.json` | `lib/verification.ts` | oui |
| `data/mail/policy.json` | `lib/mail-center-store.ts` | **non** |
| `data/mail/modules.json` | idem | **non** |
| `data/mail/layouts.json` | idem | **non** |
| `data/mail/sent-log.json` | idem | **non** |
| `data/fr\|en\|ar/**` | contenu d'amorçage, importé à la demande | oui |

Le centre de courrier est volontairement hors base de données : fichiers JSON
lisibles et éditables à la main sur le serveur. Trois garde-fous à l'écriture —
fichier temporaire puis `rename`, valeurs bornées, historique élagué selon
`logRetentionDays` (60 jours par défaut) et plafonné à 5 000 lignes.

`data/mail/*` n'est **ni ignoré ni committé** : ce sont des fichiers créés au
premier enregistrement. Ils ne sont donc dans aucune sauvegarde git et doivent
être copiés à part.

### `backend/storage/` — côté backend

| Chemin | Contenu | Suivi |
| --- | --- | --- |
| `storage/mail/smtp.json` | identifiants SMTP saisis dans l'écran | **ignoré** (`backend/.gitignore:14`) |
| `storage/json/*.json` | données du pilote JSON | ignoré |
| `storage/cache/*` | cache L2 | ignoré, reconstructible |

`smtp.json` contient un mot de passe. Il est prioritaire sur les variables
d'environnement : le restaurer restaure aussi la configuration d'envoi.

---

## 4. Ce qui n'est que dans le navigateur

`localStorage` du poste de l'administrateur. Deux situations, à ne pas confondre.

| Clé | Contenu | Serveur ? |
| --- | --- | --- |
| `sari_coupons` | cache des coupons | **oui** — table `coupons` |
| `sari_taxes` | cache des taxes | **oui** — table `tax_rules` |
| `sari_orders`, `sari_quotes`, `sari_applications` | cache CRM | **oui** — synchronisés |
| `sari_site_visibility` | copie locale | **oui** — table `settings` |
| `sari_coupon_uses` | **utilisations de coupons** | **non** |
| `sari_shop_config` | **zones de livraison, frais, remise globale** | **non** |
| `sari_payments` | **modes de paiement proposés** | **non** |
| `sari_payment_records` | **enregistrements de paiement** | **non** |
| `sari_currencies` | **devises** | **non** |
| `sari_taxonomies` | **taxonomies** | **non** |
| `sari_admin_settings` | **réglages de l'écran Paramètres** | **non** |
| `sari_users_registry` | annuaire local | **non** |
| `sari_cart`, `sari_theme`, `sari_sku_seq` | panier, thème, séquence | non, sans enjeu |

Les lignes marquées « oui » sont un **cache** : l'écran les lit et les écrit de
façon synchrone, mais la base fait autorité et le contenu est rechargé à
l'ouverture (`lib/shop-sync.ts`, `lib/crm-sync.ts`). Vider le cache ne coûte
donc rien sur ces lignes-là.

Les lignes en gras sont la **seule copie** : elles n'ont aucun équivalent serveur
et se perdent au vidage du cache.

Conséquences encore valables :

- Les **enregistrements de paiement** (validé / en attente / rejeté, avec leur
  motif) ne quittent pas le poste. C'est le point de vigilance comptable
  principal depuis que les coupons et les taxes sont en base.
- Les **zones de livraison et les frais** (`sari_shop_config`) sont locaux :
  deux administrateurs peuvent facturer des frais de port différents. Le
  `globalTaxId` de ce réglage pointe vers une taxe désormais en base, mais
  l'aiguillage lui reste local : il n'est pas synchronisé.
- Les **taxonomies** alimentent les listes déroulantes de plusieurs écrans ;
  locales, elles diffèrent d'un poste à l'autre.
- Le **montant de taxe recalculé** à l'affichage d'une commande dépend des
  taxes en cache sur ce poste-là. Le montant *stocké* sur la commande, lui, est
  en base et ne bouge pas.

---

## 5. Que mettre dans une sauvegarde

Dans l'ordre d'importance :

1. **La base MySQL** — `mysqldump` de toutes les tables. C'est le cœur :
   contenus, commandes, comptes, coupons, taxes, audit.
2. **`public/uploads/`** — tous les médias. Sans lui, la base restaurée pointe
   des images absentes.
3. **`data/mail/`** — configuration et gabarits du centre de courrier, plus
   l'historique d'envoi.
4. **`backend/storage/mail/smtp.json`** — sinon l'envoi repart en mode
   « fichier » sans avertissement autre qu'une ligne de log.
5. **Les exports manuels de l'étage navigateur** — voir ci-dessous.

### Récupérer l'étage navigateur

Coupons et taxes n'ont plus besoin d'être exportés à la main : au premier
chargement de l'écran après la mise en base, `lib/shop-sync.ts` regarde ce que
rend la base. Si elle est vide **et** que ce poste n'a jamais synchronisé, il
pousse le catalogue local avant d'écrire quoi que ce soit, et l'administrateur
voit « N coupons repris de ce poste et enregistrés en base ». Ouvrir l'écran ne
détruit donc plus les données — c'était le risque de la bascule.

Règle complète, dans `decidePull()` :

| Base | Cache du poste | Déjà synchronisé | Ce qui se passe |
| --- | --- | --- | --- |
| lignes | peu importe | peu importe | la base remplit le cache |
| vide | vide | — | rien |
| vide | des lignes | non | **migration** : le local est poussé |
| vide | des lignes | oui | la base gagne (suppression consentie) |

La dernière ligne est ce qui empêche un catalogue supprimé de revenir sans
cesse. Dans les deux derniers cas, une copie du cache est écrite au préalable
dans `sari_shop_backup_coupons` et `sari_shop_backup_taxes` : c'est le filet si
un écrasement tourne mal.

Le reste de l'étage n'a toujours **aucun** export automatique. Depuis le poste
qui détient les données, dans la console, sur une page de l'administration :

```js
copy(JSON.stringify({
  uses:      JSON.parse(localStorage.getItem('sari_coupon_uses')|| '[]'),
  shop:      JSON.parse(localStorage.getItem('sari_shop_config')|| '{}'),
  payments:  JSON.parse(localStorage.getItem('sari_payments')  || '[]'),
  records:   JSON.parse(localStorage.getItem('sari_payment_records') || '[]'),
  currencies:JSON.parse(localStorage.getItem('sari_currencies')|| '[]'),
  taxonomies:JSON.parse(localStorage.getItem('sari_taxonomies')|| '[]'),
}, null, 2));
```

Le JSON est dans le presse-papiers. Le conserver avec les sauvegardes ; pour le
réinjecter sur un autre poste, faire l'opération inverse avec
`localStorage.setItem`.

---

## 6. Restauration

1. Recréer la base et rejouer le `mysqldump`.
2. Remettre `public/uploads/`, `data/mail/`, `backend/storage/mail/smtp.json`
   aux mêmes chemins.
3. Vérifier la cohérence des migrations : `npx prisma migrate deploy` ne doit
   rien trouver à appliquer. En cas d'erreur `P3009` ou `P3018`, voir
   `docs/REPRISE-MYSQL.md` §2.1 ter.
4. Redémarrer le backend. Au démarrage il replanifie les deux purges sur les
   valeurs enregistrées en base — aucun réglage à refaire.
5. Réinjecter le JSON du §5 sur le poste de l'administrateur.

---

## 7. Points d'attention

- **Coupons et taxes sont désormais en base** et entrent dans le `mysqldump`.
  **Restent sans sauvegarde automatique** : devises, taxonomies, modes de
  paiement, enregistrements de paiement, réglages de l'écran Paramètres,
  configuration boutique (`sari_shop_config`) et utilisations de coupons
  (`sari_coupon_uses`). Ce sont eux, le risque de perte restant.
- **La reprise du catalogue existant est automatique** (§5), mais elle ne se
  déclenche qu'une fois : au tout premier chargement d'un poste qui n'a jamais
  synchronisé, et seulement si la base est vide. Si l'administrateur ouvre
  d'abord un autre poste, déjà synchronisé lui, c'est ce dernier qui remplira la
  base et le premier verra son cache remplacé — la copie
  `sari_shop_backup_coupons` reste alors le seul recours. Mieux vaut faire
  la bascule depuis le poste qui détient le catalogue.
- **`data/mail/` n'est ni ignoré ni versionné** : il disparaît d'un
  déploiement qui repart d'un clone propre.
- **`smtp.json` contient un secret** et n'est pas dans git — à traiter comme
  une pièce d'infrastructure, pas comme du code.
- **`public/uploads/` est ignoré par git** : un `git clone` ne le contient pas.
- **La piste d'audit s'auto-limite** (30 jours par défaut, réglable dans
  Paramètres → Journaux & maintenance). En revanche les lignes plus anciennes
  que la fenêtre sont **définitivement supprimées** : si un audit long terme est
  exigé, il faut l'exporter avant, ou allonger la fenêtre.
- **La corbeille ne supprime pas** : une suppression depuis l'administration
  pose `deletedAt`, et la ligne reste en base jusqu'à la purge (30 jours par
  défaut) ou jusqu'à une suppression définitive confirmée par jeton.
