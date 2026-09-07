-- Migration: motif de désinscription de la newsletter
-- Created: 2026-09-07
-- Description: Le formulaire de désabonnement de la vitrine demande désormais
--              pourquoi une adresse part. Deux colonnes s'ajoutent à la liste
--              d'abonnement : un code de motif, stable et traduit à l'écran, et
--              le commentaire libre qui l'accompagne. Le pilote JSON n'a pas
--              besoin de migration (les champs sont ajoutés à la fiche).
--
-- Additif seulement : aucune colonne existante n'est modifiée ni supprimée, le
-- contenu de la table reste intact. À ne lancer qu'une fois (MySQL ne connaît
-- pas `ADD COLUMN IF NOT EXISTS`).

ALTER TABLE `newsletter_subscribers`
  -- VARCHAR(255) et le nom d'index sont ceux que produit `node
  -- sql/generate-schema.mjs` à partir de `schema.prisma` : le schéma généré et
  -- cette migration doivent décrire la même table, sinon `migrate deploy`
  -- voudrait recréer ce qui existe déjà.
  ADD COLUMN `unsubscribeReason` VARCHAR(255) NULL AFTER `unsubscribedAt`,
  ADD COLUMN `unsubscribeNote`   TEXT        NULL AFTER `unsubscribeReason`;

-- Le motif se trie et se compte (l'écran d'administration filtre par motif) :
-- un index simple suffit, la table reste petite.
CREATE INDEX `newsletter_subscribers_unsubscribeReason_idx`
  ON `newsletter_subscribers` (`unsubscribeReason`);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT COUNT(*) AS newsletter_subscribers FROM `newsletter_subscribers`;
