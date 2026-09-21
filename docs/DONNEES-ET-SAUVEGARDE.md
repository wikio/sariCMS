# Données et sauvegarde — où vit chaque information

Document d'exploitation : ce qui est en base MySQL, ce qui est sur fichier, ce
qui n'est que dans le navigateur, et quoi emporter dans une sauvegarde.

Tout ce qui suit a été relevé dans le code, pas déduit. Les chemins et les noms
de tables sont ceux du dépôt au moment de la rédaction.

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

`lib/shop-store.ts` :

```
COUPON_KEY = 'sari_coupons'       → localStorage
USE_KEY    = 'sari_coupon_uses'   → localStorage
```

`saveCoupons()` fait un `localStorage.setItem`, et c'est tout. La page
`app/[locale]/admin/coupons/page.tsx` n'appelle **aucune** API : elle lit
`loadCoupons()` au montage et écrit `saveCoupons()` à chaque modification. Il
n'existe ni modèle `Coupon` dans `backend/prisma/schema.prisma`, ni module
`coupons` dans `backend/src/modules/`.

### Ce qu'un coupon contient

`interface Coupon` (`lib/shop-store.ts:17`) — dix-sept champs :

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | chaîne | identifiant local |
| `code` | chaîne | ce que saisit le client |
| `type` | `fixed` \| `percent` | montant fixe ou pourcentage |
| `amount` | nombre | valeur du `type` |
| `maxDiscount` | nombre ? | plafond en mode pourcentage |
| `minOrder` | nombre ? | panier minimum |
| `start`, `end` | chaînes | fenêtre de validité |
| `limitGlobal` | nombre ? | nombre total d'utilisations |
| `limitPerClient` | nombre ? | par client |
| `used` | nombre | compteur d'utilisations |
| `scope` | `all` \| `category` \| `product` | périmètre |
| `scopeValues`, `excludeValues` | tableaux | inclusions / exclusions |
| `stackable` | booléen | cumulable |
| `active` | booléen | activé |
| `revenue` | nombre | chiffre d'affaires attribué |

Chaque utilisation est tracée à part (`CouponUse` : coupon, commande, client,
email, date, remise) dans `sari_coupon_uses`.

### Ce qui, malgré tout, atteint MySQL

Le **catalogue** de coupons n'est pas en base, mais **l'effet d'un coupon sur un
document** l'est. Les tables `orders` et `quotes` portent :

```
coupon          String?                  -- le code saisi
couponDiscount  Decimal?  @db.Decimal(14,2)   -- la remise accordée
```

Autrement dit : on retrouve dans MySQL *quelle* remise a été appliquée à *quelle*
commande, mais pas la définition du coupon qui l'a produite. Si le poste qui a
créé le coupon est perdu, les commandes historiques gardent leur montant mais le
coupon, lui, n'est plus reproductible.

### Conséquence pratique

Un coupon créé aujourd'hui n'est visible que par le navigateur qui l'a créé. Un
autre administrateur, sur un autre poste, ne le voit pas. Deux postes qui
créent des coupons chacun de leur côté ne les partagent pas, et le dernier
`saveCoupons()` du poste A n'écrase rien chez B — ils ont deux catalogues
distincts qui ne se rencontrent jamais.

---

## 2. Ce qui est dans MySQL

Vingt-neuf tables, déclarées dans `backend/prisma/schema.prisma`.

| Groupe | Tables | Contenu |
| --- | --- | --- |
| Comptes | `users`, `roles`, `permissions`, `role_permissions` | identités, rôles, droits |
| Jetons | `refresh_tokens`, `password_reset_tokens` | sessions longues, réinitialisation |
| Contenus | `pages`, `news_articles`, `faqs`, `testimonials`, `menus`, `events`, `home_sections`, `hero_slides` | éditorial et structure de la vitrine |
| Catalogue | `products`, `services`, `partners`, `solutions`, `careers`, `job_applications` | offres et recrutement |
| Commerce | `orders`, `quotes` | commandes et devis, dont `coupon` et `couponDiscount` |
| Relation | `contact_info`, `contact_messages`, `newsletter_subscribers` | coordonnées et inscriptions |
| Réglages | `settings`, `translations`, `audit_logs` | clés/valeurs JSON, traductions, journal |

