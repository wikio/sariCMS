# Contact : où vont les messages ?

## Avant le tri IA

Les six boutons (**Devis, Support technique, Commercial, Ressources humaines, Partenariat, Espace client**) renseignaient le champ `subject`. Ils ne désignaient ni six services destinataires ni six boîtes mail. Après captcha, le CMS enregistrait la demande dans `contact_messages` au statut `new`. Si les événements étaient actifs, `contact_received` accusait réception à l’adresse saisie et `contact_alert` prévenait **la même adresse société pour tous les sujets**, dans la langue du formulaire.

L’adresse publiée se modifie dans **Administration → Configuration → Contact → Email** (`/{locale}/admin/config`). L’ancien envoi utilisait `getConfig(locale).meta.email`, y compris ses replis de vitrine. Les fichiers de démonstration `data/{fr,en,ar}/config.json` indiquent `contact@sarisysteme.com` ; ce n’est pas une vérification de la configuration d’un site installé. Les deux événements contact sont désactivés dans le `data/mail/modules.json` livré. **SMTP** règle le transport, pas la répartition par sujet.

## Configurer la nouvelle chaîne

1. **Relais privé** : définir la même `MAIL_INTERNAL_KEY` aléatoire côté Next et Nest. Le visiteur appelle `/api/contact`, qui vérifie les champs, le quota et le captcha à usage unique. Le `POST /api/v1/contact/messages` n’accepte plus de création directe depuis le navigateur. Sans clé commune ou si le CMS ne peut pas enregistrer, le formulaire signale l’échec et aucun courrier ne part.
2. **Connexion au LLM** : dans **Paramètres → Emails → Tri et routage du contact → Connexion à l’API IA (LLM)** (`/fr/admin/settings?tab=contactTriage`), remplir les champs suivants. On peut également les fournir dans l’environnement de **Nest** (`backend/.env` en local, `/etc/saricms/api.env` dans la recette systemd). Aucun fournisseur n’est imposé.

   | Champ de la page | Repli serveur | Valeur attendue |
   |---|---|---|
   | URL complète | `CONTACT_AI_URL` | Endpoint compatible Chat Completions, par exemple `https://fournisseur.example/v1/chat/completions`. HTTPS ; HTTP seulement sur la boucle locale **du backend**. Pas d’identifiants dans l’URL de la page ; seul le paramètre `api-version` y est admis. |
   | Identifiant du modèle | `CONTACT_AI_MODEL` | Modèle du fournisseur comprenant FR/EN/AR et le mode `json_object`. |
   | Clé API | `CONTACT_AI_API_KEY` | Secret transmis par Nest en authentification Bearer. Jamais de `NEXT_PUBLIC_*`. Le champ est vide à la relecture, même pour un administrateur. |

   - **Tester la connexion** interroge le fournisseur avec les champs actuels et un texte fictif. Un succès indique que le modèle a renvoyé le format de tri attendu. Ce test peut être facturé par le fournisseur ; il ne sauvegarde rien, ne crée pas de fiche, ne retire pas de points et n’envoie pas de courrier.
   - **Enregistrer la connexion** l’applique aux prochaines demandes, sans redémarrage. Les champs URL/modèle non renseignés utilisent leur valeur serveur. Une clé laissée vide conserve celle déjà enregistrée pour **la même URL** ; la clé du `.env` ne sert qu’à son URL exacte. Pour une nouvelle destination, saisir sa propre clé. Une clé saisie est liée à l’URL résolue lors de la sauvegarde.
   - **Revenir au .env** supprime la configuration de la page, pas les variables serveur. Enregistrer les trois champs vides fait également revenir au `.env`. Un changement **dans le fichier `.env`** nécessite le redémarrage de Nest. Une panne du fournisseur sélectionné ou des réglages illisibles provoque une vérification humaine, pas l’envoi à un deuxième fournisseur.
   - Le profil de la page est enregistré côté serveur, dans `private/contact-ai.json` à côté du répertoire `JSON_STORE_PATH` (par défaut `backend/storage/private/contact-ai.json`), **même en MySQL**. Il peut contenir la clé : fichier créé en `0600`, hors répertoire public, hors Git, hors base et hors stockage du navigateur. Préserver le volume et protéger/chiffrer ses sauvegardes comme celles d’un `.env`. Ne pas communiquer le contenu de ce fichier.

   Pour une vraie demande, le modèle reçoit **sujet, langue, texte**, pas les champs nom, courriel, téléphone, société, compte, adresse IP ou jeton. Le texte libre lui-même peut contenir des données personnelles : choisir un prestataire et des conditions de traitement/rétention adaptés. La suppression dans le CMS ne supprime pas les éventuelles copies du prestataire.

