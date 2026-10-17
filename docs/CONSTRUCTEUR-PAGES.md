# Constructeur de pages

L'administration contient un éditeur visuel (**Administration → Pages → Construire**,
ou **Administration → Constructeur**) qui dessine une page du site. Une page dessinée
ici est une **page générique de type « Constructeur de page »** : elle se visite à
`/{langue}/p/{slug}`, **sans le bandeau de navigation du site ni son pied de page**,
et elle se retravaille dans le même écran autant de fois qu'on veut.

## Pourquoi « sans menu ni pied de page »

Une page construite est une page de campagne : elle arrive d'un e-mail, d'un QR code,
d'une publicité. Un menu autour d'elle ferait partir le visiteur avant la fin de
l'appel à l'action. Ce n'est donc pas une page du catalogue à laquelle on aurait retiré
des morceaux — c'est un type à part, avec son adresse, et son type qui se voit dans la
liste des pages.

La coque du site se décide par le **chemin** : `components/layout/SiteWrapper.tsx` ne
pose déjà ni le menu ni le pied de page sur les routes d'administration, et la règle
s'étend à `/[langue]/p/[identifiant]` (`lib/standalone-page.ts`). La page construite
bénéficie du même traitement, sans qu'aucune page existante n'ait été touchée.

## Où vit le contenu : le champ `content`, pas une colonne de plus

Une page du module Pages est déjà une fiche avec `title`, `subtitle`, `slug`, `status`,
`media`… et un champ `content` en HTML. Le constructeur range sa construction **dans ce
`content`**, sous une forme convenue (`lib/builder-doc.ts`) :

```html
<style data-sari-builder="1">
/* le CSS propre à la page, sorti du constructeur */
</style>
<section class="sari-band">…</section>
```

- le **premier** bloc `<style>` du document appartient au constructeur ; en dessous,
  c'est le HTML de la page ;
- un style écrit à la main plus bas dans la page n'est pas touché, et une page dont le
  `content` ne commence pas par `<style>` reste lisible : le constructeur accepte les
  deux ;
- aucun schéma n'a été modifié — ni colonne, ni DTO, ni migration SQL, ni champ que
  le formulaire du module pourrait effacer en enregistrant une fiche ;
- le champ reste du HTML : la page continue d'être lisible, modifiable et exportable
  par tous les chemins existants (formulaire Pages, liste, reprise de données).

La feuille de la page ne porte **que ce qui est propre à cette page** (une couleur, un
rayon, une taille de chiffre) : le reste vient du kit, chargé une fois pour toutes.

## Le kit : `app/builder-kit.css`

Les blocs du constructeur posent des classes `sari-*` : `.sari-band`, `.sari-wrap`,
`.sari-grid--3`, `.sari-card`, `.sari-btn--lime`, `.sari-gallery`, `.sari-carousel`,
`.sari-slides`, `.sari-flyer`, `.sari-quote`, `.sari-faq`… Ce fichier est importé par
`app/[locale]/layout.tsx`, donc disponible à la fois sur la vitrine et dans le canevas
de l'éditeur.

Pourquoi un fichier de CSS écrit et pas des classes utilitaires Tailwind dans les blocs :
une classe utilitaire n'existe que si le compilateur l'a vue dans un fichier source. Une
classe posée par l'administrateur dans GrapesJS, puis retouchée à la main, disparaîtrait
du CSS compilé à la prochaine construction, sans que personne ne s'en aperçoive. Le kit
est toujours là ; les blocs ne font que le citer.

Trois choses le gouvernent :

- **l'état plutôt que le point de rupture** : colonnes (`--2/3/4`), largeur des éléments
  d'un carrousel (`--half/--third`), hauteur d'un visuel (`--short/--tall`) ;
- **les propriétés logiques** (`margin-inline`, `padding-inline`, `inset-inline`) : la
  page en arabe se retourne toute seule, les flèches des carrousels avec elle ;
- **`prefers-reduced-motion` et une page imprimée** : le mouvement s'arrête, les
  bandeaux se posent à plat sur le papier, les visuels conservent une bordure.

## Les blocs disponibles

La palette garde **les composants déjà existants de la vitrine** (hero, chiffres,
produits vedettes, partenaires, témoignages, appel à l'action, sections alternées,
événements, newsletter, parallaxe, grille, carte) — ils sont simplement écrités avec les
classes du kit, pour que leur HTML se rende à l'identique dans le constructeur et sur la
page. S'y ajoutent les modules demandés :

