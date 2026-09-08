# Menus : où sont-ils stockés, et comment diagnostiquer

## Où vivent les menus

| Source | Rôle | Modifiable depuis l'admin |
|---|---|---|
| Table `menus` (base de données) | **Autorité.** Une ligne par emplacement **et par langue** | Oui |
| `data/{fr,en,ar}/menu.json` | **Repli** si la base ne renvoie rien pour cette langue | Non |

La contrainte d'unicité est `(location, locale)`. Il existe donc jusqu'à
quatre lignes par langue : `main`, `footer-nav`, `footer-legal`, `social`.

Conséquence directe, et cause la plus fréquente de menus incohérents :
**enregistrer un menu depuis l'administration ne crée la ligne que pour la
langue en cours d'édition.** Les autres langues n'ont rien en base et affichent
le fichier de repli — souvent neuf entrées face aux quatre que vous venez de
composer.

## Cascade de lecture

```
getMenu(locale)
   └─ API  GET /public/menus?locale=<langue>     ← base de données
        └─ si vide : data/<langue>/menu.json     ← repli livré avec le code
             └─ si absent : menu vide
```

Un cache de 30 secondes s'applique (`CMS_CACHE_TTL`). Après un enregistrement,
attendez ce délai ou rechargez pour voir le changement.

## Les trois scripts, et ce qu'ils font vraiment

### `npm run menus:check` — contrôle du serveur

Interroge un serveur **en marche** et répond aux questions utiles : d'où vient
le menu de chaque langue, les structures concordent-elles, reste-t-il des
sous-menus vides ?

```bash
npm run menus:check
npm run menus:check -- --url https://mon-site.tld
npm run menus:check -- --api https://mon-site.tld/api/v1 --url https://mon-site.tld
```

Sortie type lorsqu'une langue n'a pas été enregistrée :

```
Langue « ar »
  ! Menu principal : aucun menu en base → repli statique (9 entrée(s))

Cohérence entre les langues
  ✗ Menu principal : structures différentes
      fr (base)  home:0, solutions:1, contact:0
      ar (repli) home:0, solutions:9, services:0, …
  ✗ Menu principal : enregistré en base pour fr mais pas pour ar
```

Le code de sortie est non nul en cas de problème : utilisable en intégration
continue.

### `npm run menus:sync` — aligner les langues

Recopie la structure d'une langue de référence vers les autres : liens, ordre,
règles de sous-menu automatique et sous-liens. **Les libellés déjà traduits
dans la langue cible sont conservés** lorsque l'entrée existe encore (même
identifiant) ; seules les nouvelles entrées restent à traduire.

```bash
# 1. Simulation : montre ce qui serait écrit, sans authentification
npm run menus:sync -- --dry-run

# 2. Application : le script se connecte lui-même
npm run menus:sync -- --from fr --email admin@sarisysteme.com --password '…'

# Variante : une seule langue cible
npm run menus:sync -- --from fr --to ar --email admin@… --password '…'
```

L'écriture passe par l'API d'administration. Indiquez `--email` et
`--password` : le script obtient le jeton lui-même via `POST /auth/login`. Si
le compte utilise la double authentification, passez plutôt `--token <jwt>`.
Les variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_TOKEN` sont aussi lues
dans l'environnement, ce qui évite d'écrire le mot de passe dans l'historique
du terminal.

Astuce : `--from fr --to fr` réécrit le français sur lui-même. Cela nettoie
les sous-menus vides hérités d'anciens enregistrements sans rien changer aux
libellés.

Le script répare aussi les règles de sous-menu automatique incomplètes. Les
enregistrements antérieurs à l'ajout du champ `mode` faisaient rejeter
l'écriture du menu entier par l'API (`HTTP 400 — mode must be one of the
following values: all, pick, groups`) ; la valeur par défaut est désormais
appliquée.

### Attention à npm et aux options

Selon la version de npm, les options peuvent être avalées et seules les
valeurs transmises au script :

```
npm run menus:check -- --api http://localhost:3001/api/v1 --url http://localhost:5000
> node scripts/check-menus.mjs http://localhost:3001/api/v1 http://localhost:5000
                               ^^^ --api et --url ont disparu