Deux tables méritent une note :

- **`settings`** est un magasin clé/valeur JSON. Elle porte notamment la
  visibilité du site (module `visibility`) et les réglages de maintenance
  (rétention de l'audit, planifications des purges, clé `maintenance`).
- **`audit_logs`** journalise chaque création, modification, suppression,
  restauration et purge. Sa charge utile est bornée (chaînes tronquées à
  500 caractères, objets volumineux résumés) et sa rétention est configurable —
  30 jours par défaut.

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

`localStorage` du poste de l'administrateur. Aucune de ces clés n'a
d'équivalent côté serveur, sauf mention contraire.

| Clé | Contenu | Serveur ? |
| --- | --- | --- |
| `sari_coupons` | **catalogue de coupons** | non |
| `sari_coupon_uses` | utilisations de coupons | non |
| `sari_taxes` | **règles de TVA et taxes** | non |
| `sari_shop_config` | zones de livraison, frais, remise globale | non |
| `sari_payments` | modes de paiement proposés | non |
| `sari_payment_records` | **enregistrements de paiement** | non |
| `sari_currencies` | devises | non |
| `sari_taxonomies` | taxonomies | non |
| `sari_admin_settings` | réglages de l'écran Paramètres | non |
| `sari_users_registry` | annuaire local | non |
| `sari_orders`, `sari_quotes`, `sari_applications` | copies locales | **oui** — synchronisés |
| `sari_site_visibility` | copie locale | **oui** — table `settings` |
| `sari_cart`, `sari_theme`, `sari_sku_seq` | panier, thème, séquence | non, sans enjeu |

Seules trois ressources sont réellement synchronisées avec l'API
(`lib/crm-sync.ts`, `RESOURCES`) : **commandes, devis et candidatures**. Le
reste de cette colonne est local.

Conséquences à connaître :

- Les **règles de TVA** étant locales, le montant de taxe recalculé par
  l'écran d'une commande dépend du poste qui l'ouvre. Le montant *stocké* sur la
  commande, lui, est en base.
- Les **enregistrements de paiement** (validé / en attente / rejeté, avec leur
  motif) ne quittent pas le poste. C'est un point de vigilance comptable.
- Un nettoyage des données de site, un poste remplacé, ou un simple autre
  navigateur : tout cet étage repart des valeurs par défaut.

---

## 5. Que mettre dans une sauvegarde

Dans l'ordre d'importance :

1. **La base MySQL** — `mysqldump` de toutes les tables. C'est le cœur :
   contenus, commandes, comptes, audit.
2. **`public/uploads/`** — tous les médias. Sans lui, la base restaurée pointe
   des images absentes.
3. **`data/mail/`** — configuration et gabarits du centre de courrier, plus
   l'historique d'envoi.
4. **`backend/storage/mail/smtp.json`** — sinon l'envoi repart en mode
   « fichier » sans avertissement autre qu'une ligne de log.
5. **Les exports manuels de l'étage navigateur** — voir ci-dessous.

### Récupérer l'étage navigateur

Il n'existe pas d'export automatique. Depuis le poste qui a saisi les données,
dans la console du navigateur, sur une page de l'administration :

```js
copy(JSON.stringify({
  coupons:   JSON.parse(localStorage.getItem('sari_coupons')   || '[]'),
  uses:      JSON.parse(localStorage.getItem('sari_coupon_uses')|| '[]'),
  taxes:     JSON.parse(localStorage.getItem('sari_taxes')     || '[]'),
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

- **Les coupons, taxes, devises, taxonomies, modes et enregistrements de
  paiement n'ont aucune sauvegarde automatique.** C'est le risque principal de
  perte du projet. Une migration de ces données vers MySQL supprimerait le
  problème ; elle n'est pas faite à ce jour.
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
