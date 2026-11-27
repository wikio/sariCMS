# API publique des visuels

Toutes les routes ci-dessous sont en lecture publique (`/api/v1/public/graphics/...`) et renvoient directement une image binaire. Les routes de génération d’image sont limitées à 60 requêtes par minute et par adresse IP, en plus de la limite globale de l’API. Les cartes sont générées à la demande; elles ne créent pas de fichier dans la GED.

## Visuel social à partir d’un contenu publié

```text
GET /api/v1/public/graphics/social/{source}/{id}?platform=linkedin&locale=fr
```

Sources prises en charge : `articles`, `news`, `announcements`, `tips` (actualités), `events`, `products`, `services`, `solutions`, `pages`. L’identifiant peut être le slug ou l’identifiant publié du contenu. Les contenus non publiés ne sont pas accessibles.

Formats et dimensions par défaut :

| `platform` | Dimensions |
| --- | ---: |
| `youtube` | 1280 × 720 |
| `youtube-banner` | 2560 × 1440 |
| `instagram` | 1080 × 1080 |
| `instagram-story` | 1080 × 1920 |
| `facebook` | 1200 × 630 |
| `facebook-cover` | 1640 × 624 |
| `linkedin` | 1200 × 627 |
| `x` | 1200 × 675 |
| `pinterest` | 1000 × 1500 |
| `og` | 1200 × 630 |

La carte reprend le titre, le chapô/résumé et l’image du contenu; les paramètres `title`, `summary`, `subject` et `image` peuvent les remplacer. `image` doit être un chemin GED `/uploads/...`. Les fichiers locaux sont lus dans la GED; un média HTTPS distant n’est lu que si son hôte correspond à `PUBLIC_SITE_URL` ou à `GRAPHICS_ALLOWED_IMAGE_HOSTS`. Le logo est lu depuis la marque configurée du site; `logo=none` le masque.

Paramètres graphiques : `bg`, `bg2`, `accent`, `textColor`, `effectColor`, `borderColor` en hexadécimal `#RRGGBB`; `theme=sari|clinical|midnight|editorial|aurora|lime`; `layout=full|split-left|split-right|diagonal`; `effect=none|tint|negative|screen|multiply|soft-light|overlay` avec `effectOpacity` (0–0.9) et `imageOpacity` (0–1); `borderWidth` (0–36 px), `borderRadius` et `blockRadius` (0 par défaut); `grid=1` ajoute une grille de repérage; `align=left|center|right`, `direction=ltr|rtl`, `locale=fr|en|ar`; `titleX` (3–97 %) et `titleY` (15–90 %) placent le bloc de texte, `titleScale` et `logoScale` règlent leurs tailles; `font` choisit le nom de famille de police configurée/Google Fonts disponible dans l’environnement de rendu; `overlay` (0–0.88); `logoPosition=top-left|top-right|bottom-left|bottom-right`; `icon` permet de remplacer l’icône de la fiche service/solution/produit. Les cartes événementielles affichent automatiquement dates et lieu; les cartes d’articles reprennent le sujet/catégorie et le chapô. `format=png|jpeg|webp`. Ajouter `qr=1` pour inclure un QR code; `url` définit l’adresse encodée et `qrPosition` règle son coin. Sans `url`, le lien est construit avec `PUBLIC_SITE_URL` (backend) et le slug du contenu.

Exemple pour une balise Open Graph :

```html
<meta property="og:image" content="https://api.example.com/api/v1/public/graphics/social/articles/mon-article?platform=og&amp;locale=fr&amp;qr=1">
```

L’atelier d’administration est accessible dans **Médias → Visuels sociaux & codes**. Il permet de sélectionner le contenu, de régler format, couleurs, contraste, alignement et positions, puis de copier l’URL publique ou d’enregistrer une copie PNG dans la GED pour la modifier par glisser-déposer dans l’atelier graphique.

## QR code

```text
GET /api/v1/public/graphics/qr?data=https%3A%2F%2Fexample.com&size=512&color=%23172F55&background=%23FFFFFF&margin=2
```

Renvoie un PNG. `size` est limité à 128–1200 px.

## Code-barres

```text
GET /api/v1/public/graphics/barcode?data=SARI-2026&type=code128&color=%23172F55&background=%23FFFFFF&scale=3&height=18
```

Renvoie un PNG. Types disponibles : `code128`, `ean13`, `ean8`, `upca`, `upce`, `itf14`, `isbn`, `code39`, `datamatrix`. Les données incompatibles avec le type choisi reçoivent une réponse HTTP 400.
