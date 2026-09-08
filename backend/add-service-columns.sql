-- Script pour ajouter les colonnes color et image à la table services
-- Exécuter ce script directement dans votre base de données MySQL

-- Ajouter la colonne color (VARCHAR 80, nullable)
ALTER TABLE `services` 
ADD COLUMN `color` VARCHAR(80) NULL AFTER `icon`;

-- Ajouter la colonne image (VARCHAR 500, nullable)
ALTER TABLE `services` 
ADD COLUMN `image` VARCHAR(500) NULL AFTER `color`;

-- Vérifier que les colonnes ont été ajoutées
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'services' 
  AND COLUMN_NAME IN ('color', 'image');
