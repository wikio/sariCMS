# SARI CMS — Audit des envois SMTP sortants

> **Date** : 2026-09-18 · **Branche** : `arena/01a09cab-saricms` (base `86ceba0`)
> **Périmètre** : tout ce qui quitte le CMS par email — transport, déclencheurs,
> modèles, configuration, plafonds.
> **Question posée** : quels emails le CMS envoie-t-il réellement, et comment
> améliorer sans jamais « sur-envoyer ».

---

## 1. Méthode

Recensement exhaustif par recherche dans les deux projets (frontend Next.js et
backend NestJS), puis lecture de chaque point d'appel :

```bash
grep -rn "sendMail|mail\.send|MailService|nodemailer|createTransport|/mail/send" \
     --include="*.ts" --include="*.tsx" app components lib backend/src
grep -rn "MailModule" backend/src              # qui importe le module mail ?
grep -rn "@Cron|@Interval|@Timeout" backend/src # envois planifiés ?
```

Résultat de `grep -rn "MailModule" backend/src` : **3 occurrences, toutes dans
`backend/src/app.module.ts` et `mail.module.ts`**. Aucun autre module métier
(contact, applications, orders, quotes, auth, users, newsletter) n'injecte
`MailService`. Il n'existe donc **qu'un seul transport** et **trois
déclencheurs** dans tout le CMS.

---

## 2. Le transport : un seul tuyau

| Élément | Emplacement |
| --- | --- |
| Client d'envoi (navigateur) | `lib/mail.ts:43` — `sendMail()` → `POST /api/v1/mail/send` |
| Endpoint | `backend/src/modules/mail/mail.controller.ts:14-15` — garde `@RequirePermissions(perm('settings','admin'))`, JWT obligatoire (pas de `@Public()`) |
| Validation | `backend/src/modules/mail/dto/send-mail.dto.ts` — `@IsEmail()` sur `to`, `@MaxLength(255)` sur `subject` |
| Transport réel | `backend/src/modules/mail/mail.service.ts:79` — `MailService.send()` → `transporter.sendMail()` (ligne 94) |
| Repli sans SMTP | `mail.service.ts:87` — si `SMTP_HOST` est vide, l'email est **journalisé** dans `backend/storage/mail/outbox.json`, aucun envoi réel |
| Expéditeur | `mail.service.ts:57` — `SMTP_FROM`, sinon `SARI Système <noreply@sarisysteme.com>` |

**Point important et positif** : l'envoi est déclenché **depuis le navigateur
d'un administrateur authentifié**, jamais par un visiteur. Les identifiants SMTP
restent côté serveur (`.env`). Aucun formulaire public (contact, newsletter,
candidature, checkout) ne peut déclencher un email.

---

## 3. Inventaire des envois sortants

### 3.1 Les 3 déclencheurs réels

| # | Déclencheur | Emplacement | Destinataire | Volume |
| --- | --- | --- | --- | --- |
| **1** | Saisie manuelle (écran « Emails ») | `app/[locale]/admin/emails/page.tsx:44` | 1 adresse saisie à la main | 1 par clic |
| **2** | Bouton « Tester l'envoi » d'un modèle | `app/[locale]/admin/messages/page.tsx:317` | adresse demandée par `prompt()` | 1 par clic |
| **3** | Changement de statut commande / devis | `components/admin/CommerceDesk.tsx:248` → `notifyByStatus()` (l. 252-269) | le client de la fiche | 1 par changement de statut, 1 fiche à la fois |

### 3.2 Le seul envoi automatique : `notifyByStatus`

`components/admin/CommerceDesk.tsx:253-255` — correspondance statut → déclencheur :

```ts
kind === 'orders'
  ? { pending: 'order_confirmed', processing: 'order_confirmed',
      shipped: 'order_shipped', delivered: 'order_delivered' }
  : { replied: 'quote_sent', accepted: 'quote_accepted', transformed: 'quote_accepted' }
```

Cinq déclencheurs sont réellement atteignables :
`order_confirmed`, `order_shipped`, `order_delivered`, `quote_sent`,
`quote_accepted`.

### 3.3 Les 8 déclencheurs déclarés vs. utilisés

