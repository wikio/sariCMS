# Pages légales — écrire en base, lire sur le site

Un document légal n'est pas un morceau du code du site : c'est du texte qui
change (un hébergeur déménage, une politique se relit, une CGV prend un
article). Il est donc stocké comme n'importe quelle page, édité dans le
back-office, et servi par la vitrine à une adresse fixe.

## Ce que voit l'éditeur

**Administration → Pages légales** (`/{langue}/admin/legal`). La liste est une
vue filtrée de la collection `pages` : `kind = 'legal'`. Rien de séparé n'est
créé pour le juridique, ce qui veut dire que le brouillon, la corbeille, la
duplication, la traduction par `legacyId` et le contrôle de visibilité
fonctionnent ici comme partout ailleurs.

Un bouton **Consulter** ouvre le document tel que le site le publie, dans un
onglet — c'est la seule façon de vérifier que la fiche atterrit bien où on
croyait l'avoir mise.

Les quatre champs de la fiche :

| Champ | À quoi il sert |
| ----- | -------------- |
| Titre | Le `<h1>` de la page publique et le libellé de la navigation entre documents. |
| **Type de document** | `mentions`, `privacy`, `conditions` ou `about`. **C'est lui qui décide de l'adresse publique**, pas le slug. |
| Slug | Libre. Utile pour les moteurs de recherche et pour les liens internes, jamais pour le routage du document. |
| Texte juridique | HTML. Les classes Tailwind du site (`mb-4`, `text-xl`, `list-disc`) sont disponibles ; le script et les gestionnaires d'événement sont retirés au rendu, comme partout ailleurs dans le CMS. |

## L'adresse publique

    /{langue}/legal/mentions      mentions légales
    /{langue}/legal/privacy       politique de confidentialité
    /{langue}/legal/conditions    conditions générales de vente
    /{langue}/legal/about         à propos

La table de correspondance tient en un fichier, `lib/legal-docs.ts` : la liste
des types, les libellés de l'administration et la résolution
`category` → type. Le pied de page, lui, est un menu (`menu.json`, bloc
`footerMenu.legal`) — ses liens sont donc éditables dans « Menus », pas ici.

## D'où vient le texte

La lecture se fait **document par document**, et non en tout-ou-rien :

1. la page `kind = 'legal'` publiée dans la bonne langue, si elle existe et
   qu'elle a un titre ou un texte ;
2. à défaut, `data/{langue}/legal.json`, même clé.

Un tout-ou-rien ferait une beauté à la première fiche créée et disparaître les
trois autres : la page `/legal/privacy` répondrait « introuvable » alors que son
texte est écrit dans le fichier. Le repli est donc par clé, et une fiche vidée
dans l'administration laisse le fichier en place — effacer un document légal
publié est un geste explicite (dépublier la page, ou supprimer sa ligne), pas
un texte qu'on sélectionne et qu'on remplace par rien.

## Les mettre en place, une fois

Deux chemins, le second est le plus court :

**Par la reprise complète des fichiers JSON** :

```bash
cd backend
node sql/migrate-data.mjs                       # régénère migrate-data.mysql.sql
mysql -u utilisateur -p base < sql/migrate-data.mysql.sql
```

**Par l'administration**, tableau de bord → **Importer le catalogue**. Le même
contenu est écrit, collection par collection ; un lot déjà présent est sauté
plutôt qu'écrasé (cochez « remplacer » pour rejouer). Les lignes refusées par la
base sont annoncées dans le rapport et n'interrompent plus le reste de l'import.

Après import, la page « Pages légales » doit lister douze lignes — quatre
documents × trois langues. C'est le nombre à contrôler : un import qui écrit
moins que ça a sauté quelque chose, et le rapport le dit.

## Ajouter un cinquième document

1. `lib/legal-docs.ts` : la clé dans `LEGAL_DOC_TYPES`, son libellé, et un
   indice de reconnaissance dans `HINTS` pour les fiches où `category` est vide.
2. `data/{fr,en,ar}/legal.json` : le texte de repli, sous la même clé.
3. `app/[locale]/legal/[type]/page.tsx` n'a pas besoin d'être touché : la
   navigation et le titre se construisent sur la liste.

Côté base, rien : une nouvelle clé est une nouvelle ligne de `pages`, pas une
colonne.
