# API des cartes sociales

`GET` et `POST /api/social-card` retournent un PNG généré côté serveur par Canvas. Les tailles préréglées sont `square` (1080×1080), `portrait` (1080×1350), `landscape` (1200×630), `widescreen` (1600×900) et `story` (1080×1920). Une largeur/hauteur explicite peut remplacer le préréglage (320 à 2560 px). Les styles sont sélectionnables par `style` ou `theme.style` : `presse-immersive` (photo plein cadre, dégradé bas, sans grille ni pixels), `modular-grid`, `editorial-grid`, `blueprint-grid`, `grille-plein-cadre`, `sans-photo-blocs` et `sans-photo-minimal`. Les deux derniers désactivent l’image source; le premier compose une affiche en panneaux rectangulaires, le second privilégie la typographie avec une seule ligne d’accent.

## Exemple front-end

```js
const cardResponse = await fetch('/api/social-card', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'event',
    format: 'landscape',
    title: 'Journée portes ouvertes',
    topic: 'Événement',
    summary: 'Découvrez les nouveaux équipements et rencontrez notre équipe.',
    date: '2026-11-28',
    location: 'Montréal, Québec',
    imageUrl: '/uploads/events/portes-ouvertes.jpg',
    logoUrl: '/uploads/logo.png',
    url: 'https://example.ca/evenements/portes-ouvertes',
    networks: ['facebook', 'linkedin', 'instagram'],
    theme: {
      primary: 'rgb(15, 159, 110)',
      secondary: 'rgb(22, 158, 201)',
      accent: 'rgb(234, 182, 22)',
      background: '#0B0D10',
      foreground: '#FFFFFF',
      mode: 'dark',
      fontFamily: 'Inter, sans-serif',
      transparent: false,
    },
  }),
});
if (!cardResponse.ok) throw new Error((await cardResponse.json()).error);
const png = await cardResponse.blob();
document.querySelector('#social-card-preview').src = URL.createObjectURL(png);
```

`GET` est utile pour intégrer une image par URL :

```html
<img alt="Carte sociale" src="https://cms.example.ca/api/social-card?kind=article&amp;format=landscape&amp;title=Notre%20article&amp;url=https%3A%2F%2Fexample.ca%2Farticle">
```

Paramètres utilisables : `kind`, `format`, `width`, `height`, `style`, `logoUrl`, `imageUrl`, `topic`, `title`, `summary`, `location`, `date`, `url`, `networks` (liste JSON ou séparée par virgules), `brand`, `showLogo`, `includeQr`, `textScale`, `transparent` et `themeConfig` (objet JSON pour une requête GET). Les modèles `article`, `event`, `product`, `announcement` et `job` déterminent les champs affichés. Les champs vides sont omis, sans emplacement de remplacement. `sans-photo-blocs` et `sans-photo-minimal` ignorent toujours `imageUrl`; toutes les formes restent rectangulaires, sans coins arrondis.

L’API conserve le canal alpha si `transparent: true`; un panneau opaque carré protège la lisibilité des textes et le QR code garde sa marge blanche. Les images distantes ne sont téléchargées que depuis `images.unsplash.com`, `PUBLIC_SITE_URL` et les hôtes déclarés par `SOCIAL_CARD_ALLOWED_IMAGE_HOSTS` (ou `GRAPHICS_ALLOWED_IMAGE_HOSTS`). Configurez `SOCIAL_CARD_ALLOWED_ORIGINS` pour restreindre le CORS; par défaut l’API publique autorise `*` sans cookies/credentials.
