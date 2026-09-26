-- Champs d'expédition et horodatages métier de la commande.
--
-- Pourquoi : le Centre de courrier envoie des variables que la fiche commande
-- ne savait pas stocker :
--   order_shipped   → numero_commande, date_livraison, transporteur, suivi_colis, montant_ttc
--   order_delivered → date_livraison
--   order_payment   → date de règlement
-- Ces colonnes sont toutes NULLables : aucune donnée existante n'est touchée.

ALTER TABLE `orders` ADD COLUMN `trackingNumber` VARCHAR(80) NULL;
ALTER TABLE `orders` ADD COLUMN `carrier`        VARCHAR(80) NULL;
ALTER TABLE `orders` ADD COLUMN `shippedAt`      DATETIME(3) NULL;
ALTER TABLE `orders` ADD COLUMN `deliveredAt`    DATETIME(3) NULL;
ALTER TABLE `orders` ADD COLUMN `paidAt`         DATETIME(3) NULL;