`lib/notify-store.ts:25` déclare 8 déclencheurs ; `lib/notify-store.ts:38` ne
fournit que 3 modèles par défaut.

| Déclencheur (`lib/notify-store.ts`) | Atteignable ? | Modèle par défaut ? |
| --- | --- | --- |
| `order_confirmed` | oui | oui (`m2`) |
| `order_shipped` | oui | non |
| `order_delivered` | oui | non |
| `quote_sent` | oui | oui (`m3`) |
| `quote_accepted` | oui | non |
| `stock_backorder` | **jamais** (absent de `triggerMap`) | oui (`m1`) |
| `coupon_applied` | **jamais** (0 usage dans tout le code) | non |
| `welcome` | **jamais** (0 usage dans tout le code) | non |

### 3.4 Ce qui n'envoie AUCUN email (vérifié)

| Événement | Code | Email ? |
| --- | --- | --- |
| Commande passée sur la vitrine | `app/[locale]/cart/page.tsx:185` `createOrderAndRedirect()` → `addOrder()` | **non** |
| Demande de devis sur la vitrine | même fonction, `isQuote: true` | **non** |
| Message du formulaire de contact | `backend/src/modules/contact/` (stockage seul) | **non** |
| Candidature déposée | `backend/src/modules/applications/` (stockage seul) | **non** |
| Inscription newsletter | `newsletter.service.ts:68` `subscribe()` | **non** |
| Désinscription newsletter | `newsletter.service.ts:137` `unsubscribe()` | **non** |
| Double opt-in | `newsletter.service.ts:12` — `PENDING_UNTIL_CONFIRM = false` | désactivé |
| Campagne / diffusion newsletter | aucun endpoint (`newsletter.controller.ts` : `report/bulk`, `report/stats`, `report/export`, `:id/status`) | **n'existe pas** |
| 2FA à la connexion | `backend/src/modules/auth/auth.service.ts:183` — TOTP `authenticator` | non (pas d'email) |
| Réinitialisation de mot de passe | aucun code | **n'existe pas** |
| Changement de statut **en lot** | `components/admin/CommerceDesk.tsx:143` `batchStatus()` — n'appelle **pas** `notifyByStatus` | **non** |
| Tâche planifiée | `backend/src/modules/settings/trash-purge.task.ts:18` — seul `@Cron` du projet, purge de corbeille | non |

> **Bilan volumétrique** : à ce jour le CMS n'envoie **que** des emails
> transactionnels déclenchés à la main par un administrateur. Le risque de
> « sur-envoi » n'est pas dans le volume actuel — il est dans les trois défauts
> de `notifyByStatus` (§4.1) et dans l'absence de tout plafond (§4.5).

---

## 4. Anomalies relevées

### 4.1 `[ÉLEVÉE]` Doublons d'envoi — le vrai risque de « trop envoyer »

`components/admin/CommerceDesk.tsx:253-254` mappe **`pending` et `processing`
sur le même déclencheur `order_confirmed`**. Un administrateur qui passe une
commande de « en attente » à « en traitement » renvoie au client un second
« Confirmation de votre commande ».

Il n'existe **aucune idempotence** : `notifyByStatus` ne consulte pas
`row.history` (pourtant renseigné à la ligne 241) et ne mémorise rien. Chaque
aller-retour de statut (`pending → processing → pending`) renvoie un email à
chaque fois. Le modèle `m2` porte le même objet à chaque envoi → les emails
s'empilent dans la boîte du client sous un objet identique.

### 4.2 `[ÉLEVÉE]` Échec d'envoi invisible

`components/admin/CommerceDesk.tsx:268` :

```ts
sendMail({ to: row.email, toName: row.client, subject, html }).catch(() => {});
```

L'erreur est avalée. L'administrateur voit le toast « Statut mis à jour »
(ligne 247) et croit le client prévenu. Aucun retry, aucune file, aucun journal
côté client. L'email perdu n'est visible que dans `outbox.json` avec
`provider: 'file'` et un champ `error` que l'écran « Emails » n'affiche pas
(`app/[locale]/admin/emails/page.tsx` n'a pas de colonne erreur).

### 4.3 `[MOYENNE]` Langue du modèle toujours française

`components/admin/CommerceDesk.tsx:258` appelle `messageByTrigger(trigger)`
sans second argument ; `lib/notify-store.ts:90` vaut `locale = 'fr'` par défaut.
Un client anglophone ou arabophone reçoit un email en français — alors que le
CMS est trilingue et que les modèles portent déjà un champ `locale`.

### 4.4 `[MOYENNE]` Variables de fusion déclarées mais jamais fournies

`lib/notify-store.ts:11` (`MERGE_VARS`) déclare 11 variables. Les deux seuls
appelants (`CommerceDesk.tsx:260-267` et `messages/page.tsx:309-316`) n'en
fournissent que 6. Ne sont **jamais** remplies :
`{{adresse_societe}}`, `{{telephone_societe}}`, `{{email_societe}}`,
`{{produit}}`, `{{date_reapprovisionnement}}`.

Conséquence : le modèle par défaut `m1` (« Réapprovisionnement prévu »,
`lib/notify-store.ts:40`) contient `{{produit}}` et `{{telephone_societe}}`.
Comme aucun déclencheur ne l'atteint, il ne part pas aujourd'hui — mais si un
administrateur réaffecte son déclencheur à `order_confirmed`, le client reçoit
`{{produit}}` en clair. `mergeVars` (`lib/mail.ts:23`) ne signale pas les
variables non résolues.

De même, `nom_societe` est codé en dur `'SARI Système'`
(`CommerceDesk.tsx:261`, `messages/page.tsx:310`) au lieu de reprendre les
coordonnées de l'entreprise.

### 4.5 `[MOYENNE]` Aucun plafond d'envoi dédié

`mail.controller.ts` ne porte pas de `@Throttle()`. Le seul garde-fou est le
limiteur global de `backend/src/app.module.ts:69-70` :
`120 requêtes / 60 s` par IP, **tous endpoints confondus**. Un jeton admin
permet donc mécaniquement 120 emails/minute, soit ~7 200/heure, sans aucune
limite par destinataire, par jour, ni dédoublonnage.

### 4.6 `[MOYENNE]` Deux configurations SMTP, une seule effective

| Source | Lue par | Effet réel |
| --- | --- | --- |
| `backend/.env` (`SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `.env.example:89-94`) | `mail.service.ts:31-50` | **seul effectif** |
| Admin → Paramètres → onglet « SMTP / Email » (`app/[locale]/admin/settings/page.tsx:316`) → `localStorage` via `lib/admin-settings.ts:115` | personne | **aucun** |

`grep -rn "\.smtp\b" app components lib` ne renvoie que l'écran de réglage
lui-même : rien ne consomme ces valeurs. L'administrateur peut saisir hôte,
port, utilisateur, mot de passe et expéditeur dans l'interface sans que le
moindre envoi change. Le champ `replyTo` (`settings/page.tsx:329`) est
doublement mort : jamais lu, et `MailService.send()` ne pose aucun en-tête
`Reply-To` (aucun `SMTP_REPLY_TO` dans `.env.example`).

Effet de bord : le mot de passe SMTP saisi dans l'onglet est écrit en clair
dans le `localStorage` du navigateur pour rien.

### 4.7 `[MOYENNE]` `nodemailer` 9.0.5 — 4 avis, dont contournement de domaine

`npm audit` exécuté dans `backend/` :

```
nodemailer  range <=9.1.0  severity high  fixAvailable true
- GHSA-8m3c-c648-2xjj  resolveContent() contourne disableFileAccess/disableUrlAccess
- GHSA-wmmp-3585-3rmp  contournement d'allow-list par domaine IDN/Punycode
- GHSA-2x7j-588g-ccc2  complexité quadratique dans addressparser (DoS)
- GHSA-cc9r-2j5m-2m83  contournement de validation de domaine via commentaire RFC 5322
```

Version épinglée : `backend/package.json:59` → `"nodemailer": "^9.0.5"`,
`package-lock.json` résout `9.0.5`. Correctif non cassant : `>= 9.1.0`
(`npm audit` annonce `fixAvailable: true`). Déjà signalé dans
`docs/AUDIT-PREPROD-2026-09-08.md` §3.

### 4.8 `[FAIBLE]` Historique d'envoi fragile et non traçable

`mail.service.ts:71-76` : `appendOutbox()` **relit tout le fichier, réécrit tout
le fichier** de façon synchrone à chaque envoi, et tronque à 200 entrées
(`rows.slice(0, 200)`). Trois conséquences : I/O bloquant dans l'event loop,
perte d'entrées en cas d'envois concurrents, et conservation du **corps HTML
complet** de 200 emails (adresses incluses) dans un JSON en clair sur le disque.

Aucun appel à `AuditService` dans `mail.service.ts` : l'outbox ne dit ni **qui**
a envoyé, ni depuis quel écran. Un email parti n'est pas attribuable.

### 4.9 `[FAIBLE]` Pas de conformité expéditeur dans les modèles

Aucun modèle (`lib/notify-store.ts:38-64`) ne contient de lien de
désinscription, d'adresse postale, ni d'en-tête `List-Unsubscribe`
(`mail.service.ts:94-100` ne pose que `from`, `to`, `subject`, `html`, `text`).
Il n'existe d'ailleurs aucune variable `{{lien_desinscription}}` dans
`MERGE_VARS`. Pour les emails transactionnels actuels ce n'est pas bloquant ;
cela le devient dès qu'une diffusion est ajoutée.

### 4.10 `[FAIBLE]` Écran « Emails » : modèles sans corps

`app/[locale]/admin/emails/page.tsx:95` : cliquer un modèle ne fait que
`setSubject(tpl.subject)`. Le corps reste celui du modèle précédent ; les 4
« modèles » de la colonne de gauche sont des préréglages d'objet, pas des
modèles. Aucun lien avec `lib/notify-store.ts`.

### 4.11 `[FAIBLE]` Aucun délai d'attente SMTP explicite

`mail.service.ts:45-50` crée le transport sans `connectionTimeout`,
`greetingTimeout`, `socketTimeout`, ni `pool`. Un serveur SMTP muet laisse la
requête ouverte (le client abandonne à 20 s, `lib/mail.ts:47`) et chaque envoi
ouvre une connexion TLS neuve.

---

## 5. Recommandations

### 5.1 P0 — corriger avant d'activer un SMTP de production

1. **Rendre l'envoi idempotent.** Une clé `dedupeKey = `${type}-${id}-${trigger}``
   stockée dans la fiche ; `notifyByStatus` sort immédiatement si la clé est
   déjà dans `row.notified`. Supprimer `pending` de `triggerMap`
   (`CommerceDesk.tsx:254`) : la confirmation part sur `processing` (ou sur la
   création), jamais sur l'état « en attente ».
2. **Ne plus avaler l'erreur.** Remplacer `.catch(() => {})`
   (`CommerceDesk.tsx:268`) par un toast d'échec + une mention « email non
   envoyé » dans l'historique de la fiche, et afficher la colonne `error` de
   l'outbox dans `admin/emails/page.tsx`.
3. **Mettre à jour `nodemailer`** : `cd backend && npm install nodemailer@^9.1.0`
   (non cassant), puis re-vérifier `npm audit`.
4. **Brancher l'onglet SMTP ou le retirer.** Soit persister ces réglages côté
   serveur et les faire lire par `MailService`, soit supprimer l'onglet
   (`settings/page.tsx:316-334`) et renvoyer vers `.env` — l'état actuel fait
   croire à un réglage qui n'existe pas, et stocke un mot de passe pour rien.

### 5.2 P1 — politique d'envoi anti-abus

5. **Un plafond dédié sur l'endpoint.** `@Throttle({ default: { ttl: 60_000, limit: 10 } })`
   sur `POST /mail/send`, plus un compteur quotidien par expéditeur
   (`MAIL_DAILY_CAP`, défaut 200) et **par destinataire**
   (`MAIL_MAX_PER_RECIPIENT_24H`, défaut 5). Au-delà : `429` explicite.
6. **Dédoublonnage serveur.** `MailService` refuse un envoi dont le couple
   (`to`, `subject`) est identique à un envoi des 10 dernières minutes — filet de
   sécurité indépendant du correctif applicatif de §5.1.
7. **Une file, pas un envoi synchrone.** Envoi différé avec concurrence 2 et
   retry exponentiel (3 tentatives). Un lot de 200 changements de statut ne doit
   pas ouvrir 200 connexions SMTP d'un coup.
8. **Tracer chaque envoi.** `AuditService.record({ action: 'mail_send', … })`
   avec l'acteur, le déclencheur et le destinataire ; passer l'outbox en table
   (ou JSONL append-only) en ne conservant que l'objet + une empreinte du corps.
9. **Langue du modèle = langue de la fiche.**
   `messageByTrigger(trigger, row.locale || 'fr')`, et alimenter les 5 variables
   manquantes depuis les coordonnées société ; faire échouer visiblement tout
   modèle contenant encore `{{…}}` après fusion.
10. **Durcir le transport.** `connectionTimeout: 10_000`, `greetingTimeout: 10_000`,
    `socketTimeout: 20_000`, `pool: true`, `maxConnections: 2`, `requireTLS` selon
    le port ; lire `SMTP_REPLY_TO` et poser l'en-tête ; publier SPF, DKIM et
    DMARC sur le domaine expéditeur.

### 5.3 P2 — ce qu'il faut **ne pas** ajouter

Le CMS est en B2B (commandes, devis, candidatures). La règle qui tient :
**un email = un changement d'état que le destinataire attend**. À ne pas
implémenter, parce que c'est là que se construit le spam perçu :

- pas de relance de panier abandonné ;
- pas de « vous nous manquez » / réactivation d'inactifs ;
- pas de sollicitation d'avis ni de questionnaire de satisfaction automatique ;
- pas d'email d'anniversaire, de vœux, de « nouveauté produit » hors opt-in
  explicite ;
- pas de notification interne par email **par événement** : regrouper en un
  digest quotidien (commandes du jour, devis en attente, candidatures reçues,
  messages de contact non lus). Un seul email/jour remplace des dizaines.

À l'inverse, trois emails aujourd'hui manquants méritent d'exister, parce qu'ils
sont attendus :

- accusé de réception de la **commande** passée sur la vitrine
  (`cart/page.tsx:185`) — un seul email, à la création, jamais à chaque étape ;
- accusé de réception de la **candidature** (`applications`) ;
- accusé de réception du **message de contact**, et une alerte interne vers
  l'adresse de l'entreprise (dans le digest, pas en temps réel).

Pour la newsletter : tant qu'aucun écran de campagne n'existe, laisser
`PENDING_UNTIL_CONFIRM = false` tel quel n'a pas d'effet visible. Dès qu'une
diffusion est ajoutée, passer le double opt-in à `true`
(`newsletter.service.ts:12`), envoyer le lien de confirmation, et ajouter dans
chaque campagne un lien de désinscription à un clic + en-tête `List-Unsubscribe`
+ adresse postale — c'est la condition de délivrabilité chez Gmail/Yahoo.

### 5.4 Rendre le volume visible

Ajouter sur l'écran « Emails » trois compteurs lus depuis l'outbox : envois
aujourd'hui, envois sur 7 jours, top 5 des destinataires. Un plafond que
personne ne regarde ne protège personne — et c'est le meilleur garde-fou contre
la dérive vers le trop-plein.

---

## 6. Ordre d'exécution proposé

| Étape | Fichiers | Effet |
| --- | --- | --- |
| 1 | `backend/package.json` | `nodemailer` ≥ 9.1.0 (avis clos) |
| 2 | `components/admin/CommerceDesk.tsx` (l. 253-268) | plus de doublon, erreur visible |
| 3 | `backend/src/modules/mail/mail.controller.ts` + `mail.service.ts` | plafond dédié, dédoublonnage, délais, `Reply-To`, audit |
| 4 | `lib/notify-store.ts` + appelants | langue de la fiche, variables société, contrôle des `{{…}}` restants |
| 5 | `app/[locale]/admin/settings/page.tsx` | onglet SMTP branché ou retiré |
| 6 | `app/[locale]/admin/emails/page.tsx` | colonne erreur + compteurs de volume |
| 7 | *plus tard* | accusés de réception vitrine, digest interne, campagne newsletter avec opt-in |
