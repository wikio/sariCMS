# Atelier graphique (planches, GED et gabarits)

L'atelier dessine des visuels — post carré, story, bannière, affiche, carte de visite —
et les range dans la **GED** avec leur JSON d'édition. Un seul écran, quatre entrées :

| Où | Comment | Ce que ça fait |
| --- | --- | --- |
| Constructeur de page | double-clic sur un bloc `<img class="sari-canvas">` | réouvre la planche de l'asset |
| Constructeur de page | traits **Éditer la planche** / **Retoucher** / **Remplacer** | idem, ou ouvre la retouche d'image |
| Administration → **Atelier graphique** | **Nouvelle planche**, un format, un gabarit | crée une planche et l'enregistre dans la GED |
| Médiathèque | bouton **Palette** sur une vignette (`/admin/media?file=` → l'atelier) | part du rendu d'une image existante |

Deux sorties distinctes, et c'est voulu : **Enregistrer** écrit dans la GED ; **Insérer
dans la page** enregistre puis rend la référence au bloc. Une planche non enregistrée
n'existe pas — aucun brouillon local ne traîne.

## Pourquoi un `<img>` dans la page, et le JSON à côté

Le bloc posé dans GrapesJS est un `image` **étendu** (`extend: 'image'`), pas un
composant React dans le cadre :

```html
<figure class="sari-figure">
  <img class="sari-canvas" data-sari-canvas="canvas/CANVA_mdz4k9_affiche.png"
       src="/uploads/canvas/CANVA_mdz4k9_affiche.png" alt="…" width="1080" height="1080"
       loading="lazy" decoding="async">
</figure>
```

- la vitrine rend la page **sans JavaScript** (`components/builder/BuiltPage.tsx`) : le
  bloc doit rester de l'HTML nu ;
- `sanitizeBuilderHtml` (`lib/home/config.ts`) laisse passer `class` et `data-*` : le lien
  de réédition survit à l'enregistrement de la page ;
- le JSON de l'atelier ne vit **pas** dans la page, il vit avec l'image dans la GED — une
  page qui embarquerait ses calques pèserait le poids de ses calques.

Étendre `image` est aussi ce qui garantit l'absence de régression : redimensionner,
remplacer la source, l'alt et le panneau de style restent ceux de l'éditeur.

## Un média qui ne se laisse pas déplacer, ou une planche qui s'ouvre vide

Deux pannes avaient le même goût — « l'image se pose au centre et on ne peut rien en faire »,
« les gabarits sont vides ». Elles viennent de deux endroits différents, et l'atelier les
traites maintenant explicitement.

**Le média importé.** Une image posée sur la planche (`Importer depuis la GED`, glisser-déposer,
réédition d'un simple rendu) arrive **au pointeur, avec 20 % de marge autour**, et l'atelier
repart en outil « Sélection ». Sans marge, un posé « contain » remplissait le plan de travail au
pixel près : les poignées de Fabric tombaient hors écran et le calque paraissait scotché. Sans
retour en mode sélection, un média importé pendant que le pinceau ou « Déplacer le plan » était
actif restait **non saisissable** — `applyTool()` rend les objets inerte hors de l'outil Sélection.
Les flèches du clavier (±1 px, ±10 px avec `Maj`) déplacent ce qui est sélectionné.

**Le gabarit ou la planche qui s'ouvre vide.** Fabric 6 ne charge pas un document image par
image : **un** `src` injoignable (média supprimé du disque, URL d'un ancien dossier, `crossOrigin`
hérité d'un enregistrement sur un autre serveur) fait rejeter `loadFromJSON` **entier**. L'atelier
affichait alors une planche blanche, sans un mot sur le fichier fautif. `loadResilient()` tente le
document complet, et en cas d'échec le rejoue **sans ses images** (`withoutImages()`), avec un fond
blanc à la place d'un fond en image : le format, les textes, les masques et l'ordre des calques
sont conservés, et le bandeau nomme les visuels qui ont sauté. Les images restantes se re-posent
depuis la GED, cadre par cadre.

**« Atelier indisponible : trying to initialize a canvas that has already been initialized. »**
Le moteur pose sur son élément un attribut `data-fabric`, et Fabric refuse le second passage
sur la **même** balise. `ensureCanvas()` réutilisait le `<canvas>` trouvé dans l'hôte : dès
qu'un moteur mourait à mi-chemin (import d'une image absente, asset introuvable), l'élément
marqué restait dans un `div` que React ne démonte pas, et l'atelier devenait définitivement
indisponible — seul un rechargement de page le sauvait. `ensureCanvas()` crée désormais un
élément **neuf à chaque vie du moteur**, `purgeFabricDom()` efface les vestiges avant
d'ouvrir comme après un échec, et le bandeau d'erreur offre « Redémarrer l'atelier ».

**Une sauvegarde qui échoue ne ferme plus la fenêtre.** `save()` rend `null` (il ne rejette
plus : plus personne n'écoute la promesse) et annonce la panne dans la barre d'état ; le
bouton « Fermer » comme `Échap` demandent une confirmation explicite quand la planche est
modifiée **et** qu'un avertissement est affiché.

## Les gestes du rail : pinceau, gomme, formes, texte

| Geste | Ce qui se passe | Ce qui a été cassé, et pourquoi |
|---|---|---|
| **Pinceau** (rail) | `isDrawingMode`, tracé `Path` au doigt. Le curseur de la barre d'état règle la **pointe des deux brosses** (1–160 px) et la couleur ; un aperçu rond montre l'épaisseur. | `setBrush` ne resynchronisait pas la gomme, et `Fluidité` était envoyé en fraction à un code qui divisait par 100 : le réglage partait dans le vide. |
| **Gomme** | Le même geste, en `destination-out` : elle **troue ce qu'elle recouvre**, fond compris. | Elle ne creusait pas les fonds : Fabric peint `backgroundColor` dans un chemin séparé, hors de portée de la composition des objets. Le fond est devenu un **objet** `Rect` marqué comme aide — jamais dans l'état, jamais dans les calques, mais présent à l'export PNG/SVG. |
| **Formes** (menu du rail) | Un clic **pose la forme** sous le curseur, sélectionnée, dans les calques. | Le menu appelait `setTool('rect')` : une forme n'est pas un outil. L'outil inconnu gelait l'atelier (ni brosse, ni saisie) — « les formes ne s'affichent pas ». `applyTool()` les accepte maintenant par tolérance. |
| **Texte** | Soit le bouton « Texte » du rail (une zone au curseur), soit l'outil Texte **puis un clic n'importe où sur le plan** : la zone est créée et entre en édition. | L'outil ne posait rien : le curseur passait en `text`, sans écouteur de création. |
| **Sélection directe** | Un clic sur un objet le saisit, poignées comprises. `perPixelTargetFind` pour les aplats (on ne traverse pas le trou d'une étoile), boîte entière pour les images, détection au trait pour les tracés de pinceau. | `canvas.selection = tool === 'select'` — et Fabric ne consulte la cible sous le curseur **que si** `selection` est vrai (Canvas._onMouseDownInNormalMode). Tous les calques étaient ingouvernables au clic, la liste des calques restait le seul chemin. |
| **Poignées** | Rotation et mise à l'échelle ont des **curseurs dédiés** pendant la main (`alias` en rotation, `nesw-resize` aux coins, `ew-resize` en cisaillement). | — |

## Les gabarits, pas à pas

1. Rail de gauche → **Gabarit** : la liste vient de `/api/admin/ged/templates`, et si l'API est muette, de
   `public/canvas/templates/index.json` relu en statique (`guessTemplates`). Les cinq gabarits livrés sont
   `post-carre`, `story-verte`, `banniere-web`, `affiche-a3`, `carte-visite`.
2. **Un clic sur une vignette applique** le gabarit : le plan de travail prend son format, ses calques entrent
   dans la pile, son fond (uni, dégradé ou image) est rejoué.
3. **Les zones modifiables** apparaissent en bas du panneau de droite (« Zones du gabarit ») : texte, couleur,
   image. Pour une zone d'image ou de couleur, **« Choisir dans la GED »** ouvre le navigateur en mode
   *ce cadre* — le média pris y atterrit, il ne s'ajoute pas en vrac.
4. Le fond en image d'un gabarit dont le fichier a disparu **ne vide plus la planche** : `loadResilient()`
   rejoue sans ses images et le bandeau nomme ce qui a sauté.
5. Publier le travail en gabarit : « Réglages » → *Publier comme gabarit* écrit
   `public/canvas/templates/<id>.json` et met `index.json` à jour.

## Déposer, importeur, double-clic

- **Glisser une vignette de la GED sur le plan** : `GedAssetBrowser` écrit
  `application/x-sari-ged` (`{file,url,kind}`) dans la `DataTransfer` ; au dépôt, l'atelier la lit et **pose le
  média sous le curseur** (`pointerFromEvent`). Une planche (`kind: canvas`) s'*ouvre* en réédition plutôt que
  de se coller comme image.
- **Glisser un fichier du poste** sur le plan, sur la fenêtre, ou la liste : il est écrit dans la GED puis posé
  au point de dépôt — un SVG en objets modifiables, jamais rastérisé.
- **Double-clic sur une vignette** = poser tout de suite (simple clic = préparer, le geste du sélecteur de
  champ ; `Espace` fait aussi le geste). Dans le navigateur de la GED en panneau latéral, la même règle vaut.

**Un calque figé.** Les gabarits verrouillent leurs cartouches et leur fond : un calque verrouillé
ne se saisit pas, ce qui se lit « rien n'est déplaçable ». Le panneau **Calques** affiche alors
« Tout déverrouiller » dans son titre, et l'icône de cadenas reste le geste unitaire.

**Une zone de gabarit** (« Zones du gabarit », à droite) se remplit maintenant par
**« Choisir dans la GED »** : le prochain média sélectionné va dans *ce* cadre, il n'est pas ajouté
en vrac au-dessus de la planche. Taper une URL à la main reste possible, mais n'est plus le seul
chemin.
## Où vit quoi

```
lib/canvas/types.ts        les contrats : planche, objet, fond, gabarit, événement
lib/canvas/document.ts     les règles pures : formats, couleurs, dégradés, alignements,
                           gabarit → zones, données de graphique → SVG, historique
lib/canvas/fonts.ts        les familles (Google), empilées à la française
lib/canvas/engine.ts       le moteur Fabric : outils, calques, filtres, masques, ancres
lib/ged/prefix.mjs         la politique de noms et de préfixes (source de vérité)
lib/ged/manifest.mjs         la fiche `.sari.json` : fusion, bornes, séparation
lib/ged/store.mjs          le magasin de fichiers (`public/uploads`, `public/canvas`)
lib/ged/client.ts          le client du navigateur (bascule CMS ↔ Next)
lib/ged/http.ts            les helpers des routes (`failure`, lecture de corps…)
app/api/admin/ged/         les routes : assets, asset, asset/state, canvas-export, templates
backend/src/modules/ged/   les mêmes routes côté NestJS, sur le même magasin de fichiers
components/canvas/         l'atelier React : fenêtre, panneaux, widgets, navigateur GED
components/builder/CanvasStudioHost.tsx  les fenêtres montées pour GrapesJS (pont React)
lib/builder/sari-canvas.ts                le plugin : type `sari-canvas`, bloc, sélecteur d'actifs
lib/builder/sari-canvas-bridge.ts         la file de requêtes atelier ↔ éditeur
public/canvas/templates/   le catalogue de gabarits (JSON Fabric + `index.json`)
```

`engine.serialize()` écrit le JSON Fabric **plus** une enveloppe `sariStudio` (taille du
plan, fond quand c'est un dégradé ou une image). Sans elle, une story 1080×1920 se
réouvrirait en carré 1080 et un fond dégradé redeviendrait blanc : l'image publiée et le
JSON censé en renaître ne parleraient plus de la même planche.

## Les trois fichiers d'un enregistrement

`POST /api/admin/ged/canvas-export`, et son jumeau `POST /api/v1/ged/canvas-export`,
écrivent d'un seul mouvement :

1. `canvas/CANVA_<graine>_<libellé>.png` — le rendu, celui que la page affiche ;
2. `…svg` à côté, **seulement** si le document est entièrement vectoriel ;
3. `…png.sari.json` — la fiche (légende, étiquettes, dimensions, page d'origine,
   versions) avec l'état éditable dedans s'il tient en 240 Ko, sinon
   `…sari.canvas.json` à côté.

Réécrire la même planche **garde le nom** — aucun lien déjà publié ne casse — et archive
le contenu précédent en `-v2`, `-v3`… jusqu'à vingt entrées. Une suppression simple
laisse les archives ; `?history=1` les emporte.

Un fichier posé à la main dans `public/uploads/ged/` reste un asset exploitable : le
fichier est la vérité, la fiche n'ajoute que ce que l'extension ne peut pas porter.

## Ajouter un gabarit

**Depuis l'atelier** : menu **Exporter → Publier comme gabarit**. Cela écrit
`public/canvas/templates/<id>.json` et range la fiche dans `index.json`. L'identifiant
est un nom de fichier : minuscules, chiffres, tirets.

**À la main** : un JSON Fabric + une entrée dans `public/canvas/templates/index.json` :

```json
{
  "version": 2,
  "templates": [
    {
      "id": "post-carre",
      "title": "Post carré 1080",
      "description": "Un titre, une accroche, un appel.",
      "category": "réseaux",
      "format": { "width": 1080, "height": 1080, "name": "Carré 1080", "orientation": "carré" },
      "palette": ["#0B1220", "#199ACA", "#C6DA34", "#F7F9FB"],
      "preview": null,
      "file": "templates/post-carre.json",
      "version": 1,
      "tags": ["réseaux", "dégradé"]
    }
  ]
}
```

L'index fait foi — un fichier non déclaré n'est pas proposé — mais il est recalé sur le
disque à chaque lecture : retirer le JSON suffit à faire disparaître l'entrée. Le
catalogue est **statique** (ni table ni migration) et s'ajoute donc au code : deux
gabarits qui se ressemblent se lisent dans `git diff`.

### Les zones modifiables

Un objet du JSON qui porte `slotId` devient une zone réglable sans redessiner. Le type de
zone se déduit de l'objet, pas d'une déclaration séparée :

| L'objet | Devient | Réglé par |
| --- | --- | --- |
| un texte (`text`, `textbox`) | zone de texte | un champ, qui écrit `text` |
| une image | zone d'image | une URL de la GED, via `replaceImage` |
| une forme | zone de couleur | un nuancier, via `setPaint('fill', …)` |

`slotLabel` est ce que lit l'interface (« Titre », « Logo », « Bande basse »). Un gabarit
sans `slotId` se charge quand même : il devient un point de départ à reprendre objet par
objet.

## Étendre les préfixes de la GED

La table associe un type à son préfixe et à son dossier :

```js
canvas: { prefix: 'CANVA_', module: 'canvas', extensions: ['png', 'svg', 'webp', 'jpg'] },
image:  { prefix: 'IMG_',   module: 'ged',    extensions: ['png', 'jpg', 'webp', 'gif', 'avif'] },
svg:    { prefix: 'SVG_',   module: 'ged',    extensions: ['svg'] },
doc:    { prefix: 'DOC_',   module: 'ged',    extensions: ['pdf', 'zip', 'csv', 'xlsx', 'doc', 'docx'] },
```

**Un type absent de la table n'est pas une erreur** : il devient son propre dossier et son
propre préfixe (`audio` → `audio/AUDIO_…`). Brancher un contenu généré de plus (`CARTE_`,
`FACTURE_`, `LOGO_`) ne demande donc ni retouche de schéma ni migration.

Pour fixer un dossier ou un préfixe qui ne suivent pas la déduction, une surcharge suffit,
prise de la configuration et non du code :

- back-office : réglages `sari_admin_settings` → clé `ged.prefixes` ;
- API : `GED_PREFIX_OVERRIDES={"audio":{"prefix":"SND_","module":"media"}}`.

`validateOverrides` refuse une entrée mal formée **au lieu de l'ignorer** : un préfixe qui
ne respecte pas la convention (3 à 12 capitales, `_` final) rend le nom illisible par les
écrans qui le découpent.

Côté backend, la table est recopiée dans `backend/src/modules/ged/ged-prefix.policy.ts`,
parce que `nest build` (`rootDir: ./src`) refuse un import hors de `src`. Le doublon est
tenu par un test : `ged-prefix.policy.spec.ts` relit le `.mjs` du frontend, compare
préfixes, dossiers et extensions écrivables.

## Brancher un outil de plus

Un outil, c'est trois points :

1. **la règle pure** dans `lib/canvas/document.ts` — ce que l'outil produit, décrit en
   données (`AlignMode`, `ChartSpec`, `CropRect`). C'est là que se testent arrondis,
   bornes et le cas « un seul objet sélectionné » ;
2. **le geste** dans `lib/canvas/engine.ts` : `setTool` connaît l'identifiant, un
   gestionnaire d'événements Fabric applique la règle, et la fin du geste appelle
   `commit('libellé')` pour que l'historique compte une entrée par intention, pas par
   pixel de souris ;
3. **la commande** dans `components/canvas/panels.tsx` : le panneau lit `selectedProps()`,
   écrit dans le moteur, et ne garde aucune copie de la sélection.

Deux conventions tiennent le reste :

- les objets d'aide (poignées d'édition de tracé) portent la marque `sari-helper` :
  `layers()`, la SVG et le PNG les ignorent — sinon un outil de retouche laisserait des
  ronds verts dans l'image publiée ;
- ce qui ne se rejoue pas seul (le texte sur tracé) est aussi écrit dans une propriété
  maison (`sariCurve`) listée dans `EXTRA_PROPS`, parce que Fabric **sérialise** ces
  objets mais ne les **réveille** pas.

`Engine` est le seul point d'entrée des panneaux : ils n'importent pas Fabric. Un outil
qui toucherait `canvas` en direct passerait à côté de l'historique, du masquage des aides
et du `render()` déclenché à la main — trois choses dont dépend la fluidité à
50–100 calques.

## Ce que l'export sait, et où il s'arrête

- **PNG ×1/×2/×3/×4** : fidèle au pixel près. `toDataURL({ multiplier })` ne dépend pas de
  la densité d'écran (`enableRetinaScaling` reste à `false` dans le moteur) : le fichier
  sorti de l'atelier est identique à celui que verrait le visiteur.
- **SVG** : produite quand le document est entièrement vectoriel. Une planche avec des
  images, du texte sur tracé ou un coup de gomme (`destination-out`) est marquée —
  `toSvgString()` rend `{ svg, vectorOnly, note }` — et le PNG reste la copie de confiance.
- **JSON de l'atelier** : le document rejouable, pour reprendre le travail plus tard ou
  ailleurs.
- **Copier le bloc HTML** : un `<figure><img …></figure>` collable dans un bloc code.
  Aucune écriture de `.html` dans la GED, volontairement : `public/uploads` est servi
  statiquement, et un HTML qu'on peut y poser est un script dans le domaine du site.

## Le contrat d'un média, côté écrans

Un écran de l'admin — la médiathèque, le sélecteur d'actifs de GrapesJS, l'atelier —
ne manipule jamais une URL nue : il manipule une **référence** `module/fichier`, et
l'URL en découle (`assetUrl`, dans `lib/ged/prefix.mjs`). Trois règles en découlent,
et chacune a déjà coûté une panne :

- **l'URL est le chemin réel du fichier**, y compris pour un média posé à la racine de
  `public/uploads` ; reconstituer `/uploads/ged/<nom>` à partir du module par défaut
  répondait « Image non chargeable » à la retouche et ouvrait l'atelier sur une planche
  vide ;
- **un média se réédite avec `file`** (alias `target` côté Next) : c'est ce qui garde la
  même URL et archive l'ancien contenu en `-vN`. Un export sans cette clé publie une
  planche neuve et laisse les pages sur la version d'avant ;
- **`file`, dans un `multipart`, est la partie binaire** ; la destination s'appelle
  `target`. Les confondre écrivait un asset nommé `[object File]`.

`docs/GED-MYSQL.md` reprend ces règles avec le tableau des surfaces (routes Next ↔
API Nest), le réglage MySQL (`DB_DRIVER`, `GED_UPLOAD_DIR`, `GED_CANVAS_DIR`,
`GED_PREFIX_OVERRIDES`), le forçage `localStorage.setItem('sari_ged_surface','next')`
et une liste « panne par panne ».

## Vérifier

Trois garde-fous sont joués par `node scripts/test-ged.mjs` (section « L'atelier ouvre une
planche même abîmée ») : `withoutImages()` sur un document à images mortes, l'absence de
`instance.load(` dur dans `CanvasStudio.tsx`, et les clés de liste de la médiathèque. Pour
l'état d'un média réel, la vérification à la main reste la plus courte :

```bash
# 1. un média racine et son jumeau de même nom ne doivent pas collisionner
curl -s localhost:5000/api/admin/upload | python3 -c "
import json,sys
rows=json.load(sys.stdin)['files']
keys=[r['file'] for r in rows]
assert len(keys)==len(set(keys)), 'clés dupliquées'
print('médias', len(rows), '· clés uniques')"
# 2. un gabarit livré doit avoir ses objets, sans exigence CORS
curl -s "localhost:5000/api/admin/ged/templates?id=story-verte" | python3 -c "
import json,sys
d=json.load(sys.stdin); o=d['template']['objects']
print(len(o), 'objets ·', sum(1 for x in o if 'crossOrigin' in x), 'crossOrigin')"
# 3. un plan réédité doit retrouver son état
curl -s "localhost:5000/api/admin/ged/asset/state?file=canvas/<fichier>.png"
```

## Vérifier

```bash
node scripts/test-ged.mjs        # politique de noms, magasin, racine, versions, gabarits livrés
node scripts/check-builder-kit.mjs   # la fiche du bloc « Planche graphique » a bien ses classes
npm run intl:check               # les clés de l'atelier existent en fr, en, ar
cd backend && npx jest src/modules/ged   # le miroir backend : mêmes cas, même disque
```
