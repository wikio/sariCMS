# SARI CMS — Centre de courrier (emails par module)

> **Écran** : Paramètres → **Emails** → « Emails & notifications »
> **Réglages** : `data/mail/*.json` — fichiers sur le serveur, **jamais en base**
> **Transport** : `POST /api/v1/mail/send` (backend NestJS, `nodemailer`)
> **Audit préalable** : `docs/AUDIT-EMAILS-SMTP-2026-09-18.md`

---

## 1. Ce que fait ce module

Un seul endroit décide de ce qui part par email : **l'événement est-il activé
dans les paramètres ?** Le code d'un module peut appeler l'envoi, si
l'événement est désactivé rien ne part. Réciproquement, aucun email ne part sans
qu'un administrateur l'ait explicitement activé.

```
module du CMS (commande, devis, candidature…)
        │  sendModuleMail({ event, to, vars, dedupeKey })
        ▼
POST /api/admin/mail-center/send     ← la politique d'envoi est appliquée ICI
        │  · interrupteur général        · dédoublonnage par clé
        │  · événement activé ?          · intervalle par destinataire
        │  · plafonds quotidiens         · heures silencieuses
        │  · rendu : objet + corps + gabarit (fusion des {{variables}})
        ▼
POST {CMS_API_INTERNAL_URL}/mail/send → MailService → SMTP
        │
        ▼
data/mail/sent-log.json  (envoyé / échec / refusé + motif)
```

## 2. Les fichiers

| Fichier | Contenu | Écrit par |
| --- | --- | --- |
| `data/mail/modules.json` | un réglage par événement : activé, objet, corps, gabarit, copie cachée, intervalle anti-doublon | onglet « Modules & messages » |
| `data/mail/layouts.json` | gabarits : blocs + charte (couleurs, logo, coordonnées, mention légale, désinscription) | constructeur de gabarit |
| `data/mail/policy.json` | politique d'envoi (plafonds, heures silencieuses, rétention) | onglet « Politique d'envoi » |
| `data/mail/sent-log.json` | historique : date, module, événement, destinataire, objet, état, motif | automatique, élagué selon `logRetentionDays` |

Les quatre fichiers sont créés au premier enregistrement. Tant qu'ils
n'existent pas, le module tourne sur ses valeurs par défaut — **tous les
événements désactivés** : rien ne part tant que rien n'a été choisi.

## 3. Les modules et leurs événements

| Module | Événements | Déclenchement |
| --- | --- | --- |
| Commandes | `order_confirmed`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_payment` | changement de statut dans Commandes |
| Devis | `quote_sent`, `quote_accepted`, `quote_expired` | changement de statut dans Devis |
| Formulaire de contact | `contact_received`, `contact_alert` (interne) | réception d'un message |
| Candidatures | `application_received`, `application_alert` (interne) | dépôt d'une candidature |
| Newsletter | `newsletter_welcome`, `newsletter_campaign` | inscription / diffusion |
| Comptes clients | `user_welcome`, `user_password_reset` | création de compte / demande |
| Stock | `stock_backorder` | rupture avec réapprovisionnement prévu |

### 3.1 Qui appelle quoi

| Événements | Appelant | Côté |
| --- | --- | --- |
| `order_confirmed`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_payment`, `quote_sent`, `quote_accepted`, `quote_expired` | `components/admin/CommerceDesk.tsx` → `notifyByStatus` | navigateur, jeton de session |
| `contact_received`, `contact_alert` | `app/api/contact/route.ts` | serveur |
| `newsletter_welcome` | `app/api/newsletter/route.ts` | serveur |
| `newsletter_campaign` | onglet « Diffusion » (à venir) | — |
| `application_received`, `application_alert`, `user_welcome`, `user_password_reset`, `stock_backorder` | configurable et prêt, appel à poser dans le module | — |

### 3.2 Envoyer depuis le serveur