```

Les scripts s'en accommodent : une URL nue contenant `/api` ou `:3001` est
prise pour l'API, l'autre pour le site, et la forme `--api=…` fonctionne
également. En cas de doute, appelez directement :

```bash
node scripts/check-menus.mjs --api http://localhost:3001/api/v1 --url http://localhost:5000
```

L'équivalent existe dans l'interface : bouton **« Copier vers les autres
langues »** de l'éditeur de menus, qui agit sur l'onglet courant.

### `node scripts/test-menu-auto.mjs` — garde-fous statiques

**Ce script n'exécute pas l'application et n'interroge aucun serveur.** Il
relit les fichiers source et vérifie par expressions régulières que certaines
décisions n'ont pas été défaites, en réimplémentant la logique de résolution
pour la tester isolément.

Il est utile contre les régressions de code, mais **il ne peut pas** détecter
un menu absent en base, une langue qui diverge, ni un défaut d'affichage. Pour
cela, utilisez `menus:check`.

## Le piège du sous-menu vide

Un tableau vide est vrai en JavaScript :

```js
Boolean([])   // true
```

Une entrée enregistrée avec `submenu: []` affichait donc un chevron et ouvrait
un panneau déroulant sans contenu. L'éditeur n'écrit plus de tableau vide, la
normalisation s'applique à tous les emplacements, et l'affichage teste la
longueur plutôt que la présence. `menus:check` signale les entrées encore
concernées en base ; `menus:sync` les nettoie en recopiant.

## Ce que peut être un `href` de menu

Deux formes, et une seule règle pour les deux (`lib/link-kind.mjs`) :

| Saisie | Enregistré | Servi par la vitrine |
|---|---|---|
| `contact`, `/fr/contact`, `/contact/` | `/contact` | `/fr/contact`, `/en/contact`, `/ar/contact` |
| `https://exemple.com/campagne`, `//cdn…` | tel quel | tel quel, dans un nouvel onglet |
| `mailto:` `tel:` `sms:` `whatsapp:` | tel quel | tel quel, **sans** nouvel onglet |
| `#resultats` | `#resultats` | `/fr/resultats` (une ancre ne se préfixe pas deux fois) |

Le chemin interne s'enregistre **sans préfixe de langue** : la langue affichée est
celle du visiteur, pas celle de l'administrateur qui a saisi le lien. Réciproquement,
une adresse externe ne doit jamais en recevoir un — `/fr/https://exemple.com` n'est
pas un lien, c'est une page introuvable.

L'atelier applique la même règle que la vitrine, au lieu d'en avoir une sienne :
`components/admin/SlugPicker.tsx` normalise à la sortie du champ (barre initiale,
préfixe de langue en trop retiré, `https://` ajouté à une adresse nue) et le dit à
l'écran ; `components/layout/Header.tsx` et `Footer.tsx` résolvent via `menuHref`.
Avant ce lot, le bandeau laissait une URL externe intacte et le pied de page la
préfixait : le même menu marchait en haut, cassait en bas.

Au clavier, dans le champ « Lien libre (URL manuelle) » : **Entrée** fige la valeur
et referme, **Tab** passe au champ suivant. L'icône de lien à droite du champ n'est
pas décorative — elle replace le curseur dans le champ, et le curseur y va déjà tout
seul quand on choisit ce type de lien.

Deux contrôles, et aucun des deux connecté à une base :

```bash
npm run links:test    # la règle, à plat, 10 assertions sans serveur
npm run routes:check  # confronte les chemins proposés par le sélecteur aux pages du disque
```

`routes:check` échoue si le sélecteur offre une page qui n'existe pas (un 404 prêt à
l'emploi) et signale, sans bloquer, les pages de la vitrine qu'il ne propose pas
encore — c'est ainsi qu'a été repérée l'absence de la **Vérification de garantie**
(`/verification`), désormais dans la liste, avec le sommaire `/legal`.

## Visibilité du pied de page

Les interrupteurs de **Administration → Visibilité** sont enregistrés dans le
**navigateur** (`localStorage`, clé `sari_site_visibility`), pas en base. Deux
conséquences à connaître :

- ils s'appliquent à **toutes les langues à la fois** : masquer un lien du
  pied de page le masque aussi en arabe ;
- ils ne valent que **sur le poste où ils ont été modifiés**, et ne suivent ni
  les autres navigateurs ni les autres utilisateurs.

Clés concernées : `footer.<id>` pour le lien lui-même, `page.<id>` et
`module.<id>` pour la cible. Un lien dont la cible est masquée disparaît aussi.

Les entrées créées depuis l'administration portent un identifiant aléatoire,
sans clé de visibilité correspondante : elles restent donc toujours visibles.

## Marche à suivre pour harmoniser

1. **Administration → Menus**, choisir la langue de référence.
2. Composer le menu, enregistrer.
3. **« Copier vers les autres langues »** — à répéter pour chaque emplacement
   (Principal, Pied navigation, Pied légal), le bouton n'agissant que sur
   l'onglet courant.
4. Basculer sur chaque langue pour traduire les libellés.
5. Contrôler : `npm run menus:check`.
