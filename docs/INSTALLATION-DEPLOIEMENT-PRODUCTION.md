# Installer sariCMS et le déployer en production

Ce guide prend pour référence **un VPS Ubuntu 24.04, Node.js 22 LTS, MySQL 8, systemd et Nginx**. Il ne suppose ni plateforme cloud ni accès à un serveur particulier. Remplacez `cms.example.org`, les adresses et les chemins si nécessaire. Les commandes sont pour Bash ; les commandes `sudo` sont des opérations d’administration, les builds se font **sans être root**.

```text
Navigateur ── HTTPS :443 ── Nginx ── 127.0.0.1:3000 Next.js (FR/EN/AR, SSR, /api/admin/*)
                            │                         └── /api/v1/* → 127.0.0.1:3001 NestJS → MySQL
                            └── /uploads/*, /canvas/* → fichiers persistants          └── SMTP
```

Ce n’est **pas une exportation statique** : les sessions, le proxy, les routes Next qui écrivent des fichiers et les tâches planifiées de Nest nécessitent les deux services. Un hébergement FTP seul ou un disque éphémère ne conviennent pas. Restez à **une instance de chaque service** dans cette recette : captchas en mémoire, fichiers locaux, limites de débit et tâches planifiées ne sont pas un système distribué.

> **Périmètre d’ouverture :** le modèle Nginx ci-dessous publie le catalogue et le back-office, **pas le tunnel commercial public**. La confirmation du navigateur, le rapprochement en base et l’encaissement sont trois choses distinctes. Les anciennes routes commandes/devis ne garantissent pas toutes une autorisation par propriétaire. Les tester avec des données fictives en préproduction privée ; voir les critères d’ouverture au §8.

| Votre situation | Point de départ |
|---|---|
| Je découvre le projet sans base SQL | §1, dans un répertoire local jetable |
| Nouveau site, base et volumes vides | §2 à §8, dans l’ordre |
| Site qui contient déjà des données | **§9 et §10 d’abord**. Ni seed, ni import du schéma initial |
| 502, page vide, upload perdu ou courrier non reçu | §8 et §11 |

## 1. Essayer le site en local

Installer Node **22.13 ou plus récent de la série 22** (la version de référence est dans [`.nvmrc`](../.nvmrc)), npm, Git et OpenSSL. Les scripts de contrôle utilisent des fonctions récentes de Node. Les deux `package-lock.json` sont distincts : installer les dépendances dans les **deux** dossiers.

```bash
git clone https://github.com/wikio/sariCMS.git
cd sariCMS
node -v && npm -v
umask 077   # les deux fichiers suivants contiendront des secrets
cp -n .env.example .env.local
cp -n backend/.env.example backend/.env
npm ci                         # à la racine : installe aussi @napi-rs/canvas et qrcode pour les visuels sociaux
(cd backend && npm ci)
```

Après un `git pull` qui ajoute/modifie des dépendances, relancer `npm ci` à la racine avant `npm run dev` ou `npm run build`. Les scripts `predev` et `prebuild` contrôlent maintenant que les dépendances du renderer social sont présentes et affichent la commande à exécuter si elles manquent.

Dans `backend/.env`, garder `NODE_ENV=development`, `DB_DRIVER=json`, `PORT=3001` et `CORS_ORIGINS=http://localhost:5000`. Choisir `SEED_ADMIN_EMAIL` et un `SEED_ADMIN_PASSWORD` personnel (au moins 16 caractères ; par exemple généré avec `openssl rand -hex 24`). Les valeurs d’exemple JWT sont uniquement pour le développement. Le seed lit `backend/.env`, ne crée **pas de catalogue**, n’affiche pas le mot de passe et refuse un magasin JSON déjà rempli.

```bash
# Terminal 1. Seed UNE SEULE FOIS, API arrêtée, sur ce magasin neuf.
cd backend
npm run seed
npm run start:dev

# Terminal 2, à la racine du dépôt
npm run dev
```

Ouvrir <http://localhost:5000/fr> et <http://localhost:5000/fr/admin>. L’accueil doit rester invité. `curl -fsS http://localhost:5000/api/v1/health` passe par Next ; `curl -fsS http://127.0.0.1:3001/api/v1/health` interroge Nest directement. Sans SMTP le courrier est enregistré sur disque, **pas livré**. Le pilote JSON ne requiert pas de client Prisma généré à l’exécution ; l’installation des dépendances Prisma peut néanmoins tenter de télécharger ses moteurs. Ce test ne valide pas MySQL.

## 2. Préparer le serveur, le réseau et la version

