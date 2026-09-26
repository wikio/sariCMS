-- Migration: jetons de réinitialisation de mot de passe
-- Created: 2026-09-19
-- Description: « Mot de passe oublié ? » menait jusqu'ici vers une page qui
--              n'existe pas, et aucun point d'entrée ne délivrait de jeton.
--              Cette table porte les jetons : un hachage SHA-256, une échéance,
--              et `usedAt` qui rend le jeton à usage unique.
--
-- Additif seulement : une table neuve, aucune table existante n'est modifiée.
-- Le pilote JSON n'a pas besoin de migration (la collection est créée à
-- l'écriture). À ne lancer qu'une fois.
--
-- Pourquoi pas `refresh_tokens`, qui a déjà userId/tokenHash/expiresAt :
-- `AuthService.refresh()` cherche par `tokenHash` seul, sans filtre d'usage
-- (auth.service.ts). Un jeton de réinitialisation rangé là serait accepté par
-- `POST /auth/refresh` et donnerait une session complète.

-- Le DDL ci-dessous est celui que produit `node sql/generate-schema.mjs` à
-- partir de `schema.prisma` : le schéma généré et cette migration doivent
-- décrire la même table, sinon `migrate deploy` voudrait recréer ce qui existe
-- déjà.
CREATE TABLE `password_reset_tokens` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `userId`    INT          NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3)  NULL,
  `createdBy` INT          NULL,
  `updatedBy` INT          NULL,
  `ip`        VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_tokenHash_key` (`tokenHash`),
  KEY `password_reset_tokens_userId_idx` (`userId`),
  KEY `password_reset_tokens_expiresAt_idx` (`expiresAt`),
  KEY `password_reset_tokens_deletedAt_idx` (`deletedAt`),
  CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
