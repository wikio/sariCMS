-- Migration: relevé d'encaissements en base
-- Created: 2026-09-22
-- Description: les encaissements vivaient dans le `localStorage` du navigateur
--              d'administration (clé `sari_payment_records`), sans modèle Prisma
--              ni module backend. Le relevé — ce qui est rentré, ce qui reste à
--              rapprocher, ce qui a été refusé — n'était donc jamais consultable
--              d'un autre poste, jamais sauvegardé avec la base, et se
--              reconstituait tout seul à la première lecture quand la clé était
--              absente (voir `lib/payments.ts` : le jeu fictif n'est plus écrit
--              que sur demande explicite).
--
-- Additif seulement : une table neuve, aucune table existante n'est modifiée.
-- `orders.paymentMethod` / `orders.paymentStatus` / `orders.invoiceNo` restent
-- ce qu'ils sont — le statut de PAIEMENT d'une commande, documenté sur la
-- commande. `payment_records` est le relevé de TRÉSORERIE : les gestes faits sur
-- un encaissement, y compris ceux qui ne concernent aucune commande (acompte
-- encaissé à la main, facture hors ligne, refus de virement).
--
-- Aucun lien foreign key, comme pour les paiements de commande (`orders.orderId`
-- est une simple colonne) : la base de l'installation peut avoir été reprise sans
-- les commandes, ou dans un ordre qui ferait échouer l'import. Une valeur orpheline
-- est une information ; une contrainte non satisfaite est une migration qui échoue.
--
-- `externalId UNIQUE` est la contrainte qui manque à `products.sku` et qui rend
-- l'envoi idempotent : le rapprochement de la synchronisation se fait dessus, un
-- poste qui rejoue son cache produit des mises à jour et non des doublons.
--
-- `amount` en DECIMAL(14,2), contrairement aux montants de configuration des
-- coupons (DOUBLE) : ce sont des écritures comptables, elles se additionnent, et
-- une somme en binaire ne tombe jamais juste au centime près.
--
-- `cardLast4` seul, jamais le numéro : le masque `**** **** **** 4242` est déduit
-- à la sortie, et le PAN n'est stocké nulle part — pas de `cardToken` non plus,
-- aucun stockage de la sorte n'existe dans ce produit et la moindre colonne de ce
-- type serait un engagement PCI.
--
-- Le pilote JSON n'a pas besoin de migration (la collection est créée à
-- l'écriture). À ne lancer qu'une fois.
--
-- Le DDL ci-dessous est celui que produit `node sql/generate-schema.mjs` à partir
-- de `schema.prisma` : le schéma généré et cette migration doivent décrire les
-- mêmes tables, sinon `migrate deploy` voudrait recréer ce qui existe déjà.

CREATE TABLE `payment_records` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `externalId`  VARCHAR(64)    NOT NULL,
  `orderId`     INT            NULL,
  `orderCode`   VARCHAR(40)    NULL,
  `client`      VARCHAR(160)   NOT NULL,
  `email`       VARCHAR(160)   NULL,
  `method`      VARCHAR(24)    NOT NULL,
  `methodName`  VARCHAR(60)    NULL,
  `amount`      DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `status`      VARCHAR(20)    NOT NULL DEFAULT 'pending',
  `cardLast4`   VARCHAR(4)     NULL,
  `note`        TEXT           NULL,
  `date`        DATETIME(3)    NOT NULL,
  `validatedAt` DATETIME(3)    NULL,
  `createdAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)    NULL,
  `createdBy`   INT            NULL,
  `updatedBy`   INT            NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_records_externalId_key` (`externalId`),
  KEY `payment_records_status_date_idx` (`status`, `date`),
  KEY `payment_records_orderId_idx` (`orderId`),
  KEY `payment_records_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
