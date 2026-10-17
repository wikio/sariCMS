# Comptes de test

Jeu de comptes couvrant tous les profils, pour vérifier le contrôle d'accès
sans fabriquer les comptes à la main.

## Les comptes

| Adresse e-mail | Mot de passe | Type | Statut | Ce qu'il permet de vérifier |
|---|---|---|---|---|
| `test.admin@sarisysteme.com` | `AdminSari_2026!` | admin | actif | Accès complet au back-office |
| `test.editeur@sarisysteme.com` | `Editeur_Sari26!` | admin | actif | Back-office limité au contenu (rôle « editor ») |
| `test.client@clinique-test.dz` | `ClientSari_26!` | client | actif | Espace client : commandes, devis, panier |
| `test.partenaire@meditest.dz` | `Partner_Sari26!` | partner | actif | Espace revendeur |
| `test.candidat@gmail.com` | `Candidat_26!Az` | candidate | actif | Espace candidat : candidatures, CV |
| `test.attente@sarisysteme.com` | `Attente_Sari26!` | client | en attente | **La connexion doit être refusée** |
| `test.bloque@sarisysteme.com` | `Bloque_Sari26!` | client | bloqué | **La connexion doit être refusée** |
| `test.english@sarisysteme.com` | `English_Sari26!` | client | actif | E-mails et interface en anglais |

Chaque profil a son propre mot de passe. S'ils étaient identiques, une erreur
sur le type de compte passerait inaperçue : la connexion réussirait quand même.

Les deux comptes en attente et bloqué **doivent** échouer à la connexion avec
« Account is not active » : c'est le résultat attendu, pas une anomalie.

## Créer les comptes

```bash
node scripts/seed-test-users.mjs --email admin@sarisysteme.com --password '…'
```

Le script est idempotent : relancé, il réinitialise les comptes existants
(mot de passe et statut) au lieu d'échouer. Utile après un test qui a bloqué
un compte.

Pour n'afficher que le tableau, sans rien écrire :

```bash
node scripts/seed-test-users.mjs --dry-run
```

Options : `--api` (défaut `http://localhost:3001/api/v1`), `--email`,
`--password`, `--dry-run`.

## Règle de mot de passe

Le serveur impose, dans `backend/src/modules/users/dto/user.dto.ts` :

- 10 caractères minimum, 128 maximum ;
- au moins une majuscule, une minuscule et un chiffre.

Le formulaire du back-office vérifie ces mêmes règles avant l'envoi et affiche
un indicateur de robustesse. Le bouton « Générer » produit toujours une valeur
conforme, sans caractères ambigus (ni `O`/`0`, ni `l`/`1`/`I`) puisqu'un mot de
passe temporaire est souvent recopié à la main ou dicté au téléphone.

## Changer son mot de passe depuis la vitrine

Un compte connecté peut changer son mot de passe lui-même :
**Tableau de bord → Profil → Changer mon mot de passe**. Le formulaire exige
l'ancien mot de passe, ce qui distingue cette opération de la réinitialisation
faite par un administrateur et empêche un poste laissé ouvert de verrouiller
le compte de son propriétaire.

Les règles sont celles indiquées plus haut. Le serveur refuse en outre un
nouveau mot de passe identique à l'ancien, et limite les tentatives à cinq par
minute. Après un changement réussi, les sessions ouvertes ailleurs sont
révoquées : un mot de passe change en général parce qu'on le croit compromis.

Si vous testez ce parcours avec un compte du tableau ci-dessus, remettez
ensuite le mot de passe documenté, sinon la ligne correspondante ne sera plus
exacte.

## Supprimer les comptes

Ces comptes portent tous le préfixe `test.` : dans Administration →
Utilisateurs, recherchez `test.`, sélectionnez-les et utilisez l'action
groupée « Corbeille ».

> **En production**, ne créez pas ces comptes : les mots de passe figurent
> dans ce dépôt. Réservez-les aux environnements de développement et de
> recette.
