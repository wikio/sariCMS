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
npm run menus:sync -- --dry-run                 # simulation, sans jeton
npm run menus:sync -- --from fr --token <jwt>   # application réelle
npm run menus:sync -- --from fr --to ar
```

L'écriture passe par l'API d'administration : fournissez un jeton via
`--token` ou la variable d'environnement `ADMIN_TOKEN`. En simulation sans
jeton, la lecture se fait sur l'endpoint public.

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
