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
| Newsletter | `setState` local, rien d’enregistré | Inscription serveur, liste filtrable, corbeille, export CSV |
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

## Newsletter

- `POST /api/newsletter` — inscription (`email`, `locale`, `source`, `consent`,
  `topics`). Un **champ piège** `website` rempli fait répondre « ok » sans rien
  enregistrer.
- `POST /api/newsletter` avec `action: "unsubscribe"` — désinscription par
  adresse ou par jeton.
- `GET /api/newsletter?action=confirm&token=…` — confirmation du double opt-in.
- `app/[locale]/admin/newsletter` — liste, recherche, filtres langue / statut /
  origine, sélection multiple (activer, désabonner, corbeille), édition,
  restauration, purge définitive, export CSV de la liste filtrée.

Une adresse est normalisée (minuscule, sans espace) et unique : une réinscription
réactive la ligne existante plutôt que de la dupliquer, en conservant sa date
d’origine. Le `source` enregistre d’où vient l’adresse : `home.newsletter`,
`news.detail`, `contact`. Ces trois points d’entrée utilisent le même
composant, `components/shared/NewsletterSignup.tsx`, donc le même
enregistrement serveur.

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
