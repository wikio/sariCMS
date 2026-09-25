-- ---------------------------------------------------------------------------
-- Contrôle en lecture seule : d'où vient ce que l'administration affiche
-- ---------------------------------------------------------------------------
-- À passer sur la base de production sans crainte : aucune écriture, aucun
-- `ALTER`, aucun `UPDATE`. Chaque requête est commentée sur ce qu'elle répond.
--
-- SI VOUS LISEZ CETTE LIGNE PARCE QU'UNE REQUÊTE A ÉCHOUÉ EN 1146
-- (« Table '….payment_records' doesn't exist ») : commencez par la requête 1,
-- puis jouez le rattrapage additif, au choix :
--   • avec Node et un accès réseau à la base : `cd backend && npm run db:schema-check`
--     puis `npm run db:schema-fix` ;
--   • sans les deux, dans phpMyAdmin / HeidiSQL : le fichier additif qui crée la
--     table — `backend/sql/migrate-payment-records.mysql.sql` pour le relevé,
--     `backend/sql/migrate-coupons-taxes.mysql.sql` pour coupons et taxes.
-- Ne jouez PAS `backend/sql/schema.mysql.sql` : il commence par des `DROP TABLE`.
--
-- Les requêtes 3 à 6 tapent sur des tables qui n'existent pas encore : elles
-- échoueront toutes seules. Les compteurs ci-dessous, eux, sont sûrs — ils lisent
-- `information_schema` et répondent 0, pas une erreur.
--
-- Pourquoi ce fichier existe : deux questions sont revenues, et elles ne
-- demandent pas de lire le code — juste de regarder la base.
--   1. « La liste des modes de paiement est vide : est-ce que la source, c'est
--      MySQL ? » Les modes de paiement vivent dans `settings`, sous la clé
--      `doc_payments` — un document JSON, pas une table. Une liste vide peut donc
--      vouloir dire trois choses différentes, que seule la requête 2 départage.
--   2. « Les encaissements sont-ils sauvés dans MySQL ? » Oui, dans
--      `payment_records` — à condition que la migration `20260922_add_payment_records`
--      ait été jouée. La requête 3 le vérifie, et la 4 dit si le total bouge.

-- 1. Les trois tables de données (et non de réglages) de ces vagues.
--    Une table absente = la migration n'a pas été jouée : l'écran correspondant
--    répond 500 (ou 0 ligne sous le pilote JSON), jamais « vide parce que rien
--    n'a été saisi ».
SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records') AS payment_records,
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons')          AS coupons,
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tax_rules')        AS tax_rules;
-- Chacune des trois colonnes doit valoir 1. Un 0 veut dire « table absente » :
-- l'écran correspondant répond 500 (ou affiche 0 sous le pilote JSON), et ce
-- n'est jamais « vide parce que personne n'a rien saisi ».

-- 2. D'où viennent les modes de paiement affichés par l'écran.
--    Trois lignes possibles, et le remède change selon laquelle on obtient :
--      • aucune ligne          → le document n'a JAMAIS été enregistré. L'écran
--                                montre les valeurs par défaut du fichier
--                                `lib/shop-store.ts`, locales à ce navigateur, et
--                                non partagées. Rien n'est perdu : il faut saisir
--                                une fois dans l'écran, l'envoi crée la ligne.
--      • items = 0              → quelqu'un a ENREGISTRÉ une liste vide (ou un
--                                poste au cache vide l'a poussée). C'est une
--                                décision d'opérateur, pas un bug, et elle se
--                                défait depuis l'écran lui-même : « Repartir des
--                                valeurs livrées » réécute les six modes du
--                                produit, « Rendre la copie locale » récupère
--                                `sari_doc_backup_payments` du navigateur.
--      Les TYPES de paiement (virement, CIB, carte, PayPal…) ne sont pas ici :
--      c'est une constante du code (`PaymentType`), parce que chaque type pilote un
--      comportement du site. Seuls les MODES — les lignes que l'opérateur nomme,
--      règle et active — sont en base.
--      • items > 0 et écran vide → le poste ne lit pas ce document : vérifier
--                                `payments:read` / `settings:read` du rôle (un 403
--                                muet se présente comme une base vide).
SELECT p.`key` AS document,
       JSON_LENGTH(JSON_EXTRACT(p.`value`, '$.items')) AS lignes,
       CHAR_LENGTH(p.`value`) AS octets,
       p.`updatedAt` AS dernier_envoi
  FROM `settings` p
 WHERE p.`key` IN ('doc_payments', 'doc_currencies', 'doc_notify', 'doc_admin', 'doc_shop', 'doc_taxonomies')
 ORDER BY p.`key`;

-- 2bis. Les compteurs de lignes sans risquer le 1146 : `information_schema`
--    répond 0 pour une table absente. Estimation InnoDB (TABLE_ROWS), donc à
--    confirmer par un COUNT réel une fois les tables présentes.
SELECT t.TABLE_NAME AS table_, COALESCE(t.TABLE_ROWS, 0) AS lignes_estimees
  FROM information_schema.TABLES t
 WHERE t.TABLE_SCHEMA = DATABASE()
   AND t.TABLE_NAME IN ('payment_records', 'coupons', 'tax_rules', 'orders', 'quotes')
 ORDER BY t.TABLE_NAME;

-- 3. Le relevé d'encaissements : est-il en base, et que dit la base ?
--    `rows` = lignes hors corbeille. Zéro alors que l'écran Journal des paiements
--    affiche des lignes = le poste n'a pas encore synchronisé (la poussée a lieu
--    au montage d'un écran d'administration, `lib/payment-records-sync.ts`).
SELECT COUNT(*) AS lignes,
       COALESCE(SUM(`amount`), 0) AS total,
       MIN(`date`) AS plus_ancienne,
       MAX(`date`) AS plus_recente
  FROM `payment_records` WHERE `deletedAt` IS NULL;

