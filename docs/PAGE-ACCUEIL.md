# Page d’accueil administrable

Tout ce que montre `app/[locale]/page.tsx` se règle depuis **Administration →
Page d’accueil** : le slider, la mission, les produits phares, les blocs en
alternance, les chiffres, les témoignages, les événements, les actualités, la
newsletter, les partenaires et le bloc d’appel à l’action — y compris leur ordre
sur la page. Les adresses collectées par les formulaires d’abonnement ont leur
propre écran, **Administration → Newsletter**, avec un vrai CRUD en base.

## Ce qui a changé

| | Avant | Maintenant |
|---|---|---|
| Contenu des blocs | Cinq modules séparés (hero, témoignages, partenaires…) et rien d’autre | Chaque bloc a en plus ses **réglages de vitrine** : textes vus, nombre, fiches retenues, ordre, apparence |
| Nombre de produits / actualités / événements | `count={4}` et `count={3}` écrits dans le code | Champ « nombre affiché » par bloc |
| Ordre des blocs | Ordre JSX figé | Listes réordonnables (glisser ou flèches), enregistré |
| Témoignages, événements, actualités, partenaires | Premier arrivé, premier affiché | Sélection manuelle des fiches, ordre libre, ou automatique avec tri |
| Blocs en alternance, chiffres, tuiles de navigation | Trois blocs codés en dur dans le composant | Listes administrables : ajouter, dupliquer, masquer, réordonner |
| Newsletter | `setState` local, rien d’enregistré | Inscription serveur en deux temps (fenêtre de confirmation, **captcha en image**), liste filtrable avec lignes par page réglables, fiche de consultation, corbeille, motifs de désabonnement, export de la sélection ou de la liste |
| Blocs vierges à la première ouverture | Formulaire vide alors que la page, elle, affichait bien le contenu du site | Le contenu publié est **repris** dans la configuration (voir plus bas) et l’action « Reprendre » l’enregistre |
| Multilingue | Réglage unique pour trois langues | **Textes par langue**, structure commune (voir plus bas) |
| Constructeur de page | `localStorage` du navigateur seulement | Le HTML produit peut être rattaché à un bloc et servi à sa place |

## Les blocs

| Bloc | Ce qu’on y règle |
|---|---|
| Slider (bannière) | Choix des slides, ordre, réglage fiche par fiche (titre, texte, bouton, image, affichage), autoplay, durée, pastilles, flèches, hauteur, voile, alignement |
| Bandeau partenaires défilant | Partenaires retenus, vitesse, sens, logos ou noms, séparateur, pause au survol |
| Grille des univers | Tuiles (libellé, description, lien, icône, image), colonnes |
| Notre mission | Surtitre, titre, texte, bouton + lien, image de fond, voile, hauteur, parallaxe, alignement, CSS libre, constructeur |
| Produits phares | Titre, description, nombre, fiches sélectionnées, format de carte, prix et disponibilité visibles, bouton « tout voir » |
| Blocs en alternance | Liste complète : étiquette, titre, texte, liste à puces, image, côté de l’image, bouton ; constructeur |
| Chiffres clés | Valeur, suffixe, libellé, icône par élément ; animation et durée ; repli possible sur `data/config.json` |
| Témoignages | Fiches retenues et ordre (manuel, mieux notés, plus récents), présentation en diaporama ou grille, autoplay, étoiles, photo, établissement |
| Événements | Fiches retenues et ordre, nombre, « à venir seulement », bouton « tout voir » |
| Dernières actualités | Fiches retenues et ordre, nombre, bouton « tout voir » |
| Newsletter | Textes du bandeau, arguments affichés (icône + titre + texte), consentement explicite, double opt-in, thèmes proposés |
| Partenaires en vedette | Sélection, nombre, colonnes, logos en niveaux de gris ou couleur, hauteur, bordure |
| Bloc appel à l’action | Titre, texte, deux boutons (libellés et liens), accent couleur, fond, CSS libre, constructeur |

Les textes laissés vides reprennent les traductions du site (`messages/*.json`) :
une page ne peut jamais se retrouver sans texte parce qu’un champ n’a pas été
saisi.

## Où c’est enregistré

1. **API CMS** — table `home_sections`, une ligne par `(key, locale)` ;
   routes `PUT /home/sections/:key?locale=…`, `POST /home/sections/reorder`,
   `POST /home/sections/:key/copy`, `DELETE /home/sections/:key`.
