-- Migration 2026-09-17 : Détail montants commande (remise globale & livraison globale éditables admin)
-- Applique les colonnes manquantes à `orders` et `quotes` pour persistance instantanée vitrine/PDF.

-- Orders
ALTER TABLE `orders`
  ADD COLUMN `subtotal`        DECIMAL(14,2) NULL AFTER `invoice`,
  ADD COLUMN `discountTotal`   DECIMAL(14,2) NULL AFTER `subtotal`,
  ADD COLUMN `productDiscount` DECIMAL(14,2) NULL AFTER `discountTotal`,
  ADD COLUMN `globalDiscount`  DECIMAL(14,2) NULL AFTER `productDiscount`,
  ADD COLUMN `couponDiscount`  DECIMAL(14,2) NULL AFTER `globalDiscount`,
  ADD COLUMN `shippingFee`     DECIMAL(14,2) NULL AFTER `couponDiscount`,
  ADD COLUMN `productShipping` DECIMAL(14,2) NULL AFTER `shippingFee`,
  ADD COLUMN `globalShipping`  DECIMAL(14,2) NULL AFTER `productShipping`,
  ADD COLUMN `taxTotal`        DECIMAL(14,2) NULL AFTER `globalShipping`,
  ADD COLUMN `taxLines`        JSON NULL AFTER `taxTotal`,
  ADD COLUMN `deliveryZone`    VARCHAR(80) NULL AFTER `taxLines`,
  ADD COLUMN `saleZone`        VARCHAR(80) NULL AFTER `deliveryZone`,
  ADD COLUMN `deliveryAddress` TEXT NULL AFTER `saleZone`,
  ADD COLUMN `country`         VARCHAR(80) NULL AFTER `deliveryAddress`,
  ADD COLUMN `notes`           TEXT NULL AFTER `country`,
  ADD COLUMN `adminNotes`      TEXT NULL AFTER `notes`;

-- Quotes (cohérence)
ALTER TABLE `quotes`
  ADD COLUMN `subtotal`        DECIMAL(14,2) NULL AFTER `response`,
  ADD COLUMN `discountTotal`   DECIMAL(14,2) NULL AFTER `subtotal`,
  ADD COLUMN `productDiscount` DECIMAL(14,2) NULL AFTER `discountTotal`,
  ADD COLUMN `globalDiscount`  DECIMAL(14,2) NULL AFTER `productDiscount`,
  ADD COLUMN `couponDiscount`  DECIMAL(14,2) NULL AFTER `globalDiscount`,
  ADD COLUMN `shippingFee`     DECIMAL(14,2) NULL AFTER `couponDiscount`,
  ADD COLUMN `productShipping` DECIMAL(14,2) NULL AFTER `shippingFee`,
  ADD COLUMN `globalShipping`  DECIMAL(14,2) NULL AFTER `productShipping`,
  ADD COLUMN `taxTotal`        DECIMAL(14,2) NULL AFTER `globalShipping`,
  ADD COLUMN `taxLines`        JSON NULL AFTER `taxTotal`,
  ADD COLUMN `deliveryZone`    VARCHAR(80) NULL AFTER `taxLines`,
  ADD COLUMN `saleZone`        VARCHAR(80) NULL AFTER `deliveryZone`,
  ADD COLUMN `deliveryAddress` TEXT NULL AFTER `saleZone`,
  ADD COLUMN `adminNotes`      TEXT NULL AFTER `deliveryAddress`;
