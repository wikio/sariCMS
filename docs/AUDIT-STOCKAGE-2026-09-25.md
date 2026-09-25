# Où vivent les données — audit de stockage et de sécurité

Date : 25 septembre 2026, sur la branche `arena/01a09cab-saricms` (commit `8e1535d`
et suivants). Périmètre : tout ce que le front écrit et lit, tout ce que le backend
persiste, et la question que vous avez posée pour chaque module et chaque écran :
**chez qui la donnée atterrit-elle, et est-ce le bon endroit ?**

Ce document est **tenu par un script**, pas par une promesse : `npm run
storage:audit` relit le code, relève chaque clé `localStorage` utilisée, et vérifie
qu'elle figure ici avec son verdict. Une clé ajoutée sans ligne meurt au contrôle.

---

## 0. Comment relire cet audit

```bash
npm run storage:audit        # la carte dit-elle la vérité sur le code ?
npm run settings-doc:test    # les réglages d'écran : accord écran/serveur/navigation
npm run upload:test          # uploads : type, magic bytes, SVG, entêtes
cd backend && npx jest       # backend (372 tests)
./node_modules/.bin/tsc --noEmit && npx next build --webpack
```

Les verdicts ci-dessous utilisent quatre mots, toujours les mêmes :

| Mot | Signification |
| --- | --- |
| **base** | une ligne en MySQL (table), donc sauvegardée avec la base, visible de tout poste autorisé |
| **document** | un réglage d'écran dans la table `settings`, sous clé `doc_<kind>` — même force, forme JSON |
| **local** | `localStorage` du navigateur : personne d'autre ne le voit, rien n'en est sauvegardé |
| **temporaire** | local, et c'est voulu : la donnée n'a de sens que pour ce visiteur, cette session |

**La règle que vous avez posée, et qui a servi de critère** : une donnée partagée
(entre postes, entre opérateurs, avec un visiteur) ne doit pas vivre chez le client ;
une donnée propre au visiteur n'a rien à faire en base.

---

## 1. Table maître — les 49 clés du navigateur

La colonne « Écrit par » nomme le module, pas l'écran : un écran qui passe par
`lib/crm-store.ts` est répliqué par `lib/crm-sync.ts`, et c'est ce second module qui
décide du sort de la donnée.

