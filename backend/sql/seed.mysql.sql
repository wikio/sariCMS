-- =============================================================================
-- SARI CMS — Données de démarrage (contexte algérien)
-- Généré par backend/sql/generate-seed.mjs — ne pas éditer à la main.
-- Mot de passe de démo (tous les comptes) : ChangeMe_Sari2026!
--
-- Import : sélectionner d'abord la base cible, puis exécuter ce fichier.
--   CLI        : mysql -u USER -p NOM_DE_LA_BASE < backend/sql/seed.mysql.sql
--   phpMyAdmin : ouvrir la base puis Importer → seed.mysql.sql
-- =============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `permissions` (`id`, `resource`, `action`, `description`, `createdAt`, `updatedAt`) VALUES
(1, 'users', 'create', 'Créer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'users', 'read', 'Consulter users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'users', 'update', 'Modifier users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'users', 'delete', 'Supprimer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'users', 'admin', 'Administrer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'roles', 'create', 'Créer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'roles', 'read', 'Consulter roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'roles', 'update', 'Modifier roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'roles', 'delete', 'Supprimer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'roles', 'admin', 'Administrer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'permissions', 'create', 'Créer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'permissions', 'read', 'Consulter permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(13, 'permissions', 'update', 'Modifier permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(14, 'permissions', 'delete', 'Supprimer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(15, 'permissions', 'admin', 'Administrer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(16, 'pages', 'create', 'Créer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(17, 'pages', 'read', 'Consulter pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(18, 'pages', 'update', 'Modifier pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(19, 'pages', 'delete', 'Supprimer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(20, 'pages', 'admin', 'Administrer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(21, 'faqs', 'create', 'Créer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(22, 'faqs', 'read', 'Consulter faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(23, 'faqs', 'update', 'Modifier faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(24, 'faqs', 'delete', 'Supprimer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(25, 'faqs', 'admin', 'Administrer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(26, 'testimonials', 'create', 'Créer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(27, 'testimonials', 'read', 'Consulter testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(28, 'testimonials', 'update', 'Modifier testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(29, 'testimonials', 'delete', 'Supprimer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(30, 'testimonials', 'admin', 'Administrer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(31, 'menus', 'create', 'Créer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(32, 'menus', 'read', 'Consulter menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(33, 'menus', 'update', 'Modifier menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(34, 'menus', 'delete', 'Supprimer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(35, 'menus', 'admin', 'Administrer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(36, 'contact', 'create', 'Créer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(37, 'contact', 'read', 'Consulter contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(38, 'contact', 'update', 'Modifier contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(39, 'contact', 'delete', 'Supprimer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(40, 'contact', 'admin', 'Administrer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(41, 'translations', 'create', 'Créer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(42, 'translations', 'read', 'Consulter translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(43, 'translations', 'update', 'Modifier translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(44, 'translations', 'delete', 'Supprimer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(45, 'translations', 'admin', 'Administrer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(46, 'audit', 'create', 'Créer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(47, 'audit', 'read', 'Consulter audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(48, 'audit', 'update', 'Modifier audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(49, 'audit', 'delete', 'Supprimer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(50, 'audit', 'admin', 'Administrer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(51, 'settings', 'create', 'Créer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(52, 'settings', 'read', 'Consulter settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(53, 'settings', 'update', 'Modifier settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(54, 'settings', 'delete', 'Supprimer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(55, 'settings', 'admin', 'Administrer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(56, 'news', 'create', 'Créer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(57, 'news', 'read', 'Consulter news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(58, 'news', 'update', 'Modifier news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(59, 'news', 'delete', 'Supprimer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(60, 'news', 'admin', 'Administrer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(61, 'events', 'create', 'Créer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(62, 'events', 'read', 'Consulter events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(63, 'events', 'update', 'Modifier events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(64, 'events', 'delete', 'Supprimer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(65, 'events', 'admin', 'Administrer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(66, 'products', 'create', 'Créer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(67, 'products', 'read', 'Consulter products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(68, 'products', 'update', 'Modifier products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(69, 'products', 'delete', 'Supprimer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(70, 'products', 'admin', 'Administrer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(71, 'services', 'create', 'Créer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(72, 'services', 'read', 'Consulter services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(73, 'services', 'update', 'Modifier services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(74, 'services', 'delete', 'Supprimer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(75, 'services', 'admin', 'Administrer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(76, 'partners', 'create', 'Créer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(77, 'partners', 'read', 'Consulter partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(78, 'partners', 'update', 'Modifier partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(79, 'partners', 'delete', 'Supprimer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(80, 'partners', 'admin', 'Administrer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(81, 'careers', 'create', 'Créer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(82, 'careers', 'read', 'Consulter careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(83, 'careers', 'update', 'Modifier careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(84, 'careers', 'delete', 'Supprimer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(85, 'careers', 'admin', 'Administrer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(86, 'solutions', 'create', 'Créer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(87, 'solutions', 'read', 'Consulter solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(88, 'solutions', 'update', 'Modifier solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(89, 'solutions', 'delete', 'Supprimer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(90, 'solutions', 'admin', 'Administrer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(91, 'hero', 'create', 'Créer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(92, 'hero', 'read', 'Consulter hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(93, 'hero', 'update', 'Modifier hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(94, 'hero', 'delete', 'Supprimer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(95, 'hero', 'admin', 'Administrer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(96, 'dashboard', 'create', 'Créer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(97, 'dashboard', 'read', 'Consulter dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(98, 'dashboard', 'update', 'Modifier dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(99, 'dashboard', 'delete', 'Supprimer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(100, 'dashboard', 'admin', 'Administrer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `slug`, `description`, `isSystem`, `permissionIds`, `createdAt`, `updatedAt`) VALUES
(1, 'Super Administrateur', 'super-admin', 'Accès complet au système (contourne le contrôle de permissions).', 1, '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'Administrateur', 'admin', 'Gestion du contenu, du catalogue et des commandes.', 1, '[16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,47,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'Éditeur de contenu', 'editor', 'Rédaction et mise à jour du contenu de la vitrine.', 1, '[16,17,18,21,22,23,26,27,28,31,32,33,41,42,43,56,57,58,61,62,63,66,67,68,71,72,73,76,77,78,81,82,83,86,87,88,91,92,93,97]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'Lecteur', 'viewer', 'Accès en lecture seule au back-office.', 1, '[17,22,27,32,37,42,47,57,62,67,72,77,82,87,92,97]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- role_permissions (liens rôles ↔ permissions)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(1, 34),
(1, 35),
(1, 36),
(1, 37),
(1, 38),
(1, 39),
(1, 40),
(1, 41),
(1, 42),
(1, 43),
(1, 44),
(1, 45),
(1, 46),
(1, 47),
(1, 48),
(1, 49),
(1, 50),
(1, 51),
(1, 52),
(1, 53),
(1, 54),
(1, 55),
(1, 56),
(1, 57),
(1, 58),
(1, 59),
(1, 60),
(1, 61),
(1, 62),
(1, 63),
(1, 64),
(1, 65),
(1, 66),
(1, 67),
(1, 68),
(1, 69),
(1, 70),
(1, 71),
(1, 72),
(1, 73),
(1, 74),
(1, 75),
(1, 76),
(1, 77),
(1, 78),
(1, 79),
(1, 80),
(1, 81),
(1, 82),
(1, 83),
(1, 84),
(1, 85),
(1, 86),
(1, 87),
(1, 88),
(1, 89),
(1, 90),
(1, 91),
(1, 92),
(1, 93),
(1, 94),
(1, 95),
(1, 96),
(1, 97),
(1, 98),
(1, 99),
(1, 100),
(2, 16),
(2, 17),
(2, 18),
(2, 19),
(2, 20),
(2, 21),
(2, 22),
(2, 23),
(2, 24),
(2, 25),
(2, 26),
(2, 27),
(2, 28),
(2, 29),
(2, 30),
(2, 31),
(2, 32),
(2, 33),
(2, 34),
(2, 35),
(2, 36),
(2, 37),
(2, 38),
(2, 39),
(2, 40),
(2, 41),
(2, 42),
(2, 43),
(2, 44),
(2, 45),
(2, 47),
(2, 51),
(2, 52),
(2, 53),
(2, 54),
(2, 55),
(2, 56),
(2, 57),
(2, 58),
(2, 59),
(2, 60),
(2, 61),
(2, 62),
(2, 63),
(2, 64),
(2, 65),
(2, 66),
(2, 67),
(2, 68),
(2, 69),
(2, 70),
(2, 71),
(2, 72),
(2, 73),
(2, 74),
(2, 75),
(2, 76),
(2, 77),
(2, 78),
(2, 79),
(2, 80),
(2, 81),
(2, 82),
(2, 83),
(2, 84),
(2, 85),
(2, 86),
(2, 87),
(2, 88),
(2, 89),
(2, 90),
(2, 91),
(2, 92),
(2, 93),
(2, 94),
(2, 95),
(2, 96),
(2, 97),
(2, 98),
(2, 99),
(2, 100),
(3, 16),
(3, 17),
(3, 18),
(3, 21),
(3, 22),
(3, 23),
(3, 26),
(3, 27),
(3, 28),
(3, 31),
(3, 32),
(3, 33),
(3, 41),
(3, 42),
(3, 43),
(3, 56),
(3, 57),
(3, 58),
(3, 61),
(3, 62),
(3, 63),
(3, 66),
(3, 67),
(3, 68),
(3, 71),
(3, 72),
(3, 73),
(3, 76),
(3, 77),
(3, 78),
(3, 81),
(3, 82),
(3, 83),
(3, 86),
(3, 87),
(3, 88),
(3, 91),
(3, 92),
(3, 93),
(3, 97),
(4, 17),
(4, 22),
(4, 27),
(4, 32),
(4, 37),
(4, 42),
(4, 47),
(4, 57),
(4, 62),
(4, 67),
(4, 72),
(4, 77),
(4, 82),
(4, 87),
(4, 92),
(4, 97);

-- ---------------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users` (`id`, `email`, `passwordHash`, `firstName`, `lastName`, `phone`, `company`, `type`, `status`, `locale`, `roleId`, `address`, `wilaya`, `country`, `position`, `createdAt`, `updatedAt`) VALUES
(1, 'admin@sarisysteme.com', '$2a$10$EXZ.3ROo8T/4JO39RLf74enILvsvQG70mE1b/ee58VJpvSedHEhNe', 'Karim', 'BENALI', '(+213) 23 52 42 72', 'SARI Système SARL', 'admin', 'active', 'fr', 1, NULL, 'Alger', 'Algérie', 'Gérant', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'gestion@sarisysteme.com', '$2a$10$EXZ.3ROo8T/4JO39RLf74enILvsvQG70mE1b/ee58VJpvSedHEhNe', 'Yasmine', 'CHERIF', '(+213) 550 12 34 56', 'SARI Système SARL', 'admin', 'active', 'fr', 2, NULL, 'Alger', 'Algérie', 'Responsable commerciale', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'client@clinique-elafia.dz', '$2a$10$EXZ.3ROo8T/4JO39RLf74enILvsvQG70mE1b/ee58VJpvSedHEhNe', 'Clinique', 'El Afia', '(+213) 21 63 45 78', 'Clinique El Afia', 'client', 'active', 'fr', NULL, 'Rue Didouche Mourad, Alger-Centre', 'Alger', 'Algérie', NULL, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'contact@meditech.dz', '$2a$10$EXZ.3ROo8T/4JO39RLf74enILvsvQG70mE1b/ee58VJpvSedHEhNe', 'MediTech', 'Algérie', '(+213) 41 33 22 11', 'MediTech Algérie', 'partner', 'active', 'fr', NULL, NULL, 'Oran', 'Algérie', NULL, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'mohamed.saidi@gmail.com', '$2a$10$EXZ.3ROo8T/4JO39RLf74enILvsvQG70mE1b/ee58VJpvSedHEhNe', 'Mohamed', 'SAIDI', '(+213) 661 22 33 44', NULL, 'candidate', 'pending', 'fr', NULL, NULL, 'Constantine', 'Algérie', 'Technicien biomédical', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Coordonnées (contact_info)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `contact_info` (`id`, `locale`, `company`, `tagline`, `phone`, `email`, `address`, `hours`, `currency`, `social`, `extras`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'SARI Système SARL', 'L''excellence médicale au service de la santé en Algérie', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie', 'Dim - Jeu : 8h00 - 17h00', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"Alger","description":"Distribution d''équipements et consommables médicaux depuis plus de 20 ans en Algérie.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'en', 'SARI Système SARL', 'Medical excellence serving healthcare in Algeria', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria', 'Sun - Thu: 8:00 AM - 5:00 PM', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"Algiers","description":"Distributing medical equipment and consumables in Algeria for over 20 years.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'ar', 'ساري سيستم ش.ذ.م.م', 'التميز الطبي في خدمة الصحة في الجزائر', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة، الجزائر', 'الأحد - الخميس: 8:00 - 17:00', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"الجزائر","description":"توزيع المعدات والمستلزمات الطبية منذ أكثر من 20 عامًا في الجزائر.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `menus` (`id`, `locale`, `name`, `location`, `items`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'Menu principal', 'main', '[{"id":"home","label":"Accueil","href":"/"},{"id":"about","label":"À Propos","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions","submenu":[{"label":"Diagnostic","href":"/solutions/diagnostic","desc":"Échographes, tensiomètres, microscopes"},{"label":"Cardiologie","href":"/solutions/cardiology","desc":"ECG, défibrillateurs, moniteurs"},{"label":"Imagerie","href":"/solutions/imaging","desc":"Scanners, IRM, radiologie"},{"label":"Chirurgie","href":"/solutions/surgery","desc":"Instruments, autoclaves, tables opératoires"},{"label":"Réanimation","href":"/solutions/emergency","desc":"Défibrillateurs, chariots d''urgence"},{"label":"Laboratoire","href":"/solutions/laboratory","desc":"Analyseurs, microscopes, centrifugeuses"}]},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Produits","href":"/products"},{"id":"events","label":"Événements","href":"/events"},{"id":"news","label":"Actualités","href":"/news"},{"id":"careers","label":"Carrières","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"Accueil","href":"/"},{"id":"about","label":"À Propos","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions"},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Produits","href":"/products"},{"id":"news","label":"Actualités","href":"/news"},{"id":"careers","label":"Carrières","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"Mentions Légales","href":"/legal/mentions"},{"id":"privacy","label":"Confidentialité","href":"/legal/privacy"},{"id":"conditions","label":"Conditions d''utilisation","href":"/legal/conditions"},{"id":"verification","label":"Vérification","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'en', 'Menu principal', 'main', '[{"id":"home","label":"Home","href":"/"},{"id":"about","label":"About","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions","submenu":[{"label":"Diagnostic","href":"/solutions/diagnostic","desc":"Ultrasound, blood pressure monitors, microscopes"},{"label":"Cardiology","href":"/solutions/cardiology","desc":"ECG, defibrillators, monitors"},{"label":"Imaging","href":"/solutions/imaging","desc":"CT, MRI, radiology"},{"label":"Surgery","href":"/solutions/surgery","desc":"Instruments, autoclaves, operating tables"},{"label":"Emergency","href":"/solutions/emergency","desc":"Defibrillators, crash carts"},{"label":"Laboratory","href":"/solutions/laboratory","desc":"Analyzers, microscopes, centrifuges"}]},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Products","href":"/products"},{"id":"events","label":"Events","href":"/events"},{"id":"news","label":"News","href":"/news"},{"id":"careers","label":"Careers","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"Home","href":"/"},{"id":"about","label":"About","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions"},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Products","href":"/products"},{"id":"news","label":"News","href":"/news"},{"id":"careers","label":"Careers","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"Legal Notice","href":"/legal/mentions"},{"id":"privacy","label":"Privacy Policy","href":"/legal/privacy"},{"id":"conditions","label":"Terms & Conditions","href":"/legal/conditions"},{"id":"verification","label":"Verification","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'ar', 'Menu principal', 'main', '[{"id":"home","label":"الرئيسية","href":"/"},{"id":"about","label":"من نحن","href":"/about"},{"id":"solutions","label":"الحلول","href":"/solutions","submenu":[{"label":"التشخيص","href":"/solutions/diagnostic","desc":"أجهزة الموجات فوق الصوتية، أجهزة قياس الضغط، المجاهر"},{"label":"أمراض القلب","href":"/solutions/cardiology","desc":"تخطيط القلب، أجهزة الصدمات، الشاشات"},{"label":"التصوير","href":"/solutions/imaging","desc":"الماسح الضوئي، الرنين المغناطيسي، الأشعة"},{"label":"الجراحة","href":"/solutions/surgery","desc":"الأدوات، المعقمات، طاولات العمليات"},{"label":"الطوارئ","href":"/solutions/emergency","desc":"أجهزة الصدمات، عربات الطوارئ"},{"label":"المختبر","href":"/solutions/laboratory","desc":"أجهزة التحليل، المجاهر، أجهزة الطرد المركزي"}]},{"id":"services","label":"الخدمات","href":"/services"},{"id":"products","label":"المنتجات","href":"/products"},{"id":"events","label":"الفعاليات","href":"/events"},{"id":"news","label":"الأخبار","href":"/news"},{"id":"careers","label":"الوظائف","href":"/careers"},{"id":"contact","label":"اتصل بنا","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'ar', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"الرئيسية","href":"/"},{"id":"about","label":"من نحن","href":"/about"},{"id":"solutions","label":"الحلول","href":"/solutions"},{"id":"services","label":"الخدمات","href":"/services"},{"id":"products","label":"المنتجات","href":"/products"},{"id":"news","label":"الأخبار","href":"/news"},{"id":"careers","label":"الوظائف","href":"/careers"},{"id":"contact","label":"اتصل بنا","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"الإشعار القانوني","href":"/legal/mentions"},{"id":"privacy","label":"سياسة الخصوصية","href":"/legal/privacy"},{"id":"conditions","label":"الشروط والأحكام","href":"/legal/conditions"},{"id":"verification","label":"التحقق","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Pages légales + À propos
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `pages` (`id`, `slug`, `locale`, `kind`, `subtype`, `title`, `content`, `status`, `publishedAt`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
(1, 'mentions', 'fr', 'legal', 'simple', 'Mentions Légales', '<p class="mb-4"><strong>Raison sociale :</strong> SARI Système SARL</p><p class="mb-4"><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p><p class="mb-4"><strong>Capital social :</strong> 10 000 000 DZD (dix millions de dinars algériens)</p><p class="mb-4"><strong>Registre de Commerce (RC) :</strong> Alger n° 16/00-1234567B21</p><p class="mb-4"><strong>NIF (Numéro d''Identification Fiscale) :</strong> 002116001234567</p><p class="mb-4"><strong>NIS (Numéro d''Identification Statistique) :</strong> 09876543210016</p><p class="mb-4"><strong>Siège social :</strong> 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie</p><p class="mb-4"><strong>Téléphone :</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>Email :</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Directeur de la publication :</strong> Karim BENALI, Gérant</p><p class="mb-4"><strong>Hébergeur :</strong> Hébergement local algérien (datacenter Alger)</p><p class="mb-4">Les présentes mentions légales sont établies conformément à la législation algérienne en vigueur.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'privacy', 'fr', 'legal', 'simple', 'Politique de Confidentialité', '<p class="mb-4">SARI Système SARL accorde une grande importance à la protection de vos données à caractère personnel, conformément à la <strong>loi n° 18-07 du 10 juin 2018</strong> relative à la protection des personnes physiques dans le traitement des données à caractère personnel.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Responsable du traitement</h3><p class="mb-4">SARI Système SARL, 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Données collectées</h3><p class="mb-4">Nom, email, téléphone, entreprise et contenu des demandes (devis, contact, candidature).</p><h3 class="text-xl font-bold mb-3 mt-6">3. Finalités</h3><p class="mb-4">Traitement de vos demandes, suivi commercial et respect de nos obligations légales.</p><h3 class="text-xl font-bold mb-3 mt-6">4. Vos droits</h3><p class="mb-4">Vous disposez des droits d''accès, de rectification et d''opposition auprès de l''<strong>ANPDP</strong> (Autorité Nationale de Protection des Données à caractère Personnel). Contact : dpo@sarisysteme.com</p><h3 class="text-xl font-bold mb-3 mt-6">5. Cookies</h3><p class="mb-4">Notre site utilise des cookies pour améliorer votre expérience de navigation.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'conditions', 'fr', 'legal', 'simple', 'Conditions Générales de Vente', '<p class="mb-4">Les présentes CGV s''appliquent à toutes les ventes de produits et services réalisées par SARI Système SARL sur le territoire algérien.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 1 : Prix</h3><p class="mb-4">Les prix sont indiqués en <strong>Dinar Algérien (DZD)</strong> hors taxes. La TVA au taux en vigueur (19% ou 9% selon les produits) s''ajoute au prix HT.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 2 : Commandes</h3><p class="mb-4">Toute commande doit être confirmée par écrit (email ou bon de commande signé). Accusé de réception sous 48h ouvrées.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 3 : Livraison</h3><p class="mb-4">Livraison sur les <strong>58 wilayas</strong>. Délais indicatifs de 3 à 15 jours ouvrés selon la wilaya et la disponibilité.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 4 : Paiement</h3><p class="mb-4">Virement bancaire, chèque, carte CIB / Edahabia ou paiement à la livraison selon accord préalable.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 5 : Garantie</h3><p class="mb-4">Garantie constructeur de 12 à 36 mois selon les équipements. Le SAV est assuré par nos techniciens agréés.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'about', 'fr', 'about', 'simple', 'À Propos de SARI Système', '<p class="mb-4">Fondée en 2003 à Alger, SARI Système SARL s''est imposée comme un acteur majeur de la distribution d''équipements et de consommables médicaux en Algérie.</p><h3 class="text-xl font-bold mb-3 mt-6">Notre Mission</h3><p class="mb-4">Accompagner les établissements de santé publics et privés des 58 wilayas avec des équipements fiables, certifiés et un service de proximité.</p><h3 class="text-xl font-bold mb-3 mt-6">Nos Valeurs</h3><ul class="list-disc pl-6 mb-4 space-y-2"><li>Qualité et conformité aux normes internationales</li><li>Réactivité et SAV de proximité</li><li>Expertise biomédicale</li><li>Engagement envers la santé publique algérienne</li></ul>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'mentions', 'en', 'legal', 'simple', 'Legal Notice', '<p class="mb-4"><strong>Company name:</strong> SARI Système SARL</p><p class="mb-4"><strong>Legal form:</strong> Limited Liability Company (SARL)</p><p class="mb-4"><strong>Share capital:</strong> DZD 10,000,000</p><p class="mb-4"><strong>Trade Register (RC):</strong> Algiers n° 16/00-1234567B21</p><p class="mb-4"><strong>Tax ID (NIF):</strong> 002116001234567</p><p class="mb-4"><strong>Statistical ID (NIS):</strong> 09876543210016</p><p class="mb-4"><strong>Registered office:</strong> 17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria</p><p class="mb-4"><strong>Phone:</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>Email:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Publisher:</strong> Karim BENALI, Manager</p><p class="mb-4"><strong>Hosting:</strong> Local Algerian hosting (Algiers datacenter)</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'privacy', 'en', 'legal', 'simple', 'Privacy Policy', '<p class="mb-4">SARI Système SARL protects your personal data in accordance with <strong>Law n° 18-07 of June 10, 2018</strong> on the protection of individuals in the processing of personal data.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Data controller</h3><p class="mb-4">SARI Système SARL, Algiers, Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Collected data</h3><p class="mb-4">Name, email, phone, company and request contents.</p><h3 class="text-xl font-bold mb-3 mt-6">3. Your rights</h3><p class="mb-4">Access, rectification and objection rights with the ANPDP. Contact: dpo@sarisysteme.com</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'conditions', 'en', 'legal', 'simple', 'Terms and Conditions of Sale', '<p class="mb-4">These terms apply to all sales made by SARI Système SARL in Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Prices</h3><p class="mb-4">Prices are in <strong>Algerian Dinar (DZD)</strong>, VAT excluded (19% or 9%).</p><h3 class="text-xl font-bold mb-3 mt-6">2. Delivery</h3><p class="mb-4">Delivery to all <strong>58 wilayas</strong>, 3 to 15 business days.</p><h3 class="text-xl font-bold mb-3 mt-6">3. Payment</h3><p class="mb-4">Bank transfer, cheque, CIB / Edahabia card or cash on delivery.</p><h3 class="text-xl font-bold mb-3 mt-6">4. Warranty</h3><p class="mb-4">12 to 36 months manufacturer warranty.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'about', 'en', 'about', 'simple', 'About SARI Système', '<p class="mb-4">Founded in 2003 in Algiers, SARI Système SARL is a leading distributor of medical equipment and consumables in Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">Our Mission</h3><p class="mb-4">Support public and private healthcare facilities across the 58 wilayas with reliable, certified equipment and local service.</p>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'mentions', 'ar', 'legal', 'simple', 'الإشعار القانوني', '<p class="mb-4"><strong>الاسم التجاري:</strong> ساري سيستم ش.ذ.م.م</p><p class="mb-4"><strong>الشكل القانوني:</strong> شركة ذات مسؤولية محدودة (ش.ذ.م.م)</p><p class="mb-4"><strong>رأس المال:</strong> 10,000,000 دج</p><p class="mb-4"><strong>السجل التجاري:</strong> الجزائر رقم 16/00-1234567B21</p><p class="mb-4"><strong>الرقم الجبائي (NIF):</strong> 002116001234567</p><p class="mb-4"><strong>الرقم الإحصائي (NIS):</strong> 09876543210016</p><p class="mb-4"><strong>المقر الاجتماعي:</strong> 17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة</p><p class="mb-4"><strong>الهاتف:</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>البريد الإلكتروني:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>مدير النشر:</strong> كريم بن علي، المسير</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'privacy', 'ar', 'legal', 'simple', 'سياسة الخصوصية', '<p class="mb-4">تحمي ساري سيستم بياناتك الشخصية وفقًا <strong>للقانون رقم 18-07 المؤرخ في 10 جوان 2018</strong> المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.</p><h3 class="text-xl font-bold mb-3 mt-6">1. مسؤول المعالجة</h3><p class="mb-4">ساري سيستم ش.ذ.م.م، الجزائر العاصمة.</p><h3 class="text-xl font-bold mb-3 mt-6">2. البيانات المجمعة</h3><p class="mb-4">الاسم، البريد الإلكتروني، الهاتف، المؤسسة ومحتوى الطلبات.</p><h3 class="text-xl font-bold mb-3 mt-6">3. حقوقك</h3><p class="mb-4">حقوق الوصول والتصحيح والاعتراض لدى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي. للتواصل: dpo@sarisysteme.com</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'conditions', 'ar', 'legal', 'simple', 'الشروط والأحكام العامة للبيع', '<p class="mb-4">تنطبق هذه الشروط على جميع مبيعات ساري سيستم في الجزائر.</p><h3 class="text-xl font-bold mb-3 mt-6">1. الأسعار</h3><p class="mb-4">الأسعار بالدينار الجزائري (DZD) دون احتساب الرسم على القيمة المضافة (19% أو 9%).</p><h3 class="text-xl font-bold mb-3 mt-6">2. التوصيل</h3><p class="mb-4">التوصيل إلى جميع الولايات الـ58 خلال 3 إلى 15 يوم عمل.</p><h3 class="text-xl font-bold mb-3 mt-6">3. الدفع</h3><p class="mb-4">تحويل بنكي، شيك، بطاقة CIB / الذهبية أو الدفع عند الاستلام.</p><h3 class="text-xl font-bold mb-3 mt-6">4. الضمان</h3><p class="mb-4">ضمان المصنع من 12 إلى 36 شهرًا.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'about', 'ar', 'about', 'simple', 'من نحن — ساري سيستم', '<p class="mb-4">تأسست ساري سيستم في عام 2003 بالجزائر العاصمة، وأصبحت فاعلًا رئيسيًا في توزيع المعدات والمستلزمات الطبية في الجزائر.</p><h3 class="text-xl font-bold mb-3 mt-6">مهمتنا</h3><p class="mb-4">مرافقة المؤسسات الصحية العمومية والخاصة عبر 58 ولاية بمعدات موثوقة ومعتمدة وخدمة قريبة.</p>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `products` (`id`, `locale`, `slug`, `name`, `category`, `sku`, `price`, `shortDesc`, `image`, `inStock`, `stockQty`, `currency`, `sortOrder`, `deliveryTime`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'echographe-portable-pro-x1', 'Échographe Portable Pro X1', 'Diagnostic', 'SARI-ECH-001', '1 450 000 DZD', 'Échographe portable avec sondes convexes et linéaires, idéal pour les cabinets et les structures mobiles.', NULL, 1, 10, 'DZD', 1, '5-10 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'lit-examen-electrique-premium', 'Lit d''Examen Électrique Premium', 'Équipements', 'SARI-LIT-002', '320 000 DZD', 'Lit d''examen électrique à hauteur variable, structure renforcée.', NULL, 1, 10, 'DZD', 2, '10-15 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'sterilisateur-autoclave-classe-b', 'Stérilisateur Autoclave Classe B', 'Chirurgie', 'SARI-STR-003', '480 000 DZD', 'Autoclave Classe B conforme aux normes, cycles rapides.', NULL, 1, 10, 'DZD', 3, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'tensiometre-digital-pro', 'Tensiomètre Digital Pro', 'Diagnostic', 'SARI-TEN-004', '28 500 DZD', 'Tensiomètre électronique professionnel avec brassard adulte.', NULL, 1, 10, 'DZD', 4, '3-5 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'fr', 'moniteur-signes-vitaux-5-parametres', 'Moniteur de Signes Vitaux 5 Paramètres', 'Réanimation', 'SARI-MON-005', '265 000 DZD', 'Moniteur multiparamétrique : ECG, SpO2, PNIA, température, respiration.', NULL, 1, 10, 'DZD', 5, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'fr', 'defibrillateur-biphasique', 'Défibrillateur Biphasique', 'Urgence', 'SARI-DEF-006', '690 000 DZD', 'Défibrillateur biphasique avec mode AED et moniteur intégré.', NULL, 1, 10, 'DZD', 6, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'portable-ultrasound-pro-x1', 'Portable Ultrasound Pro X1', 'Diagnostic', 'SARI-ECH-001', 'DZD 1,450,000', 'Portable ultrasound with convex and linear probes.', NULL, 1, 10, 'DZD', 1, '5-10 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'premium-electric-examination-table', 'Premium Electric Examination Table', 'Equipment', 'SARI-LIT-002', 'DZD 320,000', 'Electric examination table with adjustable height.', NULL, 1, 10, 'DZD', 2, '10-15 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'en', 'class-b-autoclave-sterilizer', 'Class B Autoclave Sterilizer', 'Surgery', 'SARI-STR-003', 'DZD 480,000', 'Class B autoclave with fast cycles.', NULL, 1, 10, 'DZD', 3, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'en', 'digital-pro-blood-pressure-monitor', 'Digital Pro Blood Pressure Monitor', 'Diagnostic', 'SARI-TEN-004', 'DZD 28,500', 'Professional electronic blood pressure monitor.', NULL, 1, 10, 'DZD', 4, '3-5 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'en', '5-parameter-vital-signs-monitor', '5-Parameter Vital Signs Monitor', 'Intensive Care', 'SARI-MON-005', 'DZD 265,000', 'Multiparameter monitor: ECG, SpO2, NIBP, temperature, respiration.', NULL, 1, 10, 'DZD', 5, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'en', 'biphasic-defibrillator', 'Biphasic Defibrillator', 'Emergency', 'SARI-DEF-006', 'DZD 690,000', 'Biphasic defibrillator with AED mode and built-in monitor.', NULL, 1, 10, 'DZD', 6, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(13, 'ar', 'echographe-portable-pro-x1', 'جهاز الموجات فوق الصوتية المحمول Pro X1', 'التشخيص', 'SARI-ECH-001', '1,450,000 دج', 'جهاز موجات فوق صوتية محمول بمجسات محدبة وخطية.', NULL, 1, 10, 'DZD', 1, '5-10 أيام عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(14, 'ar', 'lit-examen-electrique-premium', 'سرير فحص كهربائي فاخر', 'المعدات', 'SARI-LIT-002', '320,000 دج', 'سرير فحص كهربائي بارتفاع قابل للتعديل.', NULL, 1, 10, 'DZD', 2, '10-15 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(15, 'ar', 'sterilisateur-autoclave-classe-b', 'معقم أوتوكلاف الفئة B', 'الجراحة', 'SARI-STR-003', '480,000 دج', 'معقم أوتوكلاف من الفئة B بدورات سريعة.', NULL, 1, 10, 'DZD', 3, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(16, 'ar', 'tensiometre-digital-pro', 'جهاز قياس ضغط الدم الرقمي الاحترافي', 'التشخيص', 'SARI-TEN-004', '28,500 دج', 'جهاز قياس ضغط الدم الإلكتروني الاحترافي.', NULL, 1, 10, 'DZD', 4, '3-5 أيام عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(17, 'ar', 'moniteur-signes-vitaux-5-parametres', 'جهاز مراقبة العلامات الحيوية 5 معايير', 'الإنعاش', 'SARI-MON-005', '265,000 دج', 'جهاز مراقبة متعدد المعايير: تخطيط القلب، تشبع الأكسجين، الضغط، الحرارة، التنفس.', NULL, 1, 10, 'DZD', 5, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(18, 'ar', 'defibrillateur-biphasique', 'جهاز صدمات القلب ثنائي الطور', 'الطوارئ', 'SARI-DEF-006', '690,000 دج', 'جهاز صدمات ثنائي الطور مع وضع AED وشاشة مدمجة.', NULL, 1, 10, 'DZD', 6, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `services` (`id`, `locale`, `slug`, `title`, `icon`, `shortDesc`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'vente-equipements', 'Vente d''Équipements Médicaux', 'shopping-cart', 'Large gamme d''équipements neufs et reconditionnés pour les structures de santé.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'installation-mise-en-service', 'Installation & Mise en Service', 'settings', 'Installation, calibration et mise en service par nos techniciens agréés.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'maintenance-sav', 'Maintenance & SAV', 'wrench', 'Contrats de maintenance préventive et corrective avec pièces d''origine.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'formation-personnel', 'Formation du Personnel Soignant', 'graduation-cap', 'Formation à l''utilisation des équipements sur site ou dans nos locaux.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'fr', 'conseil-ingenierie', 'Conseil & Ingénierie Biomédicale', 'clipboard', 'Étude des besoins et accompagnement dans les appels d''offres.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'equipment-sales', 'Medical Equipment Sales', 'shopping-cart', 'Wide range of new and refurbished equipment for healthcare facilities.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'installation-commissioning', 'Installation & Commissioning', 'settings', 'Installation, calibration and commissioning by certified technicians.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'maintenance-after-sales', 'Maintenance & After-Sales', 'wrench', 'Preventive and corrective maintenance contracts with original parts.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'en', 'staff-training', 'Healthcare Staff Training', 'graduation-cap', 'On-site training on equipment use.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'en', 'biomedical-consulting', 'Biomedical Consulting', 'clipboard', 'Needs assessment and tender support.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'ar', 'vente-equipements', 'بيع المعدات الطبية', 'shopping-cart', 'تشكيلة واسعة من المعدات الجديدة والمجددة للمؤسسات الصحية.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'ar', 'installation-mise-en-service', 'التركيب والتشغيل', 'settings', 'التركيب والمعايرة والتشغيل من قبل تقنيين معتمدين.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(13, 'ar', 'maintenance-sav', 'الصيانة وخدمة ما بعد البيع', 'wrench', 'عقود صيانة وقائية وتصحيحية بقطع أصلية.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(14, 'ar', 'formation-personnel', 'تكوين الطاقم الطبي', 'graduation-cap', 'تكوين حول استخدام المعدات في الموقع أو بمقرنا.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(15, 'ar', 'conseil-ingenierie', 'الاستشارة والهندسة الطبية', 'clipboard', 'دراسة الاحتياجات والمرافقة في طلبات العروض.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Partenaires
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `partners` (`id`, `locale`, `name`, `category`, `website`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'MediTech Algérie', 'Distributeur', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'Mindray — Représentant officiel Algérie', 'Fabricant', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'Philips Healthcare', 'Fabricant', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'GE Healthcare', 'Fabricant', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'fr', 'HealForce Medical', 'Fabricant', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'MediTech Algeria', 'Distributor', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'Mindray — Official representative in Algeria', 'Manufacturer', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'Philips Healthcare', 'Manufacturer', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'en', 'GE Healthcare', 'Manufacturer', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'en', 'HealForce Medical', 'Manufacturer', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'ar', 'ميديتك الجزائر', 'موزع', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'ar', 'مايندراي — الممثل الرسمي في الجزائر', 'مصنع', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(13, 'ar', 'فيليبس للرعاية الصحية', 'مصنع', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(14, 'ar', 'جي إي للرعاية الصحية', 'مصنع', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(15, 'ar', 'هيل فورس الطبية', 'مصنع', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Carrières
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `careers` (`id`, `locale`, `slug`, `title`, `type`, `location`, `salary`, `shortDesc`, `legacyId`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'technicien-biomedical', 'Technicien Biomédical H/F', 'CDI', 'Alger', '45 000 - 70 000 DZD', 'Maintenance et installation des équipements médicaux.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'ingenieur-commercial-medical', 'Ingénieur Commercial Médical', 'CDI', 'Oran', '60 000 - 90 000 DZD', 'Développement du portefeuille clients (hôpitaux, cliniques).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'responsable-logistique', 'Responsable Logistique', 'CDD', 'Blida', '50 000 - 75 000 DZD', 'Gestion des stocks et de la distribution sur les 58 wilayas.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'technico-commercial-imagerie', 'Technico-Commercial Imagerie Médicale', 'CDI', 'Constantine', '55 000 - 85 000 DZD', 'Vente et démonstration des solutions d''imagerie.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'biomedical-technician', 'Biomedical Technician (M/F)', 'Permanent', 'Algiers', 'DZD 45,000 - 70,000', 'Maintenance and installation of medical equipment.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'medical-sales-engineer', 'Medical Sales Engineer', 'Permanent', 'Oran', 'DZD 60,000 - 90,000', 'Develop the client portfolio (hospitals, clinics).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'logistics-manager', 'Logistics Manager', 'Contract', 'Blida', 'DZD 50,000 - 75,000', 'Stock and distribution management across the 58 wilayas.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'imaging-sales-specialist', 'Medical Imaging Sales Specialist', 'Permanent', 'Constantine', 'DZD 55,000 - 85,000', 'Sales and demo of imaging solutions.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'technicien-biomedical', 'تقني بيوطبي (م/ج)', 'عقد دائم', 'الجزائر', '45,000 - 70,000 دج', 'صيانة وتركيب المعدات الطبية.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'ar', 'ingenieur-commercial-medical', 'مهندس تجاري طبي', 'عقد دائم', 'وهران', '60,000 - 90,000 دج', 'تطوير محفظة العملاء (مستشفيات، عيادات).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'ar', 'responsable-logistique', 'مسؤول اللوجستيك', 'عقد محدد', 'البليدة', '50,000 - 75,000 دج', 'إدارة المخزون والتوزيع عبر 58 ولاية.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'ar', 'technico-commercial-imagerie', 'تقني تجاري في التصوير الطبي', 'عقد دائم', 'قسنطينة', '55,000 - 85,000 دج', 'بيع وعرض حلول التصوير الطبي.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Solutions
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `solutions` (`id`, `locale`, `slug`, `title`, `shortDesc`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'diagnostic', 'Diagnostic & Imagerie', 'Échographes, tensiomètres et appareils de diagnostic de proximité.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'cardiology', 'Cardiologie', 'ECG, défibrillateurs et moniteurs cardiaques.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'imaging', 'Imagerie Médicale', 'Radiologie, scanner et solutions d''imagerie.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'surgery', 'Chirurgie', 'Instruments, autoclaves et tables opératoires.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'fr', 'pediatrics', 'Pédiatrie', 'Couveuses, balances et lampes de photothérapie.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'fr', 'emergency', 'Urgence & Réanimation', 'Défibrillateurs, chariots d''urgence et ventilation.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'fr', 'informatics', 'Informatique Médicale', 'DMP, télémédecine et PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'fr', 'laboratory', 'Laboratoire', 'Analyseurs, microscopes et centrifugeuses.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'fr', 'rehabilitation', 'Rééducation', 'Tables de kinésithérapie et électrothérapie.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'en', 'diagnostic', 'Diagnostics & Imaging', 'Ultrasound, blood pressure monitors and point-of-care devices.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'en', 'cardiology', 'Cardiology', 'ECG, defibrillators and cardiac monitors.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'en', 'imaging', 'Medical Imaging', 'Radiology, CT and imaging solutions.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(13, 'en', 'surgery', 'Surgery', 'Instruments, autoclaves and operating tables.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(14, 'en', 'pediatrics', 'Pediatrics', 'Incubators, scales and phototherapy lamps.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(15, 'en', 'emergency', 'Emergency & Intensive Care', 'Defibrillators, crash carts and ventilation.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(16, 'en', 'informatics', 'Medical Informatics', 'EMR, telemedicine and PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(17, 'en', 'laboratory', 'Laboratory', 'Analyzers, microscopes and centrifuges.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(18, 'en', 'rehabilitation', 'Rehabilitation', 'Physiotherapy tables and electrotherapy.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(19, 'ar', 'diagnostic', 'التشخيص والتصوير', 'أجهزة الموجات فوق الصوتية وأجهزة قياس الضغط وأجهزة التشخيص.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(20, 'ar', 'cardiology', 'أمراض القلب', 'تخطيط القلب وأجهزة الصدمات وشاشات القلب.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(21, 'ar', 'imaging', 'التصوير الطبي', 'الأشعة والماسح الضوئي وحلول التصوير.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(22, 'ar', 'surgery', 'الجراحة', 'الأدوات والمعقمات وطاولات العمليات.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(23, 'ar', 'pediatrics', 'طب الأطفال', 'الحضانات والموازين ومصابيح العلاج الضوئي.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(24, 'ar', 'emergency', 'الطوارئ والإنعاش', 'أجهزة الصدمات وعربات الطوارئ والتهوية.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(25, 'ar', 'informatics', 'المعلوماتية الطبية', 'الملف الطبي والتطبيب عن بعد وأنظمة PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(26, 'ar', 'laboratory', 'المختبر', 'أجهزة التحليل والمجاهر وأجهزة الطرد المركزي.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(27, 'ar', 'rehabilitation', 'إعادة التأهيل', 'طاولات العلاج الطبيعي والعلاج الكهربائي.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Témoignages
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `testimonials` (`id`, `locale`, `name`, `role`, `clinic`, `text`, `rating`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'Dr. Amine KHALFI', 'Directeur Médical', 'Clinique El Afia, Alger', 'SARI Système nous accompagne depuis 10 ans. Réactivité et qualité des équipements exceptionnelles, avec un SAV toujours disponible.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'Dr. Salima BOUZID', 'Cheffe de service Imagerie', 'CHU Mustapha Pacha, Alger', 'Installation rapide et formation du personnel très professionnelle. Un partenaire de confiance pour notre service.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'Dr. Yacine HAMDI', 'Cardiologue', 'Clinique Ibn Rochd, Oran', 'Le moniteur et le défibrillateur livrés étaient conformes et parfaitement calibrés. Je recommande vivement.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'Dr. Nadia MERABET', 'Pharmacienne Hospitalière', 'EPH Beni Messous, Alger', 'Un accompagnement de A à Z, de l''étude du besoin jusqu''à la maintenance. Très satisfaite du suivi.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'Dr. Amine KHALFI', 'Medical Director', 'El Afia Clinic, Algiers', 'SARI Système has supported us for 10 years. Outstanding responsiveness and equipment quality with an always-available after-sales service.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'Dr. Salima BOUZID', 'Head of Imaging', 'Mustapha Pacha University Hospital, Algiers', 'Fast installation and very professional staff training. A trusted partner for our department.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'Dr. Yacine HAMDI', 'Cardiologist', 'Ibn Rochd Clinic, Oran', 'The monitor and defibrillator delivered were compliant and perfectly calibrated. Highly recommended.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'Dr. Nadia MERABET', 'Hospital Pharmacist', 'Beni Messous EPH, Algiers', 'End-to-end support from needs assessment to maintenance. Very satisfied.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'د. أمين خالفي', 'المدير الطبي', 'عيادة العافية، الجزائر', 'ترافقنا ساري سيستم منذ 10 سنوات. سرعة الاستجابة وجودة المعدات استثنائية مع خدمة ما بعد البيع متاحة دائمًا.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'ar', 'د. سليمة بوزيد', 'رئيسة مصلحة التصوير', 'المستشفى الجامعي مصطفى باشا، الجزائر', 'تركيب سريع وتكوين احترافي للطاقم. شريك موثوق لمصلحتنا.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'ar', 'د. ياسين حمدي', 'طبيب قلب', 'عيادة ابن رشد، وهران', 'الشاشة وجهاز الصدمات المسلّمان كانا مطابقين ومعايرين بشكل مثالي. أنصح بهما بشدة.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'ar', 'د. نادية مرابط', 'صيدلانية استشفائية', 'المؤسسة العمومية الاستشفائية بني مسوس، الجزائر', 'مرافقة شاملة من دراسة الحاجة إلى الصيانة. راضية جدًا عن المتابعة.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Hero slides
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `hero_slides` (`id`, `locale`, `title`, `subtitle`, `description`, `cta`, `ctaLink`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'Équipements Médicaux de Pointe', 'Distribution et installation sur les 58 wilayas', 'Nous accompagnons hôpitaux, cliniques et cabinets avec des équipements certifiés et un service de proximité.', 'Découvrir nos solutions', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'Service Après-Vente 24/7', 'Techniciens agréés dans toute l''Algérie', 'Maintenance préventive et corrective avec pièces d''origine.', 'Nos services', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'Partenaires des Grands Fabricants', 'Représentation officielle en Algérie', 'Mindray, Philips, GE Healthcare et bien d''autres.', 'Voir le catalogue', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'en', 'State-of-the-Art Medical Equipment', 'Distribution and installation across the 58 wilayas', 'We support hospitals, clinics and practices with certified equipment and local service.', 'Discover our solutions', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', '24/7 After-Sales Service', 'Certified technicians across Algeria', 'Preventive and corrective maintenance with original parts.', 'Our services', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'Partners of Leading Manufacturers', 'Official representation in Algeria', 'Mindray, Philips, GE Healthcare and more.', 'View catalog', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'ar', 'معدات طبية متطورة', 'التوزيع والتركيب عبر 58 ولاية', 'نرافق المستشفيات والعيادات بمعدات معتمدة وخدمة قريبة.', 'اكتشف حلولنا', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'ar', 'خدمة ما بعد البيع 24/7', 'تقنيون معتمدون في كامل التراب الوطني', 'صيانة وقائية وتصحيحية بقطع أصلية.', 'خدماتنا', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'شركاء كبار المصنعين', 'تمثيل رسمي في الجزائر', 'مايندراي، فيليبس، جي إي للرعاية الصحية وغيرها.', 'تصفح الكتالوج', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Actualités
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `news_articles` (`id`, `locale`, `slug`, `title`, `category`, `classification`, `sujet`, `authorName`, `date`, `readTime`, `shortDesc`, `fullContent`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'participation-simem-2026', 'SARI Système au SIMEM 2026', 'Événement', 'Salon', 'Salon médical', 'SARI Système', '2026-04-10 09:00:00.000', '3 min', 'Retrouvez-nous au Salon International du Médical, SAFEX Alger.', '<p>SARI Système exposera ses dernières solutions d''imagerie et de réanimation au SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'nouvelle-gamme-echographes-portables', 'Nouvelle gamme d''échographes portables', 'Produits', 'Innovation', 'Imagerie', 'SARI Système', '2026-03-02 09:00:00.000', '4 min', 'Échographes portables avec IA intégrée pour la médecine de proximité.', '<p>Une gamme compacte et connectée, pensée pour les structures mobiles et les zones éloignées.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'partenariat-chu-mustapha-pacha', 'Partenariat avec le CHU Mustapha Pacha', 'Institutionnel', 'Partenariat', 'Santé publique', 'SARI Système', '2026-01-20 09:00:00.000', '2 min', 'Équipement du service d''imagerie du CHU d''Alger.', '<p>Signature d''une convention pour l''équipement et la maintenance du plateau d''imagerie.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'en', 'sari-systeme-at-simem-2026', 'SARI Système at SIMEM 2026', 'Event', 'Trade show', 'Medical fair', 'SARI Système', '2026-04-10 09:00:00.000', '3 min', 'Meet us at the International Medical Exhibition, SAFEX Algiers.', '<p>SARI Système will showcase its latest imaging and intensive care solutions at SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'new-portable-ultrasound-range', 'New portable ultrasound range', 'Products', 'Innovation', 'Imaging', 'SARI Système', '2026-03-02 09:00:00.000', '4 min', 'Portable ultrasounds with built-in AI for point-of-care medicine.', '<p>A compact, connected range designed for mobile units and remote areas.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'partnership-with-mustapha-pacha-hospital', 'Partnership with Mustapha Pacha University Hospital', 'Institutional', 'Partnership', 'Public health', 'SARI Système', '2026-01-20 09:00:00.000', '2 min', 'Equipping the imaging department of the Algiers hospital.', '<p>Signing of an agreement to equip and maintain the imaging platform.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'ar', 'participation-simem-2026', 'ساري سيستم في SIMEM 2026', 'حدث', 'معرض', 'المعرض الطبي', 'SARI Système', '2026-04-10 09:00:00.000', '3 د', 'زورونا في الصالون الدولي للطب، قصر المعارض SAFEX الجزائر.', '<p>ستعرض ساري سيستم أحدث حلول التصوير والإنعاش في SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'ar', 'nouvelle-gamme-echographes-portables', 'تشكيلة جديدة من أجهزة الموجات فوق الصوتية المحمولة', 'منتجات', 'ابتكار', 'التصوير', 'SARI Système', '2026-03-02 09:00:00.000', '4 د', 'أجهزة محمولة بذكاء اصطناعي مدمج للطب القريب.', '<p>تشكيلة مدمجة ومتصلة، مصممة للوحدات المتنقلة والمناطق النائية.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'partenariat-chu-mustapha-pacha', 'شراكة مع المستشفى الجامعي مصطفى باشا', 'مؤسساتي', 'شراكة', 'الصحة العمومية', 'SARI Système', '2026-01-20 09:00:00.000', '2 د', 'تجهيز مصلحة التصوير بمستشفى الجزائر.', '<p>توقيع اتفاقية لتجهيز وصيانة منصة التصوير.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Événements
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `events` (`id`, `locale`, `slug`, `title`, `type`, `date`, `location`, `shortDesc`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'simem-2026', 'SIMEM 2026 — Salon International du Médical', 'Salon', '2026-04-15 09:00:00.000', 'SAFEX, Pins Maritimes, Alger', 'Stand B12 — démonstrations d''imagerie et de réanimation.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'journees-medicales-alger', 'Journées Médicales d''Alger', 'Congrès', '2026-06-05 09:00:00.000', 'Hôtel El Aurassi, Alger', 'Conférence sur les nouvelles technologies biomédicales.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'forum-sante-oran', 'Forum Santé Oran', 'Forum', '2026-09-18 09:00:00.000', 'Centre des Conventions d''Oran', 'Rencontres avec les professionnels de la santé de l''Ouest.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'en', 'simem-2026', 'SIMEM 2026 — International Medical Exhibition', 'Trade show', '2026-04-15 09:00:00.000', 'SAFEX, Pins Maritimes, Algiers', 'Booth B12 — imaging and intensive care demos.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'algiers-medical-days', 'Algiers Medical Days', 'Congress', '2026-06-05 09:00:00.000', 'El Aurassi Hotel, Algiers', 'Conference on new biomedical technologies.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'oran-health-forum', 'Oran Health Forum', 'Forum', '2026-09-18 09:00:00.000', 'Oran Convention Centre', 'Meetings with Western Algeria healthcare professionals.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'ar', 'simem-2026', 'SIMEM 2026 — الصالون الدولي للطب', 'معرض', '2026-04-15 09:00:00.000', 'قصر المعارض SAFEX، الصنوبر البحري، الجزائر', 'الجناح B12 — عروض التصوير والإنعاش.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'ar', 'journees-medicales-alger', 'الأيام الطبية للجزائر', 'مؤتمر', '2026-06-05 09:00:00.000', 'فندق الأوراسي، الجزائر', 'محاضرة حول التقنيات الطبية الحيوية الجديدة.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'forum-sante-oran', 'منتدى الصحة بوهران', 'منتدى', '2026-09-18 09:00:00.000', 'مركز المؤتمرات، وهران', 'لقاءات مع مهنيي الصحة في الغرب الجزائري.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `faqs` (`id`, `locale`, `question`, `answer`, `category`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'fr', 'Livrez-vous sur tout le territoire algérien ?', 'Oui, nous livrons sur les 58 wilayas. Les délais varient de 3 à 15 jours ouvrés selon la wilaya et la disponibilité du produit.', 'Livraison', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'fr', 'Quels sont les modes de paiement acceptés ?', 'Virement bancaire, chèque, carte CIB / Edahabia et paiement à la livraison selon accord préalable.', 'Paiement', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'fr', 'Les prix sont-ils affichés en dinar algérien ?', 'Oui, tous nos prix sont en Dinar Algérien (DZD), hors TVA (19% ou 9% selon les produits).', 'Tarifs', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'fr', 'Proposez-vous une garantie et un service après-vente ?', 'Oui, garantie constructeur de 12 à 36 mois et SAV assuré par nos techniciens agréés sur l''ensemble du territoire.', 'Garantie', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(5, 'en', 'Do you deliver across Algeria?', 'Yes, we deliver to all 58 wilayas. Lead times range from 3 to 15 business days.', 'Delivery', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(6, 'en', 'Which payment methods are accepted?', 'Bank transfer, cheque, CIB / Edahabia card and cash on delivery subject to prior agreement.', 'Payment', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(7, 'en', 'Are prices displayed in Algerian Dinar?', 'Yes, all prices are in Algerian Dinar (DZD), VAT excluded (19% or 9%).', 'Pricing', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(8, 'en', 'Do you provide warranty and after-sales service?', 'Yes, 12 to 36 months manufacturer warranty with nationwide after-sales support.', 'Warranty', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(9, 'ar', 'هل توصلون عبر كامل التراب الجزائري؟', 'نعم، نوصل إلى جميع الولايات الـ58. تتراوح الآجال بين 3 و15 يوم عمل.', 'التوصيل', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(10, 'ar', 'ما هي وسائل الدفع المقبولة؟', 'تحويل بنكي، شيك، بطاقة CIB / الذهبية والدفع عند الاستلام بموافقة مسبقة.', 'الدفع', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(11, 'ar', 'هل الأسعار معروضة بالدينار الجزائري؟', 'نعم، جميع أسعارنا بالدينار الجزائري (DZD)، دون احتساب الرسم على القيمة المضافة (19% أو 9%).', 'الأسعار', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(12, 'ar', 'هل توفرون ضمانًا وخدمة ما بعد البيع؟', 'نعم، ضمان المصنع من 12 إلى 36 شهرًا وخدمة ما بعد البيع عبر كامل التراب الوطني.', 'الضمان', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Messages de contact
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `contact_messages` (`id`, `name`, `email`, `phone`, `subject`, `message`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'Dr. Farid MEZIANE', 'farid.meziane@polyclinique.dz', '(+213) 21 44 55 66', 'devis', 'Bonjour, je souhaite un devis pour 3 moniteurs multiparamétriques et 2 défibrillateurs.', 'new', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'Mme. Karima BENSAID', 'k.bensaid@clinique-sante.dz', '(+213) 550 11 22 33', 'sav', 'Nous avons besoin d''une intervention de maintenance sur notre autoclave.', 'read', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'M. Rachid HADDAD', 'r.haddad@cabinet.dz', '(+213) 770 44 55 66', 'partenariat', 'Je souhaite devenir revendeur agréé dans la wilaya de Sétif.', 'new', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `group`, `createdAt`, `updatedAt`) VALUES
(1, 'site_logo', '{"url":""}', 'general', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(2, 'require_auth_to_apply', '{"enabled":false}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(3, 'restock_message', '{"message":"Votre commande sera traitée dans les meilleurs délais. Nouvel arrivage prévu le {{date_reapprovisionnement}}."}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
(4, 'code_formats', '{"quote":"SARI-WDEV-{ID}","order":"SARI-WCMD{XX}-{ID}","invoice":"SARI-WFAV{XX}-{ID}","product":"SARI-WPRO{XX}-{ID}"}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Journal d'audit (entrée de démarrage)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `audit_logs` (`id`, `actorId`, `action`, `resource`, `resourceId`, `payload`, `createdAt`, `updatedAt`) VALUES (1, 1, 'seed', 'database', NULL, '{"driver":"mysql","locales":["fr","en","ar"]}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');