Les routes serveur (`app/api/**`) n'ont **pas** de jeton de session : elles
passent par `lib/mail-center-send.ts`, un seul point d'entrée qui lit le
même `data/mail/*.json`, applique la même politique, appelle le backend puis
journalise.

```ts
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

void (async () => {
  const vars: Record<string, string> = {
    ...(await companyVars(locale, requestOrigin(req))),
    nom_client: message.name,
    objet_message: message.subject,
    message_client: message.message,
    email_client: message.email,
  };
  await sendMailCenterEvent({
    event: 'contact_received',
    to: message.email,
    toName: message.name,
    vars,
    dedupeKey: `contact-${message.email}-contact_received`,
  });
})().catch(() => {});
```

L'envoi est **décroché** de la réponse : le visiteur n'attend pas le serveur de
courrier (jusqu'à 20 s), et le résultat — envoyé ou refusé, avec son motif —
atterrit dans `data/mail/sent-log.json`.

Le transport se décide seul :

- avec un `bearer` (onglet admin) → `POST /mail/send`, jeton de session ;
- sans → `POST /mail/internal/send`, en-tête `x-mail-internal-key`.

`MAIL_INTERNAL_KEY` doit donc avoir **la même valeur** dans `backend/.env` et
dans le `.env.local` de Next. Non définie, les flux publics n'envoient rien :
chaque tentative est journalisée en `failed` avec le motif
`internal_key_missing`. Ce point d'entrée ne lève jamais d'exception vers
l'appelant.

`result.reason` vaut `disabled`, `master_off`, `duplicate`, `daily_cap`,
`recipient_cap`, `quiet_hours`, `no_recipient`, `unknown_event`,
`transport_error` ou `internal_key_missing`. Un refus n'est pas une exception :
c'est la politique qui fait son travail.

## 4. Les variables de fusion

31 variables, regroupées par thème (société, destinataire, document, montants,
dates, liens). Chaque événement ne propose que celles qui le concernent ; elles
s'insèrent **à la position du curseur** via le sélecteur « Insérer une
variable… » de l'éditeur.

Une variable utilisée dans le modèle mais absente de l'appel part en blanc :
l'écran le signale (`Variables inconnues pour cet événement`) et la réponse de
l'API liste `missingVars`.

## 5. Le constructeur de gabarit

Un gabarit est l'habillage commun : blocs **Logo · Titre · Texte · Bouton ·
Séparateur · Image · Corps du message · Pied de page**, plus une charte
(couleurs, arrondi, coordonnées, mention légale, lien de désinscription).

Le bloc « **Corps du message** » marque l'endroit où le texte de l'événement
vient se loger — un seul par gabarit, sous peine de voir le texte répété.

Sortie : HTML email (tables 600 px + styles en ligne, aucune feuille externe,
aucun JavaScript), parce que c'est ce que les clients de messagerie savent
lire. C'est aussi pourquoi le constructeur de page (`/admin/builder`, GrapesJS)
n'est pas réutilisé ici : une page construite dans l'atelier arriverait cassée
dans Outlook.

## 6. La politique d'envoi — ne pas trop envoyer

| Réglage | Défaut | Effet |
| --- | --- | --- |
| Interrupteur général | activé | coupé, plus rien ne part |
| Envois par jour | 200 | plafond global, tous modules |
| Envois par destinataire / jour | 5 | évite d'arroser une même adresse |
| Fenêtre de dédoublonnage | 60 min | une même clé (`fiche + événement`) ne repart pas |
| Intervalle anti-doublon | 1 h par événement | deux « commande confirmée » à 5 min d'écart : un seul part |
| Heures silencieuses | désactivées | aucun envoi la nuit |
| Historique conservé | 60 jours | élagage automatique du journal |

Ces compteurs sont lus dans `data/mail/sent-log.json` **côté serveur** : ils ne
peuvent pas être contournés depuis le navigateur, et un redémarrage ne les remet
pas à zéro.

Règles d'usage, dans l'esprit de l'audit :

- un email transactionnel attendu = **un message par étape**, jamais un par changement d'état ;
- les alertes internes gagnent à être regroupées dans un **résumé quotidien** ;
- toute diffusion exige un **consentement explicite** et un lien de désinscription ;
- à éviter : relance de panier abandonné, « vous nous manquez », demande d'avis,
  vœux et anniversaires. C'est ce qui fait classer le domaine en indésirable.

## 7. Vérifications faites

```bash
npx tsc --noEmit                          # 0 erreur
npx tsc --noEmit -p backend/tsconfig.json # 0 erreur
npx next build                            # ✓ Compiled successfully — /api/contact, /api/newsletter, /api/admin/mail-center{,/send}
npm run intl:check                        # fr/en/ar 4636 clés, 0 absente
npm run builder:check                     # 32 blocs, identifiants uniques
npm run links:test                        # 10 assertions
cd backend && npx jest src/modules/mail/mail.controller.spec.ts   # 4 tests
```

Le backend complet donne 135 tests passés et **3 échecs antérieurs à ce
travail** (`orders.service.spec.ts`, `quotes.service.spec.ts`), vérifiés comme
tels en remettant temporairement `mail.controller.ts` de côté.

Contrôles fonctionnels sur serveur lancé (`next start`) : 401 sans session ;
GET renvoie 17 événements, 7 modules, 31 variables, 1 gabarit ; PUT crée
`data/mail/modules.json` ; envoi vers un événement désactivé → `disabled` ;
adresse invalide → `no_recipient` ; événement inconnu → `unknown_event` ;
même clé d'envoi → `duplicate` ; intervalle par destinataire → `duplicate` ;
interrupteur coupé → `master_off` ; heures silencieuses → `quiet_hours` ;
plafond par destinataire → `recipient_cap` ; backend SMTP absent →
`transport_error` avec objet fusionné et `missingVars` correctes.

Chaîne publique testée de bout en bout (Next 5000 → Nest 3001 en `DB_DRIVER=json`,
`SMTP_HOST` vide donc mode fichier) :

- `POST /api/contact` → 200, message enregistré dans le CRM (`id: 1`), puis
  `contact_received` et `contact_alert` journalisés `sent` et présents dans
  `backend/storage/mail/outbox.json` ;
- deuxième message de la même adresse → les deux événements `skipped`
  (`duplicate`) ;
- captcha faux → 400, **aucune ligne** dans le journal ;
- `POST /api/newsletter` avec consentement → `newsletter_welcome` `sent`, le
  lien de désinscription portant le jeton réellement émis pour cet abonné ;
- `/mail/internal/send` : clé juste → envoyé ; clé fausse, clé vide ou clé non
  configurée côté backend → 401 sans appel à `MailService.send`.

## 8. Fichiers du module

| Fichier | Rôle |
| --- | --- |
| `lib/mail-center.ts` | isomorphe : catalogue, variables, valeurs par défaut, rendu HTML email |
| `lib/mail-center-store.ts` | serveur : lecture/écriture JSON atomique, bornage, journal, garde-fous |
| `app/api/admin/mail-center/route.ts` | `GET` état complet · `PUT` réglages par section |
| `app/api/admin/mail-center/send/route.ts` | politique → rendu → transport → journal |
| `components/admin/MailCenterSection.tsx` | l'écran (modules, gabarits, politique, journal) |
| `components/admin/MailLayoutStudio.tsx` | le constructeur de gabarit |
| `lib/mail.ts` | `sendModuleMail()` côté navigateur |
| `lib/mail-center-send.ts` | serveur : le même envoi, sans jeton de session (`sendMailCenterEvent`, `companyVars`, `requestOrigin`) |
| `app/api/contact/route.ts` | formulaire de contact : captcha serveur, relais CRM, `contact_received` + `contact_alert` |
| `app/api/newsletter/route.ts` | inscription : `newsletter_welcome` avec lien de désinscription réel |
| `backend/src/modules/mail/mail.controller.ts` | `POST /mail/internal/send`, point d'entrée à clé partagée |