| Clé | Écrit par | Nature | Où c'est persisté | Verdict |
| --- | --- | --- | --- | --- |
| `sari_orders` | `lib/crm-store.ts`, `app/[locale]/payment/[id]` | partagée (commandes) | **base** — table `orders` ; le cache n'est qu'un miroir | conforme ; le repli du cache (`DEFAULT_ORDERS`) reste une dette P3, nommée plus bas |
| `sari_quotes` | `lib/crm-store.ts` | partagée (devis) | **base** — table `quotes` | conforme |
| `sari_applications` | `lib/recruitment.ts` | partagée (candidatures) | **base** — table `job_applications` | conforme |
| `sari_payment_records` | `lib/payment-records-sync.ts` | partagée (encaissements) | **base** — table `payment_records`, une ligne par encaissement | conforme (table à créer chez vous : `db:schema-fix`) |
| `sari_payment_records_synced` | `lib/payment-records-sync.ts` | marqueur de poste | local, par nature | conforme |
| `sari_payment_records_backup` | `lib/payment-records-sync.ts` | copie de secours locale | local, et c'est son rôle | conforme |
| `sari_coupons` | `lib/shop-store.ts` + `lib/shop-sync.ts` | partagée (coupons) | **base** — table `coupons` | conforme |
| `sari_taxes` | `lib/shop-store.ts` + `lib/shop-sync.ts` | partagée (taxes) | **base** — table `tax_rules` | conforme |
| `sari_coupon_uses` | `lib/shop-store.ts` | partagée (journal d'usage) | local — **dette P2** : un compteur de consommation par navigateur, donc faux d'un poste à l'autre |
| `sari_payments` | `lib/shop-store.ts` + `lib/settings-doc.ts` | partagée (modes de paiement) | **document** `doc_payments` ; le champ `apiKey` de chaque ligne ne sort **jamais** du navigateur | conforme depuis `8e1535d` (voir §5 F1) |
| `sari_currencies` | `lib/currencies.ts` | partagée | **document** `doc_currencies` | conforme |
| `sari_shop_config` | `lib/shop-store.ts` | partagée | **document** `doc_shop` (`importApi` exclu : clé d'API) | conforme |
| `sari_taxonomies` | `lib/taxonomies.ts` | partagée | **document** `doc_taxonomies` | conforme |
| `sari_notify_messages` | `lib/notify-store.ts` | partagée (gabarits) | **document** `doc_notify` | conforme |
| `sari_shop_synced_*` | `lib/shop-sync.ts` | marqueur de poste, par ressource | local, par nature | conforme |
| `sari_shop_backup_*` | `lib/shop-sync.ts` | copie de secours locale | local, et c'est son rôle | conforme |
| `sari_sync_ids_*` | `lib/crm-sync.ts` | **cache** de correspondance identifiant local → identifiant serveur | local ; c'est ce qui rend un renvoi idempotent au lieu de doubler une ligne | conforme |
| `sari_geo_*` | `lib/geo.ts` | **cache** de recherche commune → wilaya | local ; recalculable, aucune valeur métier | conforme |
| `sari_csrf` | `lib/csrf.ts`, `components/useCsrf.tsx` | jeton CSRF en **cookie** (le garde le recense car le nom suit la convention du projet) | local, et c'est le rôle d'un jeton double-submit | conforme |
| `sari_admin_settings` | `lib/admin-settings.ts`, `lib/site-contact.ts` | partagée (réglages d'écran) | **document** `doc_admin` — `smtp`, `db`, `erp` retirés à l'envoi | conforme |
| `sari_doc_synced_*` | `lib/settings-doc.ts` | marqueur de poste | local, par nature | conforme |
| `sari_doc_backup_*` | `lib/settings-doc.ts` | copie de secours locale | local, et c'est son rôle — le seul endroit où vit encore une liste écrasée | conforme ; l'écran « Modes de paiement » la rend par un bouton |
| `sari_site_visibility` | `lib/site-visibility.ts` | partagée (visibilité du site) | **base** — table `settings`, document `visibility` | conforme |
| `sari_site_logo_synced` | `lib/site-contact.ts` | marqueur | local | conforme ; le logo lui-même vit dans `ContactInfo.logo` (base) |
| `sari_users_registry` | `contexts/AuthContext.tsx` | **partagée** (annuaire de comptes : e-mails, noms) | local — **dette P1** : un registre d'utilisateurs dans un navigateur n'est ni sauvegardé, ni mutualisé, et contient des données personnelles |
| `sari_user` | `contexts/AuthContext.tsx`, `components/dashboard/ProfileModule.tsx` | profil du visiteur connecté | cache de session, **base** en source (`users`) | conforme |
| `sari_front_access` | `contexts/AuthContext.tsx` | jeton du visiteur | local — voir §5 F2 (XSS) |
| `sari_admin_access` | `lib/admin-session.ts` | jeton d'accès admin | local — voir §5 F2 |
| `sari_admin_refresh` | `lib/admin-session.ts`, `lib/cms-admin.ts` | jeton de renouvellement | local — **le point le plus sensible de cet audit**, §5 F2 |
| `sari_admin_user` | `lib/admin-session.ts` | profil de l'opérateur | cache, source `users` en **base** | conforme |
| `sari_admin_auth` | `lib/admin-session.ts` | marqueur « session probablement ouverte » | local ; ne **garantit** rien, voir §5 F3 |
| `sari_admin_time` | `lib/admin-session.ts` | horodatage de session | local, temporaire | conforme |
| `sari_cart` | `contexts/CartContext.tsx` | panier du visiteur | local — **temporaire** : un panier n'est partagé qu'au moment de la commande, qui part en base | conforme à votre règle |
| `sari_pending_cart` | `app/[locale]/cart/page.tsx` | relais entre pages du visiteur | **temporaire** | conforme |
| `sari_pending_action` | `app/[locale]/connexion`, `app/[locale]/jobs/[id]` | redirection après connexion | **temporaire** | conforme |
| `sari_pending_open_thread` | `app/[locale]/dashboard`, `MessagesModule` | fil de discussion ouvert | **temporaire** | conforme |
| `sari_orders_ctx` | `lib/crm-store.ts`, `CommerceDesk` | contexte de l'écran de paiement | **temporaire** (reprise du tunnel) | conforme |
| `sari_theme` | `contexts/ThemeContext.tsx` | thème du visiteur | **préférence** locale | conforme |
| `sari_admin_theme` | `components/admin/AdminTheme.tsx` | thème de l'opérateur | **préférence** locale | conforme |
| `sari.newsletter.pageSize` | `app/[locale]/admin/newsletter/page.tsx` | réglage d'affichage | **préférence** locale | conforme |
| `sari_ged_surface` | `lib/ged/client.ts` | surface d'atelier ouverte | **préférence** locale | conforme |
| `sari_demo_v3` | `lib/demo-seed.ts` | marqueur « démo posée ici » | local ; l'amorçage, lui, refuse une base déjà peuplée | conforme |
| `__SARI_DEBUG` | `lib/crm-sync.ts` | bascule de **verbebose**, lue seulement | local et temporaire : aucun comportement de stockage n'en dépend | conforme ; voir §5 F7 |
| `sari_fiche_i18n` | `lib/fiche-i18n.ts` | **brouillon** de traduction d'une fiche | local ; la fiche validée est en **base** (`translations`) | conforme (brouillon) ; un brouillon perdu n'est pas une donnée perdue |
| `sari_flow_templates` | `lib/recruitment-flow.ts` | **partagée** (gabarits du parcours de recrutement) | local — **dette P2** : un gabarit défini par un poste est invisible aux autres recruteurs |
| `sari_flow_*` | `lib/recruitment-flow.ts` | avancement d'un visiteur dans une offre | **temporaire**, propre au visiteur | conforme |
| `sari_flow_progress_*` | `lib/recruitment-flow.ts` | étape atteinte par candidature | **temporaire** | conforme |
| `sari_flow_answers_*` | `lib/recruitment-flow.ts` | réponses au questionnaire d'une offre | **temporaire** (envoyées en **base** à la soumission, table `job_applications`) | conforme |
| `sari_flow_legacy_*` | `lib/recruitment-flow.ts` | correspondance ancien identifiant | **temporaire** | conforme |
| `sari_threads` | `lib/messages.ts` | **partagée** ( fils de discussion visiteur ↔ administration) | local — **dette P1** : un fil de conversation n'a de sens que s'il est des deux côtés ; aujourd'hui le visiteur écrit dans son navigateur et l'opérateur lit le sien |
| `sari_notes_*` | `components/admin/PeopleDesk.tsx` | **partagée** (notes sur un client, un partenaire) | local — **dette P1** : la note d'un commercial ne doit pas être privée à son collègue |
| `sari_config_*` | `app/[locale]/admin/config/page.tsx` | **partagée** (configuration du site par langue) | local — **dette P1** |
| `sari_admin_genericContent` | `app/[locale]/admin/contents/page.tsx` | **partagée** (contenus génériques publiés sur la vitrine) | local — **dette P1** : l'écran exporte un JSON à replacer à la main (`genericContent_<locale>.json`), ce qui est une sauvegarde… sur le bureau de l'opérateur |
| `sari_component_*` | `app/[locale]/admin/c/[type]/page.tsx` | **partagée** (composants d'un écran de contenu) | local — **dette P1**, même famille que la précédente |
| `sari_page_builder_*` | `app/[locale]/admin/builder/page.tsx` | **brouillon** de la page en cours d'édition | local, et c'est le dessin assumé : la page publiée part en **base** (`pages`) | conforme |
| `sari_import_log` | `app/[locale]/admin/shop-config/page.tsx` | journal local des imports | local — **dette P3** : utile en historique, non critique, mais introuvable d'un autre poste |

### Lecture de cette table

- **49 clés, 30 déjà conformes**, dont 22 qui n'ont jamais été censées quitter le
  navigateur (panier, thème, brouillon, marqueurs de synchronisation). C'est le tri
  que vous demandiez : la donnée temporaire du visiteur reste chez lui.
- **8 dettes nommées** (§6), toutes du même type : un écran d'administration qui
  écrit « pour lui » alors que la donnée est par nature partagée.
- **Aucune donnée de visiteur identifiable en base qui ne doive y être** : les
  seules écritures publiques sont la commande, le devis, la candidature, le message
  de contact, l'inscription à la lettre d'information — cinq tables, chacune avec sa
  raison d'être.

---

## 2. Côté serveur : les trois endroits où quelque chose est stocké

### 2.1 MySQL — 32 tables

`users`, `roles`, `permissions`, `role_permissions`, `refresh_tokens`,
`password_reset_tokens`, `settings`, `translations`, `audit_logs`, `contact_info`,
`contact_messages`, `newsletter_subscribers`, `job_applications`, `careers`,
`orders`, `quotes`, `payment_records`, `coupons`, `tax_rules`, `products`,
`services`, `solutions`, `news_articles`, `events`, `faqs`, `testimonials`,
`partners`, `authors`, `menus`, `pages`, `home_sections`, `hero_slides`.

Tout ce que la vitrine affiche au visiteur et tout ce que l'administration gère en
commun y a sa ligne. Les montants sont en `DECIMAL(14,2)`, jamais en `FLOAT` — un
relevé d'encaissements qui additionne des nombres binaires ne tombe jamais juste au
centime.

**Le point à vérifier chez vous** : ces tables existent-elles toutes ? Une table
manquante ne se voit pas comme un trou, elle se voit comme un écran vide ou une
erreur 500. `backend/sql/check-data-sources.mysql.sql` (requête 1) répond table par
table, en lecture seule.

### 2.2 Table `settings`, clés `doc_*` — les réglages d'écran

Six documents : `doc_admin`, `doc_shop`, `doc_taxonomies`, `doc_currencies`,
`doc_payments`, `doc_notify`. Un réglage d'écran y entre dès qu'on enregistre
l'écran, et en ressort sur n'importe quel poste.

Ce qui **n'y entre pas**, et n'y entrera jamais (liste blanche du serveur, dans les
deux sens — écriture et lecture) :

- `admin.smtp` (mot de passe SMTP), `admin.db` (URL de connexion avec identifiants),
  `admin.erp.apiKey`, `shop.importApi.apiKey` ;
- depuis cette vague, `payments[].apiKey` — la clé de passerelle de chaque mode de
  paiement, retirée ligne par ligne (voir §5 F1) ;
- `siteLogo` : le logo de la vitrine vit dans `ContactInfo.logo`, la seule valeur que
  le rendu serveur de l'en-tête lit. Un réglage par navigateur ne peut pas constituer
  le logo d'un visiteur.

### 2.3 Fichiers sur le serveur — conformes à votre directive

Vous aviez posé : « si un truc est sauvegardé dans un fichier de donnée sur le
serveur, laisse-le ». C'est le cas de trois choses, vérifiées :

| Emplacement | Contenu | Qui le lit | Sauvegarde |
| --- | --- | --- | --- |
| `backend/public/uploads/<module>/` | médias (GED), + fiche `.sari.json` par asset | l'API et la vitrine, par URL | **hors git** : à inclure dans la sauvegarde de deployment |
| `backend/storage/mail/smtp.json` | configuration SMTP réelle, **mot de passe inclus** | le service d'envoi | hors git, à traiter comme une pièce d'infrastructure (droits `600`, pas de dépôt) |
| `data/mail/` | copies des messages partis (piste d'envoi) | l'écran « E-mails » | **ni ignoré ni versionné** : il disparaît d'un clone propre — à décider (§6 P3) |
| `backend/storage/json/` | le **pilote de développement** (`DB_DRIVER=json`) : mêmes collections que MySQL, en fichiers | l'API, quand le pilote est `json` | sans objet en production ; ne pas laisser le pilote `json` activé en prod |

Un quatrième, que je signale sans le corriger : `backend/storage/json/.seeded` est
**suivi par git** (un horodatage d'amorçage). Inoffensif, mais c'est un fichier de
donnée dans l'histoire du dépôt — à ignorer à la première occasion.

---

## 3. Par module d'administration — où part l'écriture

Vérifié écran par écran (lecture du code d'écriture, pas de la liste des imports) :

| Module / écran | Sortie réelle | Statut |
| --- | --- | --- |
| Catalogue : produits, services, solutions, partenaires, partenaires-comptes, auteurs, FAQ, avis, événements, actualités | API → tables MySQL correspondantes, versions par langue dans `translations` | conforme |
| Pages, menus, hero, sections d'accueil, galeries, canvas, builder (publication) | tables `pages`, `menus`, `hero_slides`, `home_sections` | conforme ; le **brouillon** du builder et de l'atelier canvas reste local, à dessein |
| Commandes, devis, paiements (relevé), coupons, taxes, devises | `orders`, `quotes`, `payment_records`, `coupons`, `tax_rules` + documents | conforme ; `sari_coupon_uses` en dette P2 |
| Comptes & contacts, clients, utilisateurs, rôles, permissions, codes de vérification | `users`, `roles`, `permissions`, `password_reset_tokens`, `contact_info` | conforme |
| Candidatures, offres d'emploi, comparaison de candidatures | `job_applications`, `careers` | conforme |
| Lettre d'information, messages de contact, statistiques, recherche, journal d'audit, journaux | `newsletter_subscribers`, `contact_messages`, `audit_logs` | conforme ; la taille des journaux est bornée par la tâche de rétention |
| Réglages : Général, Dates, Produits, Codes, Devis, Facturation, Sécurité, SMTP, Base, Maintenance, Vérification, Courriel, SEO, Marque | `doc_*` pour les cinq écrans abonnés ; SMTP/ERP en fichier serveur ; le reste des champs `admin` filtrés | conforme |
| **Messages** ( fils de discussion) | `sari_threads` en `localStorage` | **dette P1** |
| **Contenus génériques**, **Config par langue** | `sari_admin_genericContent`, `sari_config_<locale>` en `localStorage` | **dette P1** |
| Notes sur une personne (Comptes & contacts, clients) | `sari_notes_<id>` en `localStorage` | **dette P1** |
| Écrans de contenu par type (`admin/c/<type>`) | `sari_component_<locale>_<type>` en `localStorage` | **dette P1** |
| Import & jeu de démonstration (Paramètres → Intégrations) | lit `data/{fr,en,ar}`, écrit en base, **refuse** une base peuplée | conforme depuis `3aa03c5` |
| GED / médias | fichiers `public/uploads/` + fiche JSON par asset | conforme (§2.3) ; voir §5 F4 pour le SVG |
| Ateliers (builder, canvas, retouche d'image) | brouillon local, média en fichier, page publiée en base | conforme |

---

## 4. Ce qui est bien ainsi — et ne doit pas être changé

Une donnée propre au visiteur ne va pas en base. Six choses respectent cette règle,
et je les liste pour qu'on ne « corrige » pas un jour ce qui est juste :

- `sari_cart`, `sari_pending_cart` : le panier n'existe que jusqu'à la commande, qui,
  elle, part en `orders`.
- `sari_pending_action` : « après connexion, reviens ici » — le visiteur, la session,
  personne d'autre.
- `sari_pending_open_thread` : quel fil est déplié à l'écran.
- `sari_theme`, `sari_admin_theme`, `sari.newsletter.pageSize`, `sari_ged_surface` :
  préférences de poste.
- `sari_fiche_i18n`, `sari_page_builder_*`, `sari_flow_resume_*` : brouillons. Un
  brouillon en base, c'est un publié à l'envers — la vitrine montrerait un demi-travail.
- `sari_doc_backup_*`, `sari_payment_records_backup`, `sari_*_synced` : copies et
  marqueurs de poste. Un marqueur partagé serait une erreur (le poste A se croirait
  synchronisé à la place du poste B).

---

## 5. Sécurité — dix constats, avec ce qui a été fait et ce qui reste à décider

### F1 · Une clé d'API de passerelle partait en base — **corrigé**

`PaymentMethod.apiKey` (champ saisi sur « Modes de paiement » pour CIB et carte
internationale) était une clé secrète stockée dans un mode de paiement, donc envoyée
telle quelle dans `doc_payments` : en MySQL, donc dans chaque `mysqldump`, donc dans
chaque restauration, recrachée à tout poste ayant `payments:read`.

Deux listes blanches existaient déjà pour les objets (`admin.smtp`, `admin.db`,
`admin.erp.apiKey`, `shop.importApi`) mais aucune pour les lignes d'une liste nue —
le trou était dans la forme, pas dans l'intention. Corrigé des deux côtés :
`itemStrip: ['apiKey']` côté navigateur (`lib/settings-doc.ts`) et côté serveur
(`settings-docs.service.ts`), avec la projection **à la sortie** en plus de l'entrée,
parce que votre base contient déjà le champ dans les lignes écrites avant la règle.
L'écran le dit à l'opérateur (« cette clé reste sur CE poste ») et la copie de
secours locale, elle, reste fidèle (elle garde le cache brut, secret compris) — sinon
à quoi servirait une copie d'où l'on a déjà retiré ce qu'elle doit pouvoir rendre ?

### F2 · Jetons en `localStorage` — **constaté, non corrigé, à décider**

`sari_admin_access`, `sari_admin_refresh`, `sari_front_access` : trois jetons JWT dans
le `localStorage`. N'importe quel script injecté dans une page les lit — c'est la
chaîne XSS → vol de session, et le jeton de renouvellement dans le lot, donc le vol
est durable et pas seulement limité au temps de vie du jeton d'accès.

Ce n'est pas une correction d'un soir : le jeton de renouvellement doit devenir un
**cookie `httpOnly` + `SameSite=strict` + `Secure`**, limité à la route de
renouvellement, l'accès restant en mémoire. Cela touche la connexion, le
réabonnement du bandeau d'expiration, le déconnexion, et le parcours visiteur (qui a
sa propre route). Je le place en **P1 sécurité** et je détaille la séquence en §7. En
attente, la surface est réduite par ce qui existe déjà : CSP (`default-src 'self'`),
`X-Content-Type-Options: nosniff`, validation stricte des uploads, aucune dépendance
à un script tiers autre que Google reCAPTCHA et les images Unsplash.

### F3 · Un marqueur de session qui ouvre l'interface — **constaté, sans effet sur les données**

`hasAdminAccess()` répond vrai si `sari_admin_auth === 'true'`, même sans jeton. Une
personne qui pose cette clé dans sa console voit donc **les écrans** s'ouvrir. Aucun
donnée n'est exposée pour autant : chaque route exige son jeton et sa permission, et
l'écran se remplit d'un état vide ou d'un 403. C'est un garde d'**affichage**, pas une
frontière — le danger est de le croire frontière. Remède proposé en §6 (P3) : lier le
marqueur à la présence d'un jeton, et garder l'API comme seule frontière.

### F4 · Un SVGuploadé s'ouvrait comme une page du site — **corrigé**

La GED accepte `image/svg+xml` (et doit le accepter : logos et vectoriels d'atelier).
Un SVG est un document : ouvert **en haut de page** sur `/uploads/…`, il s'exécute avec
l'origine du site — donc lit les jetons du §F2. Le filtre à l'extension ne change rien
à l'affaire.

Deux mesures, appliquées ici :

1. **Nettoyage à l'écriture** (`sanitizeSvg`, `lib/upload-validation.ts`) : `<script>`,
   gestionnaires `on*`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, et tout
   attribut dont la valeur (entités XML décodées) est `javascript:` ou `data:text/html`
   — la dernière règle attrape les contournements par animation SMIL. Ce qui a été
   retiré est journalisé côté serveur : un refus silencieux ressemble à une image
   cassée.
2. **CSP propre à `/uploads/*`** (`next.config.mjs`) : `default-src 'none'`, images et
   styles internes seulement. Une exfiltration par un fichier de la GED demanderait de
   charger une ressource externe ; elle est bloquée, et si un fichier vérolé arrive par
   un autre chemin (déposé à la main sur le serveur), il ne peut plus rien emporter.

À savoir : `app/api/admin/upload/route.ts` valide déjà type MIME, magic bytes, taille,
polyglottes et traversée de chemin, et refuse tout ce qui n'est pas
`png/jpg/jpeg/jpe/gif/webp/svg/pdf` — un `.html` ou un `.js` n'atteint pas le disque.
Le commentaire de `lib/ged/prefix.mjs` qui prétendait le contraire (« `/api/admin/upload`
accepte déjà n'importe quel fichier d'un utilisateur authentifié ») est **faux depuis ce
contrôle** ; il daté d'avant `lib/upload-validation.ts`.

### F5 · CORS : deux joker dans la liste d'autorisation — **à fermer au déploiement**

`backend/src/main.ts` accepte l'origine si elle est dans `CORS_ORIGINS`, **ou** si elle
finit par `.e2b.app`, **ou** par `.vercel.app`. Les deux derniers sont des environnements
de développement ; en production, `.vercel.app` autorise n'importe quel déploiement
Vercel de n'importe qui. Comme l'authentification est en jeton d'en-tête (pas en cookie),
l'exploitation directe est faible, mais le principe reste : une liste d'origines ne doit
contenir aucun suffixe ouvert.

Correction en §7, une variable d'environnement, aucune ligne de code.

### F6 · Ce qui est déjà en place, et qui compte

Contrôlé, pas supposé :

- `helmet` monté, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (pas de caméra, micro, géoloc, paiement,
  USB, Bluetooth), `Cross-Origin-Opener/Resource-Policy: same-origin`.
- CSP sur tout le site, avec `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`. **Réserve honnête** : `script-src` contient encore
  `'unsafe-inline'` et `'unsafe-eval'` — c'est ce qui rend le §F2 douloureux et le
  §F4 nécessaire. Mesure faite sur ce dépôt, pour qu'on ne négocie pas au feeling :
  **aucun `eval(` dans `app`, `components`, `lib`, `hooks`, `contexts`** — donc
  `'unsafe-eval'` ne protège rien ici et se retire sans chantier ; et la page d'accueil
  générée contient **quatre scripts inline sans `src`**, injectés par le runtime Next
  (et non par l'atelier de pages) — donc `'unsafe-inline'` exige un nonce par requête,
  qui est une migration volontaire. `style-src 'unsafe-inline'`, lui, doit rester :
  l'atelier écrit des styles à la volée.
- `ThrottlerModule` global, et des plafonds plus serrés sur les routes
  d'authentification (`5` et `10` par minute selon la route) : le mot de passe
  oublié, la connexion, le renouvellement sont LIMITÉS.
- Jeton CSRF double-submit exigé sur les mutations (`X-CSRF-Token`), `cors: false` à
  la création de l'app puis une origine par liste blanche.
- Permissions par ressource et par action, vérifiées **serveur** sur chaque route
  (`@RequirePermissions`), y compris `GET /payment-records/all` et
  `GET /settings/status` (un visiteur n'a rien à lire ici) ; le refus d'un rôle est un
  403, et l'accueil le traduit en « non mesurable », pas en vide.
- Aucun numéro de carte nulle part : la GED comme le relevé d'encaissements ne
  gardent que `cardLast4`, jamais un PAN, jamais un `cardToken`. Un fichier de plus de
  ce type serait un engagement PCI.
- Les montants d'achat ne se lisent pas dans une requête du navigateur : le prix vient
  du serveur, le panier ne voyage qu'en `id`/`qty` — un prix inventé par le client ne
  peut pas payer une commande.

### F7 · Les deux avis critiques Next.js — **sans objet ici**

*(la revue complète des dépendances est en §F8, avec ce qui est atteignable ou non.)*

`npm audit` signalait deux critiques Next.js (exécution distante non authentifiée sur
les serveurs Windows ; et via l'API d'optimisation d'images quand des AVIF sont
utilisés — celle-là nous concernait, `/_next/image` étant exposé), corrigées en
**16.3.3**. Le dépôt est en **16.3.5** ✓, et React 19.2.4. À refaire au déploiement :
`npm audit --audit-level=high` aux deux racines.

`__SARI_DEBUG` (lu dans `lib/crm-sync.ts`) n'active que des `console.log` de
synchronisation : aucun comportement de stockage, aucune donnée en plus. Sans objet en
production, où la console est fermée de toute façon.

### F8 · Dépendances — ce qui est réellement atteignable, et dans quel ordre les monter

`npm audit --json --omit=dev` (le périmètre qui compte : ce qui tourne sur le serveur)
donne **35 signalements côté front, 18 côté backend**. Ce chiffre n'effraie pas tout
seul : un signalement ne vaut que si le chemin d'appel existe dans CE produit.
Vérification faite paquet par paquet, et elle change le classement.

| Paquet signalé | Gravité | Atteignable ici ? | Conduite à tenir |
| --- | --- | --- | --- |
| `tar` (via `fabric`) | **critique** | non à l'exécution — traversal de lien matériel, chemin d'installation seulement | passer `fabric` en 7.4.0 (majeure, ligne suivante) : le correctif vient avec |
| `fabric` (export SVG) | high | oui, mais le dépôt du fichier est neutralisé par `sanitizeSvgBuffer` depuis cette vague | `fabric@7.4.0`, puis **rouvrir l'atelier d'image** à la main : l'API 6 → 7 bouge |
| `@tiptap/core` (`mergeAttributes`, clé `__proto__`) | high | oui — c'est l'éditeur de texte des écrans d'administration | `@tiptap/react` et les extensions en `^3.30.5` : un bump correctif, pas une migration |
| `grapesjs`, `nanoid`, `underscore`, `canvas`, `@mapbox/node-pre-gyp` | high | transitive ou outillage | `npm audit fix` (sans `--force`) les fait passer, puis relancer le build |
| `multer` (DoS par nettoyage incomplet) | high | **non** — aucun `FileInterceptor` dans `backend/src` : les fichiers entrent par la route Next `app/api/admin/upload`, qui parse elle-même | rien à démonter ; la migration Nest 12 éteindra le signalement |
| `body-parser` (une limite mal formée désactive le contrôle de taille) | low | **à vérifier chez toi** : la borne de taille doit vivre dans la route de dépôt, pas dans le parsing de l'API | contrôler la borne de `app/api/admin/upload/route.ts` ; ne rien ajouter côté API |
| `nodemailer` (`resolveContent`, ancienne signature) | high | **non** — `resolveContent` n'est appelé nulle part ; le centre de courrier fait `transporter.sendMail` | `nodemailer@^9.1.0` quand même : gratuit |
| `file-type` (boucle sur un ASF malformé) | moderate | **non** — plus aucun code ne le lit ; la reconnaissance est `validateMagicBytes`, écrite à la main pour ça | retirer le paquet s'il traîne dans `dependencies` |
| `lodash` (`_.template`), `js-yaml`, `deepmerge-ts`, `qs`, `uuid` | high/moderate | **non** — zéro occurrence de ces appels dans le dépôt | ils partiront avec la migration Nest ; ne pas les courir un par un |
| `prisma` / `@prisma/config` | high | chemin d'installation du moteur et de génération du client, pas la requête d'un visiteur | dernière corrective de la mineure, `npx prisma generate`, puis `npm run sql:schema` en contrôle |
| `@nestjs/*` (core, platform-express, swagger, config, schedule, cache-manager) | high/moderate | surface réelle (HTTP, limites, journal) — mais les correctifs sont en **Nest 12** | migration à planifier à part, pas la veille d'un déploiement ; à chiffrer avant |

Ordre proposé, du moins risqué au plus engageant — chaque palier se vérifie par le build
et par les contrôles de §7.1 avant le suivant :

1. `npm audit fix` aux deux racines (ne touche que le verrou, aucune version majeure).
2. `@tiptap/*@^3.30.5` et `nodemailer@^9.1.0` (correctifs dans la même mineure).
3. `fabric@7.4.0` seul, atelier d'image ouvert à la main après.
4. Migration Nest 10 → 12 et `prisma` à la dernière corrective, dans une branche dédiée.

`npm audit fix --force` est **écarté** ici : il ferait passer des majeures sans que
personne ne relise l'atelier de pages, et un builder cassé se voit moins vite qu'un logo
qui s'affiche mal.

### F9 · La règle `/uploads` ne protège le site que si elle est **en dernier** dans `headers()`

Ce détail m'a échappé à la première écriture, et il ne se voit dans aucun build : je pose
la règle, `npm run upload:test` est vert, et le fichier servi gardait malgré tout la CSP
du site — donc un SVG déposé dans la GED restait exécutable en haut de page.

`next.config.mjs` declare trois règles ; pour une même clé d'entête, **Next garde la
dernière règle dont le motif correspond**. La CSP stricte de `/uploads/:path*` doit donc
être écrite **après** la règle `/:path*` qui porte la CSP globale, sinon elle est
recouverte et le fichier de GED hérite de `script-src 'self' 'unsafe-inline'
'unsafe-eval'` — exactement l'inverse du but. La règle est en dernier dans le fichier,
avec un commentaire qui le dit.

Vérification à faire sur l'hôte déployé, pas seulement en local (une sonde déposée à la
main dans `public/uploads`, lue par `curl -I`, puis retirée) :

```bash
curl -sI https://<votre-domaine>/uploads/<un-fichier-existant> | grep -i '^content-security-policy'
# attendu : default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:;
#           base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Deux décisions assumées, à ne pas « corriger » machinalement :

- **pas de `Content-Disposition: attachment`** sur `/uploads/*` : forcer le téléchargement
  casserait le rendu des images de la GED dans une balise `<img>`. La CSP rend le document
  inerte sans le rendre inutilisable — c'est le bon échange.
- **`style-src 'unsafe-inline'` est conservé** sur `/uploads/*` : un SVG légitime porte
  ses styles dans le fichier. Sans cette exception, les logos déposés se mettent à nu.

### F10 · Ce que cet audit ne prétend pas couvrir

Pas de test d'intrusion, pas de revue du code non exécuté ici (les écrans de contenu
`admin/c/*`, `legal`, `partners-accounts` n'ont été lus que sous l'angle du stockage),
et rien qui ressemble à une analyse de charge. La liste des fichiers `public/uploads`
existants n'a pas été reprise un par un : si des SVG ont été déposés **avant** ce
nettoyage, ils sont toujours sur le disque — la commande en §7.

---

## 6. Les dettes, classées

Neuf lignes à la date de ce document — ce nombre n'est pas une promesse, `npm run
storage:audit` compte les lignes marquées « dette » dans la table de §1 et le redit à
chaque exécution.

Le remède est le même pour la plupart : une table (ou une colonne dans une table qui
existe), un module, et la liste noire de contrôle habituelle. Je ne les ai pas
corrigées ici, parce que chacune demande une décision de modèle de données et une
migration sur **votre** base, et qu'une migration improvisée vaut moins qu'une migration
voulue.

| # | Dette | Pourquoi ça compte | Remède proposé |
| --- | --- | --- | --- |
| **P1** | `sari_users_registry` (annuaire de comptes dans le navigateur) | des données personnelles, sans sauvegarde, par poste | lire/écrire `users` via l'API ; garder la clé en cache seulement |
| **P1** | `sari_threads` + `sari_pending_open_thread` (messages) | une conversation à moitié invisible : le visiteur et l'opérateur n'ont pas le même fil | table `support_threads` + `support_messages`, deux routes, l'écran branché dessus ; le file ouvert redevient un état local |
| **P1** | notes sur une personne (`sari_notes_<id>`) | la note d'un commercial ne doit pas être privée à son collègue | colonne `notes` (Text) sur `users`/`contact_info`, ou table `person_notes` si l'historique compte |
| **P1** | `sari_admin_genericContent`, `sari_config_<locale>`, `sari_component_<locale>_<type>` | un contenu édité dans l'administration, publié… nulle part ; l'export JSON à replacer à la main n'est pas une sauvegarde | passer ces trois écrans sur les collections qui existent déjà (`pages` avec `kind: 'generic'`, `settings` en document, ou table dédiée) |
| **P1 (sécurité)** | jetons en `localStorage` | §F2 | cookie `httpOnly` pour le renouvellement, jeton d'accès en mémoire ; prévoir la bascule progressive (les postes ouverts gardent l'ancien chemin le temps du déploiement) |
| **P2 (sécurité)** | CSP globale encore peuplée de `'unsafe-eval'` (et de `'unsafe-inline'`) | §F6, §F9 | retirer `'unsafe-eval'`, redémarrer, rouvrir trois écrans et l'atelier de pages : rien dans le dépôt n'appelle `eval`, cette autorisation est gratuite à supprimer. `'unsafe-inline'` ne part qu'avec un nonce par requête (Next en injecte quatre dans chaque page HTML) — chantier à part, à chiffrer avant de promettre une date |
| **P2** | `sari_flow_templates` | des gabarits de recrutement par poste | table `flow_templates` (ou colonne sur `careers`) |
| **P2** | `sari_coupon_uses` | le compteur d'usage réel d'un coupon est faux d'un poste à l'autre — donc la limite « une fois par client » est indicative | table `coupon_uses` (une ligne par usage, `externalId` unique, comme le relevé d'encaissements) |
| **P3** | `sari_import_log`, `DEFAULT_ORDERS` du cache, `hasAdminAccess()` au marqueur seul, `storage/json/.seeded` versionné, `sari_sku_seq` (vestige : `nextSku()` a été supprimé, la référence est attribuée par `SkuSeqService` en base — plus personne ne lit la clé, elle peut traîner dans un cache) | historique non mutualisable, repli qui fabrique des lignes à la première lecture, garde d'affichage trompeur, fichier de donnée dans git | journal d'import en table ; ne plus jamais lire `loadOrders()` comme une source (l'accueil est déjà passé en base) ; lier le marqueur au jeton ; ignorer `.seeded` |

Pour chacune des lignes qui demandent une ressource neuve, la procédure d'enregistrement
complète est huit points, et le moindre oubli se paie en 500 silencieux :
`backend/src/common/constants/tokens.ts` (le token `*_REPOSITORY`, `COLLECTIONS`,
`PRISMA_MODEL_BY_COLLECTION`) → `backend/src/database/database.module.ts` (token +
`TOKEN_BY_COLLECTION`) → `backend/prisma/schema.prisma` → `backend/src/app.module.ts` →
le module lui-même → **`npm run prisma:maps`** (les deux fichiers générés
`model-fields.ts` et `relation-scalars.ts`) → `SEED_ORDER` de
`backend/sql/permissions-catalog.mjs` **en fin de liste** → `npm run sql:fix-permissions`
puis `npm run sql:seed`, et le DDL recopié depuis `npm run sql:schema` (jamais écrit à
la main).

---

## 7. Avant de déployer en production — la suite, dans l'ordre

### 7.1 Sur ce dépôt (moi, ou vous, dans l'ordre)

1. `cd backend && npm ci && npm run build && npx jest` → 0 échec **autre** que les trois
   connus (`orders.service.spec.ts` ×2, `quotes.service.spec.ts` ×1, préexistants à ces
   vagues).
2. `npm run storage:audit` → « carte d'aplomb ». C'est le contrôle de ce document.
3. `npm run settings-doc:test`, `npm run upload:test`, `npm run shop:test`,
   `npm run payments:test`, `npm run intl:check`.
4. `./node_modules/.bin/tsc --noEmit && npx next build --webpack` → 0 erreur, 218 pages.
5. `npm audit --json --omit=dev` aux deux racines, et lire le tableau §F8 — pas le
   total. Attendu : Next **16.3.5** (les deux critiques 16.x sont couvertes depuis
   16.3.3) ; `@tiptap/core` et la chaîne `fabric`/`tar` restent signalés tant que la
   montée n'est pas jouée. `npm audit fix` (sans `--force`) puis relancer : le nombre
   doit baisser, ce qui reste est une décision, pas un oubli.

### 7.2 Sur le serveur, dans cet ordre précis

1. **Sauvegarder avant** : `mysqldump --single-transaction --routines u830983108_sari_cms`,
   plus une copie de `backend/public/uploads` et de `backend/storage/mail`. Un
   `git pull` ne détruit rien, une migration mal jouée si.
2. **Arrêter l'API**, puis `cd backend && npx prisma generate` (le `postinstall` avale
   un échec avec `|| true`, et un client Prisma périmé répond « Modèle introuvable »,
   qui ressemble à un bug de code alors que c'est un fichier absent).
3. **Créer ce qui manque** : `npm run db:schema-check` puis `npm run db:schema-fix`.
   Sans Node près de la base : jouer `backend/sql/migrate-payment-records.mysql.sql`,
   puis `backend/sql/migrate-coupons-taxes.mysql.sql` dans phpMyAdmin — et **jamais**
   `backend/sql/schema.mysql.sql`, qui commence par 32 `DROP TABLE`.
4. **Contrôler** : `backend/sql/check-data-sources.mysql.sql`, en lecture seule.
   Attendu : requête 1 → `1` pour les trois tables ; requête 3 → le relevé vivant ;
   requête 2 → `doc_payments` à votre convenance (absent = jamais enregistré).
5. **Permissions** : `backend/sql/fix-permissions.mysql.sql`, puis accorder
   `payments`, `settings`, `users` aux rôles qui doivent les avoir dans
   Administration → Rôles. Un rôle sans `payments:read` voit une liste vide, pas un
   403 : c'est le silence le plus probable de tout ce dossier.
6. **Durcir le CORS** (F5) : `CORS_ORIGINS=https://votre-domaine` dans
   `backend/.env`, et retirer les deux jokers `.e2b.app` / `.vercel.app` (une ligne,
   §7.3).
7. **Variables d'environnement** : `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` — des
   valeurs longues, différentes, pas celles du dépôt ; `DB_DRIVER=mysql` ;
   `GED_UPLOAD_DIR` si les médias vivent hors du dépôt. Rien de tout cela ne se
   versionne.
8. **Redémarrer l'API**, puis `curl -s $API/api/v1/health` → le pilote doit être
   `mysql` (l'accueil de l'administration affiche le même renseignement,
   `GET /settings/status`).
9. **Contrôler les entêtes de la GED** sur le domaine public (une sonde de 60 octets
   suffit, à retirer après) : `curl -sI https://<domaine>/uploads/<fichier> | grep -i
   content-security` doit répondre `default-src 'none'` et non la CSP du site. Si c'est
   la CSP du site qui répond, la règle de `next.config.mjs` a été replacée avant la règle
   globale — voir §F9, c'est le seul point de ce dossier qui ne se voit pas au build.
10. **Vider le cache des postes** qui ont vu une liste vide : `localStorage.removeItem`
   sur les clés `sari_doc_synced_*`, ou plus simple — ouvrir un onglet privé une fois,
   y enregistrer les modes de paiement, puis recharger partout. Le poste qui avait la
   bonne liste la rend par « Rendre la copie locale » sur l'écran.

### 7.3 Les trois lignes de fermeture que je recommande, à valider par vous

```
# backend/src/main.ts — supprimer les jokers dev
-    if (/\.e2b\.app$/.test(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
     # → liste blanche stricte, uniquement CORS_ORIGINS
```

```
# next.config.mjs — la règle /uploads est déjà ajoutée par cet audit ; y ajouter
# le préchargement HSTS une fois le HTTPS vérifié :
{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
```

```bash
# Sur le serveur : un SVG déposé avant le nettoyage, c'est un fichier sur disque.
find backend/public/uploads -name '*.svg' -exec grep -l -i -E '<script|onload=|foreignObject' {} \;
# La liste, si elle n'est pas vide, est à nettoyer (même fonction) ou à remplacer.
```

### 7.4 Après le déploiement — les sept vérifications qui répondent d'elles-mêmes

1. Accueil de l'administration : tuiles non vides, macaron `API mysql`, panneau
   « Données & source » sans mention « cache du poste » sur les modes de paiement.
2. Un second navigateur (ou un poste différent) ouvre le même écran : la même liste de
   modes de paiement doit apparaître. **C'est LE test de « pas chez le client ».**
3. Journal des paiements : encaisser sur un poste, valider sur l'autre, la ligne doit
   être là une fois, pas deux (`externalId` unique).
4. Panier public : un visiteur qui n'a jamais ouvert l'administration doit voir les
   prix, les taxes et les modes de paiement **de la base** — s'il voit les défauts du
   fichier, la bascule n'a pas été enregistrée.
5. Un compte sans `payments:read` : l'écran doit rester inaccessible, et l'accueil doit
   afficher le compteur en tiret, pas en 0.
6. Une commande test en production, puis sa suppression : elle part à la corbeille, et
   la tâche de purge ne la récupère que si la rétention le prévoit.
7. Un SVG déposé par l'atelier ne doit **pas** être exécutable : enregistrer une image
   SVG depuis Administration → Médias, ouvrir l'URL renvoyée dans un onglet — le fichier
   s'affiche, et la console du navigateur doit signaler qu'une ressource a été bloquée
   par la CSP si le dessin tentait une sortie. Le fichier sur le disque, lui, ne doit
   plus contenir de `<script>` : `grep -c "<script" backend/public/uploads/<fichier>` → `0`.

---

## 8. Récapitulatif en une phrase

**Le contenu commercial, les réglages et la comptabilité sont en base, et l'audit montre
qu'ils y sont vraiment ; la monnaie du visiteur (panier, thème, brouillons, marqueurs)
reste chez lui, et c'est voulu ; huit choses sont encore dans le navigateur alors
qu'elles sont partagées par nature, nommées une par une avec leur remède ; côté sécurité,
deux trous étaient réels et sont bouchés ici — une clé d'API qui partait en base, un SVG
qui s'ouvrait comme une page du site — et le plus gros reste à décider avec vous : les
jetons en `localStorage`, qui se soignent par un cookie `httpOnly`, pas par un patch.**