- Créer les enregistrements DNS A et, uniquement si IPv6 fonctionne, AAAA. Garder MySQL et les deux ports Node sur la boucle locale. Au pare-feu de l’hébergeur et de l’OS, ouvrir uniquement HTTP/HTTPS et votre accès SSH administré ; vérifier l’accès SSH **avant** d’activer le filtrage.
- Installer un Node 22 à jour, accessible dans `/usr/local/bin` ou `/usr/bin` **hors du HOME** : un service systemd ne charge pas `nvm` ni votre `.bashrc`. Prévoir de la place pour deux releases, deux arbres `node_modules`, `.next`, les médias et la sauvegarde. Compiler sur une machine avec de la marge mémoire ; à défaut, construire sur un hôte de même architecture, OS, OpenSSL et version de Node. Ne pas copier des dépendances macOS/Windows vers Linux.
- Autoriser le registre npm et, pour le build SQL, le téléchargement des moteurs correspondant à la version Prisma verrouillée (`binaries.prisma.sh` ou miroir interne approuvé). Autoriser aussi le SMTP sortant de votre fournisseur.

```bash
sudo apt update
sudo apt install git ca-certificates openssl curl xz-utils gpgv rsync acl mysql-server mysql-client nginx certbot python3-certbot-nginx
# Une seule fois. Le compte de service n'a pas de shell ni de privilèges sudo.
sudo useradd --system --user-group --home-dir /srv/saricms --no-create-home --shell /usr/sbin/nologin saricms
sudo install -d -m 0755 /srv/saricms
sudo install -d -o "$USER" -m 0755 /srv/saricms/releases
sudo install -d -o saricms -g saricms -m 0750 /srv/saricms/shared
sudo install -d -o root -g saricms -m 0750 /etc/saricms
sudo usermod -aG saricms "$USER"   # se reconnecter en SSH pour prendre le groupe
```