3. **Décisions et destinations** : dans le même onglet, les règles de tri et de routage ont leur **propre bouton Enregistrer**. Elles sont partagées entre tous les postes et toutes les langues (`settings`, clé `contact_triage`). L’indicateur « Modèle configuré » ne vaut pas test de connexion.
4. **Courrier** : configurer le transport dans **Paramètres → Intégrations → SMTP**, puis activer les événements voulus dans **Paramètres → Emails → Emails & notifications** (centre de courrier). L’interrupteur général, les plafonds, les heures silencieuses et le dédoublonnage restent appliqués. Pour une alerte par demande, vérifier aussi l’intervalle minimal de `contact_alert`. La variable de modèle `{{sujet_contact}}` donne le sujet retenu.

## Décisions, dans l’ordre

| Résultat | Effet |
|---|---|
| IA absente, indisponible, délai de 6 s dépassé, réponse invalide, règles illisibles ou confiance inférieure au seuil | File privée **À vérifier**. Ni transfert, ni accusé, ni inscription newsletter, ni retrait de points. |
| Spam, puis propos inappropriés | Selon la règle du motif : **À vérifier** ou **Supprimer définitivement**. Le rejet automatique se fait avant toute écriture du message : pas de fiche, de copie du texte dans l’audit, de passage en corbeille ni d’email. |
| Rejet pour abus + retrait de points activé | Seulement avec un **compte actif identifié par le JWT vitrine vérifié** : une remarque datée et le débit configuré dans `contact_penalties`. On conserve le motif codé, pas le texte rejeté. Le courriel saisi n’identifie jamais le compte à débiter. |
| Sujet inadéquat | Vérification humaine, ou reclassement si la règle le permet et si l’IA propose **l’un des six sujets**. Sans autre sujet valable : **À vérifier**. Une erreur de sujet seule ne retire jamais de points. |
| Demande acceptée | Fiche **À traiter**, avec le sujet initial et le sujet retenu. Le routage suit les réglages du **sujet retenu**, jamais une adresse donnée par l’IA ou par le visiteur. |

**Défauts :** seuil de confiance déclaré par le modèle **90/100**, spam/propos inappropriés/sujet inadéquat **à vérifier**, **0 point** de retrait. Aucun rejet ou reclassement automatique sans décision de l’administrateur. Tester les règles sur des exemples non personnels avant d’activer suppression ou retraits ; la confiance déclarée n’est pas une garantie d’exactitude.

### Les trois destinations d’une demande acceptée

| Réglage par sujet | Destination de `contact_alert` |
|---|---|
| **Suivi interne uniquement** | Aucune. La demande reste dans le CMS. |
| **Alerte à l’adresse de la société** (défaut pour les six) | Adresse effectivement enregistrée dans `ContactInfo.email` pour la langue du formulaire. Pas de boîte de démonstration en secours. Sans adresse valide : pas d’alerte, mais la fiche est conservée. |
| **Transfert à une adresse configurée** | L’unique adresse enregistrée pour ce sujet **à la place** de l’adresse société. La fiche reste disponible pour le suivi, même si le courrier est refusé. |

L’accusé `contact_received`, s’il est actif, reste destiné à l’expéditeur déclaré d’une demande acceptée. La case newsletter n’est honorée que pour une demande acceptée et avec consentement explicite. Le formulaire renvoie la même confirmation neutre en cas d’acceptation, de rejet et de mise en vérification ; aucune adresse interne ni décision individuelle n’est exposée au navigateur.

## Mémoire, stockage et consultation à distance

