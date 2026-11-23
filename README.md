# sariCMS

Vitrine, espace client et administration en français, anglais et arabe (Next.js), avec une API CMS NestJS dans [`backend/`](backend/). Il faut **deux processus Node.js** : publier seulement le dossier `public/` ne déploie pas le site.

**[Installer sariCMS et le déployer en production →](docs/INSTALLATION-DEPLOIEMENT-PRODUCTION.md)**

Le guide détaille le démarrage local, l’installation neuve MySQL, les services systemd, le domaine et HTTPS, la recette, les mises à jour et la restauration. Il distingue ce qu’on peut vérifier en JSON de ce qu’il faut valider sur le serveur cible.

- **En développement** : Node 22, `npm ci` dans les deux répertoires, API sur `3001`, vitrine sur `5000`. Voir [le démarrage local](docs/INSTALLATION-DEPLOIEMENT-PRODUCTION.md#1-essayer-le-site-en-local).
- **En production** : les secrets sont propres à l’installation. Ne jamais rejouer le seed ou `schema.mysql.sql` sur une installation existante.
- **Ouverture publique** : le vhost fourni publie la vitrine et l’administration. Le tunnel commandes/devis reste réservé à la recette privée ; une confirmation dans le navigateur ne vaut pas encaissement. Voir les [critères d’ouverture](docs/INSTALLATION-DEPLOIEMENT-PRODUCTION.md#8-recette-avant-douvrir-aux-visiteurs).
- **Exploitation** : [données et sauvegardes](docs/DONNEES-ET-SAUVEGARDE.md), [reprise MySQL](docs/REPRISE-MYSQL.md), [centre de courrier](docs/EMAILS-CENTRE-DE-COURRIER.md).