**Installer Node si le serveur ne dispose pas déjà de Node 22.13+ de la série 22.** Le paquet `nodejs` de la distribution n’est pas nécessairement de cette version. Utiliser le dépôt signé approuvé par votre exploitation, ou le [binaire Linux officiel de Node](https://nodejs.org/dist/latest-v22.x/). Dans ce second cas, choisir une version 22 maintenue et vérifier la signature avec un trousseau déjà approuvé selon les [instructions de vérification de Node](https://github.com/nodejs/node#verifying-binaries). Exemple pour une machine **sans installation Node globale à remplacer** :

```bash
( set -e
  NODE_VERSION='v22.X.Y'             # remplacer par la version exacte retenue
  KEYRING='/chemin/vers/node-release-keys.gpg'  # trousseau de confiance de l’opérateur
  case "$(dpkg --print-architecture)" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) exit 1 ;; esac
  tmp=$(mktemp -d); cd "$tmp"
  base="https://nodejs.org/dist/$NODE_VERSION"
  archive="node-$NODE_VERSION-linux-$arch.tar.xz"
  for f in "$archive" SHASUMS256.txt SHASUMS256.txt.sig; do curl -fSLO "$base/$f"; done
  gpgv --keyring "$KEYRING" SHASUMS256.txt.sig SHASUMS256.txt
  awk -v f="$archive" '$2 == f {print}' SHASUMS256.txt > checksum
  test -s checksum && sha256sum -c checksum || exit 1
  sudo tar --no-same-owner -xJf "$archive" -C /opt
  for cmd in node npm npx; do sudo ln -s "/opt/node-$NODE_VERSION-linux-$arch/bin/$cmd" "/usr/local/bin/$cmd"; done
)
node -v && npm -v && openssl version
```

Comme utilisateur de déploiement, préparer une **nouvelle** release à partir d’un SHA relu et approuvé. Sur une instance existante, ne jamais faire `git reset --hard`, `git clean` ou `rsync --delete` dans le site actif.

```bash
BASE=/srv/saricms
SHARED=$BASE/shared
REV='REMPLACER_PAR_LE_SHA_APPROUVE'
REL=$BASE/releases/$REV
test ! -e "$REL" && git clone https://github.com/wikio/sariCMS.git "$REL"
cd "$REL" && git checkout --detach "$REV" && git rev-parse HEAD
```

## 3. Configuration : séparer navigateur, runtime et secrets

Créer **une fois** `/etc/saricms/web.env` et `/etc/saricms/api.env` avec `sudoedit`. Propriétaire `root:saricms`, mode `0640` ; ne pas les placer sous `public/`, les committer, les envoyer dans les logs ou les joindre aux tickets. Les services chargent ces fichiers via `EnvironmentFile=`. Utiliser une valeur littérale par ligne (pas de substitution `$(...)`), guillemets pour les espaces. Générer **séparément** chaque secret dans un gestionnaire de secrets ou avec `openssl rand -hex 48`. Un seul doit être **identique** des deux côtés : `MAIL_INTERNAL_KEY`.

Préparer les fichiers **avant** de saisir des secrets. Cette boucle ne remplace pas le contenu d’une configuration existante :

```bash
for f in /etc/saricms/{web,api}.env; do
  sudo test -f "$f" || sudo install -o root -g saricms -m 0640 /dev/null "$f"
  sudo chown root:saricms "$f" && sudo chmod 0640 "$f"
done
sudoedit /etc/saricms/web.env /etc/saricms/api.env
```

**`/etc/saricms/web.env`** :

```dotenv
NODE_ENV=production
PUBLIC_SITE_ORIGIN=https://cms.example.org
NEXT_PUBLIC_CMS_API_URL=/api/v1
CMS_API_INTERNAL_URL=http://127.0.0.1:3001/api/v1
MAIL_INTERNAL_KEY=REMPLACER_PAR_LA_CLE_COMMUNE
```

**`/etc/saricms/api.env`** (exemple à adapter, pas des identifiants utilisables) :

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
API_PREFIX=api/v1
CORS_ORIGINS=https://cms.example.org
DB_DRIVER=mysql
DATABASE_URL="mysql://sari_app:MOT_DE_PASSE_ENCODE@127.0.0.1:3306/sari_cms"
JSON_STORE_PATH=/srv/saricms/shared/backend/storage/json
CACHE_L2_PATH=/srv/saricms/shared/backend/storage/cache/keyv.json
CATALOG_JSON_PATH=/srv/saricms/shared/data
GED_UPLOAD_DIR=/srv/saricms/shared/public/uploads
GED_CANVAS_DIR=/srv/saricms/shared/public/canvas
JWT_ACCESS_SECRET=REMPLACER_PAR_UN_SECRET_ALEATOIRE
JWT_REFRESH_SECRET=REMPLACER_PAR_UN_AUTRE_SECRET_ALEATOIRE
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
MAIL_INTERNAL_KEY=REMPLACER_PAR_LA_CLE_COMMUNE
SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=REMPLACER
SMTP_PASS=REMPLACER
SMTP_FROM="Votre site <noreply@example.org>"
```

- Le navigateur appelle **`/api/v1`**, jamais `localhost:3001`. `CMS_API_INTERNAL_URL` est une adresse **serveur** ; la destination des réécritures et les variables `NEXT_PUBLIC_*` sont fixées au **build**. Changement d’hôte/port interne → reconstruire Next et redémarrer. Les utilitaires `menus:*` acceptent aussi `API_URL` ou `--api` : inutile de publier une adresse privée dans le JS.
- Pas de secret JWT ni d’identifiant de secours à installer dans Next. Nest valide l’identité et le type `admin`. Une API arrêtée ne donne jamais accès au back-office. Le renouvellement Nest utilise un jeton opaque à rotation ; changer seulement `JWT_REFRESH_SECRET` ne révoque pas les sessions existantes. Garder les secrets stables entre redémarrages.
- Adapter le domaine, l’adresse d’expédition et le mot de passe SQL. Encoder les caractères réservés du nom/mot de passe dans l’URL (`@`, `:`, `/`, `%`, `#`…), ou choisir un secret hexadécimal aléatoire. N’utiliser ni `root` ni un compte SQL global pour l’application. `CORS_ORIGINS` contient des **origines exactes**, sans `/` final, séparées par des virgules ; pas de `*`.
- En MySQL, `JSON_STORE_PATH` reste important : le service mail lit `mail/smtp.json` et `mail/outbox.json` à côté de `json/`. Les réglages SMTP enregistrés en administration peuvent primer sur l’environnement. Port 587 = STARTTLS ; 465 = TLS implicite (`SMTP_SECURE=true`) selon le fournisseur. Renseigner SPF/DKIM/DMARC pour le domaine expéditeur. Ne pas utiliser le mode fichier comme preuve de livraison.
- Pour le [LLM de tri du contact](CONTACT-TRI-ET-ROUTAGE.md), les champs de l’administration priment sur `CONTACT_AI_URL`, `CONTACT_AI_MODEL` et `CONTACT_AI_API_KEY` de Nest. Conserver aussi le dossier privé à côté de `JSON_STORE_PATH` : il peut contenir la clé.

## 4. Installer et construire les deux applications

Dans `$REL`, **avant de lier les données et secrets réels**, installer à partir des verrous, dépendances de développement comprises. Le compilateur Nest, TypeScript, la CLI Prisma et le seed en ont besoin. Ne pas lancer la compilation dans `current` pendant que le site sert du trafic.

```bash
cd "$REL"
npm ci --include=dev
(cd backend && npm ci --include=dev && npm run build)
test -f backend/dist/main.js && test -d backend/dist/i18n
# URL identique à celle du runtime. Aucune donnée privée nécessaire pour builder.
NEXT_PUBLIC_CMS_API_URL=/api/v1 CMS_API_INTERNAL_URL=http://127.0.0.1:3001/api/v1 \
  npm run build -- --webpack
test -s .next/BUILD_ID
```

`npm run build` utilise Turbopack par défaut ; la commande ci-dessus utilise **Webpack**, recette vérifiée sur machine limitée. Sur petit serveur, limiter le parallélisme (`CIRCLE_NODE_TOTAL=2 RAYON_NUM_THREADS=1`) ou mieux construire ailleurs. Le pré-build recrée uniquement les copies `translate/{fr,en,ar}.json` ignorées par Git ; `intl:check` continue de bloquer les vraies divergences de l’atelier versionné. Ne pas embarquer le `data/` privé d’une ancienne installation dans le bundle client : construire depuis les sources de la release.

```bash
# Contrôles non destructifs sur la release, avant bascule
npm run intl:check && npm run builder:check && npm run quote:test && npm run front-auth:test
npm run admin-auth:test && npm run users:test && npm run storage:audit && npm run links:test
(cd backend && npm test -- --runInBand && npm run db:schema-test)
npm run lint             # vrai ESLint ; traiter/revoir les écarts, pas de --fix sur le serveur
```

Le build n’est pas un audit ESLint, un test de charge ou une recette MySQL. La commande de lint signale encore de la dette historique hors des parcours corrigés. À froid, Webpack peut signaler une dépendance de **cache de build** de `next-intl` (import dynamique dans l’extracteur) : ce n’est pas une erreur de traduction à l’exécution. En cas de doute reconstruire dans **une nouvelle release**.

## 5. Initialiser MySQL et le premier administrateur

**Installation neuve uniquement.** La voie de référence du dépôt part du DDL `backend/sql/schema.mysql.sql`. Il sélectionne **`sari_cms` en dur et contient des `DROP TABLE`** : lui passer un autre nom en argument ne change pas la cible. Sur une base existante, même vide en apparence, aller au §9. Pour une base nommée autrement, demander au DBA un DDL relu pour cette base ou un diff Prisma depuis un schéma vide ; ne pas exécuter ce fichier tel quel.

La commande ci-dessous conditionne l’import à la **création réussie** d’une base neuve. **Garder le `&&` et ne pas ajouter `IF NOT EXISTS` ni `--force`.** Si l’initialisation est interrompue, inspecter l’état avec le DBA, ne pas relancer le fichier sur la base partiellement remplie.

```bash
cd "$REL"
sudo mysql -e 'CREATE DATABASE `sari_cms` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci' && \
  sudo mysql --default-character-set=utf8mb4 sari_cms < backend/sql/schema.mysql.sql
```

Dans une session MySQL d’administration protégée, créer le compte applicatif (même secret que `DATABASE_URL`). Garder les droits DDL pour l’opérateur de migration, pas pour le processus web :

```sql
CREATE USER 'sari_app'@'127.0.0.1' IDENTIFIED BY 'REMPLACER_PAR_UN_SECRET_UNIQUE';
GRANT SELECT, INSERT, UPDATE, DELETE ON sari_cms.* TO 'sari_app'@'127.0.0.1';
```

```bash
cd "$REL/backend"
ln -s /etc/saricms/api.env .env  # dans cette nouvelle release, sans écraser de configuration
npm run prisma:generate          # OBLIGATOIRE pour MySQL, doit sortir avec 0
npm run db:schema-check          # aucune table/colonne manquante attendue
mysql --protocol=TCP -h 127.0.0.1 -u sari_app -p sari_cms -e 'SELECT DATABASE(); SHOW TABLES;'
```

Pour le seed, transmettre les identifiants **temporairement**, sans mot de passe dans la ligne de commande ni compte fourni par le dépôt :

```bash
# Toujours depuis backend/, base neuve, avant le démarrage du service.
read -r -p 'Adresse du premier administrateur : ' SEED_ADMIN_EMAIL
read -r -s -p 'Mot de passe unique (16 caractères min.) : ' SEED_ADMIN_PASSWORD; printf '\n'
export SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD
npm run seed
unset SEED_ADMIN_PASSWORD SEED_ADMIN_EMAIL
```

Vérifier le succès avant de continuer. En SQL, le seed refuse des tables de comptes/rôles/permissions déjà remplies et crée le premier compte dans la même transaction que ses droits. Serveur et seed doivent viser **la même base et le même pilote**. Ne pas importer ensuite `seed.mysql.sql`, `auth-only.mysql.sql`, des comptes ou un export historique « pour compléter » : c’est un autre jeu de données. Pour un catalogue réel, sauvegarder, valider d’abord en préproduction puis utiliser l’import du catalogue dans l’administration **sans remplacer** les fiches existantes. Une vitrine affichant le catalogue JSON de repli ne prouve pas que ces fiches existent en MySQL.

## 6. Rendre les fichiers persistants et démarrer

Un dump SQL ne contient **ni** les médias **ni** toutes les données du site. Initialiser l’arbre partagé depuis les fichiers livrés, **seulement à la première installation**. Exécuter les blocs suivants avec les variables `$BASE`, `$REL`, `$SHARED` du §2. Pas de `chmod 777`.

```bash
# Premier déploiement ; s'arrêter si shared contient déjà des données.
( set -e
  contenu=$(sudo ls -A "$SHARED")
  test -z "$contenu"
  mkdir -p "$REL/logs"
  for p in data messages translate public/uploads public/canvas backend/storage logs; do
    sudo install -d -m 0750 -o saricms -g saricms "$SHARED/$p"
    sudo rsync -a --chown=saricms:saricms --chmod=D750,F640 "$REL/$p/" "$SHARED/$p/"
  done
)
```

Pour **chaque** release compilée, lier ces dossiers *après* le build. Les fichiers livrés sont mis de côté, pas supprimés. Le compte `www-data` de Nginx reçoit un droit de lecture sur **les seuls médias publics** (y compris ceux déposés plus tard), jamais sur les secrets ou les dossiers de données.

```bash
( set -e
  mkdir -p "$REL/logs"
  for p in data messages translate public/uploads public/canvas backend/storage logs; do
    test -d "$SHARED/$p" && test ! -L "$REL/$p" || exit 1
    mkdir -p "$REL/.livraison/$(dirname "$p")"
    mv -T "$REL/$p" "$REL/.livraison/$p"
    ln -s "$SHARED/$p" "$REL/$p"
  done
  sudo install -d -o saricms -g saricms -m 0750 "$REL/.next/cache"
  sudo chown -R saricms:saricms "$REL/.next/cache"
)
sudo setfacl -m u:www-data:--x "$SHARED" "$SHARED/public"
for p in uploads canvas; do
  sudo setfacl -R -m u:www-data:rX "$SHARED/public/$p"
  sudo find "$SHARED/public/$p" -type d -exec setfacl -m d:u:www-data:rx {} +
done
sudo -u saricms test -r "$REL/.next/BUILD_ID" && sudo -u saricms test -r "$REL/backend/.env"
sudo -u saricms test -w "$REL/data" && sudo -u www-data test -x "$SHARED/public/uploads"
# Si un test de droits échoue, corriger avant la bascule.
sudo ln -sfn "$REL" "$BASE/current.next" && sudo mv -Tf "$BASE/current.next" "$BASE/current"
```

`data/` inclut notamment réglages, journaux métier, inscriptions et centre de courrier ; `messages/` et `translate/` incluent les modifications de l’atelier. `public/canvas/` contient aussi les gabarits, `public/uploads/` les fichiers GED et leurs métadonnées. **Ce qui est dans `public/` est public** : ne pas y ranger de justificatifs confidentiels. `backend/storage/` conserve notamment le courrier et, en mode JSON, les collections. Voir l’[inventaire détaillé](DONNEES-ET-SAUVEGARDE.md).

Installer les [deux unités systemd](../deploy/systemd/) livrées. Elles utilisent les vrais points d’entrée (`backend/dist/main.js` et `next start`) avec des répertoires de travail distincts. Le code reste en lecture seule ; les répertoires d’état sont explicitement autorisés.

```bash
sudo install -m 0644 "$REL"/deploy/systemd/saricms-{api,web}.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now saricms-api
curl -fsS http://127.0.0.1:3001/api/v1/health  # attendre l'écoute, driver mysql, env production
sudo systemctl enable --now saricms-web
sudo systemctl status saricms-api saricms-web --no-pager
curl -fsS http://127.0.0.1:3000/api/v1/health
```

## 7. Domaine public, reverse proxy et TLS

Le [vhost Nginx fourni](../deploy/nginx/saricms.conf) est un **modèle HTTP d’amorçage** pour Certbot. Il envoie **les routes applicatives autorisées à Next**, y compris `/api/v1`, et conserve `/api/admin/*` chez Next. Ne pas remplacer `location /api/` par un proxy général vers Nest. Les médias sont lus sur le volume partagé même s’ils arrivent après le démarrage ; Nginx conserve une politique restrictive pour les SVG. Le schéma suppose Nginx directement en bordure ; si un CDN précède Nginx, établir la chaîne de proxies de confiance avant d’utiliser les IP pour les quotas ou l’audit.

```bash
sudo install -m 0644 "$REL/deploy/nginx/saricms.conf" /etc/nginx/sites-available/saricms
sudoedit /etc/nginx/sites-available/saricms    # remplacer cms.example.org par VOTRE domaine
sudo ln -s /etc/nginx/sites-available/saricms /etc/nginx/sites-enabled/saricms
sudo nginx -t && sudo systemctl reload nginx
# DNS propagé, ports 80/443 joignables, aucun autre vhost pour ce nom
sudo certbot --nginx --redirect -d cms.example.org
sudo nginx -t && sudo certbot renew --dry-run
```

Ne saisir aucun identifiant via HTTP : les cookies admin sont `Secure` en production. Vérifier le renouvellement (`systemctl list-timers | grep certbot` pour le paquet Ubuntu), l’absence d’accès public à `3000`, `3001`, `3306`, et le blocage de Swagger depuis Internet. Ne pas mettre le back-office ni les API en cache partagé. Le vhost ferme les routes commerciales historiques à son entrée publique ; ne pas enlever ces protections pour faire passer une recette. La passerelle authentifiée `/api/admin/cms` reste disponible pour le back-office. Garder tout environnement de recette du commerce derrière un accès réseau privé, avec des données fictives et les courriers sortants neutralisés.

## 8. Recette avant d’ouvrir aux visiteurs

```bash
cd /srv/saricms/current
SITE=https://cms.example.org
npm run prod:smoke -- "$SITE" mysql --edge  # via le vhost public : recette HTTP en lecture seule
curl -sSI "$SITE/"                       # redirection vers /fr, sur le bon domaine en HTTPS
for l in fr en ar; do curl -fsS -o /dev/null -w "$l %{http_code}\n" "$SITE/$l"; done
curl -fsS "$SITE/api/v1/health"         # enveloppe { success, data: { status, driver, env, ... } }
curl -fsS "$SITE/api/v1/public/products?locale=fr&limit=1"  # lecture CMS réelle ; 200 même si liste vide
curl -fsS "$SITE/api/v1/public/payment-methods"             # [] si aucun mode manuel n'a été publié
# Au travers du vhost public, ces ressources ne sont PAS publiées : 403/404 attendus.
for p in api/v1/docs api/v1/orders/my/list api/v1/quotes/my/list fr/cart; do
  curl -sS -o /dev/null -w "$p %{http_code}\n" "$SITE/$p"
done
sudo journalctl -u saricms-api -u saricms-web -n 80 --no-pager
```

- **Base** : `health` décrit le processus, pas l’intégrité de la base. Vérifier `db:schema-check`, une lecture de catalogue et, dans l’admin, créer puis relire une fiche de recette après redémarrage. Contrôler la page d’état du CMS et les compteurs de tables indisponibles.
- **Vitrine et accès** : depuis un navigateur privé, vérifier `/fr`, `/en`, `/ar` (RTL) et le logo vers la racine de la langue. Le visiteur n’est pas connecté ; `/fr/dashboard` demande une connexion et `/fr/admin/dashboard` ne s’ouvre pas sans compte admin. Avec le vrai compte, tester connexion, édition, renouvellement et déconnexion ; vérifier qu’un compte client est refusé, le CAPTCHA au premier facteur, puis l’enrôlement et la connexion avec la 2FA du compte. Ne jamais transmettre les cookies dans les journaux de support.
- **Fichiers** : déposer un visuel public dans la GED, le relire depuis un deuxième navigateur puis après redémarrage. Vérifier aussi une modification de traduction. Configurer les coordonnées, les langues, le domaine canonique/SEO et les visibilités pour **votre** site.
- **Courrier** : faire le test de connexion SMTP **et un envoi** vers une boîte contrôlée (réception réelle, liens HTTPS, expéditeur), puis un formulaire public. Consulter le centre de courrier en cas d’échec ; une entrée dans l’outbox seule ne suffit pas.
- **Commerce (préproduction privée)** : valider le catalogue, les prix, taxes, devise, CGV et frais. Sans mode publié, attendre une liste vide ; après publication d’un mode manuel depuis l’administration, vérifier sa lecture depuis un deuxième poste. Tester retour du paiement → panier conservé, puis confirmation → panier vidé, règlement **en attente**. Contrôler la présence de la commande et du règlement en base depuis un autre poste : une écriture dans le `localStorage` du visiteur et une tentative de synchronisation ne sont pas un accusé de réception du serveur.

**Avant toute vente ou collecte publique de devis :** les opérations de consultation personnelle et de modification doivent exiger côté serveur une identité vérifiée et le droit sur **ce dossier**, pas une adresse ou un identifiant transmis par le navigateur. Les montants, les changements de statut et les accusés de réception doivent aussi être validés par le serveur. Tant que ce circuit n’est pas corrigé et testé pour deux clients distincts et un invité, garder les restrictions Nginx livrées et ne pas proposer ces actions dans les menus / appels à l’action. **Aucun prestataire de paiement n’est intégré.** Carte/CIB/PayPal simulés ne sont pas des modes publiables. Une déclaration de règlement manuel n’est pas un encaissement, et sélectionner une pièce sur l’écran ne l’archive pas de manière sécurisée.

## 9. Mettre à jour sans perdre le site

1. Si une ancienne installation a utilisé des identifiants de démonstration, inventorier les comptes, désactiver ceux de test, changer les secrets concernés et révoquer les sessions avant toute exposition. Le nouveau seed ne corrige pas ces comptes et ne doit pas être rejoué. Noter le SHA courant (`readlink -f /srv/saricms/current`), l’inventaire des services et les variables modifiées. **Faire et tester une sauvegarde (§10)**. Répéter la mise à jour sur une copie isolée de la base et des volumes, sans courrier sortant réel.
2. Créer une **nouvelle** release au §2. Exécuter les installations, builds et contrôles du §4 avec les bonnes URL. Régénérer le client Prisma depuis **cette** release et son verrou. Ne pas faire un `npm update` implicite, rejouer le seed, `prisma migrate dev/reset` ou `db push --accept-data-loss`.
3. Base existante : lier `backend/.env` à la configuration de la cible. Dans `backend/`, lancer `npm run db:schema-check`. Il lit `information_schema` et écrit **`sql/schema-sync.mysql.sql`** pour cette base. Un code 1 peut indiquer des additions nécessaires **ou une erreur de connexion** : lire le diagnostic. Relire le SQL produit ; les types différents, index, contraintes, backfills et transformations métier demandent une décision DBA. Ne pas considérer ce contrôle comme une migration exhaustive. Les migrations Prisma du dépôt ne constituent pas un historique initial complet pour une base créée par le DDL : ne pas lancer `migrate deploy` à l’aveugle.
4. Pendant la fenêtre de maintenance, geler les écritures et tâches (`sudo systemctl stop saricms-web saricms-api`), prendre la sauvegarde cohérente finale. Appliquer **uniquement le SQL additif revu** sur la bonne base avec un compte DDL dédié, puis recontrôler. Par exemple `mysql -u OPERATEUR_DDL -p sari_cms < sql/schema-sync.mysql.sql` depuis `backend/` ; `npm run db:schema-fix` applique les additions directement et nécessite les droits DDL. **Ne jamais importer `schema.mysql.sql` en mise à jour.**
5. Réconcilier les nouveautés livrées et l’état partagé. Comparer les valeurs versionnées **ancien SHA → nouveau SHA** et les modifications effectivement en ligne. Fusionner en zone de travail les nouvelles clés `messages/*` avec les traductions opérateur, puis `npm run intl:sync && npm run intl:check` **sur cette copie**. Reporter les fichiers validés dans `shared/messages` et `shared/translate`. Revoir de même les nouvelles données d’amorçage/gabarits. Ne pas écraser `shared/data`, les médias, `smtp.json` ou les textes par les valeurs par défaut d’une release. Les JSON de repli importés par le code peuvent être incorporés au build : une modification sur disque ne remplace pas nécessairement cette copie dans `.next`. Préférer le CMS pour le contenu publié. Ne pas compiler le `data/` privé.
6. Relier les dossiers partagés et basculer `current` avec le second bloc du §6. Adapter les unités/vhost **si modifiés** (`systemctl daemon-reload`, `nginx -t`). Redémarrer l’API, vérifier son état, puis le web. Rejouer la recette §8 avant de rouvrir. Conserver la release et la sauvegarde précédentes.

**Retour arrière :** stopper les deux services. Si schéma, documents et fichiers restent compatibles, repointer `current` vers la release précédente avec le couple `ln -sfn` / `mv -Tf` du §6, remettre sa configuration et redémarrer API puis web. Sinon restaurer la **base + les volumes + la configuration de la même sauvegarde**, idéalement sur une cible séparée avant bascule. Un changement de lien ne défait pas une migration SQL. Réconcilier toute écriture postérieure à la sauvegarde avant de remplacer des données réelles.

## 10. Sauvegarder et prouver qu’on sait restaurer

Planifier avec une rétention adaptée, une copie **chiffrée hors serveur**, un accès limité et un essai de restauration périodique. `localStorage` (ex. panier d’un visiteur) n’est pas dans un dump serveur. Sauvegarder aussi les secrets, les unités et le vhost/TLS dans un coffre approprié ; `smtp.json`, les journaux, les exports et la base contiennent des informations privées. Une sauvegarde Git ne suffit pas.

Exemple **en session root**, avec un compte MySQL de sauvegarde dédié configuré auparavant via `mysql_config_editor set --login-path=sari-backup --host=127.0.0.1 --user=UTILISATEUR --password`. Ne pas écrire le mot de passe sur la ligne de commande. Pour un point de reprise cohérent base/fichiers, faire l’opération en maintenance, écritures et jobs arrêtés (sinon utiliser des snapshots coordonnés). `--single-transaction` couvre les tables InnoDB, pas les DDL concurrents.

```bash
set -euo pipefail
umask 077
B=/var/backups/saricms/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$B"
readlink -f /srv/saricms/current > "$B/release.txt"
mysqldump --login-path=sari-backup --single-transaction --quick --no-tablespaces \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 sari_cms | gzip > "$B/mysql.sql.gz"
tar --acls --xattrs -C /srv/saricms -czf "$B/shared.tgz" shared
tar -C /etc -czf "$B/config-privee.tgz" saricms systemd/system/saricms-{api,web}.service nginx/sites-available/saricms
(cd "$B" && sha256sum *.gz *.tgz | sort -u > SHA256SUMS && sha256sum -c SHA256SUMS)
gzip -t "$B/mysql.sql.gz" && tar -tzf "$B/shared.tgz" >/dev/null
```

Restaurer d’abord **ailleurs** : contrôler les empreintes, créer une base **vide de nom différent** (`sari_restauration`), `gunzip -c mysql.sql.gz | mysql -u OPERATEUR -p sari_restauration`. Le dump ci-dessus est fait sans `--databases` pour permettre ce test. Extraire `shared.tgz` avec `tar --acls --xattrs` et la configuration dans des dossiers isolés (pas par-dessus le serveur actif). Installer le SHA noté, rétablir les propriétaires/ACL, relier l’état restauré, utiliser une `DATABASE_URL`, des chemins, ports et une origine adaptés à cet environnement. **Couper SMTP et les intégrations sortantes avant démarrage** : écarter aussi le `storage/mail/smtp.json` restauré et tout secret réel en préproduction. Vérifier tables/compteurs, connexion, visuels, textes et fiche éditable (§8) ; documenter la durée et la date du test.

## 11. Diagnostic rapide

| Symptôme | Vérifier / agir |
|---|---|
| 502 Nginx, pas de page | `nginx -t`, `systemctl status`, `journalctl -u saricms-web`. Tester 3000 puis 3001 localement. Vérifier `current`, `.next/BUILD_ID`, le Node du service, `WorkingDirectory` et les droits de traversée. |
| Vitrine visible, admin ou API en échec | Tester `/api/v1/public/products` et `health` via **les deux** ports. Une vitrine en repli JSON masque une panne API. Vérifier `DB_DRIVER`, `DATABASE_URL`, secret JWT et `/api/v1` dans la réécriture compilée. |
| Prisma introuvable, modèle absent, `P2021/P2022` | `cd backend && npm run prisma:generate` sur la plateforme cible, puis `db:schema-check`. Un `npm ci` ou un build Nest réussi ne prouve ni la génération ni le schéma de la base. Ne pas contourner une erreur de téléchargement TLS en désactivant TLS. |
| 401/403, session qui boucle, liens vers le mauvais hôte | HTTPS réel, domaine exact, `PUBLIC_SITE_ORIGIN`, cookies `Secure`, rôle admin actif, horloge serveur, CORS et service Nest joignable. Les mutations Next nécessitent aussi le cookie et l’en-tête CSRF ; ne pas désactiver cette garde. |
| 413 ou fichier en 404 après dépôt | Taille HTTP/multipart et limites applicatives, `client_max_body_size`, droits de Nginx, `shared/public`, liens et chemins GED identiques dans les deux processus. Vérifier le média **par HTTPS après redémarrage**. |
| Pas de mail, `internal_key_missing`, envoi affiché seulement dans l’outbox | Comparer la présence de la même clé dans les deux services sans l’afficher ; vérifier le mode SMTP effectif, le fichier de réglages, TLS/port, journaux et réception réelle. |
| 429 en charge | Distinguer limite Nest / proxy Next. Observer les IP réellement vues derrière le proxy et les appels SSR partagés avant de dimensionner `THROTTLE_LIMIT` ou les limites Next ; ne pas supprimer les protections. Faire un test de charge avant une ouverture importante. |
| Textes anciens ou build interrompu | Espace disque/RAM, `messages/` et `translate/` cohérents. Examiner `intl:check` ; réparer sur copie, pas sur les textes actifs. Relancer dans une nouvelle release. |

### Ce qui a été vérifié sur cette version

| Vérifié localement | À valider sur votre serveur avant ouverture |
|---|---|
| Build Webpack Next (224 pages) et build Nest ; 389 tests Nest. Contrôles de schéma sur fixtures et analyse des unités par `systemd-analyze verify`. | `prisma:generate` avec les moteurs adaptés, import sur une vraie base MySQL **neuve** ou migration sur copie, puis restauration MySQL + volumes. L’environnement de test n’a pas pu télécharger le moteur Prisma. |
| Deux services compilés en `NODE_ENV=production`, JSON jetable : seed neuf et second seed refusé, FR/EN/AR, session admin, refus d’un compte client, renouvellement, 2FA et déconnexion. En navigateur : panier conservé au retour, confirmation manuelle en attente. | Installation effective des unités, permissions disque après redémarrage, contrôle des dossiers par propriétaire et rapprochement des transactions sur deux postes avant toute ouverture commerciale. |
| Nginx 1.24 en HTTP local sur port non privilégié : `nginx -t`, test `prod:smoke --edge`, lecture d’un nouveau média et en-têtes de protection. | DNS public, pare-feu, certificat et renouvellement ACME, réception SMTP réelle et charge représentative. |

Le lint global de la vitrine reste en échec : **547 erreurs et 253 avertissements ESLint**, contre 727 et 269 au relevé de départ. Les règles n’ont pas été désactivées. Ce résultat n’annule pas les tests réussis et ne doit pas être présenté comme une certification de production.
