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
('7891c51c-f8e7-5539-9aa9-5c26b9867032', 'users', 'create', 'Créer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('21ea213f-d92e-507d-be1c-d149085d9a78', 'users', 'read', 'Consulter users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4901ff44-2edd-5ea4-a609-5610e567d73d', 'users', 'update', 'Modifier users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3fd3eb50-8af6-5b68-8e2e-68fdd57e1b97', 'users', 'delete', 'Supprimer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('00f47443-cfc9-5bb8-bf92-1f6b7b6d8333', 'users', 'admin', 'Administrer users', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5636a672-b802-5caf-841e-e6970962a2fb', 'roles', 'create', 'Créer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f2ce28a7-86a3-516f-9697-aa2218d4d196', 'roles', 'read', 'Consulter roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('19ecb23a-60b7-52f1-b507-c4039dcc0c91', 'roles', 'update', 'Modifier roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('892f53be-4845-5479-b3fe-7be7910864d2', 'roles', 'delete', 'Supprimer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('759e6ade-ebd9-51cb-a426-eb266bbbbfc1', 'roles', 'admin', 'Administrer roles', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e08562f9-f2a4-551b-9fcc-e116cc3fbc9d', 'permissions', 'create', 'Créer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0512e917-7cc9-59d6-a1db-e321f5e5ea92', 'permissions', 'read', 'Consulter permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('78a6080b-a8bd-5f4b-85f6-4b5a669a61ce', 'permissions', 'update', 'Modifier permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('711e31af-5e80-5b20-afc6-fa0eca223720', 'permissions', 'delete', 'Supprimer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('544c7fb2-1eb4-56c3-ad8a-a19e1cc05cf4', 'permissions', 'admin', 'Administrer permissions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('044808b2-4404-571b-bb78-27103def6ab7', 'pages', 'create', 'Créer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('57ff8cb5-7ba7-5a41-858c-f15b8cc34591', 'pages', 'read', 'Consulter pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('787c8a9d-c473-5704-acbb-b14a1217f572', 'pages', 'update', 'Modifier pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3bfbd70f-c423-5a25-a09a-49758f077196', 'pages', 'delete', 'Supprimer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('016e1c62-a720-55d0-ba7d-b6bd3c6f6db0', 'pages', 'admin', 'Administrer pages', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8ed98dd8-0635-5a13-b39d-4db47595df56', 'faqs', 'create', 'Créer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('638e1450-4f52-597e-b184-5c3885f3764a', 'faqs', 'read', 'Consulter faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('547fcbbe-321b-553c-aa79-7f93ac4cbaeb', 'faqs', 'update', 'Modifier faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ea22046a-2887-5fb1-90c7-7c3211717fca', 'faqs', 'delete', 'Supprimer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ba003cd4-4e8b-58ba-92c7-5e961054538d', 'faqs', 'admin', 'Administrer faqs', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ec60796e-30dd-5b94-9dde-d8c3d1705b9e', 'testimonials', 'create', 'Créer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5e17a5d6-3a64-566d-a28e-418677b55355', 'testimonials', 'read', 'Consulter testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('39f5bc03-ce29-520b-a567-d9caa02f6888', 'testimonials', 'update', 'Modifier testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('48398b32-a97c-5f91-9f9c-4ac70506b264', 'testimonials', 'delete', 'Supprimer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8a97fae3-351f-5cb1-b48c-e2a22cc54e75', 'testimonials', 'admin', 'Administrer testimonials', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('20b5d057-6da9-586a-b6d2-7a06e84f7c00', 'menus', 'create', 'Créer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('acda50b1-95ad-592c-8eba-2707697e6e8e', 'menus', 'read', 'Consulter menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('21b57959-f8de-51cd-bf9a-a79d01fe18ac', 'menus', 'update', 'Modifier menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ef6cc449-4e62-579c-87dd-c8189bbff72a', 'menus', 'delete', 'Supprimer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d301815e-9e02-5aaf-9a85-e94b8ea427b5', 'menus', 'admin', 'Administrer menus', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('461b559a-2bd3-50f3-84c2-3cf0e5eb53d5', 'contact', 'create', 'Créer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d9c82a07-a850-5a0f-a7be-a5770ee7b73d', 'contact', 'read', 'Consulter contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('00a05083-b382-511b-9f0a-7cc77cf19ec2', 'contact', 'update', 'Modifier contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6c72992a-c78f-5592-b3c7-b6d8c7edb8b4', 'contact', 'delete', 'Supprimer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a8077ed6-2a38-5f84-a067-320690d232da', 'contact', 'admin', 'Administrer contact', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4d296abb-79c0-5122-a5db-61b6ef6021bc', 'translations', 'create', 'Créer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('28819433-740d-5a45-bb42-f6b529031892', 'translations', 'read', 'Consulter translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('96564bd5-72a2-5891-8077-6ccf96a6818b', 'translations', 'update', 'Modifier translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('986b6b40-c9c6-5ffa-b6f5-dbd80306e334', 'translations', 'delete', 'Supprimer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c3c99bb0-fea0-5dbb-9288-44e12ff768d7', 'translations', 'admin', 'Administrer translations', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('cee950f7-e54d-5a7d-84e1-313798c32ae4', 'audit', 'create', 'Créer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a6a07512-ef6f-58fc-803e-90cffca86a34', 'audit', 'read', 'Consulter audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ad85f2e6-9984-585c-b1c4-fe9da290181a', 'audit', 'update', 'Modifier audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b84584b5-850a-598c-9d2c-603ee63ccb82', 'audit', 'delete', 'Supprimer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5c57f92c-bddc-5ab3-9413-f5df59257521', 'audit', 'admin', 'Administrer audit', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5315a43e-e2ea-57be-ad25-faa3f68f8a03', 'settings', 'create', 'Créer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5cf056b3-703a-57c7-b71a-4cb70ca26b85', 'settings', 'read', 'Consulter settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('63db84ba-b8ca-54f8-97df-7b913d1ae1b9', 'settings', 'update', 'Modifier settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a3682003-1d53-5d2a-bd27-b6258c1f2d5d', 'settings', 'delete', 'Supprimer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('cce5e9e6-c321-5ebe-8283-4606fb5d4a44', 'settings', 'admin', 'Administrer settings', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e41827e7-096d-577e-921e-3e35738f76b3', 'news', 'create', 'Créer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6782769e-e28f-5309-9862-765a1dfa2dad', 'news', 'read', 'Consulter news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('58da803b-afd5-5400-aff4-4a4316f38ef0', 'news', 'update', 'Modifier news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f26cd005-f79e-52fb-9052-f58523b82f60', 'news', 'delete', 'Supprimer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6d82f9c0-bf88-54aa-8399-6a0d74386e4e', 'news', 'admin', 'Administrer news', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a1e0637a-fc74-5e22-be6c-1310f815a920', 'events', 'create', 'Créer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b5b0fa14-0c9e-5f94-9008-795e612d3bdd', 'events', 'read', 'Consulter events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7eb9f32d-3e13-54a5-a642-35fc11600d67', 'events', 'update', 'Modifier events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('de58ec93-05f9-5d5a-b7cc-e410da5f765f', 'events', 'delete', 'Supprimer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b5d9face-4142-5576-90cb-b84fc7db0c6b', 'events', 'admin', 'Administrer events', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('73814e2f-14b5-5661-9d62-9df4ce3728d1', 'products', 'create', 'Créer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ef2d60e8-b78b-5ec9-ae6b-f95941b32f98', 'products', 'read', 'Consulter products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d8727938-059f-589a-b323-b90c59cce154', 'products', 'update', 'Modifier products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a8187551-605c-5ee3-8b60-9664206d1154', 'products', 'delete', 'Supprimer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4ba83591-e577-5528-abce-3f04433e6aa5', 'products', 'admin', 'Administrer products', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e3ffbafc-8176-5bb3-86fe-1b18511c8b72', 'services', 'create', 'Créer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('76b4f6ba-f7e8-5c4e-8556-042adf74b78c', 'services', 'read', 'Consulter services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('670c4479-d776-560d-9709-579e6c9a964c', 'services', 'update', 'Modifier services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('750d8ea8-770a-511b-b7b2-de49e4b58adf', 'services', 'delete', 'Supprimer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('cff9ca4e-1ab8-50de-9d10-a1ae70c66db6', 'services', 'admin', 'Administrer services', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a40ff1e8-1d5d-57dc-9331-d24155620963', 'partners', 'create', 'Créer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e49691e9-59da-5231-9532-3f8955bc57e1', 'partners', 'read', 'Consulter partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('9429cea7-5961-5a94-9b01-293a9e363e9d', 'partners', 'update', 'Modifier partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b269e025-a785-5411-b633-392809dd9333', 'partners', 'delete', 'Supprimer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('04f441fd-de9c-5161-8129-de153763de7c', 'partners', 'admin', 'Administrer partners', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a', 'careers', 'create', 'Créer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('103df784-31a0-5f2c-a04a-1f5fda3bcaa3', 'careers', 'read', 'Consulter careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7248c381-1166-5cf8-a90a-15423e69af23', 'careers', 'update', 'Modifier careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('eebfd063-f7b3-5cbb-8d27-0d770d9f090d', 'careers', 'delete', 'Supprimer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7b8e067b-2993-5374-95f9-72a876cfe7f3', 'careers', 'admin', 'Administrer careers', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b600e847-ad35-538e-81f1-72674c0ed357', 'solutions', 'create', 'Créer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e7981804-4956-58af-bdd2-bd1ef0831dfd', 'solutions', 'read', 'Consulter solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('58402e65-12f7-5a0b-85b8-3bcb50b458ae', 'solutions', 'update', 'Modifier solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c318fc62-d27f-55c7-be19-fc57bd4d4871', 'solutions', 'delete', 'Supprimer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('67d83a9f-e044-58da-a12a-f1be38ae5b1d', 'solutions', 'admin', 'Administrer solutions', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b1b60a5e-1cb8-5e3b-9ab5-624104ea9862', 'hero', 'create', 'Créer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bc93091f-63f2-5814-8438-82088f68e070', 'hero', 'read', 'Consulter hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('30bd9923-c66c-53e9-920d-3d0efd4f22df', 'hero', 'update', 'Modifier hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0a56825f-21ab-5671-84b1-bdb2523ffc39', 'hero', 'delete', 'Supprimer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e6e287e4-d0c1-59f7-908e-8991e935b5eb', 'hero', 'admin', 'Administrer hero', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ce7a6a15-41a3-5cc3-bf69-4a4d4658a010', 'dashboard', 'create', 'Créer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6f2b709a-bb57-5838-b379-a877d227f2e1', 'dashboard', 'read', 'Consulter dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c7b58c3e-72f5-5c04-ba11-edf671ac76ee', 'dashboard', 'update', 'Modifier dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('1b6878cf-04d2-52e9-b33d-9ca6a6d57280', 'dashboard', 'delete', 'Supprimer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b78671c4-9799-58b8-8bb9-3ad75324266d', 'dashboard', 'admin', 'Administrer dashboard', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `slug`, `description`, `isSystem`, `permissionIds`, `createdAt`, `updatedAt`) VALUES
('556dab34-5897-571f-84e2-4066f200eb65', 'Super Administrateur', 'super-admin', 'Accès complet au système (contourne le contrôle de permissions).', 1, '["7891c51c-f8e7-5539-9aa9-5c26b9867032","21ea213f-d92e-507d-be1c-d149085d9a78","4901ff44-2edd-5ea4-a609-5610e567d73d","3fd3eb50-8af6-5b68-8e2e-68fdd57e1b97","00f47443-cfc9-5bb8-bf92-1f6b7b6d8333","5636a672-b802-5caf-841e-e6970962a2fb","f2ce28a7-86a3-516f-9697-aa2218d4d196","19ecb23a-60b7-52f1-b507-c4039dcc0c91","892f53be-4845-5479-b3fe-7be7910864d2","759e6ade-ebd9-51cb-a426-eb266bbbbfc1","e08562f9-f2a4-551b-9fcc-e116cc3fbc9d","0512e917-7cc9-59d6-a1db-e321f5e5ea92","78a6080b-a8bd-5f4b-85f6-4b5a669a61ce","711e31af-5e80-5b20-afc6-fa0eca223720","544c7fb2-1eb4-56c3-ad8a-a19e1cc05cf4","044808b2-4404-571b-bb78-27103def6ab7","57ff8cb5-7ba7-5a41-858c-f15b8cc34591","787c8a9d-c473-5704-acbb-b14a1217f572","3bfbd70f-c423-5a25-a09a-49758f077196","016e1c62-a720-55d0-ba7d-b6bd3c6f6db0","8ed98dd8-0635-5a13-b39d-4db47595df56","638e1450-4f52-597e-b184-5c3885f3764a","547fcbbe-321b-553c-aa79-7f93ac4cbaeb","ea22046a-2887-5fb1-90c7-7c3211717fca","ba003cd4-4e8b-58ba-92c7-5e961054538d","ec60796e-30dd-5b94-9dde-d8c3d1705b9e","5e17a5d6-3a64-566d-a28e-418677b55355","39f5bc03-ce29-520b-a567-d9caa02f6888","48398b32-a97c-5f91-9f9c-4ac70506b264","8a97fae3-351f-5cb1-b48c-e2a22cc54e75","20b5d057-6da9-586a-b6d2-7a06e84f7c00","acda50b1-95ad-592c-8eba-2707697e6e8e","21b57959-f8de-51cd-bf9a-a79d01fe18ac","ef6cc449-4e62-579c-87dd-c8189bbff72a","d301815e-9e02-5aaf-9a85-e94b8ea427b5","461b559a-2bd3-50f3-84c2-3cf0e5eb53d5","d9c82a07-a850-5a0f-a7be-a5770ee7b73d","00a05083-b382-511b-9f0a-7cc77cf19ec2","6c72992a-c78f-5592-b3c7-b6d8c7edb8b4","a8077ed6-2a38-5f84-a067-320690d232da","4d296abb-79c0-5122-a5db-61b6ef6021bc","28819433-740d-5a45-bb42-f6b529031892","96564bd5-72a2-5891-8077-6ccf96a6818b","986b6b40-c9c6-5ffa-b6f5-dbd80306e334","c3c99bb0-fea0-5dbb-9288-44e12ff768d7","cee950f7-e54d-5a7d-84e1-313798c32ae4","a6a07512-ef6f-58fc-803e-90cffca86a34","ad85f2e6-9984-585c-b1c4-fe9da290181a","b84584b5-850a-598c-9d2c-603ee63ccb82","5c57f92c-bddc-5ab3-9413-f5df59257521","5315a43e-e2ea-57be-ad25-faa3f68f8a03","5cf056b3-703a-57c7-b71a-4cb70ca26b85","63db84ba-b8ca-54f8-97df-7b913d1ae1b9","a3682003-1d53-5d2a-bd27-b6258c1f2d5d","cce5e9e6-c321-5ebe-8283-4606fb5d4a44","e41827e7-096d-577e-921e-3e35738f76b3","6782769e-e28f-5309-9862-765a1dfa2dad","58da803b-afd5-5400-aff4-4a4316f38ef0","f26cd005-f79e-52fb-9052-f58523b82f60","6d82f9c0-bf88-54aa-8399-6a0d74386e4e","a1e0637a-fc74-5e22-be6c-1310f815a920","b5b0fa14-0c9e-5f94-9008-795e612d3bdd","7eb9f32d-3e13-54a5-a642-35fc11600d67","de58ec93-05f9-5d5a-b7cc-e410da5f765f","b5d9face-4142-5576-90cb-b84fc7db0c6b","73814e2f-14b5-5661-9d62-9df4ce3728d1","ef2d60e8-b78b-5ec9-ae6b-f95941b32f98","d8727938-059f-589a-b323-b90c59cce154","a8187551-605c-5ee3-8b60-9664206d1154","4ba83591-e577-5528-abce-3f04433e6aa5","e3ffbafc-8176-5bb3-86fe-1b18511c8b72","76b4f6ba-f7e8-5c4e-8556-042adf74b78c","670c4479-d776-560d-9709-579e6c9a964c","750d8ea8-770a-511b-b7b2-de49e4b58adf","cff9ca4e-1ab8-50de-9d10-a1ae70c66db6","a40ff1e8-1d5d-57dc-9331-d24155620963","e49691e9-59da-5231-9532-3f8955bc57e1","9429cea7-5961-5a94-9b01-293a9e363e9d","b269e025-a785-5411-b633-392809dd9333","04f441fd-de9c-5161-8129-de153763de7c","3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a","103df784-31a0-5f2c-a04a-1f5fda3bcaa3","7248c381-1166-5cf8-a90a-15423e69af23","eebfd063-f7b3-5cbb-8d27-0d770d9f090d","7b8e067b-2993-5374-95f9-72a876cfe7f3","b600e847-ad35-538e-81f1-72674c0ed357","e7981804-4956-58af-bdd2-bd1ef0831dfd","58402e65-12f7-5a0b-85b8-3bcb50b458ae","c318fc62-d27f-55c7-be19-fc57bd4d4871","67d83a9f-e044-58da-a12a-f1be38ae5b1d","b1b60a5e-1cb8-5e3b-9ab5-624104ea9862","bc93091f-63f2-5814-8438-82088f68e070","30bd9923-c66c-53e9-920d-3d0efd4f22df","0a56825f-21ab-5671-84b1-bdb2523ffc39","e6e287e4-d0c1-59f7-908e-8991e935b5eb","ce7a6a15-41a3-5cc3-bf69-4a4d4658a010","6f2b709a-bb57-5838-b379-a877d227f2e1","c7b58c3e-72f5-5c04-ba11-edf671ac76ee","1b6878cf-04d2-52e9-b33d-9ca6a6d57280","b78671c4-9799-58b8-8bb9-3ad75324266d"]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'Administrateur', 'admin', 'Gestion du contenu, du catalogue et des commandes.', 1, '["044808b2-4404-571b-bb78-27103def6ab7","57ff8cb5-7ba7-5a41-858c-f15b8cc34591","787c8a9d-c473-5704-acbb-b14a1217f572","3bfbd70f-c423-5a25-a09a-49758f077196","016e1c62-a720-55d0-ba7d-b6bd3c6f6db0","8ed98dd8-0635-5a13-b39d-4db47595df56","638e1450-4f52-597e-b184-5c3885f3764a","547fcbbe-321b-553c-aa79-7f93ac4cbaeb","ea22046a-2887-5fb1-90c7-7c3211717fca","ba003cd4-4e8b-58ba-92c7-5e961054538d","ec60796e-30dd-5b94-9dde-d8c3d1705b9e","5e17a5d6-3a64-566d-a28e-418677b55355","39f5bc03-ce29-520b-a567-d9caa02f6888","48398b32-a97c-5f91-9f9c-4ac70506b264","8a97fae3-351f-5cb1-b48c-e2a22cc54e75","20b5d057-6da9-586a-b6d2-7a06e84f7c00","acda50b1-95ad-592c-8eba-2707697e6e8e","21b57959-f8de-51cd-bf9a-a79d01fe18ac","ef6cc449-4e62-579c-87dd-c8189bbff72a","d301815e-9e02-5aaf-9a85-e94b8ea427b5","461b559a-2bd3-50f3-84c2-3cf0e5eb53d5","d9c82a07-a850-5a0f-a7be-a5770ee7b73d","00a05083-b382-511b-9f0a-7cc77cf19ec2","6c72992a-c78f-5592-b3c7-b6d8c7edb8b4","a8077ed6-2a38-5f84-a067-320690d232da","4d296abb-79c0-5122-a5db-61b6ef6021bc","28819433-740d-5a45-bb42-f6b529031892","96564bd5-72a2-5891-8077-6ccf96a6818b","986b6b40-c9c6-5ffa-b6f5-dbd80306e334","c3c99bb0-fea0-5dbb-9288-44e12ff768d7","a6a07512-ef6f-58fc-803e-90cffca86a34","5315a43e-e2ea-57be-ad25-faa3f68f8a03","5cf056b3-703a-57c7-b71a-4cb70ca26b85","63db84ba-b8ca-54f8-97df-7b913d1ae1b9","a3682003-1d53-5d2a-bd27-b6258c1f2d5d","cce5e9e6-c321-5ebe-8283-4606fb5d4a44","e41827e7-096d-577e-921e-3e35738f76b3","6782769e-e28f-5309-9862-765a1dfa2dad","58da803b-afd5-5400-aff4-4a4316f38ef0","f26cd005-f79e-52fb-9052-f58523b82f60","6d82f9c0-bf88-54aa-8399-6a0d74386e4e","a1e0637a-fc74-5e22-be6c-1310f815a920","b5b0fa14-0c9e-5f94-9008-795e612d3bdd","7eb9f32d-3e13-54a5-a642-35fc11600d67","de58ec93-05f9-5d5a-b7cc-e410da5f765f","b5d9face-4142-5576-90cb-b84fc7db0c6b","73814e2f-14b5-5661-9d62-9df4ce3728d1","ef2d60e8-b78b-5ec9-ae6b-f95941b32f98","d8727938-059f-589a-b323-b90c59cce154","a8187551-605c-5ee3-8b60-9664206d1154","4ba83591-e577-5528-abce-3f04433e6aa5","e3ffbafc-8176-5bb3-86fe-1b18511c8b72","76b4f6ba-f7e8-5c4e-8556-042adf74b78c","670c4479-d776-560d-9709-579e6c9a964c","750d8ea8-770a-511b-b7b2-de49e4b58adf","cff9ca4e-1ab8-50de-9d10-a1ae70c66db6","a40ff1e8-1d5d-57dc-9331-d24155620963","e49691e9-59da-5231-9532-3f8955bc57e1","9429cea7-5961-5a94-9b01-293a9e363e9d","b269e025-a785-5411-b633-392809dd9333","04f441fd-de9c-5161-8129-de153763de7c","3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a","103df784-31a0-5f2c-a04a-1f5fda3bcaa3","7248c381-1166-5cf8-a90a-15423e69af23","eebfd063-f7b3-5cbb-8d27-0d770d9f090d","7b8e067b-2993-5374-95f9-72a876cfe7f3","b600e847-ad35-538e-81f1-72674c0ed357","e7981804-4956-58af-bdd2-bd1ef0831dfd","58402e65-12f7-5a0b-85b8-3bcb50b458ae","c318fc62-d27f-55c7-be19-fc57bd4d4871","67d83a9f-e044-58da-a12a-f1be38ae5b1d","b1b60a5e-1cb8-5e3b-9ab5-624104ea9862","bc93091f-63f2-5814-8438-82088f68e070","30bd9923-c66c-53e9-920d-3d0efd4f22df","0a56825f-21ab-5671-84b1-bdb2523ffc39","e6e287e4-d0c1-59f7-908e-8991e935b5eb","ce7a6a15-41a3-5cc3-bf69-4a4d4658a010","6f2b709a-bb57-5838-b379-a877d227f2e1","c7b58c3e-72f5-5c04-ba11-edf671ac76ee","1b6878cf-04d2-52e9-b33d-9ca6a6d57280","b78671c4-9799-58b8-8bb9-3ad75324266d"]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'Éditeur de contenu', 'editor', 'Rédaction et mise à jour du contenu de la vitrine.', 1, '["044808b2-4404-571b-bb78-27103def6ab7","57ff8cb5-7ba7-5a41-858c-f15b8cc34591","787c8a9d-c473-5704-acbb-b14a1217f572","8ed98dd8-0635-5a13-b39d-4db47595df56","638e1450-4f52-597e-b184-5c3885f3764a","547fcbbe-321b-553c-aa79-7f93ac4cbaeb","ec60796e-30dd-5b94-9dde-d8c3d1705b9e","5e17a5d6-3a64-566d-a28e-418677b55355","39f5bc03-ce29-520b-a567-d9caa02f6888","20b5d057-6da9-586a-b6d2-7a06e84f7c00","acda50b1-95ad-592c-8eba-2707697e6e8e","21b57959-f8de-51cd-bf9a-a79d01fe18ac","4d296abb-79c0-5122-a5db-61b6ef6021bc","28819433-740d-5a45-bb42-f6b529031892","96564bd5-72a2-5891-8077-6ccf96a6818b","e41827e7-096d-577e-921e-3e35738f76b3","6782769e-e28f-5309-9862-765a1dfa2dad","58da803b-afd5-5400-aff4-4a4316f38ef0","a1e0637a-fc74-5e22-be6c-1310f815a920","b5b0fa14-0c9e-5f94-9008-795e612d3bdd","7eb9f32d-3e13-54a5-a642-35fc11600d67","73814e2f-14b5-5661-9d62-9df4ce3728d1","ef2d60e8-b78b-5ec9-ae6b-f95941b32f98","d8727938-059f-589a-b323-b90c59cce154","e3ffbafc-8176-5bb3-86fe-1b18511c8b72","76b4f6ba-f7e8-5c4e-8556-042adf74b78c","670c4479-d776-560d-9709-579e6c9a964c","a40ff1e8-1d5d-57dc-9331-d24155620963","e49691e9-59da-5231-9532-3f8955bc57e1","9429cea7-5961-5a94-9b01-293a9e363e9d","3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a","103df784-31a0-5f2c-a04a-1f5fda3bcaa3","7248c381-1166-5cf8-a90a-15423e69af23","b600e847-ad35-538e-81f1-72674c0ed357","e7981804-4956-58af-bdd2-bd1ef0831dfd","58402e65-12f7-5a0b-85b8-3bcb50b458ae","b1b60a5e-1cb8-5e3b-9ab5-624104ea9862","bc93091f-63f2-5814-8438-82088f68e070","30bd9923-c66c-53e9-920d-3d0efd4f22df","6f2b709a-bb57-5838-b379-a877d227f2e1"]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'Lecteur', 'viewer', 'Accès en lecture seule au back-office.', 1, '["57ff8cb5-7ba7-5a41-858c-f15b8cc34591","638e1450-4f52-597e-b184-5c3885f3764a","5e17a5d6-3a64-566d-a28e-418677b55355","acda50b1-95ad-592c-8eba-2707697e6e8e","d9c82a07-a850-5a0f-a7be-a5770ee7b73d","28819433-740d-5a45-bb42-f6b529031892","a6a07512-ef6f-58fc-803e-90cffca86a34","6782769e-e28f-5309-9862-765a1dfa2dad","b5b0fa14-0c9e-5f94-9008-795e612d3bdd","ef2d60e8-b78b-5ec9-ae6b-f95941b32f98","76b4f6ba-f7e8-5c4e-8556-042adf74b78c","e49691e9-59da-5231-9532-3f8955bc57e1","103df784-31a0-5f2c-a04a-1f5fda3bcaa3","e7981804-4956-58af-bdd2-bd1ef0831dfd","bc93091f-63f2-5814-8438-82088f68e070","6f2b709a-bb57-5838-b379-a877d227f2e1"]', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- role_permissions (liens rôles ↔ permissions)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) VALUES
('556dab34-5897-571f-84e2-4066f200eb65', '7891c51c-f8e7-5539-9aa9-5c26b9867032'),
('556dab34-5897-571f-84e2-4066f200eb65', '21ea213f-d92e-507d-be1c-d149085d9a78'),
('556dab34-5897-571f-84e2-4066f200eb65', '4901ff44-2edd-5ea4-a609-5610e567d73d'),
('556dab34-5897-571f-84e2-4066f200eb65', '3fd3eb50-8af6-5b68-8e2e-68fdd57e1b97'),
('556dab34-5897-571f-84e2-4066f200eb65', '00f47443-cfc9-5bb8-bf92-1f6b7b6d8333'),
('556dab34-5897-571f-84e2-4066f200eb65', '5636a672-b802-5caf-841e-e6970962a2fb'),
('556dab34-5897-571f-84e2-4066f200eb65', 'f2ce28a7-86a3-516f-9697-aa2218d4d196'),
('556dab34-5897-571f-84e2-4066f200eb65', '19ecb23a-60b7-52f1-b507-c4039dcc0c91'),
('556dab34-5897-571f-84e2-4066f200eb65', '892f53be-4845-5479-b3fe-7be7910864d2'),
('556dab34-5897-571f-84e2-4066f200eb65', '759e6ade-ebd9-51cb-a426-eb266bbbbfc1'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e08562f9-f2a4-551b-9fcc-e116cc3fbc9d'),
('556dab34-5897-571f-84e2-4066f200eb65', '0512e917-7cc9-59d6-a1db-e321f5e5ea92'),
('556dab34-5897-571f-84e2-4066f200eb65', '78a6080b-a8bd-5f4b-85f6-4b5a669a61ce'),
('556dab34-5897-571f-84e2-4066f200eb65', '711e31af-5e80-5b20-afc6-fa0eca223720'),
('556dab34-5897-571f-84e2-4066f200eb65', '544c7fb2-1eb4-56c3-ad8a-a19e1cc05cf4'),
('556dab34-5897-571f-84e2-4066f200eb65', '044808b2-4404-571b-bb78-27103def6ab7'),
('556dab34-5897-571f-84e2-4066f200eb65', '57ff8cb5-7ba7-5a41-858c-f15b8cc34591'),
('556dab34-5897-571f-84e2-4066f200eb65', '787c8a9d-c473-5704-acbb-b14a1217f572'),
('556dab34-5897-571f-84e2-4066f200eb65', '3bfbd70f-c423-5a25-a09a-49758f077196'),
('556dab34-5897-571f-84e2-4066f200eb65', '016e1c62-a720-55d0-ba7d-b6bd3c6f6db0'),
('556dab34-5897-571f-84e2-4066f200eb65', '8ed98dd8-0635-5a13-b39d-4db47595df56'),
('556dab34-5897-571f-84e2-4066f200eb65', '638e1450-4f52-597e-b184-5c3885f3764a'),
('556dab34-5897-571f-84e2-4066f200eb65', '547fcbbe-321b-553c-aa79-7f93ac4cbaeb'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ea22046a-2887-5fb1-90c7-7c3211717fca'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ba003cd4-4e8b-58ba-92c7-5e961054538d'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ec60796e-30dd-5b94-9dde-d8c3d1705b9e'),
('556dab34-5897-571f-84e2-4066f200eb65', '5e17a5d6-3a64-566d-a28e-418677b55355'),
('556dab34-5897-571f-84e2-4066f200eb65', '39f5bc03-ce29-520b-a567-d9caa02f6888'),
('556dab34-5897-571f-84e2-4066f200eb65', '48398b32-a97c-5f91-9f9c-4ac70506b264'),
('556dab34-5897-571f-84e2-4066f200eb65', '8a97fae3-351f-5cb1-b48c-e2a22cc54e75'),
('556dab34-5897-571f-84e2-4066f200eb65', '20b5d057-6da9-586a-b6d2-7a06e84f7c00'),
('556dab34-5897-571f-84e2-4066f200eb65', 'acda50b1-95ad-592c-8eba-2707697e6e8e'),
('556dab34-5897-571f-84e2-4066f200eb65', '21b57959-f8de-51cd-bf9a-a79d01fe18ac'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ef6cc449-4e62-579c-87dd-c8189bbff72a'),
('556dab34-5897-571f-84e2-4066f200eb65', 'd301815e-9e02-5aaf-9a85-e94b8ea427b5'),
('556dab34-5897-571f-84e2-4066f200eb65', '461b559a-2bd3-50f3-84c2-3cf0e5eb53d5'),
('556dab34-5897-571f-84e2-4066f200eb65', 'd9c82a07-a850-5a0f-a7be-a5770ee7b73d'),
('556dab34-5897-571f-84e2-4066f200eb65', '00a05083-b382-511b-9f0a-7cc77cf19ec2'),
('556dab34-5897-571f-84e2-4066f200eb65', '6c72992a-c78f-5592-b3c7-b6d8c7edb8b4'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a8077ed6-2a38-5f84-a067-320690d232da'),
('556dab34-5897-571f-84e2-4066f200eb65', '4d296abb-79c0-5122-a5db-61b6ef6021bc'),
('556dab34-5897-571f-84e2-4066f200eb65', '28819433-740d-5a45-bb42-f6b529031892'),
('556dab34-5897-571f-84e2-4066f200eb65', '96564bd5-72a2-5891-8077-6ccf96a6818b'),
('556dab34-5897-571f-84e2-4066f200eb65', '986b6b40-c9c6-5ffa-b6f5-dbd80306e334'),
('556dab34-5897-571f-84e2-4066f200eb65', 'c3c99bb0-fea0-5dbb-9288-44e12ff768d7'),
('556dab34-5897-571f-84e2-4066f200eb65', 'cee950f7-e54d-5a7d-84e1-313798c32ae4'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a6a07512-ef6f-58fc-803e-90cffca86a34'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ad85f2e6-9984-585c-b1c4-fe9da290181a'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b84584b5-850a-598c-9d2c-603ee63ccb82'),
('556dab34-5897-571f-84e2-4066f200eb65', '5c57f92c-bddc-5ab3-9413-f5df59257521'),
('556dab34-5897-571f-84e2-4066f200eb65', '5315a43e-e2ea-57be-ad25-faa3f68f8a03'),
('556dab34-5897-571f-84e2-4066f200eb65', '5cf056b3-703a-57c7-b71a-4cb70ca26b85'),
('556dab34-5897-571f-84e2-4066f200eb65', '63db84ba-b8ca-54f8-97df-7b913d1ae1b9'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a3682003-1d53-5d2a-bd27-b6258c1f2d5d'),
('556dab34-5897-571f-84e2-4066f200eb65', 'cce5e9e6-c321-5ebe-8283-4606fb5d4a44'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e41827e7-096d-577e-921e-3e35738f76b3'),
('556dab34-5897-571f-84e2-4066f200eb65', '6782769e-e28f-5309-9862-765a1dfa2dad'),
('556dab34-5897-571f-84e2-4066f200eb65', '58da803b-afd5-5400-aff4-4a4316f38ef0'),
('556dab34-5897-571f-84e2-4066f200eb65', 'f26cd005-f79e-52fb-9052-f58523b82f60'),
('556dab34-5897-571f-84e2-4066f200eb65', '6d82f9c0-bf88-54aa-8399-6a0d74386e4e'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a1e0637a-fc74-5e22-be6c-1310f815a920'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b5b0fa14-0c9e-5f94-9008-795e612d3bdd'),
('556dab34-5897-571f-84e2-4066f200eb65', '7eb9f32d-3e13-54a5-a642-35fc11600d67'),
('556dab34-5897-571f-84e2-4066f200eb65', 'de58ec93-05f9-5d5a-b7cc-e410da5f765f'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b5d9face-4142-5576-90cb-b84fc7db0c6b'),
('556dab34-5897-571f-84e2-4066f200eb65', '73814e2f-14b5-5661-9d62-9df4ce3728d1'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ef2d60e8-b78b-5ec9-ae6b-f95941b32f98'),
('556dab34-5897-571f-84e2-4066f200eb65', 'd8727938-059f-589a-b323-b90c59cce154'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a8187551-605c-5ee3-8b60-9664206d1154'),
('556dab34-5897-571f-84e2-4066f200eb65', '4ba83591-e577-5528-abce-3f04433e6aa5'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e3ffbafc-8176-5bb3-86fe-1b18511c8b72'),
('556dab34-5897-571f-84e2-4066f200eb65', '76b4f6ba-f7e8-5c4e-8556-042adf74b78c'),
('556dab34-5897-571f-84e2-4066f200eb65', '670c4479-d776-560d-9709-579e6c9a964c'),
('556dab34-5897-571f-84e2-4066f200eb65', '750d8ea8-770a-511b-b7b2-de49e4b58adf'),
('556dab34-5897-571f-84e2-4066f200eb65', 'cff9ca4e-1ab8-50de-9d10-a1ae70c66db6'),
('556dab34-5897-571f-84e2-4066f200eb65', 'a40ff1e8-1d5d-57dc-9331-d24155620963'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e49691e9-59da-5231-9532-3f8955bc57e1'),
('556dab34-5897-571f-84e2-4066f200eb65', '9429cea7-5961-5a94-9b01-293a9e363e9d'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b269e025-a785-5411-b633-392809dd9333'),
('556dab34-5897-571f-84e2-4066f200eb65', '04f441fd-de9c-5161-8129-de153763de7c'),
('556dab34-5897-571f-84e2-4066f200eb65', '3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a'),
('556dab34-5897-571f-84e2-4066f200eb65', '103df784-31a0-5f2c-a04a-1f5fda3bcaa3'),
('556dab34-5897-571f-84e2-4066f200eb65', '7248c381-1166-5cf8-a90a-15423e69af23'),
('556dab34-5897-571f-84e2-4066f200eb65', 'eebfd063-f7b3-5cbb-8d27-0d770d9f090d'),
('556dab34-5897-571f-84e2-4066f200eb65', '7b8e067b-2993-5374-95f9-72a876cfe7f3'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b600e847-ad35-538e-81f1-72674c0ed357'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e7981804-4956-58af-bdd2-bd1ef0831dfd'),
('556dab34-5897-571f-84e2-4066f200eb65', '58402e65-12f7-5a0b-85b8-3bcb50b458ae'),
('556dab34-5897-571f-84e2-4066f200eb65', 'c318fc62-d27f-55c7-be19-fc57bd4d4871'),
('556dab34-5897-571f-84e2-4066f200eb65', '67d83a9f-e044-58da-a12a-f1be38ae5b1d'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b1b60a5e-1cb8-5e3b-9ab5-624104ea9862'),
('556dab34-5897-571f-84e2-4066f200eb65', 'bc93091f-63f2-5814-8438-82088f68e070'),
('556dab34-5897-571f-84e2-4066f200eb65', '30bd9923-c66c-53e9-920d-3d0efd4f22df'),
('556dab34-5897-571f-84e2-4066f200eb65', '0a56825f-21ab-5671-84b1-bdb2523ffc39'),
('556dab34-5897-571f-84e2-4066f200eb65', 'e6e287e4-d0c1-59f7-908e-8991e935b5eb'),
('556dab34-5897-571f-84e2-4066f200eb65', 'ce7a6a15-41a3-5cc3-bf69-4a4d4658a010'),
('556dab34-5897-571f-84e2-4066f200eb65', '6f2b709a-bb57-5838-b379-a877d227f2e1'),
('556dab34-5897-571f-84e2-4066f200eb65', 'c7b58c3e-72f5-5c04-ba11-edf671ac76ee'),
('556dab34-5897-571f-84e2-4066f200eb65', '1b6878cf-04d2-52e9-b33d-9ca6a6d57280'),
('556dab34-5897-571f-84e2-4066f200eb65', 'b78671c4-9799-58b8-8bb9-3ad75324266d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '044808b2-4404-571b-bb78-27103def6ab7'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '57ff8cb5-7ba7-5a41-858c-f15b8cc34591'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '787c8a9d-c473-5704-acbb-b14a1217f572'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '3bfbd70f-c423-5a25-a09a-49758f077196'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '016e1c62-a720-55d0-ba7d-b6bd3c6f6db0'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '8ed98dd8-0635-5a13-b39d-4db47595df56'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '638e1450-4f52-597e-b184-5c3885f3764a'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '547fcbbe-321b-553c-aa79-7f93ac4cbaeb'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ea22046a-2887-5fb1-90c7-7c3211717fca'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ba003cd4-4e8b-58ba-92c7-5e961054538d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ec60796e-30dd-5b94-9dde-d8c3d1705b9e'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '5e17a5d6-3a64-566d-a28e-418677b55355'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '39f5bc03-ce29-520b-a567-d9caa02f6888'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '48398b32-a97c-5f91-9f9c-4ac70506b264'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '8a97fae3-351f-5cb1-b48c-e2a22cc54e75'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '20b5d057-6da9-586a-b6d2-7a06e84f7c00'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'acda50b1-95ad-592c-8eba-2707697e6e8e'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '21b57959-f8de-51cd-bf9a-a79d01fe18ac'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ef6cc449-4e62-579c-87dd-c8189bbff72a'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'd301815e-9e02-5aaf-9a85-e94b8ea427b5'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '461b559a-2bd3-50f3-84c2-3cf0e5eb53d5'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'd9c82a07-a850-5a0f-a7be-a5770ee7b73d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '00a05083-b382-511b-9f0a-7cc77cf19ec2'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '6c72992a-c78f-5592-b3c7-b6d8c7edb8b4'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a8077ed6-2a38-5f84-a067-320690d232da'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '4d296abb-79c0-5122-a5db-61b6ef6021bc'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '28819433-740d-5a45-bb42-f6b529031892'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '96564bd5-72a2-5891-8077-6ccf96a6818b'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '986b6b40-c9c6-5ffa-b6f5-dbd80306e334'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'c3c99bb0-fea0-5dbb-9288-44e12ff768d7'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a6a07512-ef6f-58fc-803e-90cffca86a34'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '5315a43e-e2ea-57be-ad25-faa3f68f8a03'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '5cf056b3-703a-57c7-b71a-4cb70ca26b85'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '63db84ba-b8ca-54f8-97df-7b913d1ae1b9'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a3682003-1d53-5d2a-bd27-b6258c1f2d5d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'cce5e9e6-c321-5ebe-8283-4606fb5d4a44'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'e41827e7-096d-577e-921e-3e35738f76b3'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '6782769e-e28f-5309-9862-765a1dfa2dad'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '58da803b-afd5-5400-aff4-4a4316f38ef0'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'f26cd005-f79e-52fb-9052-f58523b82f60'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '6d82f9c0-bf88-54aa-8399-6a0d74386e4e'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a1e0637a-fc74-5e22-be6c-1310f815a920'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b5b0fa14-0c9e-5f94-9008-795e612d3bdd'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '7eb9f32d-3e13-54a5-a642-35fc11600d67'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'de58ec93-05f9-5d5a-b7cc-e410da5f765f'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b5d9face-4142-5576-90cb-b84fc7db0c6b'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '73814e2f-14b5-5661-9d62-9df4ce3728d1'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ef2d60e8-b78b-5ec9-ae6b-f95941b32f98'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'd8727938-059f-589a-b323-b90c59cce154'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a8187551-605c-5ee3-8b60-9664206d1154'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '4ba83591-e577-5528-abce-3f04433e6aa5'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'e3ffbafc-8176-5bb3-86fe-1b18511c8b72'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '76b4f6ba-f7e8-5c4e-8556-042adf74b78c'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '670c4479-d776-560d-9709-579e6c9a964c'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '750d8ea8-770a-511b-b7b2-de49e4b58adf'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'cff9ca4e-1ab8-50de-9d10-a1ae70c66db6'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'a40ff1e8-1d5d-57dc-9331-d24155620963'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'e49691e9-59da-5231-9532-3f8955bc57e1'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '9429cea7-5961-5a94-9b01-293a9e363e9d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b269e025-a785-5411-b633-392809dd9333'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '04f441fd-de9c-5161-8129-de153763de7c'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '103df784-31a0-5f2c-a04a-1f5fda3bcaa3'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '7248c381-1166-5cf8-a90a-15423e69af23'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'eebfd063-f7b3-5cbb-8d27-0d770d9f090d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '7b8e067b-2993-5374-95f9-72a876cfe7f3'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b600e847-ad35-538e-81f1-72674c0ed357'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'e7981804-4956-58af-bdd2-bd1ef0831dfd'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '58402e65-12f7-5a0b-85b8-3bcb50b458ae'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'c318fc62-d27f-55c7-be19-fc57bd4d4871'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '67d83a9f-e044-58da-a12a-f1be38ae5b1d'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b1b60a5e-1cb8-5e3b-9ab5-624104ea9862'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'bc93091f-63f2-5814-8438-82088f68e070'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '30bd9923-c66c-53e9-920d-3d0efd4f22df'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '0a56825f-21ab-5671-84b1-bdb2523ffc39'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'e6e287e4-d0c1-59f7-908e-8991e935b5eb'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'ce7a6a15-41a3-5cc3-bf69-4a4d4658a010'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '6f2b709a-bb57-5838-b379-a877d227f2e1'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'c7b58c3e-72f5-5c04-ba11-edf671ac76ee'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', '1b6878cf-04d2-52e9-b33d-9ca6a6d57280'),
('b3c44daa-a5bc-5814-a78c-9ad0d2db7876', 'b78671c4-9799-58b8-8bb9-3ad75324266d'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '044808b2-4404-571b-bb78-27103def6ab7'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '57ff8cb5-7ba7-5a41-858c-f15b8cc34591'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '787c8a9d-c473-5704-acbb-b14a1217f572'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '8ed98dd8-0635-5a13-b39d-4db47595df56'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '638e1450-4f52-597e-b184-5c3885f3764a'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '547fcbbe-321b-553c-aa79-7f93ac4cbaeb'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'ec60796e-30dd-5b94-9dde-d8c3d1705b9e'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '5e17a5d6-3a64-566d-a28e-418677b55355'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '39f5bc03-ce29-520b-a567-d9caa02f6888'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '20b5d057-6da9-586a-b6d2-7a06e84f7c00'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'acda50b1-95ad-592c-8eba-2707697e6e8e'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '21b57959-f8de-51cd-bf9a-a79d01fe18ac'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '4d296abb-79c0-5122-a5db-61b6ef6021bc'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '28819433-740d-5a45-bb42-f6b529031892'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '96564bd5-72a2-5891-8077-6ccf96a6818b'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'e41827e7-096d-577e-921e-3e35738f76b3'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '6782769e-e28f-5309-9862-765a1dfa2dad'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '58da803b-afd5-5400-aff4-4a4316f38ef0'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'a1e0637a-fc74-5e22-be6c-1310f815a920'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'b5b0fa14-0c9e-5f94-9008-795e612d3bdd'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '7eb9f32d-3e13-54a5-a642-35fc11600d67'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '73814e2f-14b5-5661-9d62-9df4ce3728d1'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'ef2d60e8-b78b-5ec9-ae6b-f95941b32f98'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'd8727938-059f-589a-b323-b90c59cce154'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'e3ffbafc-8176-5bb3-86fe-1b18511c8b72'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '76b4f6ba-f7e8-5c4e-8556-042adf74b78c'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '670c4479-d776-560d-9709-579e6c9a964c'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'a40ff1e8-1d5d-57dc-9331-d24155620963'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'e49691e9-59da-5231-9532-3f8955bc57e1'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '9429cea7-5961-5a94-9b01-293a9e363e9d'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '3cafc47c-b93d-5cc7-ad38-7e8f1deb5c0a'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '103df784-31a0-5f2c-a04a-1f5fda3bcaa3'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '7248c381-1166-5cf8-a90a-15423e69af23'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'b600e847-ad35-538e-81f1-72674c0ed357'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'e7981804-4956-58af-bdd2-bd1ef0831dfd'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '58402e65-12f7-5a0b-85b8-3bcb50b458ae'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'b1b60a5e-1cb8-5e3b-9ab5-624104ea9862'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', 'bc93091f-63f2-5814-8438-82088f68e070'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '30bd9923-c66c-53e9-920d-3d0efd4f22df'),
('52e8a7d2-4b3f-51c5-ac7e-579e481fa4a3', '6f2b709a-bb57-5838-b379-a877d227f2e1'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '57ff8cb5-7ba7-5a41-858c-f15b8cc34591'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '638e1450-4f52-597e-b184-5c3885f3764a'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '5e17a5d6-3a64-566d-a28e-418677b55355'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'acda50b1-95ad-592c-8eba-2707697e6e8e'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'd9c82a07-a850-5a0f-a7be-a5770ee7b73d'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '28819433-740d-5a45-bb42-f6b529031892'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'a6a07512-ef6f-58fc-803e-90cffca86a34'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '6782769e-e28f-5309-9862-765a1dfa2dad'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'b5b0fa14-0c9e-5f94-9008-795e612d3bdd'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'ef2d60e8-b78b-5ec9-ae6b-f95941b32f98'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '76b4f6ba-f7e8-5c4e-8556-042adf74b78c'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'e49691e9-59da-5231-9532-3f8955bc57e1'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '103df784-31a0-5f2c-a04a-1f5fda3bcaa3'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'e7981804-4956-58af-bdd2-bd1ef0831dfd'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', 'bc93091f-63f2-5814-8438-82088f68e070'),
('ebf231a5-c391-5b4f-b49f-8ff87fbfbe99', '6f2b709a-bb57-5838-b379-a877d227f2e1');

-- ---------------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `users` (`id`, `email`, `passwordHash`, `firstName`, `lastName`, `phone`, `company`, `type`, `status`, `locale`, `roleId`, `address`, `wilaya`, `country`, `position`, `createdAt`, `updatedAt`) VALUES
('d9678792-4ed1-548f-876d-0455618d08a2', 'admin@sarisysteme.com', '$2a$10$2053EAxY2htx579id2TKKOo4wggph0b12WE8dTi/DJRTG/l5I.eXy', 'Karim', 'BENALI', '(+213) 23 52 42 72', 'SARI Système SARL', 'admin', 'active', 'fr', '556dab34-5897-571f-84e2-4066f200eb65', NULL, 'Alger', 'Algérie', 'Gérant', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('fa96732a-9d8f-5928-a475-bf81617ada91', 'gestion@sarisysteme.com', '$2a$10$2053EAxY2htx579id2TKKOo4wggph0b12WE8dTi/DJRTG/l5I.eXy', 'Yasmine', 'CHERIF', '(+213) 550 12 34 56', 'SARI Système SARL', 'admin', 'active', 'fr', 'b3c44daa-a5bc-5814-a78c-9ad0d2db7876', NULL, 'Alger', 'Algérie', 'Responsable commerciale', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8e9f4ed7-44cd-59ed-900f-33c5fc6ee3ad', 'client@clinique-elafia.dz', '$2a$10$2053EAxY2htx579id2TKKOo4wggph0b12WE8dTi/DJRTG/l5I.eXy', 'Clinique', 'El Afia', '(+213) 21 63 45 78', 'Clinique El Afia', 'client', 'active', 'fr', NULL, 'Rue Didouche Mourad, Alger-Centre', 'Alger', 'Algérie', NULL, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('98b1938b-84a8-5667-bec3-6c147a1cc171', 'contact@meditech.dz', '$2a$10$2053EAxY2htx579id2TKKOo4wggph0b12WE8dTi/DJRTG/l5I.eXy', 'MediTech', 'Algérie', '(+213) 41 33 22 11', 'MediTech Algérie', 'partner', 'active', 'fr', NULL, NULL, 'Oran', 'Algérie', NULL, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('889672d2-3be7-589d-96ff-e4170209aff5', 'mohamed.saidi@gmail.com', '$2a$10$2053EAxY2htx579id2TKKOo4wggph0b12WE8dTi/DJRTG/l5I.eXy', 'Mohamed', 'SAIDI', '(+213) 661 22 33 44', NULL, 'candidate', 'pending', 'fr', NULL, NULL, 'Constantine', 'Algérie', 'Technicien biomédical', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Coordonnées (contact_info)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `contact_info` (`id`, `locale`, `company`, `tagline`, `phone`, `email`, `address`, `hours`, `currency`, `social`, `extras`, `createdAt`, `updatedAt`) VALUES
('d09f951f-bf3f-52d2-93fc-f3c50b2708ad', 'fr', 'SARI Système SARL', 'L''excellence médicale au service de la santé en Algérie', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie', 'Dim - Jeu : 8h00 - 17h00', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"Alger","description":"Distribution d''équipements et consommables médicaux depuis plus de 20 ans en Algérie.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bc86e476-da46-5d9f-9489-67e39b6bf197', 'en', 'SARI Système SARL', 'Medical excellence serving healthcare in Algeria', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria', 'Sun - Thu: 8:00 AM - 5:00 PM', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"Algiers","description":"Distributing medical equipment and consumables in Algeria for over 20 years.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ea7655db-fc66-554c-8412-3156b790b391', 'ar', 'ساري سيستم ش.ذ.م.م', 'التميز الطبي في خدمة الصحة في الجزائر', '(+213) 23 52 42 72', 'contact@sarisysteme.com', '17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة، الجزائر', 'الأحد - الخميس: 8:00 - 17:00', 'DZD', '{"facebook":"https://facebook.com/sarisysteme","linkedin":"https://linkedin.com/company/sari-systeme","twitter":"https://twitter.com/sarisysteme","youtube":"https://youtube.com/@sarisysteme"}', '{"wilaya":"الجزائر","description":"توزيع المعدات والمستلزمات الطبية منذ أكثر من 20 عامًا في الجزائر.","stats":{"clients":"500+","experience":"20","support":"24/7","satisfaction":"98%"}}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `menus` (`id`, `locale`, `name`, `location`, `items`, `status`, `createdAt`, `updatedAt`) VALUES
('723cce60-abf6-5457-98be-1eff5bfb501c', 'fr', 'Menu principal', 'main', '[{"id":"home","label":"Accueil","href":"/"},{"id":"about","label":"À Propos","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions","submenu":[{"label":"Diagnostic","href":"/solutions/diagnostic","desc":"Échographes, tensiomètres, microscopes"},{"label":"Cardiologie","href":"/solutions/cardiology","desc":"ECG, défibrillateurs, moniteurs"},{"label":"Imagerie","href":"/solutions/imaging","desc":"Scanners, IRM, radiologie"},{"label":"Chirurgie","href":"/solutions/surgery","desc":"Instruments, autoclaves, tables opératoires"},{"label":"Réanimation","href":"/solutions/emergency","desc":"Défibrillateurs, chariots d''urgence"},{"label":"Laboratoire","href":"/solutions/laboratory","desc":"Analyseurs, microscopes, centrifugeuses"}]},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Produits","href":"/products"},{"id":"events","label":"Événements","href":"/events"},{"id":"news","label":"Actualités","href":"/news"},{"id":"careers","label":"Carrières","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('17099c63-4cbb-5064-a03e-a8f0ee1affee', 'fr', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"Accueil","href":"/"},{"id":"about","label":"À Propos","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions"},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Produits","href":"/products"},{"id":"news","label":"Actualités","href":"/news"},{"id":"careers","label":"Carrières","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8f456156-c05a-5e80-a0e9-5cba8d9cacda', 'fr', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"Mentions Légales","href":"/legal/mentions"},{"id":"privacy","label":"Confidentialité","href":"/legal/privacy"},{"id":"conditions","label":"Conditions d''utilisation","href":"/legal/conditions"},{"id":"verification","label":"Vérification","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('fc7d0cdc-33f8-5aab-af4f-23ff1d8c2ebc', 'en', 'Menu principal', 'main', '[{"id":"home","label":"Home","href":"/"},{"id":"about","label":"About","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions","submenu":[{"label":"Diagnostic","href":"/solutions/diagnostic","desc":"Ultrasound, blood pressure monitors, microscopes"},{"label":"Cardiology","href":"/solutions/cardiology","desc":"ECG, defibrillators, monitors"},{"label":"Imaging","href":"/solutions/imaging","desc":"CT, MRI, radiology"},{"label":"Surgery","href":"/solutions/surgery","desc":"Instruments, autoclaves, operating tables"},{"label":"Emergency","href":"/solutions/emergency","desc":"Defibrillators, crash carts"},{"label":"Laboratory","href":"/solutions/laboratory","desc":"Analyzers, microscopes, centrifuges"}]},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Products","href":"/products"},{"id":"events","label":"Events","href":"/events"},{"id":"news","label":"News","href":"/news"},{"id":"careers","label":"Careers","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bbfb4678-1a64-5f1d-93d3-c4d50b551241', 'en', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"Home","href":"/"},{"id":"about","label":"About","href":"/about"},{"id":"solutions","label":"Solutions","href":"/solutions"},{"id":"services","label":"Services","href":"/services"},{"id":"products","label":"Products","href":"/products"},{"id":"news","label":"News","href":"/news"},{"id":"careers","label":"Careers","href":"/careers"},{"id":"contact","label":"Contact","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0212be8c-9034-53a6-a399-f77d57eac87f', 'en', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"Legal Notice","href":"/legal/mentions"},{"id":"privacy","label":"Privacy Policy","href":"/legal/privacy"},{"id":"conditions","label":"Terms & Conditions","href":"/legal/conditions"},{"id":"verification","label":"Verification","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c0dc6ef2-aee8-5a20-9409-624c2d637e6a', 'ar', 'Menu principal', 'main', '[{"id":"home","label":"الرئيسية","href":"/"},{"id":"about","label":"من نحن","href":"/about"},{"id":"solutions","label":"الحلول","href":"/solutions","submenu":[{"label":"التشخيص","href":"/solutions/diagnostic","desc":"أجهزة الموجات فوق الصوتية، أجهزة قياس الضغط، المجاهر"},{"label":"أمراض القلب","href":"/solutions/cardiology","desc":"تخطيط القلب، أجهزة الصدمات، الشاشات"},{"label":"التصوير","href":"/solutions/imaging","desc":"الماسح الضوئي، الرنين المغناطيسي، الأشعة"},{"label":"الجراحة","href":"/solutions/surgery","desc":"الأدوات، المعقمات، طاولات العمليات"},{"label":"الطوارئ","href":"/solutions/emergency","desc":"أجهزة الصدمات، عربات الطوارئ"},{"label":"المختبر","href":"/solutions/laboratory","desc":"أجهزة التحليل، المجاهر، أجهزة الطرد المركزي"}]},{"id":"services","label":"الخدمات","href":"/services"},{"id":"products","label":"المنتجات","href":"/products"},{"id":"events","label":"الفعاليات","href":"/events"},{"id":"news","label":"الأخبار","href":"/news"},{"id":"careers","label":"الوظائف","href":"/careers"},{"id":"contact","label":"اتصل بنا","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c17eab14-e492-57d5-9c2b-272552b545c9', 'ar', 'Navigation pied de page', 'footer-nav', '[{"id":"home","label":"الرئيسية","href":"/"},{"id":"about","label":"من نحن","href":"/about"},{"id":"solutions","label":"الحلول","href":"/solutions"},{"id":"services","label":"الخدمات","href":"/services"},{"id":"products","label":"المنتجات","href":"/products"},{"id":"news","label":"الأخبار","href":"/news"},{"id":"careers","label":"الوظائف","href":"/careers"},{"id":"contact","label":"اتصل بنا","href":"/contact"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3b78134c-92cb-56d6-bec9-43f7915b63b4', 'ar', 'Liens légaux', 'footer-legal', '[{"id":"mentions","label":"الإشعار القانوني","href":"/legal/mentions"},{"id":"privacy","label":"سياسة الخصوصية","href":"/legal/privacy"},{"id":"conditions","label":"الشروط والأحكام","href":"/legal/conditions"},{"id":"verification","label":"التحقق","href":"/verification"}]', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Pages légales + À propos
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `pages` (`id`, `slug`, `locale`, `kind`, `subtype`, `title`, `content`, `status`, `publishedAt`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
('0ce42bd7-7fd0-561b-a9bc-06667d9ed69d', 'mentions', 'fr', 'legal', 'simple', 'Mentions Légales', '<p class="mb-4"><strong>Raison sociale :</strong> SARI Système SARL</p><p class="mb-4"><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</p><p class="mb-4"><strong>Capital social :</strong> 10 000 000 DZD (dix millions de dinars algériens)</p><p class="mb-4"><strong>Registre de Commerce (RC) :</strong> Alger n° 16/00-1234567B21</p><p class="mb-4"><strong>NIF (Numéro d''Identification Fiscale) :</strong> 002116001234567</p><p class="mb-4"><strong>NIS (Numéro d''Identification Statistique) :</strong> 09876543210016</p><p class="mb-4"><strong>Siège social :</strong> 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger, Algérie</p><p class="mb-4"><strong>Téléphone :</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>Email :</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Directeur de la publication :</strong> Karim BENALI, Gérant</p><p class="mb-4"><strong>Hébergeur :</strong> Hébergement local algérien (datacenter Alger)</p><p class="mb-4">Les présentes mentions légales sont établies conformément à la législation algérienne en vigueur.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7862d668-3a73-5efe-b4e7-99a6c7cdc915', 'privacy', 'fr', 'legal', 'simple', 'Politique de Confidentialité', '<p class="mb-4">SARI Système SARL accorde une grande importance à la protection de vos données à caractère personnel, conformément à la <strong>loi n° 18-07 du 10 juin 2018</strong> relative à la protection des personnes physiques dans le traitement des données à caractère personnel.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Responsable du traitement</h3><p class="mb-4">SARI Système SARL, 17 Lot ONAB, Cité SONELGAZ, Gué de Constantine, Alger.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Données collectées</h3><p class="mb-4">Nom, email, téléphone, entreprise et contenu des demandes (devis, contact, candidature).</p><h3 class="text-xl font-bold mb-3 mt-6">3. Finalités</h3><p class="mb-4">Traitement de vos demandes, suivi commercial et respect de nos obligations légales.</p><h3 class="text-xl font-bold mb-3 mt-6">4. Vos droits</h3><p class="mb-4">Vous disposez des droits d''accès, de rectification et d''opposition auprès de l''<strong>ANPDP</strong> (Autorité Nationale de Protection des Données à caractère Personnel). Contact : dpo@sarisysteme.com</p><h3 class="text-xl font-bold mb-3 mt-6">5. Cookies</h3><p class="mb-4">Notre site utilise des cookies pour améliorer votre expérience de navigation.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ee4ba0ce-01e4-5ca4-992c-0c588f1bf911', 'conditions', 'fr', 'legal', 'simple', 'Conditions Générales de Vente', '<p class="mb-4">Les présentes CGV s''appliquent à toutes les ventes de produits et services réalisées par SARI Système SARL sur le territoire algérien.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 1 : Prix</h3><p class="mb-4">Les prix sont indiqués en <strong>Dinar Algérien (DZD)</strong> hors taxes. La TVA au taux en vigueur (19% ou 9% selon les produits) s''ajoute au prix HT.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 2 : Commandes</h3><p class="mb-4">Toute commande doit être confirmée par écrit (email ou bon de commande signé). Accusé de réception sous 48h ouvrées.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 3 : Livraison</h3><p class="mb-4">Livraison sur les <strong>58 wilayas</strong>. Délais indicatifs de 3 à 15 jours ouvrés selon la wilaya et la disponibilité.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 4 : Paiement</h3><p class="mb-4">Virement bancaire, chèque, carte CIB / Edahabia ou paiement à la livraison selon accord préalable.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 5 : Garantie</h3><p class="mb-4">Garantie constructeur de 12 à 36 mois selon les équipements. Le SAV est assuré par nos techniciens agréés.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('107cbf30-378a-52a0-ab87-3fd6990ec6f5', 'about', 'fr', 'about', 'simple', 'À Propos de SARI Système', '<p class="mb-4">Fondée en 2003 à Alger, SARI Système SARL s''est imposée comme un acteur majeur de la distribution d''équipements et de consommables médicaux en Algérie.</p><h3 class="text-xl font-bold mb-3 mt-6">Notre Mission</h3><p class="mb-4">Accompagner les établissements de santé publics et privés des 58 wilayas avec des équipements fiables, certifiés et un service de proximité.</p><h3 class="text-xl font-bold mb-3 mt-6">Nos Valeurs</h3><ul class="list-disc pl-6 mb-4 space-y-2"><li>Qualité et conformité aux normes internationales</li><li>Réactivité et SAV de proximité</li><li>Expertise biomédicale</li><li>Engagement envers la santé publique algérienne</li></ul>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('72d64d38-db06-5f61-8b86-d76babe9965c', 'mentions', 'en', 'legal', 'simple', 'Legal Notice', '<p class="mb-4"><strong>Company name:</strong> SARI Système SARL</p><p class="mb-4"><strong>Legal form:</strong> Limited Liability Company (SARL)</p><p class="mb-4"><strong>Share capital:</strong> DZD 10,000,000</p><p class="mb-4"><strong>Trade Register (RC):</strong> Algiers n° 16/00-1234567B21</p><p class="mb-4"><strong>Tax ID (NIF):</strong> 002116001234567</p><p class="mb-4"><strong>Statistical ID (NIS):</strong> 09876543210016</p><p class="mb-4"><strong>Registered office:</strong> 17 Lot ONAB, Sonelgaz City, Gué de Constantine, Algiers, Algeria</p><p class="mb-4"><strong>Phone:</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>Email:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Publisher:</strong> Karim BENALI, Manager</p><p class="mb-4"><strong>Hosting:</strong> Local Algerian hosting (Algiers datacenter)</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('917118cb-5c71-55ab-ac0b-598970192049', 'privacy', 'en', 'legal', 'simple', 'Privacy Policy', '<p class="mb-4">SARI Système SARL protects your personal data in accordance with <strong>Law n° 18-07 of June 10, 2018</strong> on the protection of individuals in the processing of personal data.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Data controller</h3><p class="mb-4">SARI Système SARL, Algiers, Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Collected data</h3><p class="mb-4">Name, email, phone, company and request contents.</p><h3 class="text-xl font-bold mb-3 mt-6">3. Your rights</h3><p class="mb-4">Access, rectification and objection rights with the ANPDP. Contact: dpo@sarisysteme.com</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3145490d-65aa-5644-a7ed-7f47256ecc7a', 'conditions', 'en', 'legal', 'simple', 'Terms and Conditions of Sale', '<p class="mb-4">These terms apply to all sales made by SARI Système SARL in Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Prices</h3><p class="mb-4">Prices are in <strong>Algerian Dinar (DZD)</strong>, VAT excluded (19% or 9%).</p><h3 class="text-xl font-bold mb-3 mt-6">2. Delivery</h3><p class="mb-4">Delivery to all <strong>58 wilayas</strong>, 3 to 15 business days.</p><h3 class="text-xl font-bold mb-3 mt-6">3. Payment</h3><p class="mb-4">Bank transfer, cheque, CIB / Edahabia card or cash on delivery.</p><h3 class="text-xl font-bold mb-3 mt-6">4. Warranty</h3><p class="mb-4">12 to 36 months manufacturer warranty.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b34518a1-c624-5ee2-b21e-335a3abdb325', 'about', 'en', 'about', 'simple', 'About SARI Système', '<p class="mb-4">Founded in 2003 in Algiers, SARI Système SARL is a leading distributor of medical equipment and consumables in Algeria.</p><h3 class="text-xl font-bold mb-3 mt-6">Our Mission</h3><p class="mb-4">Support public and private healthcare facilities across the 58 wilayas with reliable, certified equipment and local service.</p>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('2402dd9b-521a-58e4-b743-4fd9a9dc225b', 'mentions', 'ar', 'legal', 'simple', 'الإشعار القانوني', '<p class="mb-4"><strong>الاسم التجاري:</strong> ساري سيستم ش.ذ.م.م</p><p class="mb-4"><strong>الشكل القانوني:</strong> شركة ذات مسؤولية محدودة (ش.ذ.م.م)</p><p class="mb-4"><strong>رأس المال:</strong> 10,000,000 دج</p><p class="mb-4"><strong>السجل التجاري:</strong> الجزائر رقم 16/00-1234567B21</p><p class="mb-4"><strong>الرقم الجبائي (NIF):</strong> 002116001234567</p><p class="mb-4"><strong>الرقم الإحصائي (NIS):</strong> 09876543210016</p><p class="mb-4"><strong>المقر الاجتماعي:</strong> 17 حي أوناب، حي سونلغاز، قي دي قسنطينة، الجزائر العاصمة</p><p class="mb-4"><strong>الهاتف:</strong> (+213) 23 52 42 72</p><p class="mb-4"><strong>البريد الإلكتروني:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>مدير النشر:</strong> كريم بن علي، المسير</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bba1a58b-7055-5ec9-8186-8e3271245c94', 'privacy', 'ar', 'legal', 'simple', 'سياسة الخصوصية', '<p class="mb-4">تحمي ساري سيستم بياناتك الشخصية وفقًا <strong>للقانون رقم 18-07 المؤرخ في 10 جوان 2018</strong> المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.</p><h3 class="text-xl font-bold mb-3 mt-6">1. مسؤول المعالجة</h3><p class="mb-4">ساري سيستم ش.ذ.م.م، الجزائر العاصمة.</p><h3 class="text-xl font-bold mb-3 mt-6">2. البيانات المجمعة</h3><p class="mb-4">الاسم، البريد الإلكتروني، الهاتف، المؤسسة ومحتوى الطلبات.</p><h3 class="text-xl font-bold mb-3 mt-6">3. حقوقك</h3><p class="mb-4">حقوق الوصول والتصحيح والاعتراض لدى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي. للتواصل: dpo@sarisysteme.com</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3fbf8a0d-a7f0-55ef-9155-12f4adc381d8', 'conditions', 'ar', 'legal', 'simple', 'الشروط والأحكام العامة للبيع', '<p class="mb-4">تنطبق هذه الشروط على جميع مبيعات ساري سيستم في الجزائر.</p><h3 class="text-xl font-bold mb-3 mt-6">1. الأسعار</h3><p class="mb-4">الأسعار بالدينار الجزائري (DZD) دون احتساب الرسم على القيمة المضافة (19% أو 9%).</p><h3 class="text-xl font-bold mb-3 mt-6">2. التوصيل</h3><p class="mb-4">التوصيل إلى جميع الولايات الـ58 خلال 3 إلى 15 يوم عمل.</p><h3 class="text-xl font-bold mb-3 mt-6">3. الدفع</h3><p class="mb-4">تحويل بنكي، شيك، بطاقة CIB / الذهبية أو الدفع عند الاستلام.</p><h3 class="text-xl font-bold mb-3 mt-6">4. الضمان</h3><p class="mb-4">ضمان المصنع من 12 إلى 36 شهرًا.</p>', 'published', '2026-08-21 10:00:00.000', 0, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a98f0c64-86d3-5b27-8f75-e24ba131c143', 'about', 'ar', 'about', 'simple', 'من نحن — ساري سيستم', '<p class="mb-4">تأسست ساري سيستم في عام 2003 بالجزائر العاصمة، وأصبحت فاعلًا رئيسيًا في توزيع المعدات والمستلزمات الطبية في الجزائر.</p><h3 class="text-xl font-bold mb-3 mt-6">مهمتنا</h3><p class="mb-4">مرافقة المؤسسات الصحية العمومية والخاصة عبر 58 ولاية بمعدات موثوقة ومعتمدة وخدمة قريبة.</p>', 'published', '2026-08-21 10:00:00.000', 1, '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `products` (`id`, `locale`, `slug`, `name`, `category`, `sku`, `price`, `shortDesc`, `image`, `inStock`, `stockQty`, `currency`, `sortOrder`, `deliveryTime`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
('190a7855-0414-5ffc-a553-b902d408aa33', 'fr', 'echographe-portable-pro-x1', 'Échographe Portable Pro X1', 'Diagnostic', 'SARI-ECH-001', '1 450 000 DZD', 'Échographe portable avec sondes convexes et linéaires, idéal pour les cabinets et les structures mobiles.', NULL, 1, 10, 'DZD', 1, '5-10 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c623bfb6-1907-5432-a0e2-ece204e341fb', 'fr', 'lit-examen-electrique-premium', 'Lit d''Examen Électrique Premium', 'Équipements', 'SARI-LIT-002', '320 000 DZD', 'Lit d''examen électrique à hauteur variable, structure renforcée.', NULL, 1, 10, 'DZD', 2, '10-15 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('24648f40-d428-5fc0-b232-67e7141654ab', 'fr', 'sterilisateur-autoclave-classe-b', 'Stérilisateur Autoclave Classe B', 'Chirurgie', 'SARI-STR-003', '480 000 DZD', 'Autoclave Classe B conforme aux normes, cycles rapides.', NULL, 1, 10, 'DZD', 3, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ad3bdc01-fda8-520e-b1c1-8eee287c8e97', 'fr', 'tensiometre-digital-pro', 'Tensiomètre Digital Pro', 'Diagnostic', 'SARI-TEN-004', '28 500 DZD', 'Tensiomètre électronique professionnel avec brassard adulte.', NULL, 1, 10, 'DZD', 4, '3-5 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('543124b3-4d9c-538b-bd6d-3f52fcf2bd62', 'fr', 'moniteur-signes-vitaux-5-parametres', 'Moniteur de Signes Vitaux 5 Paramètres', 'Réanimation', 'SARI-MON-005', '265 000 DZD', 'Moniteur multiparamétrique : ECG, SpO2, PNIA, température, respiration.', NULL, 1, 10, 'DZD', 5, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ad3457c1-8101-5128-bc4a-e28eaaf7e07b', 'fr', 'defibrillateur-biphasique', 'Défibrillateur Biphasique', 'Urgence', 'SARI-DEF-006', '690 000 DZD', 'Défibrillateur biphasique avec mode AED et moniteur intégré.', NULL, 1, 10, 'DZD', 6, '7-12 jours ouvrés', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('2821a85d-e055-5142-bade-047107feb2b2', 'en', 'portable-ultrasound-pro-x1', 'Portable Ultrasound Pro X1', 'Diagnostic', 'SARI-ECH-001', 'DZD 1,450,000', 'Portable ultrasound with convex and linear probes.', NULL, 1, 10, 'DZD', 1, '5-10 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e6e4f048-1451-54e9-b219-0bc41dbc00ac', 'en', 'premium-electric-examination-table', 'Premium Electric Examination Table', 'Equipment', 'SARI-LIT-002', 'DZD 320,000', 'Electric examination table with adjustable height.', NULL, 1, 10, 'DZD', 2, '10-15 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8ca45e36-5b20-50b5-ab9e-2375327d4f5d', 'en', 'class-b-autoclave-sterilizer', 'Class B Autoclave Sterilizer', 'Surgery', 'SARI-STR-003', 'DZD 480,000', 'Class B autoclave with fast cycles.', NULL, 1, 10, 'DZD', 3, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a41e86fc-1c22-5d03-857a-9be9c5001123', 'en', 'digital-pro-blood-pressure-monitor', 'Digital Pro Blood Pressure Monitor', 'Diagnostic', 'SARI-TEN-004', 'DZD 28,500', 'Professional electronic blood pressure monitor.', NULL, 1, 10, 'DZD', 4, '3-5 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e9923413-241b-5b4c-9ec4-a6d7ec3698fe', 'en', '5-parameter-vital-signs-monitor', '5-Parameter Vital Signs Monitor', 'Intensive Care', 'SARI-MON-005', 'DZD 265,000', 'Multiparameter monitor: ECG, SpO2, NIBP, temperature, respiration.', NULL, 1, 10, 'DZD', 5, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('64e40e03-8ff1-59d8-b3b2-feeae3249823', 'en', 'biphasic-defibrillator', 'Biphasic Defibrillator', 'Emergency', 'SARI-DEF-006', 'DZD 690,000', 'Biphasic defibrillator with AED mode and built-in monitor.', NULL, 1, 10, 'DZD', 6, '7-12 business days', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('364ea4af-402b-5eda-b0d4-51766f7f60ca', 'ar', 'echographe-portable-pro-x1', 'جهاز الموجات فوق الصوتية المحمول Pro X1', 'التشخيص', 'SARI-ECH-001', '1,450,000 دج', 'جهاز موجات فوق صوتية محمول بمجسات محدبة وخطية.', NULL, 1, 10, 'DZD', 1, '5-10 أيام عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ad5a2cf3-1b60-5ead-8155-66543eea6a06', 'ar', 'lit-examen-electrique-premium', 'سرير فحص كهربائي فاخر', 'المعدات', 'SARI-LIT-002', '320,000 دج', 'سرير فحص كهربائي بارتفاع قابل للتعديل.', NULL, 1, 10, 'DZD', 2, '10-15 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('20b627f1-41a9-5124-a30f-a122e5219f0f', 'ar', 'sterilisateur-autoclave-classe-b', 'معقم أوتوكلاف الفئة B', 'الجراحة', 'SARI-STR-003', '480,000 دج', 'معقم أوتوكلاف من الفئة B بدورات سريعة.', NULL, 1, 10, 'DZD', 3, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bdd927b2-8f7a-503c-b270-051b46e78a25', 'ar', 'tensiometre-digital-pro', 'جهاز قياس ضغط الدم الرقمي الاحترافي', 'التشخيص', 'SARI-TEN-004', '28,500 دج', 'جهاز قياس ضغط الدم الإلكتروني الاحترافي.', NULL, 1, 10, 'DZD', 4, '3-5 أيام عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6636393c-0603-5897-8ebf-9b80ca90a0e5', 'ar', 'moniteur-signes-vitaux-5-parametres', 'جهاز مراقبة العلامات الحيوية 5 معايير', 'الإنعاش', 'SARI-MON-005', '265,000 دج', 'جهاز مراقبة متعدد المعايير: تخطيط القلب، تشبع الأكسجين، الضغط، الحرارة، التنفس.', NULL, 1, 10, 'DZD', 5, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f4aa9832-c94f-52fa-bd65-5b1464906d5c', 'ar', 'defibrillateur-biphasique', 'جهاز صدمات القلب ثنائي الطور', 'الطوارئ', 'SARI-DEF-006', '690,000 دج', 'جهاز صدمات ثنائي الطور مع وضع AED وشاشة مدمجة.', NULL, 1, 10, 'DZD', 6, '7-12 يوم عمل', 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `services` (`id`, `locale`, `slug`, `title`, `icon`, `shortDesc`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
('2eea79f1-02c8-578f-a033-62142e33f4df', 'fr', 'vente-equipements', 'Vente d''Équipements Médicaux', 'shopping-cart', 'Large gamme d''équipements neufs et reconditionnés pour les structures de santé.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('88663d26-fb21-5512-958e-0640e2ee9780', 'fr', 'installation-mise-en-service', 'Installation & Mise en Service', 'settings', 'Installation, calibration et mise en service par nos techniciens agréés.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e30c2633-93fb-5b4c-a771-903c36f4041d', 'fr', 'maintenance-sav', 'Maintenance & SAV', 'wrench', 'Contrats de maintenance préventive et corrective avec pièces d''origine.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('493ccc73-3727-5dba-8fab-13ae4add0f1f', 'fr', 'formation-personnel', 'Formation du Personnel Soignant', 'graduation-cap', 'Formation à l''utilisation des équipements sur site ou dans nos locaux.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e12db61d-59df-5f55-b3b1-31f8bf2c8645', 'fr', 'conseil-ingenierie', 'Conseil & Ingénierie Biomédicale', 'clipboard', 'Étude des besoins et accompagnement dans les appels d''offres.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4ca9b0fe-6513-5fdf-bd66-5c6d3e2641b0', 'en', 'equipment-sales', 'Medical Equipment Sales', 'shopping-cart', 'Wide range of new and refurbished equipment for healthcare facilities.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0795e876-df6d-5fc6-85d4-8231384a502e', 'en', 'installation-commissioning', 'Installation & Commissioning', 'settings', 'Installation, calibration and commissioning by certified technicians.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('2d9efea4-7a2f-52d1-a865-39b574304d9e', 'en', 'maintenance-after-sales', 'Maintenance & After-Sales', 'wrench', 'Preventive and corrective maintenance contracts with original parts.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4823bba5-6948-51a2-b772-c22078f29639', 'en', 'staff-training', 'Healthcare Staff Training', 'graduation-cap', 'On-site training on equipment use.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7e1a7919-6a86-5f4b-954c-d75b0757076c', 'en', 'biomedical-consulting', 'Biomedical Consulting', 'clipboard', 'Needs assessment and tender support.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('1db1c79d-e9f7-50f5-aea7-af2b20607f8e', 'ar', 'vente-equipements', 'بيع المعدات الطبية', 'shopping-cart', 'تشكيلة واسعة من المعدات الجديدة والمجددة للمؤسسات الصحية.', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('dd042171-251c-59eb-a7cb-fff296910d33', 'ar', 'installation-mise-en-service', 'التركيب والتشغيل', 'settings', 'التركيب والمعايرة والتشغيل من قبل تقنيين معتمدين.', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e3dcf2ad-e514-5baa-a00b-203705972b2b', 'ar', 'maintenance-sav', 'الصيانة وخدمة ما بعد البيع', 'wrench', 'عقود صيانة وقائية وتصحيحية بقطع أصلية.', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('391a9c3a-5e55-5105-8877-a55908d12f0b', 'ar', 'formation-personnel', 'تكوين الطاقم الطبي', 'graduation-cap', 'تكوين حول استخدام المعدات في الموقع أو بمقرنا.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bb95a833-edb8-5f8d-81a0-be49e55d4c9a', 'ar', 'conseil-ingenierie', 'الاستشارة والهندسة الطبية', 'clipboard', 'دراسة الاحتياجات والمرافقة في طلبات العروض.', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Partenaires
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `partners` (`id`, `locale`, `name`, `category`, `website`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
('e4cc6902-2506-5e8f-b725-74e97c574a6a', 'fr', 'MediTech Algérie', 'Distributeur', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0b39145c-c237-5ab8-ac2f-0ea20f8389ca', 'fr', 'Mindray — Représentant officiel Algérie', 'Fabricant', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('826d523c-3fe0-58bf-b729-27d45ff2855b', 'fr', 'Philips Healthcare', 'Fabricant', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7ddc8c40-7b7e-575b-935e-2f8b48b984d9', 'fr', 'GE Healthcare', 'Fabricant', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('79fc8127-d274-5b4c-bf5f-bbac34fdf939', 'fr', 'HealForce Medical', 'Fabricant', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('df24c710-c196-511d-b20d-f514ef5fcbed', 'en', 'MediTech Algeria', 'Distributor', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('42ef285e-59af-5559-b92d-d5ccfcb749fd', 'en', 'Mindray — Official representative in Algeria', 'Manufacturer', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7d203814-a087-5ac0-b0bf-653bef81dd0b', 'en', 'Philips Healthcare', 'Manufacturer', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('9d0f3232-2053-538c-b1ae-3a1cba6aa931', 'en', 'GE Healthcare', 'Manufacturer', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('1150a50b-9e2c-5dfb-a95e-b003df465a4e', 'en', 'HealForce Medical', 'Manufacturer', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('65cb36a6-1ae0-5e86-8cb3-34387d292af7', 'ar', 'ميديتك الجزائر', 'موزع', 'https://meditech.dz', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d66ec29f-3ea9-5b02-a5cb-047d6b35955c', 'ar', 'مايندراي — الممثل الرسمي في الجزائر', 'مصنع', 'https://mindray.com', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5b991b2e-2198-563a-9e10-503942f5719e', 'ar', 'فيليبس للرعاية الصحية', 'مصنع', 'https://philips.com', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('eff83e94-99cf-5d8c-ab74-135fae4cb796', 'ar', 'جي إي للرعاية الصحية', 'مصنع', 'https://gehealthcare.com', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('88b62c15-7362-5f08-a243-b22d6801828c', 'ar', 'هيل فورس الطبية', 'مصنع', 'https://healforce.com', 5, 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Carrières
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `careers` (`id`, `locale`, `slug`, `title`, `type`, `location`, `salary`, `shortDesc`, `legacyId`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
('eef71785-0a34-5e02-a476-2ce51123494a', 'fr', 'technicien-biomedical', 'Technicien Biomédical H/F', 'CDI', 'Alger', '45 000 - 70 000 DZD', 'Maintenance et installation des équipements médicaux.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('cda65a07-d143-5198-a1b5-3a906c001463', 'fr', 'ingenieur-commercial-medical', 'Ingénieur Commercial Médical', 'CDI', 'Oran', '60 000 - 90 000 DZD', 'Développement du portefeuille clients (hôpitaux, cliniques).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('958769c9-fb53-5a64-8179-c6f2a14386e0', 'fr', 'responsable-logistique', 'Responsable Logistique', 'CDD', 'Blida', '50 000 - 75 000 DZD', 'Gestion des stocks et de la distribution sur les 58 wilayas.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('5d1c8e6e-2c2d-5fe3-94eb-c372a7b5c3e6', 'fr', 'technico-commercial-imagerie', 'Technico-Commercial Imagerie Médicale', 'CDI', 'Constantine', '55 000 - 85 000 DZD', 'Vente et démonstration des solutions d''imagerie.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('9375556b-1fb0-5d6f-b9e5-5da2477dadd6', 'en', 'biomedical-technician', 'Biomedical Technician (M/F)', 'Permanent', 'Algiers', 'DZD 45,000 - 70,000', 'Maintenance and installation of medical equipment.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ef3d9616-f954-53ac-92f7-bb69b23b0c90', 'en', 'medical-sales-engineer', 'Medical Sales Engineer', 'Permanent', 'Oran', 'DZD 60,000 - 90,000', 'Develop the client portfolio (hospitals, clinics).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ea8330f5-29e9-55fe-a333-fe640c6078e3', 'en', 'logistics-manager', 'Logistics Manager', 'Contract', 'Blida', 'DZD 50,000 - 75,000', 'Stock and distribution management across the 58 wilayas.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('df612f71-10ca-52b9-afa2-ea678b526e76', 'en', 'imaging-sales-specialist', 'Medical Imaging Sales Specialist', 'Permanent', 'Constantine', 'DZD 55,000 - 85,000', 'Sales and demo of imaging solutions.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('30adb374-fe38-5cfd-a1c4-21f2ab0ee11f', 'ar', 'technicien-biomedical', 'تقني بيوطبي (م/ج)', 'عقد دائم', 'الجزائر', '45,000 - 70,000 دج', 'صيانة وتركيب المعدات الطبية.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('eaac1468-5a79-5d86-9b2d-1d6c64f232ad', 'ar', 'ingenieur-commercial-medical', 'مهندس تجاري طبي', 'عقد دائم', 'وهران', '60,000 - 90,000 دج', 'تطوير محفظة العملاء (مستشفيات، عيادات).', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b4e5168f-4bf5-5cc6-8086-ec7f9ad59b47', 'ar', 'responsable-logistique', 'مسؤول اللوجستيك', 'عقد محدد', 'البليدة', '50,000 - 75,000 دج', 'إدارة المخزون والتوزيع عبر 58 ولاية.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('069a1e31-efd1-589a-83d2-e13f5c1a1786', 'ar', 'technico-commercial-imagerie', 'تقني تجاري في التصوير الطبي', 'عقد دائم', 'قسنطينة', '55,000 - 85,000 دج', 'بيع وعرض حلول التصوير الطبي.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Solutions
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `solutions` (`id`, `locale`, `slug`, `title`, `shortDesc`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
('7b61ca63-c0e2-57b2-a888-29271fcde80e', 'fr', 'diagnostic', 'Diagnostic & Imagerie', 'Échographes, tensiomètres et appareils de diagnostic de proximité.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bf70aff2-599a-5bc6-81d4-438a896c3de1', 'fr', 'cardiology', 'Cardiologie', 'ECG, défibrillateurs et moniteurs cardiaques.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8697702f-dea6-5b8a-afbd-30be58c7274f', 'fr', 'imaging', 'Imagerie Médicale', 'Radiologie, scanner et solutions d''imagerie.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('11e16393-3e12-5e97-91f1-a92a241cb928', 'fr', 'surgery', 'Chirurgie', 'Instruments, autoclaves et tables opératoires.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('79d49a73-26b9-5eb0-9920-98497623dc7a', 'fr', 'pediatrics', 'Pédiatrie', 'Couveuses, balances et lampes de photothérapie.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('42f4cb79-43ad-5c4b-a65a-95da0059cb79', 'fr', 'emergency', 'Urgence & Réanimation', 'Défibrillateurs, chariots d''urgence et ventilation.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bbf7392b-781e-57bc-9222-ff72f45538f7', 'fr', 'informatics', 'Informatique Médicale', 'DMP, télémédecine et PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f3f494af-a3b0-57ba-a628-8cceb05040b8', 'fr', 'laboratory', 'Laboratoire', 'Analyseurs, microscopes et centrifugeuses.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c218f72e-8553-5f66-98f3-088b0d362b28', 'fr', 'rehabilitation', 'Rééducation', 'Tables de kinésithérapie et électrothérapie.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d74bdb27-f12e-5fea-98b6-91a66fd6397c', 'en', 'diagnostic', 'Diagnostics & Imaging', 'Ultrasound, blood pressure monitors and point-of-care devices.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('c5f6c168-a52c-55f0-987b-b1c9ad608ad4', 'en', 'cardiology', 'Cardiology', 'ECG, defibrillators and cardiac monitors.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f5bd1020-d92d-59a4-99af-e5e0b0da7064', 'en', 'imaging', 'Medical Imaging', 'Radiology, CT and imaging solutions.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b7dbab68-c7b2-52db-a778-c5c80bd748e9', 'en', 'surgery', 'Surgery', 'Instruments, autoclaves and operating tables.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('acd0adae-68e5-5868-b06b-670350a64a2a', 'en', 'pediatrics', 'Pediatrics', 'Incubators, scales and phototherapy lamps.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b07717b0-d5fa-58ab-91da-dcff9e82ba86', 'en', 'emergency', 'Emergency & Intensive Care', 'Defibrillators, crash carts and ventilation.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7999a57d-4e61-5401-8935-58eda3fbe7dd', 'en', 'informatics', 'Medical Informatics', 'EMR, telemedicine and PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('59162174-07c8-58f4-8b03-d5949b7f3528', 'en', 'laboratory', 'Laboratory', 'Analyzers, microscopes and centrifuges.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('74c37c7b-b6e6-58dc-8461-34359e7f0d08', 'en', 'rehabilitation', 'Rehabilitation', 'Physiotherapy tables and electrotherapy.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8addd701-52a7-551d-99a6-4f0a2621bff8', 'ar', 'diagnostic', 'التشخيص والتصوير', 'أجهزة الموجات فوق الصوتية وأجهزة قياس الضغط وأجهزة التشخيص.', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('1a006644-8137-53d6-8182-19b63f8986be', 'ar', 'cardiology', 'أمراض القلب', 'تخطيط القلب وأجهزة الصدمات وشاشات القلب.', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('cc90f293-b9e2-5db3-a062-f2662af8d050', 'ar', 'imaging', 'التصوير الطبي', 'الأشعة والماسح الضوئي وحلول التصوير.', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('108031d2-ad8c-53b1-9eb8-a63f5f557008', 'ar', 'surgery', 'الجراحة', 'الأدوات والمعقمات وطاولات العمليات.', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8c52c43b-f8c3-56dc-9015-29766f045b7f', 'ar', 'pediatrics', 'طب الأطفال', 'الحضانات والموازين ومصابيح العلاج الضوئي.', 5, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('aca45bcc-8778-5cc6-b96e-10e53c5c7bd6', 'ar', 'emergency', 'الطوارئ والإنعاش', 'أجهزة الصدمات وعربات الطوارئ والتهوية.', 6, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('dac36373-6078-5b08-8fda-32886591c767', 'ar', 'informatics', 'المعلوماتية الطبية', 'الملف الطبي والتطبيب عن بعد وأنظمة PACS/RIS.', 7, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('95d9fc9c-ac87-5ec1-9ea0-217b4cad2ab3', 'ar', 'laboratory', 'المختبر', 'أجهزة التحليل والمجاهر وأجهزة الطرد المركزي.', 8, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b9f26910-216b-5706-a27f-52ded77cba81', 'ar', 'rehabilitation', 'إعادة التأهيل', 'طاولات العلاج الطبيعي والعلاج الكهربائي.', 9, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Témoignages
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `testimonials` (`id`, `locale`, `name`, `role`, `clinic`, `text`, `rating`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
('1c117e9e-715e-5faf-9d8a-1aab38d37f9c', 'fr', 'Dr. Amine KHALFI', 'Directeur Médical', 'Clinique El Afia, Alger', 'SARI Système nous accompagne depuis 10 ans. Réactivité et qualité des équipements exceptionnelles, avec un SAV toujours disponible.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d8044108-bb46-53bd-b393-6d6548bfd3c8', 'fr', 'Dr. Salima BOUZID', 'Cheffe de service Imagerie', 'CHU Mustapha Pacha, Alger', 'Installation rapide et formation du personnel très professionnelle. Un partenaire de confiance pour notre service.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7e483051-0c75-5ec2-a7fa-a82398fdcbd1', 'fr', 'Dr. Yacine HAMDI', 'Cardiologue', 'Clinique Ibn Rochd, Oran', 'Le moniteur et le défibrillateur livrés étaient conformes et parfaitement calibrés. Je recommande vivement.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('de22cbae-dbe7-5e17-bf35-56799f9fccd1', 'fr', 'Dr. Nadia MERABET', 'Pharmacienne Hospitalière', 'EPH Beni Messous, Alger', 'Un accompagnement de A à Z, de l''étude du besoin jusqu''à la maintenance. Très satisfaite du suivi.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b716ee6a-f55b-5ad6-bf68-c9d047c440e5', 'en', 'Dr. Amine KHALFI', 'Medical Director', 'El Afia Clinic, Algiers', 'SARI Système has supported us for 10 years. Outstanding responsiveness and equipment quality with an always-available after-sales service.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d57ca588-3557-5706-bc42-e872372be891', 'en', 'Dr. Salima BOUZID', 'Head of Imaging', 'Mustapha Pacha University Hospital, Algiers', 'Fast installation and very professional staff training. A trusted partner for our department.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b278ca3c-0e2c-5e47-9370-9e2fb5f8cd4c', 'en', 'Dr. Yacine HAMDI', 'Cardiologist', 'Ibn Rochd Clinic, Oran', 'The monitor and defibrillator delivered were compliant and perfectly calibrated. Highly recommended.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a005ffa9-3249-5cba-ad54-8073ba75dfca', 'en', 'Dr. Nadia MERABET', 'Hospital Pharmacist', 'Beni Messous EPH, Algiers', 'End-to-end support from needs assessment to maintenance. Very satisfied.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('dcc5905c-e619-58cf-8443-ba5494e01ca0', 'ar', 'د. أمين خالفي', 'المدير الطبي', 'عيادة العافية، الجزائر', 'ترافقنا ساري سيستم منذ 10 سنوات. سرعة الاستجابة وجودة المعدات استثنائية مع خدمة ما بعد البيع متاحة دائمًا.', 5, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('abd3c06a-bead-5d34-be78-039d888c1f08', 'ar', 'د. سليمة بوزيد', 'رئيسة مصلحة التصوير', 'المستشفى الجامعي مصطفى باشا، الجزائر', 'تركيب سريع وتكوين احترافي للطاقم. شريك موثوق لمصلحتنا.', 5, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('23ed39b4-63e8-566a-831d-9cbb0bb904f6', 'ar', 'د. ياسين حمدي', 'طبيب قلب', 'عيادة ابن رشد، وهران', 'الشاشة وجهاز الصدمات المسلّمان كانا مطابقين ومعايرين بشكل مثالي. أنصح بهما بشدة.', 5, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('d747d500-1165-53f2-a5f2-020caf0cc855', 'ar', 'د. نادية مرابط', 'صيدلانية استشفائية', 'المؤسسة العمومية الاستشفائية بني مسوس، الجزائر', 'مرافقة شاملة من دراسة الحاجة إلى الصيانة. راضية جدًا عن المتابعة.', 4, 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Hero slides
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `hero_slides` (`id`, `locale`, `title`, `subtitle`, `description`, `cta`, `ctaLink`, `sortOrder`, `legacyId`, `status`, `createdAt`, `updatedAt`) VALUES
('5e94ab3b-445e-5765-a411-f8871e893bcc', 'fr', 'Équipements Médicaux de Pointe', 'Distribution et installation sur les 58 wilayas', 'Nous accompagnons hôpitaux, cliniques et cabinets avec des équipements certifiés et un service de proximité.', 'Découvrir nos solutions', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b3542df1-9ba8-5938-8e0a-f24f7c09bb26', 'fr', 'Service Après-Vente 24/7', 'Techniciens agréés dans toute l''Algérie', 'Maintenance préventive et corrective avec pièces d''origine.', 'Nos services', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ba325458-0e3c-5268-bf44-95b52af083e4', 'fr', 'Partenaires des Grands Fabricants', 'Représentation officielle en Algérie', 'Mindray, Philips, GE Healthcare et bien d''autres.', 'Voir le catalogue', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('58f68ec2-0cc6-560d-b5c2-c0ddbc2f1ae9', 'en', 'State-of-the-Art Medical Equipment', 'Distribution and installation across the 58 wilayas', 'We support hospitals, clinics and practices with certified equipment and local service.', 'Discover our solutions', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0d0b38df-5470-5297-b9ab-ded0fb482f96', 'en', '24/7 After-Sales Service', 'Certified technicians across Algeria', 'Preventive and corrective maintenance with original parts.', 'Our services', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('aa0489c9-d24f-554d-8bf9-64edf372e49b', 'en', 'Partners of Leading Manufacturers', 'Official representation in Algeria', 'Mindray, Philips, GE Healthcare and more.', 'View catalog', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('fdf0b1e3-ed79-5f24-975c-f2fab934d1ec', 'ar', 'معدات طبية متطورة', 'التوزيع والتركيب عبر 58 ولاية', 'نرافق المستشفيات والعيادات بمعدات معتمدة وخدمة قريبة.', 'اكتشف حلولنا', '/solutions', 1, 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f8db8c9e-49c8-5302-835e-e9887c8a1762', 'ar', 'خدمة ما بعد البيع 24/7', 'تقنيون معتمدون في كامل التراب الوطني', 'صيانة وقائية وتصحيحية بقطع أصلية.', 'خدماتنا', '/services', 2, 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('17021133-8447-510c-985e-649213878c0c', 'ar', 'شركاء كبار المصنعين', 'تمثيل رسمي في الجزائر', 'مايندراي، فيليبس، جي إي للرعاية الصحية وغيرها.', 'تصفح الكتالوج', '/products', 3, 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Actualités
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `news_articles` (`id`, `locale`, `slug`, `title`, `category`, `classification`, `sujet`, `authorName`, `date`, `readTime`, `shortDesc`, `fullContent`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
('487ca1e2-99cb-53cd-889e-77ed0fe8e720', 'fr', 'participation-simem-2026', 'SARI Système au SIMEM 2026', 'Événement', 'Salon', 'Salon médical', 'SARI Système', '2026-04-10 09:00:00.000', '3 min', 'Retrouvez-nous au Salon International du Médical, SAFEX Alger.', '<p>SARI Système exposera ses dernières solutions d''imagerie et de réanimation au SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e8e7a95a-4dc5-5252-9c29-5a51304005cb', 'fr', 'nouvelle-gamme-echographes-portables', 'Nouvelle gamme d''échographes portables', 'Produits', 'Innovation', 'Imagerie', 'SARI Système', '2026-03-02 09:00:00.000', '4 min', 'Échographes portables avec IA intégrée pour la médecine de proximité.', '<p>Une gamme compacte et connectée, pensée pour les structures mobiles et les zones éloignées.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('f5389865-840b-5fc7-9ddc-3d91fcaf73e4', 'fr', 'partenariat-chu-mustapha-pacha', 'Partenariat avec le CHU Mustapha Pacha', 'Institutionnel', 'Partenariat', 'Santé publique', 'SARI Système', '2026-01-20 09:00:00.000', '2 min', 'Équipement du service d''imagerie du CHU d''Alger.', '<p>Signature d''une convention pour l''équipement et la maintenance du plateau d''imagerie.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('05be3743-1117-5f8e-9098-8a4ac7816d36', 'en', 'sari-systeme-at-simem-2026', 'SARI Système at SIMEM 2026', 'Event', 'Trade show', 'Medical fair', 'SARI Système', '2026-04-10 09:00:00.000', '3 min', 'Meet us at the International Medical Exhibition, SAFEX Algiers.', '<p>SARI Système will showcase its latest imaging and intensive care solutions at SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('fe9e71d1-e324-50c4-9de6-3b48708bc127', 'en', 'new-portable-ultrasound-range', 'New portable ultrasound range', 'Products', 'Innovation', 'Imaging', 'SARI Système', '2026-03-02 09:00:00.000', '4 min', 'Portable ultrasounds with built-in AI for point-of-care medicine.', '<p>A compact, connected range designed for mobile units and remote areas.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('e4f63e08-cc8e-5962-b7ca-9e1714467b02', 'en', 'partnership-with-mustapha-pacha-hospital', 'Partnership with Mustapha Pacha University Hospital', 'Institutional', 'Partnership', 'Public health', 'SARI Système', '2026-01-20 09:00:00.000', '2 min', 'Equipping the imaging department of the Algiers hospital.', '<p>Signing of an agreement to equip and maintain the imaging platform.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('bb0707ae-0d24-5619-a503-304040616b78', 'ar', 'participation-simem-2026', 'ساري سيستم في SIMEM 2026', 'حدث', 'معرض', 'المعرض الطبي', 'SARI Système', '2026-04-10 09:00:00.000', '3 د', 'زورونا في الصالون الدولي للطب، قصر المعارض SAFEX الجزائر.', '<p>ستعرض ساري سيستم أحدث حلول التصوير والإنعاش في SIMEM 2026.</p>', 'published', '2026-04-10 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b10f1fff-1f68-5ee8-808e-6a5f0c2290a3', 'ar', 'nouvelle-gamme-echographes-portables', 'تشكيلة جديدة من أجهزة الموجات فوق الصوتية المحمولة', 'منتجات', 'ابتكار', 'التصوير', 'SARI Système', '2026-03-02 09:00:00.000', '4 د', 'أجهزة محمولة بذكاء اصطناعي مدمج للطب القريب.', '<p>تشكيلة مدمجة ومتصلة، مصممة للوحدات المتنقلة والمناطق النائية.</p>', 'published', '2026-03-02 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('01b0b262-dcb4-5940-b877-fdd5f939126b', 'ar', 'partenariat-chu-mustapha-pacha', 'شراكة مع المستشفى الجامعي مصطفى باشا', 'مؤسساتي', 'شراكة', 'الصحة العمومية', 'SARI Système', '2026-01-20 09:00:00.000', '2 د', 'تجهيز مصلحة التصوير بمستشفى الجزائر.', '<p>توقيع اتفاقية لتجهيز وصيانة منصة التصوير.</p>', 'published', '2026-01-20 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Événements
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `events` (`id`, `locale`, `slug`, `title`, `type`, `date`, `location`, `shortDesc`, `status`, `publishedAt`, `createdAt`, `updatedAt`) VALUES
('30fbf52e-0391-5041-b65c-bcc33035e0e9', 'fr', 'simem-2026', 'SIMEM 2026 — Salon International du Médical', 'Salon', '2026-04-15 09:00:00.000', 'SAFEX, Pins Maritimes, Alger', 'Stand B12 — démonstrations d''imagerie et de réanimation.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3d56eda1-7ce5-556b-a32a-ee915819164a', 'fr', 'journees-medicales-alger', 'Journées Médicales d''Alger', 'Congrès', '2026-06-05 09:00:00.000', 'Hôtel El Aurassi, Alger', 'Conférence sur les nouvelles technologies biomédicales.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('7b7e0755-98c1-5bc3-8db2-4af814455b75', 'fr', 'forum-sante-oran', 'Forum Santé Oran', 'Forum', '2026-09-18 09:00:00.000', 'Centre des Conventions d''Oran', 'Rencontres avec les professionnels de la santé de l''Ouest.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4a3351a2-4a68-5dc7-a2c7-48c517582aee', 'en', 'simem-2026', 'SIMEM 2026 — International Medical Exhibition', 'Trade show', '2026-04-15 09:00:00.000', 'SAFEX, Pins Maritimes, Algiers', 'Booth B12 — imaging and intensive care demos.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('0f11e088-b6fb-5909-9ba8-918de747cb1f', 'en', 'algiers-medical-days', 'Algiers Medical Days', 'Congress', '2026-06-05 09:00:00.000', 'El Aurassi Hotel, Algiers', 'Conference on new biomedical technologies.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b047c290-0bf9-5ce9-99e9-b23f2f1c2caa', 'en', 'oran-health-forum', 'Oran Health Forum', 'Forum', '2026-09-18 09:00:00.000', 'Oran Convention Centre', 'Meetings with Western Algeria healthcare professionals.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('b65df936-8076-5a93-8056-d231db030931', 'ar', 'simem-2026', 'SIMEM 2026 — الصالون الدولي للطب', 'معرض', '2026-04-15 09:00:00.000', 'قصر المعارض SAFEX، الصنوبر البحري، الجزائر', 'الجناح B12 — عروض التصوير والإنعاش.', 'published', '2026-04-15 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('2b5c515b-8da3-5b0a-af70-fb86fa1d24ec', 'ar', 'journees-medicales-alger', 'الأيام الطبية للجزائر', 'مؤتمر', '2026-06-05 09:00:00.000', 'فندق الأوراسي، الجزائر', 'محاضرة حول التقنيات الطبية الحيوية الجديدة.', 'published', '2026-06-05 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('212c9ad4-222a-5272-baf6-13f7dd937bdd', 'ar', 'forum-sante-oran', 'منتدى الصحة بوهران', 'منتدى', '2026-09-18 09:00:00.000', 'مركز المؤتمرات، وهران', 'لقاءات مع مهنيي الصحة في الغرب الجزائري.', 'published', '2026-09-18 09:00:00.000', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `faqs` (`id`, `locale`, `question`, `answer`, `category`, `sortOrder`, `status`, `createdAt`, `updatedAt`) VALUES
('196ced71-e946-56ee-bcb6-c41140d34b4f', 'fr', 'Livrez-vous sur tout le territoire algérien ?', 'Oui, nous livrons sur les 58 wilayas. Les délais varient de 3 à 15 jours ouvrés selon la wilaya et la disponibilité du produit.', 'Livraison', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('9693c2b4-bb5d-5582-aa23-05a408126f12', 'fr', 'Quels sont les modes de paiement acceptés ?', 'Virement bancaire, chèque, carte CIB / Edahabia et paiement à la livraison selon accord préalable.', 'Paiement', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('26d208dd-e3bf-56d0-9ba9-6fc3925bdb75', 'fr', 'Les prix sont-ils affichés en dinar algérien ?', 'Oui, tous nos prix sont en Dinar Algérien (DZD), hors TVA (19% ou 9% selon les produits).', 'Tarifs', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('6628360a-747f-536d-b9b1-62a68b39db78', 'fr', 'Proposez-vous une garantie et un service après-vente ?', 'Oui, garantie constructeur de 12 à 36 mois et SAV assuré par nos techniciens agréés sur l''ensemble du territoire.', 'Garantie', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('162e0461-2a66-5a7d-b94d-8a0af2fc0d61', 'en', 'Do you deliver across Algeria?', 'Yes, we deliver to all 58 wilayas. Lead times range from 3 to 15 business days.', 'Delivery', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('02169a30-6605-5be1-9556-8ab7ac415c82', 'en', 'Which payment methods are accepted?', 'Bank transfer, cheque, CIB / Edahabia card and cash on delivery subject to prior agreement.', 'Payment', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('393dbb81-e93d-58ff-ad83-92cd015ac55e', 'en', 'Are prices displayed in Algerian Dinar?', 'Yes, all prices are in Algerian Dinar (DZD), VAT excluded (19% or 9%).', 'Pricing', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('a6d7f4e8-1960-5c10-9605-aaaba4b77f73', 'en', 'Do you provide warranty and after-sales service?', 'Yes, 12 to 36 months manufacturer warranty with nationwide after-sales support.', 'Warranty', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('8c2266c6-916c-5e89-aa32-f5e52b02a52f', 'ar', 'هل توصلون عبر كامل التراب الجزائري؟', 'نعم، نوصل إلى جميع الولايات الـ58. تتراوح الآجال بين 3 و15 يوم عمل.', 'التوصيل', 1, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('45dcc9f1-399c-52db-9402-d85c67017f4f', 'ar', 'ما هي وسائل الدفع المقبولة؟', 'تحويل بنكي، شيك، بطاقة CIB / الذهبية والدفع عند الاستلام بموافقة مسبقة.', 'الدفع', 2, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('13ce1e9e-7b3d-5c20-99a0-99933c922f93', 'ar', 'هل الأسعار معروضة بالدينار الجزائري؟', 'نعم، جميع أسعارنا بالدينار الجزائري (DZD)، دون احتساب الرسم على القيمة المضافة (19% أو 9%).', 'الأسعار', 3, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('ddf3a7dd-5b84-5afa-bd67-2f4045293947', 'ar', 'هل توفرون ضمانًا وخدمة ما بعد البيع؟', 'نعم، ضمان المصنع من 12 إلى 36 شهرًا وخدمة ما بعد البيع عبر كامل التراب الوطني.', 'الضمان', 4, 'published', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Messages de contact
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `contact_messages` (`id`, `name`, `email`, `phone`, `subject`, `message`, `status`, `createdAt`, `updatedAt`) VALUES
('b505823f-178d-5901-ab04-5af02745981d', 'Dr. Farid MEZIANE', 'farid.meziane@polyclinique.dz', '(+213) 21 44 55 66', 'devis', 'Bonjour, je souhaite un devis pour 3 moniteurs multiparamétriques et 2 défibrillateurs.', 'new', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('4cb789a3-2f84-5b18-a8ca-9b922d30da08', 'Mme. Karima BENSAID', 'k.bensaid@clinique-sante.dz', '(+213) 550 11 22 33', 'sav', 'Nous avons besoin d''une intervention de maintenance sur notre autoclave.', 'read', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('3c833ad9-72a0-5193-af60-1220384176e5', 'M. Rachid HADDAD', 'r.haddad@cabinet.dz', '(+213) 770 44 55 66', 'partenariat', 'Je souhaite devenir revendeur agréé dans la wilaya de Sétif.', 'new', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `settings` (`id`, `key`, `value`, `group`, `createdAt`, `updatedAt`) VALUES
('68a0fffe-18d2-52b1-8ff9-aba7e9f32b17', 'site_logo', '{"url":""}', 'general', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('22bb3176-0b49-5531-ba65-f31ff4b7d982', 'require_auth_to_apply', '{"enabled":false}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('9813cab8-c673-5e6f-b94a-7ee6d4e9e0fa', 'restock_message', '{"message":"Votre commande sera traitée dans les meilleurs délais. Nouvel arrivage prévu le {{date_reapprovisionnement}}."}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000'),
('69486baf-429e-56fb-a90b-caae22818d69', 'code_formats', '{"quote":"SARI-WDEV-{ID}","order":"SARI-WCMD{XX}-{ID}","invoice":"SARI-WFAV{XX}-{ID}","product":"SARI-WPRO{XX}-{ID}"}', 'commerce', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');

-- ---------------------------------------------------------------------------
-- Journal d'audit (entrée de démarrage)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `audit_logs` (`id`, `actorId`, `action`, `resource`, `resourceId`, `payload`, `createdAt`, `updatedAt`) VALUES ('05d85cf8-fc2d-5451-be5e-e1d393846ffe', 'd9678792-4ed1-548f-876d-0455618d08a2', 'seed', 'database', NULL, '{"driver":"mysql","locales":["fr","en","ar"]}', '2026-08-21 10:00:00.000', '2026-08-21 10:00:00.000');