Pendant la saisie, le texte est dans le formulaire du navigateur du visiteur. À la soumission, il est transmis au serveur web, puis à l’API Nest. **Pendant le tri, la demande est en mémoire vive côté serveur** : il n’y a pas de boîte d’attente persistante avant la décision, ni de file à lire sur l’appareil du visiteur. Une analyse interrompue avant l’enregistrement n’est pas une fiche consultable.

Une fois la décision prise, les demandes **À vérifier** et **À traiter** sont écrites dans le stockage du **serveur**, avant tout envoi de courrier :

| Pilote actif (`DB_DRIVER`) | Emplacement de la fiche |
|---|---|
| MySQL / PostgreSQL | Table `contact_messages` de la base du CMS |
| MongoDB | Collection `contact_messages` |
| JSON (défaut hors production) | `contact_messages.json` dans `JSON_STORE_PATH`, soit `backend/storage/json/contact_messages.json` avec les chemins par défaut |

Depuis un autre poste, se connecter au même site en HTTPS avec un compte administrateur habilité, ouvrir **Messages → Contact**, filtrer sur **À vérifier** et ouvrir la fiche pour lire le texte et le motif. C’est une lecture de l’API du CMS, **pas** de la mémoire du visiteur ou d’une boîte SMTP. Pour pouvoir relire un spam suspect, choisir **À vérifier** plutôt que **Supprimer définitivement** : le texte rejeté n’a pas de fiche. Le pilote actif est affiché sous **Paramètres → Intégrations → Import & jeu de démonstration**, sans lancer d’import.

## Vérifier et suivre

- **Messages → Contact** : boîte partagée des demandes du site, distincte des **Conversations**. Filtrer les demandes, ouvrir une fiche pour voir le texte, le motif et la destination prévue, corriger la catégorie, passer de **À vérifier** à **À traiter**, puis **Pris en charge** ou **Archivé**, et laisser une note de suivi. L’acceptation **manuelle** autorise le traitement interne ; modifier une fiche ne déclenche pas rétroactivement d’envoi, d’abonnement ou de pénalité. L’action de suppression définitive demande confirmation.
- **Centre de courrier → Historique** : vérifier le destinataire et le résultat réel (`sent`, `failed`, `skipped`). La clé `contact-<id>-contact_alert` du journal serveur permet le rapprochement. Une destination prévue n’est pas une preuve d’envoi ; en mode fichier (`file_transport`) aucun courriel n’a quitté le serveur. Un blocage ou un échec ne supprime pas la demande ; traiter les échecs en interne, il n’y a pas de relance automatique.
- **Utilisateurs → Ouvrir la fiche du compte → Score du compte · Contact** : solde des mouvements Contact (distinct de la notation d’une candidature), nombre de remarques et 20 dernières remarques. Un opérateur autorisé peut annuler un retrait erroné et restituer ses points.
- **Droits API** : lecture du routage `settings:read`, modification, test et réinitialisation de connexion `settings:admin` ; messages `contact:read/update/delete` selon l’opération ; dossier `users:read`, annulation de retrait `users:update`. Les écritures du navigateur administratif passent par le relais administrateur avec CSRF.

## Mise à jour et recette

- MySQL existant : **sauvegarder d’abord**, appliquer la [migration additive `contact_penalties`](../backend/prisma/migrations/20261116_contact_penalties/migration.sql) sur une copie, régénérer le client avec `npm run prisma:generate` dans `backend/`, vérifier avec `npm run db:schema-check`, puis suivre la [procédure de mise à jour](INSTALLATION-DEPLOIEMENT-PRODUCTION.md). Ne pas rejouer `schema.mysql.sql` sur une base existante. Les anciennes fiches contact restent lisibles ; aucun retrait ni routage rétroactif. En mode JSON, la collection de mouvements est créée au premier débit.
- Recette automatisée sans API IA ni SMTP réels : `npm run contact:test` après installation des dépendances web et backend. Tester ensuite sur **votre environnement de recette** un message conforme, un sujet corrigé, un cas ambigu, un rejet anonyme et un rejet connecté. Vérifier la boîte Contact, le journal SMTP et le dossier du compte avant d’ouvrir les transferts externes.
