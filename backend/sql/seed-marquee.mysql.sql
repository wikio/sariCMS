-- backend/sql/seed-marquee.mysql.sql
--
-- Exemples du bloc « Bandeau défilant » de la page d'accueil, en base.
-- Trois réglages volontairement différents, pour voir le module travailler :
--   fr : mélange actualités + événements + partenaires, deux blocs du studio,
--        carte autour de chaque élément, pas de titre au-dessus du bandeau ;
--   en : actualités seules, éléments en « texte + image » dans une boîte de
--        112 px, titre d'en-tête affiché ;
--   ar : blocs du studio uniquement (aucune fiche de module), pastilles, sens
--        de défilement inversé pour l'écriture droite → gauche.
--
-- Rien n'est recopié depuis les modules : les lignes ne stockent qu'une
-- sélection (`selection`) et des réglages, la vitrine relit les fiches à chaque
-- rendu. Un `home_sections` déjà peuplé pour (key, locale) est remis à jour :
-- la clé unique `key`+`locale` fait foi.
--
--   mysql -u utilisateur -p base < backend/sql/seed-marquee.mysql.sql

INSERT INTO `home_sections`
  (`key`, `locale`, `label`, `enabled`, `sortOrder`, `texts`, `selection`, `settings`, `style`, `items`, `status`)
VALUES
  ('partners-marquee', 'fr', 'Bandeau défilant (marques, actualités, blocs libres)', 1, 1, '{"label": "Ce qui se passe chez SARI"}', '{"mode": "auto", "ids": [], "limit": 6, "sort": "byDateDesc"}', '{"source": "mixed", "mixedSources": "news,events,partners", "itemKind": "auto", "appendFree": true, "showImage": true, "showTitle": true, "showText": true, "itemHeight": 72, "mediaWidth": 0, "mediaRadius": 10, "mediaGap": 12, "textSize": "base", "textLines": 2, "itemGap": 40, "itemPadding": 12, "marginTop": 24, "marginBottom": 24, "valign": "middle", "cardStyle": "card", "edgeFade": true, "linkItems": true, "showSeparator": false, "speed": 40, "pauseOnHover": true}', '{"background": "white", "paddingY": 40, "invert": false, "showHeader": false}', '[{"id": "item-exemple-atelier", "from": "free", "kind": "image-text", "enabled": true, "title": "Atelier CMS, le 14 octobre", "text": "Deux heures pour reprendre la main sur vos pages.", "image": "/media/marquee/atelier.svg", "href": "/events"}, {"id": "item-exemple-support", "from": "free", "kind": "text", "enabled": true, "title": "Un numéro de téléphone, pas un ticket.", "href": "/contact"}]', 'published'),
  ('partners-marquee', 'en', 'Scrolling band (brands, news, studio blocks)', 1, 1, '{"label": "Latest news", "title": "What the newsroom is working on", "description": "Every tile links to its article."}', '{"mode": "auto", "ids": [], "limit": 8, "sort": "byDateDesc"}', '{"source": "news", "itemKind": "image-text", "showImage": true, "showTitle": true, "showText": true, "itemHeight": 64, "mediaWidth": 112, "mediaFit": "cover", "mediaRadius": 8, "mediaGap": 14, "textSize": "base", "textLines": 2, "itemGap": 48, "itemPadding": 0, "marginTop": 8, "marginBottom": 8, "valign": "middle", "cardStyle": "plain", "edgeFade": true, "linkItems": true, "showSeparator": true, "separator": "/", "speed": 45, "direction": "left", "pauseOnHover": true}', '{"background": "sariGray", "paddingY": 40, "invert": false, "showHeader": true}', '[{"id": "item-exemple-atelier", "from": "free", "kind": "image-text", "enabled": true, "title": "Innovation award, 2026", "text": "For the open CMS we ship with this site.", "image": "/media/marquee/prix-innovation.svg", "href": "/about"}, {"id": "item-exemple-support", "from": "free", "kind": "text", "enabled": true, "title": "Support on the phone, not in a ticket queue.", "href": "/contact"}]', 'published'),
  ('partners-marquee', 'ar', 'شريط متحرك (علامات، أخبار، كتل الاستوديو)', 1, 1, '{"label": "أخبار مختصرة"}', '{"mode": "auto", "ids": [], "limit": 6, "sort": "manual"}', '{"source": "custom", "itemKind": "auto", "showImage": true, "showTitle": true, "showText": true, "itemHeight": 56, "mediaWidth": 0, "mediaRadius": 8, "mediaGap": 10, "textSize": "base", "textLines": 2, "itemGap": 32, "itemPadding": 8, "marginTop": 16, "marginBottom": 16, "valign": "middle", "cardStyle": "chip", "edgeFade": true, "linkItems": true, "showSeparator": false, "speed": 35, "direction": "right", "pauseOnHover": true}', '{"background": "blue", "paddingY": 32, "invert": true, "showHeader": false}', '[{"id": "item-exemple-atelier", "from": "free", "kind": "image-text", "enabled": true, "title": "ورشة عن نظام إدارة المحتوى", "text": "ساعتان للتحكم الكامل في صفحاتك.", "image": "/media/marquee/webinaire.svg", "href": "/events"}, {"id": "item-exemple-support", "from": "free", "kind": "text", "enabled": true, "title": "دعم هاتفي، دون انتظار تذكرة.", "href": "/contact"}, {"id": "item-exemple-recrute", "from": "free", "kind": "image", "enabled": true, "title": "نحن نوظف", "image": "/media/marquee/recrute.svg", "href": "/jobs"}]', 'published')
ON DUPLICATE KEY UPDATE
  `label`     = VALUES(`label`),
  `enabled`   = VALUES(`enabled`),
  `sortOrder` = VALUES(`sortOrder`),
  `texts`     = VALUES(`texts`),
  `selection` = VALUES(`selection`),
  `settings`  = VALUES(`settings`),
  `style`     = VALUES(`style`),
  `items`     = VALUES(`items`),
  `status`    = VALUES(`status`);

-- Pour repartir de zéro :
-- DELETE FROM `home_sections` WHERE `key` = 'partners-marquee';