| Bloc | Réglages par classes | Interactif |
|---|---|---|
| Page d'atterrissage complète | `.sari-band--blue`, `.sari-grid--3`, `.sari-btn--lime` | — |
| Bandeau titre pleine largeur | `.sari-hero`, `.sari-hero--split` | — |
| Bandeau en deux colonnes | `.sari-split`, `.sari-split--flip` | — |
| Bouton d'action configurable | `--lime`, `--ink`, `--outline`, `--ghost`, `--sm`, `--lg`, `--block`, `--arrow` | — |
| Bandeau d'appel à l'action | `.sari-band--lime`, `.sari-band--ink` | — |
| Galerie avec visionneuse | `.sari-gallery--2`, `--4`, `--tall`, `--wide` | oui |
| Carrousel de cartes | `.sari-carousel--half`, `--third`, `--auto`, `--slow` | oui |
| Slider d'images | `.sari-slides--plain`, `--auto`, `--slow`, `data-interval` | oui |
| Flyer d'offre / d'événement | `.sari-flyer__price`, `.sari-flyer__callout` | — |
| Grille de cartes, chiffres clés, mur de logos, témoignage | `.sari-grid--*`, `.sari-center` | — |
| Questions fréquentes | `.sari-faq` (des `<details>`) | ouvert sans JS |
| Vidéo ou visuel 16/9 | `.sari-frame` | — |
| Espace vide, séparateur, en-tête de page | `.sari-spacer`, `.sari-sep` | — |

Un bloc « interactif » n'embarque **aucun script** : le HTML enregistré passe par
`sanitizeBuilderHtml` (les `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, tout
`on*` et tout `javascript:` sont retirés). Ce sont les comportements du composant de
rendu (`components/builder/use-page-behaviors.ts`) qui câblent diaporama, carrousel et
visionneuse après le rendu serveur. Sans JavaScript, la page reste entièrement lisible :
les visuels s'empilent, une image de galerie est un lien vers son fichier, les questions
fréquentes sont des `<details>` natifs.

Les réglages passent par les **classes**, pas par des attributs : le panneau de style de
GrapesJS edit les classes, alors que des `data-*` n'y sont pas éditables. C'est pourquoi
les variantes (couleur d'un bouton, nombre de colonnes, vitesse d'un carrousel) sont
documentées sous chaque bloc dans la palette.

## Le sélecteur de pages

Le constructeur ne propose que les fiches `kind=generic` **et** `subtype=constructor` de la
langue en cours — pas l'accueil, pas les services, pas les produits : ces pages sont composées
par le site à partir de blocs, un éditeur visuel ne s'y applique pas. La liste vient de la même
voie que celle des autres écrans d'administration (`cmsAdminList('pages', …)`), et le bouton
**Construire** de la liste des pages (posé par `rowAction` dans `lib/cms-modules.ts`, réservé
aux lignes dont `subtype` vaut `constructor`) ouvre directement le bon document.

Créer une page se fait de deux façons, au choix :

- depuis la liste des pages : nouvelle fiche, mise en page « Constructeur de page », puis
  bouton Construire ;
- depuis le constructeur : **Nouvelle page**, avec un identifiant d'URL, un titre et un point
  de départ (page vide, page d'atterrissage, flyer, galerie, campagne). La fiche est créée en
  brouillon, donc invisible tant qu'elle n'est pas publiée.

Le titre, l'identifiant et l'état se règlent aussi dans la barre du constructeur : ils sont
enregistrés avec la page, dans la même écriture.

## Enregistrer, retrouver, défaire

- **Enregistrer** écrit dans la fiche (`PATCH /api/v1/pages/{id}`) ; le brouillon local est
  supprimé à ce moment-là.
- Pendant le travail, une copie est gardée dans `localStorage` (`builderKey(slug, langue)`)
  toutes les 1,2 seconde après une modification, avec sa date. À la réouverture, si cette
  copie est plus récente que la fiche, c'est elle qui s'affiche, et un bouton permet d'y
  renoncer pour repartir de la fiche.
- Le bouton **Code** montre exactement ce qui sera enregistré (HTML puis CSS), parce que c'est
  ce texte qui est lu par la vitrine.
- La page publiée est rafraîchie en ISR (60 secondes, comme le reste des données du site) et
  portée `noindex` : une page de campagne a son propre canal d'entrée.

## Exemples livrés

`data/{fr,en,ar}/genericContent.json` contient des pages de type constructeur déjà écrites
(une page d'offre avec stats, galerie et questions fréquentes en français ; une page-guide et
une offre en anglais ; une campagne en arabe, en écriture droite → gauche). Ce sont les
fichiers de secours du site quand l'API n'est pas joignable ; pour un déploiement MySQL, le
même contenu est disponible en base via `backend/sql/seed-constructor-pages.mysql.sql`, et
pour un store JSON local via l'API :

```bash
curl -X POST "$API/api/v1/pages" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"generic","subtype":"constructor","locale":"fr","slug":"offre-pack-imagerie-portable",
       "title":"Pack imagerie portable","status":"published","content":"<style data-sari-builder=\"1\">…</style><section class=\"sari-band\">…</section>"}'
```

## Limites assumées

- `content` est une colonne `TEXT` (environ 64 ko) : une page construite reste légère parce
  que les visuels sont désignés par leur URL, jamais encodés dans le document.
- Pas de formulaire dans une page construite : le sanitizer retire les `<form>`. Un
  abonnement ou une demande de devis se fait par un lien vers le formulaire du site, ou par
  le bloc newsletter de la page d'accueil.
- Une page construite n'est pas dans le menu : c'est voulu. La relier quelque part se fait
  depuis le bloc qui l'accueille (bouton, image, carte) avec son adresse
  `/{langue}/p/{slug}`.