2. **Fichier de secours** — `data/{langue}/home.json`, utilisé quand l’API ne
   répond pas (développement sans back-office, arrêt du serveur).

La passerelle `app/api/admin/home/route.ts` choisit, dans cet ordre. Un refus
de l’API (session expirée, donnée rejetée) **remonte à l’écran** au lieu d'être
masqué par une écriture dans le fichier : l’encart en haut du studio dit
toujours où l’enregistrement a atterri.

Priorité des valeurs, de la plus faible à la plus forte : défauts du code
(`HOME_DEFAULTS`, `lib/home/config.ts`) → fichier `data/{langue}/home.json` →
ligne de l’API.

Côté base, le pilote suivi n’exige rien de spécial : en `DB_DRIVER=json`
(valeur par défaut du dépôt), les lignes vivent dans `backend/storage/json/`,
qui n’est pas versionné ; en MySQL ou PostgreSQL, appliquer la migration
`backend/prisma/migrations/20260906_add_home_sections_and_newsletter`
(`npx prisma migrate deploy`) ou rejouer `backend/sql/schema.mysql.sql`, qui
contient les deux tables `home_sections` et `newsletter_subscribers`.

La vitrine lit ces lignes par `getHomeSnapshot(langue)` (`lib/home/store.ts`),
avec un cache de trente secondes (`HOME_CACHE_TTL_MS` pour le réglage) vidé à
chaque écriture par `touchStorefrontCache()`. Ce cache est posé sur `globalThis`
et non dans une constante du module : en développement, la page (composant
serveur) et la passerelle `app/api/admin/home` (route handler) chargent chacune
leur propre instance du fichier, et un cache de module se serait vidé du mauvais
côté — la modification enregistrée aurait attendu une expiration avant
d’apparaître.

Le store de démonstration ne contenant aucune ligne au départ, la page se
construit donc entièrement à partir des défauts du code et des traductions du
site — c’est ce qui permet de vérifier la règle de langue d’un seul coup d’œil.
Pour revenir à cet état après avoir joué avec le studio : **Administration →
Page d’accueil → Réinitialiser**, bloc par bloc, ou `cd backend && npm run seed`
qui vide `homeSections` et la table `newsletter`.

## Règle de langue

La **structure** d’un bloc — affiché ou non, ordre, nombre, fiches sélectionnées,
réglages, apparence — est enregistrée dans la langue de référence, le
**français**. Les **langues non références** n’écrivent que leurs textes, leurs
éléments répétables, leur HTML de constructeur et leur statut.

Concrètement : traduire le titre de « Prêt à démarrer votre projet ? » en arabe
ne change pas les produits retenus pour la version française, et un titre oublié
en anglais retombe sur la traduction du site, jamais sur le texte français.
L’interface du studio verrouille d’elle-même les onglets concernés et l’explique.

## Reprendre le contenu déjà publié

La vitrine montre depuis longtemps des fiches qui n’habitent pas le studio : les
diapositives de `data/{langue}/hero.json`, les produits, témoignages, événements,
actualités et partenaires du catalogue, les chiffres de `data/{langue}/config.json`,
les libellés de `messages/{langue}.json`. Le studio, lui, ne pouvait montrer que
ce qui avait été enregistré — un formulaire vide pour un bloc pourtant plein.

`lib/home/legacy.ts` lit ces mêmes sources et les **traduit en configuration de
bloc**. Cette reprise n’est pas une couche de plus dans la page, c’est un point
de départ, inscrit entre les défauts du bloc et ce qui a été réellement
enregistré :

```
HOME_DEFAULTS  →  reprise des fichiers du site  →  data/{langue}/home.json  →  lignes de l’API
   (forme)             (le contenu publié)              (secours)               (foi)
```

Conséquences :

- les sélecteurs du studio partent des **fiches réellement affichées**, dans le
  **même ordre** — la reprise passe par `applySelection`, la fonction des blocs
  eux-mêmes, et non par une liste recopiée à la main ;
- **la page ne change pas d’un pixel** quand un bloc est importé : on écrit la
  configuration qui était déjà rendue par repli ;
- une ligne enregistrée a toujours le dessus sur la reprise, et un contenu repris
  reste supprimable — vider un champ puis enregistrer fait disparaître le texte,
  la reprise ne le « ramène » jamais ;
- si les fiches choisies ne correspondent à rien (fiche supprimée du catalogue,
  autre identifiant après une reprise MySQL), le bloc **retombe sur sa sélection
  automatique** au lieu de rendre une section vide.

