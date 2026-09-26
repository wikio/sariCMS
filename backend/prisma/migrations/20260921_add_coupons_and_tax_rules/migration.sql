-- Migration: coupons et règles de taxes
-- Created: 2026-09-21
-- Description: coupons et taxes vivaient uniquement dans le `localStorage` du
--              navigateur de l'administrateur (`lib/shop-store.ts`, clés
--              `sari_coupons` et `sari_taxes`), sans aucun appel serveur — il
--              n'existait ni modèle Prisma, ni module backend. Deux effets :
--                1. un poste remplacé, un autre navigateur ou un nettoyage des
--                   données du site perdaient tout le catalogue ;
--                2. le panier public lisait le même `localStorage` et, vide chez
--                   un client, retombait sur `DEFAULT_COUPONS` / `DEFAULT_TAXES`
--                   — les coupons créés par l'administrateur n'étaient donc
--                   jamais applicables à la commande.
--
-- Additif seulement : deux tables neuves, aucune table existante n'est modifiée.
-- `orders.coupon` et `orders.couponDiscount` (déjà présents) conservent l'effet
-- d'un coupon sur un document ; ce qui manquait était sa définition.
--
-- Le pilote JSON n'a pas besoin de migration (la collection est créée à
-- l'écriture). À ne lancer qu'une fois.
--
-- Montants en DOUBLE, pas DECIMAL : Prisma renvoie un objet `Decimal` qui se
-- sérialise en chaîne JSON (« 10.00 »), et `lib/commerce-math.ts` calcule
-- `coupon.amount / 100` sans coercition. Ce sont des valeurs de configuration et
-- des agrégats, pas des écritures comptables ; les montants de ledger restent
-- `DECIMAL(14,2)` sur `orders` et `quotes`.

-- Le DDL ci-dessous est celui que produit `node sql/generate-schema.mjs` à
-- partir de `schema.prisma` : le schéma généré et cette migration doivent
-- décrire les mêmes tables, sinon `migrate deploy` voudrait recréer ce qui
-- existe déjà.

CREATE TABLE `coupons` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `code`           VARCHAR(40)  NOT NULL,
  `type`           VARCHAR(255) NOT NULL DEFAULT 'percent',
  `amount`         DOUBLE       NOT NULL DEFAULT 0,
  `maxDiscount`    DOUBLE       NULL,
  `minOrder`       DOUBLE       NULL,
  `startDate`      DATETIME(3)  NULL,
  `endDate`        DATETIME(3)  NULL,
  `limitGlobal`    INT          NULL,
  `limitPerClient` INT          NULL,
  `used`           INT          NOT NULL DEFAULT 0,
  `scope`          VARCHAR(255) NOT NULL DEFAULT 'all',
  `scopeValues`    JSON         NULL,
  `excludeValues`  JSON         NULL,
  `stackable`      TINYINT(1)   NOT NULL DEFAULT 0,
  `active`         TINYINT(1)   NOT NULL DEFAULT 1,
  `revenue`        DOUBLE       NOT NULL DEFAULT 0,
  `notes`          TEXT         NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`      DATETIME(3)  NULL,
  `createdBy`      INT          NULL,
  `updatedBy`      INT          NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_key` (`code`),
  KEY `coupons_active_idx` (`active`),
  KEY `coupons_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tax_rules` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(255) NOT NULL,
  `names`       JSON         NULL,
  `labels`      JSON         NULL,
  `mode`        VARCHAR(255) NOT NULL DEFAULT 'percent',
  `rate`        DOUBLE       NOT NULL DEFAULT 0,
  `zone`        VARCHAR(255) NOT NULL DEFAULT 'DZ',
  `category`    VARCHAR(255) NULL,
  `scope`       VARCHAR(255) NOT NULL DEFAULT 'all',
  `scopeValues` JSON         NULL,
  `included`    TINYINT(1)   NOT NULL DEFAULT 0,
  `priority`    INT          NOT NULL DEFAULT 0,
  `active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `isDefault`   TINYINT(1)   NOT NULL DEFAULT 0,
  `startDate`   DATETIME(3)  NULL,
  `endDate`     DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3)  NULL,
  `createdBy`   INT          NULL,
  `updatedBy`   INT          NULL,
  PRIMARY KEY (`id`),
  KEY `tax_rules_active_priority_idx` (`active`, `priority`),
  KEY `tax_rules_deletedAt_idx` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note sur l'unicité de `coupons.code` : le service vérifie l'unicité en
-- incluant la corbeille (`assertUniques`), donc un code envoyé en corbeille
-- reste réservé jusqu'à la purge automatique (30 jours par défaut). C'est voulu :
-- réutiliser un code rendrait ambigus les historiques déjà stockés dans
-- `orders.coupon`.
