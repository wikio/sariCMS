# Vérification de documents

Un document émis par le système porte deux informations : un **code**
(`SARI-FAC24-00001`) et une **clé de vérification** (une suite encodée,
`CTdxXe6ZdFVzWQ==`). N'importe qui peut contrôler le couple sur la vitrine,
sans compte et sans compte non plus : c'est la page `/{locale}/verification`.

## Les deux entrées de la page

| URL | Usage |
| --- | --- |
| `/{locale}/verification` | saisie manuelle — pour qui n'a pas de QR sous la main |
| `/{locale}/verification/{code}/{hash}` | le lien court du QR : les deux champs sont **pré-remplis**, le focus va au captcha |
| `/{locale}/verification/{code}` | le QR qui ne porte que le code : la clé se lit au bas du document — le champ reste vide et le formulaire le réclame, la page ne tombe pas en 404 |
| `/{locale}/verification?code=…&key=…` | la forme historique, restée acceptée (les QR déjà imprimés gardent leur lien) |

Le pré-remplissage ne **saute jamais le contrôle anti-robot** : le lien amène le
couple, l'humain amène la preuve. Un segment d'URL encodé de travers (`%2F`
d'une base64, espace collée à la main) remplit le champ tel quel — la page
corrige par la saisie plutôt que de refuser la visite.

Le QR du bandeau latéral, lui, est vivant : il encode le couple **en cours de
saisie**, en forme de chemin. On peut donc imprimer une planche d'affichage
avec un QR par document, généré depuis la page elle-même.

## Le parcours d'une vérification

```
formulaire ─▶ POST /api/verification/check
                1. débit par adresse IP — 12 contrôles / 5 min (x-forwarded-for compris)
                2. captcha anti-robot, émis par /api/verification/captcha :
                   à usage unique, 10 min, seul un SHA-256 du code vit côté serveur
                3. forme des champs (le code est alphanumérique ; la clé, une suite encodée)
                4. l'API EXTERNE configurée dans l'admin, si elle est activée
                5. traduction du code de retour par le catalogue administré
       ─▶ verdict : semantic + libellé + Type + Émetteur, et la source de la réponse
```

Le code de retour de l'API de référence : **1 valide, 0 falsifié, 2 expiré,
3 révoqué** — plus toute valeur ajoutée depuis (voir le catalogue). Sous un feu vert, la page n'affiche aucun récépissé (ni « code renvoyé », ni
« registre local ») : un document validé n'a pas à montrer sa cuisine. Les autres
verdicts gardent la mention d'origine, et un repli sur le registre local est
toujours signalé — même sous un vert, parce que « validé par le registre, pas par
le service » se doit d'être su.

La réponse
HTTP dit tout :