Dans le studio, un bloc dont le contenu vient des fichiers du site est marqué
`repris du site` dans la liste ; sa bannière propose **« Reprendre ce bloc »**, et
le bouton de bandeau **« Reprendre les données du site (n) »** traite les n blocs
concernés d’un coup. Côté serveur, la même chose s’appelle :

```
POST /api/admin/home  { "action": "import", "locale": "fr", "keys": ["blocks"], "force": false }
```

`keys` est optionnel (tous les blocs repris sans enregistrement), `force` impose
la reprise même si le bloc a déjà été enregistré — à n’utiliser que pour repartir
du contenu publié. L’action écrit ligne par ligne via le chemin d’enregistrement
normal : langue de référence = structure complète, autres langues = textes,
éléments, constructeur et statut.

## Espacements et bandeau de navigation

Le bandeau principal est en `position: fixed` : il survole la page au lieu de la
pousser. Sa hauteur dépend de la langue (la barre de contact prend une ligne de
plus en arabe) comme du point de rupture (`h-16`, `lg:h-20`). Plutôt que de la
deviner, `SiteWrapper` la **mesure** sur le bandeau réel et l’écrit dans la
variable `--site-header-h` ; `app/globals.css` en porte le repli avant mesure
(122 px, 138 px à partir de `lg`). Deux choses en découlent :

- `html { scroll-padding-top }` — un lien d’ancrage (`#contact`, `#newsletter`,
  les menus) s’arrête sous le bandeau, plus dessus ;
- le slider cède la place du menu quand son texte est collé en haut.

### Slider : le texte ne touche plus le menu

« Position verticale » (`En haut | Au centre | En bas`) est un réglage distinct de
l’alignement du texte, et le défaut est **Au centre** — le rendu d’origine du
site, où le titre était centré dans la hauteur du slider et jamais sous le bandeau.
Choisir « En haut » applique `padding-top: calc(var(--site-header-h) + marge sous
le menu)` : la hauteur du menu est déjà déduite, le champ « Marge sous le menu »
(24 px par défaut) n’ajoute que le surplus. Le réglage ne concerne que le bloc de
tête — un slider descendu plus bas dans la page n’a rien à céder.

### Grilles : l’« Espacement » du studio est enfin appliqué

Produits, Événements, Actualités, Partenaires, Chiffres clés, Témoignages et blocs
impairs proposaient déjà un champ « Espacement » (0 à 96 px) : il écrivait la
variable `--hs-gap`, qu’aucune classe ne lisait — les cartes se collaient.
`gridClassFor` porte maintenant `gap-[var(--hs-gap,32px)]` sur chacune de ses
branches, donc l’air entre deux cartes suit le réglage, en lignes comme en
colonnes et sur mobile. Le défaut des produits passe de 24 à 32 px, comme les
trois autres grilles. Le réglage « Hauteur verticale » (`paddingY`) du bandeau de
partenaires était dans le même cas ; il s’applique désormais.

### Bandeau des partenaires : logos, noms, secours

Le logo vient de la fiche partenaire (`logo`) — ou de l’étiquette enregistrée dans
le bloc en mode manuel, la fiche servant de secours. Quatre réglages : « Afficher
les logos », « Afficher le nom à côté du logo », « Hauteur des logos » (40 px) et
« Espace entre les logos » (32 px, en propriété logique, donc elle se retourne
avec la page en arabe).

Une image qui ne charge pas est **retirée du rendu** et remplacée par un
monogramme aux initiales de la marque, jamais par un cadre cassé. C’était
précisément le cas des partenaires de démonstration : leurs logos pointent vers
`via.placeholder.com`, service aujourd’hui arrêté, et le bandeau paraissait vide
alors que la liste, elle, était bien chargée. Un logo réel (médiathèque)
s’affiche normalement ; un lien mort laisse défiler le nom, comme avant. Le nombre
de marques qui défilent se règle dans le sélecteur du bloc (« Partenaires
affichés », douze par défaut).

## Newsletter

- `GET /api/newsletter?action=captcha` — délivre un **captcha en image** :
  `{ id, imageUrl, expiresIn }`. `imageUrl` vaut `/api/newsletter/captcha?id=…`.
