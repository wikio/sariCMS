# Visibilité de la vitrine

Masquer un menu, une page, un module, une section ou un bouton sans toucher au
code, depuis **Administration → Visibilité**.

## Ce qui a changé

| | Avant | Maintenant |
|---|---|---|
| Stockage | `localStorage` du navigateur | Table `settings`, une entrée par langue |
| Portée langue | Commune aux trois langues | **Propre à chaque langue** |
| Portée utilisateur | Le poste où le réglage a été fait | **Tous les visiteurs** |
| Rendu serveur | Non — les liens clignotaient | Oui, l'état est connu avant le premier rendu |

Masquer « Carrières » en français ne le masque donc plus en arabe, et le
réglage vaut pour vos visiteurs, pas seulement pour votre navigateur.

## Où c'est enregistré

Table `settings`, sous les clés `visibility.fr`, `visibility.en`,
`visibility.ar` — la valeur est un objet JSON. **Aucune migration n'est
nécessaire** : la table existait déjà.

Seules les **exceptions** sont enregistrées. Une clé absente vaut la valeur
par défaut déclarée dans `VISIBILITY_GROUPS` (`lib/site-visibility.ts`). Une
langue sans réglage particulier a donc une valeur vide `{}` — c'est normal, et
c'est ce qui permet d'ajouter de nouveaux éléments sans réécrire la base.

## Utilisation

1. **Administration → Visibilité**
2. Choisir la **langue** en haut de l'écran. Le compteur à côté de chaque
   langue indique le nombre de réglages qui s'écartent des défauts.
3. Basculer les interrupteurs : l'enregistrement est immédiat.
4. **« Copier vers les autres langues »** applique les réglages de la langue
   affichée aux deux autres.
5. **« Réinitialiser »** rétablit les défauts, pour la langue affichée
   seulement.

## Clés de filtrage

Un lien disparaît si sa propre clé est à `false`, **ou** si la clé de sa cible
l'est :

| Préfixe | Ce qui est masqué |
|---|---|
| `menu.<id>` | Entrée du menu principal |
| `footer.<id>` | Lien du pied de page |
| `page.<id>` | La page elle-même, et tout lien qui y mène |
| `module.<id>` | Un module vitrine entier |
| `section.<id>` | Une section de la page d'accueil |
| `button.<id>` / `action.<id>` | Un bouton ou une action |

Les entrées créées depuis le gestionnaire de menus portent un identifiant
aléatoire, sans clé de visibilité correspondante : elles restent donc toujours
visibles. Pour pouvoir les masquer, donnez-leur un identifiant explicite.

## API

Lecture publique, sans jeton :

```
GET /api/v1/public/visibility?locale=fr
→ { "footer.events": false }
```

Écriture, permission `settings:update` :

```
GET    /api/v1/visibility?locales=fr,en,ar   Réglages de plusieurs langues
GET    /api/v1/visibility/:locale            Réglages d'une langue
POST   /api/v1/visibility/:locale            Remplace  { overrides: {…} }
PATCH  /api/v1/visibility/:locale            Bascule   { key, on }
POST   /api/v1/visibility/copy/all           Copie     { from, to? }
DELETE /api/v1/visibility/:locale            Rétablit les défauts
```

Les valeurs sont filtrées à l'écriture comme à la lecture : seuls des booléens
sous des clés plausibles sont conservés. Une clé mal formée ou une valeur non
booléenne est ignorée silencieusement plutôt que de faire échouer la requête.

## Vérification

```bash
npm run visibility:test -- --email admin@sarisysteme.com --password '…'
```

Dix-neuf contrôles fonctionnels contre un serveur en marche : lecture publique
sans jeton, refus de l'écriture anonyme, **indépendance des langues**,
persistance, copie, réinitialisation, et rejet des données mal formées. Les
réglages d'origine sont restaurés à la fin, même en cas d'échec.

Sans identifiants, seuls les contrôles de lecture s'exécutent.

## Fonctionnement interne

- `lib/visibility-server.ts` — lecture, utilisable côté serveur **et** client.
  Le module client porte `'use client'` et ne peut pas être appelé depuis le
  layout ; d'où ce fichier séparé.
- `app/[locale]/layout.tsx` — lit les réglages de la langue et les passe au
  fournisseur.
- `components/layout/VisibilityProvider.tsx` — amorce l'état de façon
  synchrone, avant le premier rendu des enfants, pour éviter qu'un lien masqué
  n'apparaisse brièvement.
- `lib/site-visibility.ts` — `useVisibility()` conserve sa signature d'origine
  (un dictionnaire clé → booléen) : les composants qui la consomment n'ont pas
  changé.

Si l'API est injoignable, la vitrine applique les valeurs par défaut, et le
dernier état connu est réutilisé depuis `localStorage` comme secours hors
ligne.