| Réponse | Signification |
| --- | --- |
| `200 {ok:true, source:'api'}` | verdict de l'API externe, traduit par le catalogue |
| `200 {…, notice:'api_injoignable'}` | l'API est morte, le **registre local** a répondu, et la page le dit à l'écran |
| `404 INTROUVABLE` | aucun document ne correspond au couple (la page ne dit pas *lequel* des deux cloche — c'est voulu) |
| `400 CAPTCHA` | code humain manquant, expiré ou rejoué |
| `400 FORMAT_CODE / FORMAT_KEY / PARAMETRES` | saisie impossible à juger ; le champ est resté rempli pour corriger |
| `429 TROP_DE_TENTATIVES` | débit dépassé ; le formulaire se met en veille cinq minutes |
| `502 API_INJOIGNABLE` | l'API externe ne répond pas **et** le repli local est coupé |
| `502 REPONSE_API` | l'API a répondu hors protocole — ou un code absent du catalogue. Jamais un « valide » par défaut, jamais un « falsifié » par erreur : une anomalie, et rien d'autre |

## Brancher l'API externe

**Paramètres → Intégrations → Vérification des documents**
(`app/[locale]/admin/settings`, onglet rendu par
`components/admin/VerificationSettingsSection.tsx`) :

- **URL de l'API** — l'endpoint complet (`https://api.tiers.fr/v1/verify`).
- **Méthode** — `GET` passe `?code=…&hash=…`, `POST` envoie le même couple en JSON.
- **Noms des paramètres** — si le tiers appelle les champs `numero` et `cle`.
- **Chemins de réponse** — où lire dans le JSON : `code` à la racine, ou
  `data.result.code` trois niveaux plus bas ; `type`, `issuer`, `message` idem.
  C'est par là que rentrent le **Type** et l'**Émetteur** affichés sous un verdict.
- **Clé d'API** — voyageant en `X-API-Key` ou `Authorization: Bearer`, ou pas
  d'auth du tout.
- **Repli sur le registre local** — pendant une panne, répondre avec
  `data/<locale>/verification-codes.json` (et l'annoncer) vaut mieux qu'un
  écran rouge ; à couper si un tiers se fie à la page pour accepter un document.

L'onglet contient un **test** (un code et une clé, la réponse brute, le code
extrait, l'entrée du catalogue touchée) qui appelle l'API **telle que saisie,
avant enregistrement** — on valide une configuration sans la publier.

Les réglages vivent dans **`data/verification.json`** (comme le SEO), relu à
chaque requête — pas dans le `localStorage` de l'administration : la route
publique est serveur, elle ne peut pas lire le navigateur de qui configure. La
clé y est en clair, au conventionnement près du reste du back-office (SMTP,
ERP) ; l'écran est derrière l'accès administrateur.

## Le catalogue des codes de vérification

**Admin → Codes de vérification** (`app/[locale]/admin/verification-codes`) :
une ligne = une valeur renvoyée par l'API, mariée à un comportement d'écran.

| Colonne | Rôle |
| --- | --- |
| Code API | la valeur brute, comparée en chaîne sans distinction de casse ; « 01 » vaut « 1 » si les deux sont numériques |
| Comportement | `valid` (vert), `forged` (rouge), `expired` (ambre), `revoked` (orange), `neutral` (bleu) — la couleur, l'icône, le panneau |
| Libellés FR/EN/AR | le titre du panneau, traduit ; à défaut, les titres historiques de la page |
| Type + Émetteur | afficher ou taire le détail renvoyé par l'API |
| Actif | une ligne désactivée ne répond plus : son code retombe sous l'anomalie `502` |

Quand l'API ajoute un code (4, « scellé », peu importe), **l'administrateur
ajoute une ligne et la vitrine le comprend sans redéploiement**. Deux règles
tiennent le système : le catalogue doit contenir au moins un code au
comportement `valid` (sinon aucun document ne pourrait jamais afficher de feu
vert), et deux lignes ne partagent pas la même valeur. Enregistrer remplace le
catalogue entier (`PUT /api/admin/verification {codes}`), l'onglet des réglages
n'écrivant que `{api}` — l'un ne peut pas abîmer l'autre.

## Pièces du dispositif

| Fichier | Rôle |
| --- | --- |
| `lib/verification.ts` | types, magasin `data/verification.json`, appel de l'API, catalogue, repli local — tout ce qui est testable sans HTTP |
| `app/api/verification/check` | le contrôle public : gardes, appel, traduction, erreurs `{error, code}` |
| `app/api/verification/captcha[/image]` | émission et image du captcha (le carnet de `lib/newsletter-captcha`, un bac de débit propre) |
| `app/api/verification/status` | le mode (API/démo), sans URL ni clé |
| `app/api/admin/verification[/test]` | lecture/écriture des réglages et du catalogue ; test avant enregistrement |
| `components/verification/VerificationExperience.tsx` | toute la page — montée par `/verification` **et** par `/verification/{code}/{hash}` |
| `app/[locale]/admin/verification-codes` | l'écran du catalogue |
| `scripts/test-verification.mjs` | les 22 garde-fous : pur exécuté, contrats statiques, graine et traductions |

Le registre local `data/<locale>/verification-codes.json` reste le moteur de la
**démonstration** (et le filet de la panne) : couple connu → verdict selon son
statut ; une clé fausse sur un code connu répond « introuvable », jamais «
falsifié » — la page ne devine pas, elle rapporte.

## Recettes

```bash
node scripts/test-verification.mjs    # 22 assertions, dont le magasin sur fichier réel
node scripts/check-translations.mjs   # les clés de la page existent en fr/en/ar
npm run routes:check -- --url http://127.0.0.1:5000   # les deux routes publiques rendent
```
