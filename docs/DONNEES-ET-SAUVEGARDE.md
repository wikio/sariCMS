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
| **MySQL** | Contenus, catalogue, commandes, devis, candidatures, comptes, rôles, permissions, pistes d'audit, réglages de visibilité, de maintenance et de marque, coupons, taxes, **réglages des écrans d'administration** (table `settings`, clés `doc_*`) et **numérotation des références produits** (clé `sku_seq`) | `mysqldump` |
| **Fichiers du serveur** | Médias (`public/uploads`), réglages SMTP, centre de courrier, SEO, newsletter, vérification | copie des dossiers |
| **Navigateur de l'administrateur** | **Journaux non transférés** : encaissements, utilisations de coupons, imports, compteur de références produits, annuaire, notes par personne, contenus d'édition | **aucune** — voir §4 |

> ⚠️ Le troisième étage s'est réduit mais n'a pas disparu. Ce qu'il reste n'est pas
> un réglage recopié : ce sont des **entrées ajoutées les unes après les autres**,
> qui n'ont pas de table et se perdent au vidage des données du site — changer de
> navigateur, de poste, ou de profil, les efface. Le défaut le plus grave de cette
> liste, la référence produit double, est traité à part (§4 B bis).

> Les réglages d'écran (devises, taxonomies, modes de paiement, configuration
> boutique, Paramètres, gabarits de notification) vivent en base depuis cette
> vague, sous forme d'un document JSON par écran. Le `localStorage` n'en garde
> qu'un cache d'affichage, résolu §4 B.

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

## 4. Inventaire complet de `localStorage`

Vue d'ensemble, clé par clé, de ce que le navigateur de l'administrateur ou du
visiteur conserve. La question posée était : *tout ce qui est en `localStorage`
doit-il passer en base ?* — la réponse est non, mais il fallait le vérifier pour
chaque clé au lieu de le supposer.

**Comment retrouver la liste** (un `grep` distrait en rate une catégorie) :

```bash
grep -rhoE "['\`]sari_[A-Za-z_]*" --include=*.ts --include=*.tsx app components lib | tr -d "'\`" | sort -u
```

Le motif couvre les trois écritures : `'sari_x'`, `` `sari_x${id}` `` et les
constantes de clé. S'en tenir à `localStorage.getItem('sari_…')` avait fait passer
à côté de `sari_config_<locale>` — toute la « Configuration du site ».

### A. Cache d'une table — la base fait déjà autorité

| Clé | Cache de | Autorité |
| --- | --- | --- |
| `sari_coupons`, `sari_taxes` | coupons, barèmes de taxe | tables `coupons`, `tax_rules` |
| `sari_orders`, `sari_quotes`, `sari_applications` | CRM | tables correspondantes |
| `sari_site_visibility` | visibilité des pages | table `settings` |
| `sari_orders_ctx` | contexte de la file de commandes | synchronisé |
| `sari_sync_ids_<ressource>` | correspondance d'identifiants local ↔ base | utilitaire |

Vider ces clés ne coûte rien : elles se rechargent (`lib/shop-sync.ts`,
`lib/crm-sync.ts`).

### B. Réglages d'écran — migrés cette fois-ci en documents JSON

Cinq magasins d'configuration n'existaient que sur le poste. Ils vivent désormais
dans la table `settings`, un document par écran, liste blanche de champs à
l'entrée (`backend/src/modules/settings/settings-docs.service.ts`,
`lib/settings-doc.ts`) :