- `GET /api/newsletter/captcha?id=…` — le fichier lui‑même, `image/svg+xml`,
  `Cache-Control: no-store`. Tant que le jeton vit, la même image est servie ;
  un jeton inconnu ou périmé répond `410` avec un rectangle « Code expiré », que
  le navigateur peut afficher comme image cassée sans texte trompeur.
  Le code (cinq caractères pris dans un alphabet sans `I`, `L`, `O`, `0`, `1`)
  n’existe que dessiné dans le SVG : ni dans le JSON, ni dans l’`alt`, ni dans le
  HTML. Seule son **empreinte SHA‑256** est conservée côté serveur, dix minutes,
  et un jeton ne sert qu’une fois — réponse juste ou fausse.
- `POST /api/newsletter` — inscription (`email`, `locale`, `source`, `consent`,
  `topics`, `name`, `notes`, `captchaId`, `captchaAnswer`). Trois gardes, toutes
  côté serveur : le **champ piège** `website` (rempli → « ok » sans rien
  enregistrer), une **limite de débit** par adresse (6 inscriptions par 5
  minutes) et le **captcha en image**, obligatoire — sauf pour les formulaires qui
  ont déjà leur propre contrôle, aujourd’hui `contact`, et qui doivent alors
  apporter un `consent: true` explicite.
- La réponse porte un `status` qui décrit ce qui vient de se passer **pour cette
  adresse** : `created`, `already-subscribed` (déjà dans la liste — le message le
  dit au lieu d’annoncer une inscription), `reactivated` (elle en avait été
  retirée), `pending-confirmation` (double opt-in). En cas de refus :
  `captcha-failed`, `invalid-email`, `rate-limited`.
- `POST /api/newsletter` avec `action: "unsubscribe"` — désinscription par
  adresse ou par jeton, avec `reason` (motif, code court) et `reasonNote`
  (commentaire libre, mille caractères). Réponse : `status: "unsubscribed"` ou
  `status: "not-found"` quand l’adresse n’est pas de la liste — le visiteur est
  prévenu au lieu d’être poliment menti. Débit relevé à 12 par 5 minutes, pas de
  captcha : cette requête ne crée rien.
- `GET /api/newsletter?action=confirm&token=…` — confirmation du double opt-in.
- `GET /api/newsletter?action=confirm&token=…` — confirmation du double opt-in.

### Écrans d’administration

- `app/[locale]/admin/newsletter` — liste, recherche, filtres langue / statut /
  origine, sélection multiple (activer, désabonner avec motif, corbeille),
  édition, restauration, purge définitive. Le **nombre de lignes par page** se
  règle en pied de tableau (10, 25, 50, 100, « Toutes ») et se retient dans le
  navigateur (`localStorage`, clé `sari.newsletter.pageSize`).
- `app/[locale]/admin/newsletter/[id]` — **fiche de consultation**, en lecture
  seule : l’abonné (adresse, nom, langue, origine, consentement, thèmes) puis le
  journal (dates, motif et commentaire du retrait, IP, navigateur, création et
  dernière modification) et le lien de retrait personnel, copiable. Deux sorties
  seulement : « Modifier », qui rouvre le tiroir de la liste sur cette fiche
  (`/admin/newsletter?edit=<id>`), et « Corbeille ».
- `app/[locale]/newsletter/unsubscribe` — formulaire public de désabonnement,
  joint par le petit lien sous chaque bloc d’inscription. `?email=` préremplit
  l’adresse, `?token=` (lien reçu par courriel) dispense de la retaper.
- Passerelle `app/api/admin/newsletter` : `?id=` (une fiche), `?action=stats`,
  `?action=topics&locale=fr` (suggestions du champ thèmes), `?action=export`
  (liste filtrée) ou `?action=export&ids=1,2,3` (**la sélection uniquement**),
  `?action=bulk` avec `reason`. Les deux exports écrivent les mêmes colonnes, que
  la donnée vienne du CMS ou du fichier de secours.

Une adresse est normalisée (minuscule, sans espace) et unique : une réinscription
réactive la ligne existante plutôt que de la dupliquer, en conservant sa date
d’origine. Le `source` enregistre d’où vient l’adresse : `home.newsletter`,
`news.detail`, `contact`. Ces trois points d’entrée utilisent le même
composant, `components/shared/NewsletterSignup.tsx`, donc le même
enregistrement serveur.

### Fenêtre de confirmation

Le premier clic sur « S’inscrire » n’inscrit personne : il ouvre une fenêtre qui

- relit l’adresse saisie, avec un lien **« Modifier l’adresse »** qui rouvre le
  champ sans rien perdre ;
