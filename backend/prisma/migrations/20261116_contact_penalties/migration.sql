-- Migration additive : aucune modification des messages ou comptes existants.
CREATE TABLE IF NOT EXISTS `contact_penalties` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `userId`    INT          NOT NULL,
  `reason`    VARCHAR(255) NOT NULL,
  `points`    INT          NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `contact_penalties_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `contact_penalties_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