| Clé locale | Document en base | Ce qui reste volontairement local |
| --- | --- | --- |
| `sari_admin_settings` | `doc_admin` | `smtp`, `db`, `erp` (secrets), `siteLogo` (voir C) |
| `sari_shop_config` | `doc_shop` | `importApi` (clé d'API tierce) |
| `sari_taxonomies` | `doc_taxonomies` | rien — l'objet est indexé par taxon, pas par locale |
| `sari_currencies` | `doc_currencies` | rien |
| `sari_payments` | `doc_payments` | rien |
| `sari_notify_messages` | `doc_notify` | rien — les textes des gabarits de notification |

Deux marqueurs accompagnent chaque document : `sari_doc_synced_<kind>` (la date du
dernier échange, seule base de la décision « premier contact ») et
`sari_doc_backup_<kind>` (la copie locale immédiatement avant un rattrapage, donc
réécrite à chaque fois et non datée d'une heure fixe). Ces marqueurs sont locaux par
nature : ils décrivent le poste, pas l'entreprise, et ne se sauvegardent pas.

**Pourquoi les secrets restent-ils hors de la base ?** Parce que migrer le blob tel
quel aurait migré `smtp.pass`, `db.url`, `erp.apiKey` et `importApi.apiKey` dans une
table lue par un endpoint de réglages. Ils sont retirés **côté client avant l'envoi**
et **rejetés côté serveur**, le second filtre ne valant que si le premier a été
contourné : la valeur ne part même pas sur le réseau.

### B bis. Le compteur de références produits, devenu serveur

| | Avant | Maintenant |
| --- | --- | --- |
| Numérotation | `sari_sku_seq` dans le navigateur de chaque poste | ligne `sku_seq` de la table `settings`, groupe `counter` |
| Format | appliqué par le navigateur, depuis son cache | relu dans `doc_admin.codes.product` à l'écriture |
| Référence non fournie | `PRO-` + 5 chiffres de l'horodatage | première référence libre, vérifiée en table |

Le compteur local était le défaut le plus grave de l'inventaire : deux
administrateurs publiaient des produits portant **la même référence**, et
`products.sku` n'a aucune contrainte d'unicité pour la refuser. Le repli du
serveur, `Date.now()` tronqué à cinq chiffres, bouclait toutes les 100 000 ms —
deux créations à environ 1 min 40 s d'intervalle portaient donc déjà la même
valeur.

Trois garde-fous, dans l'ordre où ils interviennent :

- le compteur est **re-calé sur l'existant** à chaque attribution (plus haut
  numéro trouvé parmi les 200 premières références triées) : une base restaurée,
  un poste neuf ou la ligne effacée ne remettent pas la numérotation à 1 ;
- la référence candidate est **contrôlée en table avant insertion**, corbeille
  incluse, et on passe à la suivante si elle est prise ;
- une référence **saisie à la main est conservée** telle quelle — c'est souvent un
  code fabricant ou un code repris de l'ERP, et le réécrire serait pire que le
  défaut combattu ; le compteur est seulement relevé au-dessus.

Mesuré : dix créations lancées en parallèle rendent dix références distinctes
(sous le pilote JSON, un seul processus). La limite est honnête : sous MySQL avec
plusieurs instances, une réservation est une lecture suivie d'une écriture, et
l'abstraction de dépôt ne permet ni `UPDATE … WHERE` ni transaction. Fermer
définitivement cette fenêtre demande une table de compteur contrainte, donc une
migration Prisma — voir §7 et `docs/REPRISE-MYSQL.md` §2.1 ter.

L'écran ne pré-remplit plus le champ « Code produit » : une proposition faite avec
un compteur local serait exactement le défaut supprimé. Le champ reste vide, avec
« Laissé vide → attribué à l'enregistrement ».

La clé `sari_sku_seq` peut subsister dans un cache déjà en place : plus rien ne la
lit.

### C. Relié à une table qui existait déjà — sans nouveau magasin

Le **logo de la vitrine** est le cas qui a déclenché cette vague, et il ne
méritait pas une table de plus :

| Champ | Avant | Maintenant |
| --- | --- | --- |
| Paramètres → logo du site vitrine | `sari_admin_settings.siteLogo`, navigateur | `contact_info.logo` |
| Configuration du site (entière) | `sari_config_<locale>`, navigateur | `contact_info`, lu et écrit en base |

`ContactInfo` portait déjà la colonne `logo`, une ligne par locale, une écriture
`PATCH`, et surtout **la seule lecture que le rendu serveur applique** :
`lib/data.ts:getConfig` → `GET /public/contact?locale=` → l'en-tête et le pied de
page. Un logo écrit dans `localStorage` ne pouvait donc jamais devenir visible pour
le visiteur — il changeait l'apparence sur le seul poste qui l'avait saisi. La
copie locale subsiste comme miroir d'affichage immédiat ; la base décide.

### D. Fichier serveur — laissé là où il est

La consigne était de ne pas déplacer ce qui est déjà persisté côté serveur :

| Fichier | Contenu |
| --- | --- |
| `data/mail/modules.json` | centre de messagerie : modules, gabarits, envois |
| `backend/storage/mail/smtp.json` | configuration SMTP réelle |
| `data/seo.json`, `data/newsletter.json`, `data/verification.json` | réglages et journaux applicatifs |

Ces fichiers sont déjà hors du navigateur : ils survivent au vidage d'un cache et se
sauvegardent avec le serveur. Les basculer en table n'aurait changé ni leur accès ni
leur solidité, et aurait coupé le code qui les lit aujourd'hui.

À ne pas confondre avec `sari_notify_messages`, qui **ressemble** à ces gabarits mais
n'en partage pas le support : l'écran « Messages » écrivait sa liste uniquement dans
le navigateur. Elle est donc migrée en `doc_notify` (section B), et le centre de
messagerie reste sur son fichier.

### E. Non migré, et pour une raison de forme

Cinq magasins n'ont pas été basculés, et ce n'est pas un oubli : **un document JSON
s'écrase au dernier appel**. Or ce sont des journaux en append — chaque entrée doit
rester lisible après la suivante. Ils demandent des **lignes**, donc une migration
Prisma, donc un arbitrage de schéma ; un document les aurait détruits à la longue.

| Clé | Contenu | Ce qu'il faudrait |
| --- | --- | --- |
| `sari_payment_records` | encaissements : validé, en attente, rejeté, motif | table de journal |
| `sari_coupon_uses` | usages par coupon | table de journal |
| `sari_import_log` | imports de catalogue | table de journal |
| `sari_users_registry` | annuaire local de comptes | à arbitrer avec la table `users` |

**`sari_sku_seq` a été traité depuis, et autrement.** Ce n'était pas un journal à
transférer mais un défaut à supprimer : voir §4 B bis.

`globalTaxId` de `sari_shop_config` désigne désormais une taxe **en base** alors que
l'aiguillage vivait dans un cache local : les deux sont maintenant synchronisés, ce
qui ferme une incohérence ancienne entre l'écran de facturation et le moteur de taxe.

### F. Clés qui doivent rester dans le navigateur

Rien à migrer ici — elles décrivent un poste ou une session, pas l'entreprise :
`sari_theme`, `sari_admin_theme` (préférence d'affichage), `sari_admin_time`
(fuseau de l'opérateur), `sari_cart`, `sari_pending_cart`, `sari_pending_action`,
`sari_pending_open_thread` (reprises après connexion), `sari_ged_surface` (vue de
bibliothèque), `sari_user`, `sari_admin_auth`, les cookies
`sari_admin_access` / `sari_admin_refresh` / `sari_admin_user` / `sari_csrf`
(double submission), `__SARI_DEBUG`, `sari_demo_v3` (marqueur d'amorçage).

### G. Écrans d'édition de contenu — hors vague, à arbitrer

Ces clés portent du **contenu**, pas du réglage, et leurs écrans ont une logique
d'enregistrement propre. Un document ne leur convient pas davantage qu'aux journaux :

| Clé | Écran |
| --- | --- |
| `sari_admin_genericContent` | Contenus génériques |
| `sari_component_<locale>_<type>` | Blocs de page |
| `sari_page_builder_<slug>_<lang>` | Constructeur de page |
| `sari_notes_<id>` | Notes sur une personne (`PeopleDesk`) |
| `sari_threads` | Fil de discussion messages |
| `sari_flow_*` (templates, legacy, progress, answers) | Entonnoir de recrutement |
| `sari_fiche_i18n` | Traductions de fiche |
| `sari_geo_<code>` | réponse de géocodage — un cache, pas une donnée |

### Limite assumée : ces documents ne sont pas lus par la vitrine

Les routes `doc/:kind` sont gardées par `settings:read` / `settings:admin`. Les
réglages **partagés avec la vitrine** — formats de date, message de
réapprovisionnement, formats de codes — vivent donc dans le même cache local qu'avant
pour le visiteur : lui continue de voir les valeurs par défaut. Rendre ces valeurs
visibles exige une lecture **serveur** au rendu de la page, étape distincte de
celle-ci et non faite. Le logo, lui, est déjà dans ce cas favorable : sa table est
publiquement lue, ce qui est précisément la raison pour laquelle il y a été mis
plutôt que dans un document.

### Un défaut annexe relevé au passage

`lib/payments.ts:132` installe de **faux encaissements de démonstration** dans le
`localStorage` de toute personne qui ouvre l'écran, administrateur comme visiteur.
Ce n'est pas une perte de données, mais une source de confusion comptable quand les
vrais enregistrements seront en base : la liste affichée pourrait mélanger données
réelles et amorçage. À trancher séparément.

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

**Depuis que les réglages d'écran sont en base, cette extraction ne concerne plus
quatre de leurs magasins.** `sari_shop_config`, `sari_payments`, `sari_currencies`,
`sari_taxonomies` et `sari_notify_messages` se sauvegardent avec la table `settings`
(clés `doc_*`) : les sortir du navigateur serait recopier une valeur que le serveur
connaît déjà, et la réinjecter par `localStorage.setItem` ne déclencherait aucune
synchronisation — le poste partirait en avance sur la base sans jamais le dire.

Ce qui attend encore un export automatique, parce que ce sont des journaux en
append et non des réglages (voir §4 E), reste donc à sauver à la main depuis le
poste qui les détient. Le compteur de références n'en fait plus partie : il est en
base depuis §4 B bis.

```js
copy(JSON.stringify({
  uses:    JSON.parse(localStorage.getItem('sari_coupon_uses')     || '[]'),
  records: JSON.parse(localStorage.getItem('sari_payment_records') || '[]'),
  imports: JSON.parse(localStorage.getItem('sari_import_log')       || '[]'),
  users:   JSON.parse(localStorage.getItem('sari_users_registry')  || '[]'),
}, null, 2));
```

Le JSON est dans le presse-papiers. Le conserver avec les sauvegardes ; pour le
réinjecter sur un autre poste, faire l'opération inverse avec
`localStorage.setItem` — c'est le bon geste **ici**, car ces clés n'ont pas encore
de pendant en base.

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

- **Les réglages sont en base et entrent dans le `mysqldump`** : coupons, taxes,
  et depuis cette vague devises, taxonomies, modes de paiement, configuration
  boutique, écran Paramètres et gabarits de notification (table `settings`,
  clés `doc_admin`, `doc_shop`, `doc_taxonomies`, `doc_currencies`,
  `doc_payments`, `doc_notify`).
  **Restent sans sauvegarde automatique** : enregistrements de paiement,
  utilisations de coupons, journal d'imports, annuaire local. Ce sont des
  journaux, pas des réglages : ils demandent des lignes et une migration, non un
  document — voir §4 E. Le compteur de références produits, lui, est passé en
  base et entre dans le `mysqldump` — voir §4 B bis.
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