-- 4. Répartition par statut : ce que l'écran appelle « en attente » doit être
--    exactement le compte des `pending`, sinon la validation manuelle n'a pas été
--    rejouée depuis la mise en base.
SELECT `status`, COUNT(*) AS lignes, COALESCE(SUM(`amount`), 0) AS montant
  FROM `payment_records`
 WHERE `deletedAt` IS NULL
 GROUP BY `status`
 ORDER BY lignes DESC;

-- 5. Résidu possible du jeu de démonstration.
--    Le bouton de l'accueil écrivait onze commandes et six devis fictifs par
--    `saveOrders()`/`saveQuotes()`, qui répliquent en base : c'est la raison pour
--    laquelle il est descendu dans Paramètres derrière une case à cocher, et la
--    raison pour laquelle `lib/demo-seed.ts` refuse désormais une base déjà peuplée.
--    Les lignes ne portent aucun marqueur « fictif » (même table, mêmes colonnes),
--    donc ce sont les clients de `lib/demo-seed.ts` qui les désignent — la liste
--    est à lire là-bas, pas à recopier ici. Cette requête remonte les candidates.
SELECT o.`id`, o.`code`, o.`client`, o.`email`, o.`total`, o.`status`, o.`createdAt`
  FROM `orders` o
 WHERE o.`deletedAt` IS NULL
 ORDER BY o.`createdAt` DESC
 LIMIT 15;

-- 6. Et les compteurs que l'accueil affiche : il ne lit plus le cache du
--    navigateur, il pose ces questions à la base. S'ils divergent de l'écran
--    d'une liste, c'est un droit de lecture manquant, pas un total faux.
SELECT (SELECT COUNT(*) FROM `orders` WHERE `deletedAt` IS NULL) AS commandes,
       (SELECT COUNT(*) FROM `quotes` WHERE `deletedAt` IS NULL) AS devis,
       (SELECT COUNT(*) FROM `payment_records` WHERE `deletedAt` IS NULL) AS encaissements,
       (SELECT COUNT(*) FROM `coupons` WHERE `deletedAt` IS NULL) AS coupons,
       (SELECT COUNT(*) FROM `tax_rules` WHERE `deletedAt` IS NULL) AS taxes;