- propose deux champs **facultatifs**, le nom et une note libre (`notes`, mille
  caractères maximum) — la note est enregistrée avec l’adresse, visible et
  modifiable dans l’écran Newsletter, reprise dans l’export CSV ;
- rappelle les thèmes cochés, si le bloc en propose ;
- fait recopier le **code de l’image**, avec un bouton « Nouveau code » — la
  vignette elle‑même en redemande un autre au clic ;
- envoie seulement là le `POST`, sur « Confirmer mon inscription ».

La fenêtre est accessible : `role="dialog"`, titre associé, fermeture par Échap
ou clic sur le fond, défilement de la page bloqué le temps de la saisie, focus
posé sur le premier champ puis rendu au bouton qui l’a ouverte. Une réponse
incorrecte ne ferme rien : un nouveau code est demandé et le message
l’explique. Un `already-subscribed` s’affiche dans la fenêtre, qui reste ouverte
pour permettre de saisir une autre adresse.

### Motifs de désabonnement

Le retrait d’une adresse enregistre un **code court et stable**, jamais un texte
traduit : la liste est la même en français, en anglais et en arabe, et elle se
filtre sans ambiguïté. Cinq motifs sont proposés au visiteur, plus deux codes
posés par le serveur :

| Code | Qui l’écrit | Sens |
| --- | --- | --- |
| `no-longer-wants` | formulaire public | ne souhaite plus ces courriels |
| `too-many-emails` | formulaire public | trop de courriels |
| `not-relevant` | formulaire public | contenu non concerné |
| `never-subscribed` | formulaire public | ne se souvient pas de l’inscription |
| `other` | formulaire public | autre motif — le commentaire porte le détail |
| `unspecified` | formulaire public sans choix | le visiteur a sauté les motifs |
| `unsubscribed-by-admin` | sélection multiple du back‑office | retrait décidé dans l’administration |

Les libellés vivent une seule fois, sous `common.newsletterReasons` : la vitrine
et l’administration traduisent le même code avec le même dictionnaire, et un code
inconnu s’affiche tel quel plutôt que de disparaître de la fiche. Le commentaire
libre est la colonne `unsubscribeNote`. En base (`backend/prisma/migrations/20260907_add_newsletter_unsubscribe_reason`)
ce sont `unsubscribeReason VARCHAR(255)` et `unsubscribeNote TEXT`, avec un index
sur le motif pour compter les retraits sans balayer la table.

## Réinitialiser puis re-enregistrer

« Réinitialiser » met la ligne du bloc à la corbeille (`deletedAt`), pas à la
poubelle : l’historique reste, la vitrine repart des valeurs par défaut. Comme la
contrainte d’unicité `(key, locale)` compte toujours cette ligne, un
enregistrement ultérieur **ranime** la fiche au lieu d’échouer — le comportement
est le même en JSON qu’en MySQL, et c’est ce qui rend l’enchaînement
réinitialisation → « Reprendre le contenu du site » sans accroc.

## Constructeur de page

L’onglet **Constructeur** d’un bloc bascule son rendu en HTML : le contenu
produit par GrapesJS (`/admin/builder?section=<bloc>`) remplace le rendu natif
du bloc, en conservant le fond, la hauteur et le conteneur réglés dans l’onglet
Apparence. À l’enregistrement, le HTML est nettoyé : balises `script`,
`iframe`, `object`, gestionnaires `on…` et URL `javascript:` sont retirés, car
ce contenu est ensuite rendu tel quel côté vitrine. Le CSS, lui, est **portée
au bloc** : chaque règle est préfixée du sélecteur `.hs-<bloc>` posé sur la
balise `<section>`, une faute de syntaxe ne déshabille donc pas toute la page.

## Ajouter un bloc à la page d’accueil

1. une clé dans `HOME_ORDER` et ses défauts dans `HOME_DEFAULTS` (`lib/home/config.ts`) ;
2. une entrée de catalogue (`lib/home/catalog.ts`) : champs de textes, réglages,
   sélecteur de fiches ou liste répétable, apparence, constructeur ;
3. le composant de vitrine, qui lit `config` via `SectionFrame` ;
4. un `case` dans `renderSection()` de `app/[locale]/page.tsx`.

Le studio (liste des blocs, éditeur, sélecteurs, copie, réinitialisation) se
construit alors tout seul à partir du catalogue — c’est le but du fichier :
un bloc = une entrée, pas un écran de plus.
