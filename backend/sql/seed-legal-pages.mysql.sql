-- ---------------------------------------------------------------------------
-- SARI CMS — documents légaux dans la table `pages`
--
-- FICHIER GÉNÉRÉ : ne pas modifier à la main.
-- Source   : data/{fr,en,ar}/legal.json
-- Générer  : node backend/sql/generate-seed-legal.mjs   (npm run sql:seed-legal)
-- Importer : mysql -u utilisateur -p base < backend/sql/seed-legal-pages.mysql.sql
-- Vérifier : node backend/sql/test-seed-legal-sql.mjs
--
-- 12 lignes (3 langues × 4 documents). Chaque document
-- porte sa famille (`kind = 'legal'`) et son type (`category`), ce qui les rend
-- visibles dans Administration → Pages légales et publiés sur /{langue}/legal/{type}.
--
-- Rejouable et prudent : ON DUPLICATE KEY UPDATE (clé unique slug + locale) ne
-- réécrit JAMAIS un `content` ni un `title` déjà renseignés. On relance donc ce
-- fichier sans risque après une suppression accidentelle ou sur une base
-- existante ; seul un document vide reçoit le texte du JSON.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Avant : ce que l'administration voit
--
-- Une base saine répond « 4 » pour chaque langue. Un « 0 » signifie que les
-- documents existent peut-être en base, mais sous une famille que l'écran ne
-- filtre pas — c'est le cas nº 2 ci-dessous.
-- ---------------------------------------------------------------------------
SELECT `locale` AS langue, COUNT(*) AS documents_legaux_vus_par_l_admin
  FROM `pages`
 WHERE `kind` = 'legal' AND `deletedAt` IS NULL
 GROUP BY `locale`
 ORDER BY `locale`;

-- ---------------------------------------------------------------------------
-- 2. Après-coup : les lignes qui étaient là sans être déclarées
--
-- Trois origines connues : une fiche créée à la main dans « Pages CMS » avec la
-- famille « Légal » oubliée, un `category` saisi en clair (« Mentions légales »
-- au lieu de « mentions »), ou un import ancien qui écrivait la fiche À propos
-- en `kind = 'about'`. Ces lignes étaient en base et invisibles. On ne corrige
-- que ce qui est certain — une catégorie qui porte déjà l'un des quatre types,
-- ou une famille « legal » sans catégorie — et le contenu n'est touché par
-- aucune de ces corrections.
-- ---------------------------------------------------------------------------
UPDATE `pages`
   SET `kind` = 'legal'
 WHERE `deletedAt` IS NULL
   AND `kind` <> 'legal'
   AND LOWER(COALESCE(`category`, '')) IN ('mentions', 'privacy', 'conditions', 'about');

UPDATE `pages`
   SET `category` = LOWER(`slug`)
 WHERE `deletedAt` IS NULL
   AND `kind` = 'legal'
   AND IFNULL(LOWER(`category`), '') NOT IN ('mentions', 'privacy', 'conditions', 'about')
   AND LOWER(`slug`) IN ('mentions', 'privacy', 'conditions', 'about');

-- Une catégorie écrite en toutes lettres (« Mentions légales ») n'est pas un
-- type de document au sens du site : la ramener à la valeur attendue évite que
-- la fiche existe, publiée, et ne s'affiche nulle part.
UPDATE `pages`
   SET `category` = CASE
         WHEN LOWER(`category`) LIKE '%mention%' THEN 'mentions'
         WHEN LOWER(`category`) LIKE '%confidentialit%' THEN 'privacy'
         WHEN LOWER(`category`) LIKE '%rgpd%' THEN 'privacy'
         WHEN LOWER(`category`) LIKE '%condition%' OR LOWER(`category`) LIKE '%cgv%' THEN 'conditions'
         WHEN LOWER(`category`) LIKE '%propos%' THEN 'about'
         ELSE `category`
       END
 WHERE `deletedAt` IS NULL
   AND `kind` = 'legal'
   AND LOWER(COALESCE(`category`, '')) NOT IN ('mentions', 'privacy', 'conditions', 'about');

-- ---------------------------------------------------------------------------
-- 3. Les douze documents
--
-- `publishedAt` n'est repris que si la ligne n'en a pas : le « dernière mise à
-- jour » affiché sous le titre doit rester celui de la dernière rédaction, pas
-- celui du fichier importé. `deletedAt` remis à NULL, en revanche : un document
-- légal absent du site est une faute, une suppression volontaire se dit
-- ailleurs (statut « archived »).
-- ---------------------------------------------------------------------------
INSERT INTO `pages`
  (`slug`, `locale`, `kind`, `subtype`, `title`, `subtitle`, `category`,
   `content`, `sortOrder`, `status`, `publishedAt`)
VALUES
  ('mentions', 'fr', 'legal', 'simple', 'Mentions Légales', NULL, 'mentions', '<p class="mb-4"><strong>Raison sociale :</strong> SARI Système SAS</p><p class="mb-4"><strong>Capital social :</strong> 100 000€</p><p class="mb-4"><strong>RCS :</strong> Lyon 123 456 789</p><p class="mb-4"><strong>Siège social :</strong> 123 Avenue de la Santé, 69000 Lyon, France</p><p class="mb-4"><strong>Téléphone :</strong> +33 (0)1 23 45 67 89</p><p class="mb-4"><strong>Email :</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Directeur de la publication :</strong> Jean Dupont</p><p class="mb-4"><strong>Hébergeur :</strong> OVH - 2 rue Kellermann, 59100 Roubaix, France</p><p class="mb-4"><strong>Numéro TVA :</strong> FR12345678901</p>', 0, 'published', '2024-01-01 00:00:00.000'),
  ('privacy', 'fr', 'legal', 'simple', 'Politique de Confidentialité', NULL, 'privacy', '<p class="mb-4">SARI Système attache une grande importance à la protection de vos données personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos informations.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Données collectées</h3><p class="mb-4">Nous collectons les informations que vous nous fournissez directement (nom, email, téléphone, entreprise) lors de vos demandes de devis, inscriptions ou contacts.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Utilisation des données</h3><p class="mb-4">Vos données sont utilisées pour :</p><ul class="list-disc pl-6 mb-4 space-y-2"><li>Traiter vos demandes de devis et commandes</li><li>Vous envoyer nos actualités (avec votre accord)</li><li>Améliorer nos services</li><li>Respecter nos obligations légales</li></ul><h3 class="text-xl font-bold mb-3 mt-6">3. Vos droits</h3><p class="mb-4">Conformément au RGPD, vous disposez d''un droit d''accès, de rectification, de suppression et d''opposition à vos données. Pour exercer ces droits, contactez-nous à : dpo@sarisysteme.com</p><h3 class="text-xl font-bold mb-3 mt-6">4. Sécurité</h3><p class="mb-4">Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données contre tout accès non autorisé.</p><h3 class="text-xl font-bold mb-3 mt-6">5. Cookies</h3><p class="mb-4">Notre site utilise des cookies pour améliorer votre expérience. Vous pouvez configurer votre navigateur pour les refuser.</p>', 1, 'published', '2024-01-15 00:00:00.000'),
  ('conditions', 'fr', 'legal', 'simple', 'Conditions Générales de Vente', NULL, 'conditions', '<p class="mb-4">Les présentes Conditions Générales de Vente (CGV) s''appliquent à toutes les ventes de produits et services réalisées par SARI Système.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 1 : Prix</h3><p class="mb-4">Les prix sont indiqués en Euros Hors Taxes (HT). La TVA au taux en vigueur s''ajoute au prix HT. SARI Système se réserve le droit de modifier ses prix à tout moment.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 2 : Commandes</h3><p class="mb-4">Toute commande doit être confirmée par écrit (email ou bon de commande signé). SARI Système accuse réception de la commande sous 48h ouvrées.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 3 : Livraison</h3><p class="mb-4">Les délais de livraison sont indiqués pour chaque produit. En cas de retard, le client doit nous en informer sous 48h suivant la date prévue.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 4 : Garantie</h3><p class="mb-4">Tous nos produits bénéficient d''une garantie constructeur (généralement 12 à 36 mois). La garantie ne couvre pas les dommages dus à une mauvaise utilisation.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 5 : Paiement</h3><p class="mb-4">Paiement à 30 jours date de facture pour les professionnels. Escompte de 2% pour paiement comptant.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 6 : Retour</h3><p class="mb-4">Les produits non utilisés peuvent être retournés sous 14 jours. Frais de retour à la charge du client sauf défaut du produit.</p>', 2, 'published', '2024-01-01 00:00:00.000'),
  ('about', 'fr', 'legal', 'simple', 'À Propos de SARI Système', NULL, 'about', '<p class="mb-4">Fondée en 2003, SARI Système s''est imposée en 20 ans comme un acteur majeur de la distribution d''équipements et de consommables médicaux en France. Notre expertise et notre engagement nous permettent d''accompagner les professionnels de santé dans leur quotidien.</p><h3 class="text-xl font-bold mb-3 mt-6">Notre Mission</h3><p class="mb-4">Notre mission est d''accompagner les professionnels de santé dans leur quête d''excellence en leur fournissant des solutions technologiques innovantes, fiables et adaptées à leurs besoins spécifiques. Nous croyons que chaque professionnel de santé mérite les meilleurs outils pour offrir des soins de qualité.</p><h3 class="text-xl font-bold mb-3 mt-6">Nos Valeurs</h3><ul class="list-disc pl-6 mb-4 space-y-2"><li><strong>Qualité :</strong> Tous nos produits répondent aux normes médicales les plus strictes (CE, ISO 13485)</li><li><strong>Réactivité :</strong> Service après-vente disponible 24/7 avec intervention garantie sous 48h</li><li><strong>Expertise :</strong> Une équipe de techniciens et commerciaux formés en continu</li><li><strong>Proximité :</strong> Un accompagnement personnalisé de A à Z</li><li><strong>Innovation :</strong> Toujours à la pointe des dernières technologies médicales</li></ul><h3 class="text-xl font-bold mb-3 mt-6">Notre Histoire</h3><p class="mb-4">Depuis notre création, nous avons accompagné plus de 500 établissements de santé dans leur équipement. Notre croissance repose sur la confiance de nos clients et notre capacité à innover constamment.</p>', 3, 'published', '2024-01-01 00:00:00.000'),
  ('mentions', 'en', 'legal', 'simple', 'Legal Notice', NULL, 'mentions', '<p class="mb-4"><strong>Company Name:</strong> SARI Système SAS</p><p class="mb-4"><strong>Share Capital:</strong> €100,000</p><p class="mb-4"><strong>RCS (Trade Register):</strong> Lyon 123 456 789</p><p class="mb-4"><strong>Headquarters:</strong> 123 Avenue de la Santé, 69000 Lyon, France</p><p class="mb-4"><strong>Phone:</strong> +33 (0)1 23 45 67 89</p><p class="mb-4"><strong>Email:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>Publication Director:</strong> Jean Dupont</p><p class="mb-4"><strong>Host:</strong> OVH - 2 rue Kellermann, 59100 Roubaix, France</p><p class="mb-4"><strong>VAT Number:</strong> FR12345678901</p>', 0, 'published', '2024-01-01 00:00:00.000'),
  ('privacy', 'en', 'legal', 'simple', 'Privacy Policy', NULL, 'privacy', '<p class="mb-4">SARI Système attaches great importance to the protection of your personal data. This privacy policy explains how we collect, use, and protect your information.</p><h3 class="text-xl font-bold mb-3 mt-6">1. Data Collected</h3><p class="mb-4">We collect the information you provide directly (name, email, phone, company) when you request quotes, register, or contact us.</p><h3 class="text-xl font-bold mb-3 mt-6">2. Use of Data</h3><p class="mb-4">Your data is used to:</p><ul class="list-disc pl-6 mb-4 space-y-2"><li>Process your quote requests and orders</li><li>Send you our news (with your consent)</li><li>Improve our services</li><li>Comply with our legal obligations</li></ul><h3 class="text-xl font-bold mb-3 mt-6">3. Your Rights</h3><p class="mb-4">In accordance with the GDPR, you have the right to access, rectify, delete, and object to the processing of your data. To exercise these rights, contact us at: dpo@sarisysteme.com</p><h3 class="text-xl font-bold mb-3 mt-6">4. Security</h3><p class="mb-4">We implement technical and organizational security measures to protect your data against any unauthorized access.</p><h3 class="text-xl font-bold mb-3 mt-6">5. Cookies</h3><p class="mb-4">Our website uses cookies to improve your experience. You can configure your browser to refuse them.</p>', 1, 'published', '2024-01-15 00:00:00.000'),
  ('conditions', 'en', 'legal', 'simple', 'Terms and Conditions of Sale', NULL, 'conditions', '<p class="mb-4">These General Terms and Conditions of Sale (GTC) apply to all sales of products and services made by SARI Système.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 1: Prices</h3><p class="mb-4">Prices are indicated in Euros excluding VAT (HT). VAT at the current rate is added to the price. SARI Système reserves the right to modify its prices at any time.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 2: Orders</h3><p class="mb-4">Any order must be confirmed in writing (email or signed purchase order). SARI Système acknowledges receipt of the order within 48 working hours.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 3: Delivery</h3><p class="mb-4">Delivery times are indicated for each product. In case of delay, the client must inform us within 48h following the scheduled date.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 4: Warranty</h3><p class="mb-4">All our products benefit from a manufacturer''s warranty (generally 12 to 36 months). The warranty does not cover damage due to misuse.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 5: Payment</h3><p class="mb-4">Payment at 30 days from the invoice date for professionals. A 2% discount is offered for cash payment.</p><h3 class="text-xl font-bold mb-3 mt-6">Article 6: Returns</h3><p class="mb-4">Unused products may be returned within 14 days. Return shipping costs are the client''s responsibility unless the product is defective.</p>', 2, 'published', '2024-01-01 00:00:00.000'),
  ('about', 'en', 'legal', 'simple', 'About SARI Système', NULL, 'about', '<p class="mb-4">Founded in 2003, SARI Système has established itself over 20 years as a major player in the distribution of medical equipment and consumables in France. Our expertise and commitment allow us to support healthcare professionals in their daily operations.</p><h3 class="text-xl font-bold mb-3 mt-6">Our Mission</h3><p class="mb-4">Our mission is to support healthcare professionals in their quest for excellence by providing innovative, reliable technological solutions tailored to their specific needs. We believe that every healthcare professional deserves the best tools to deliver quality care.</p><h3 class="text-xl font-bold mb-3 mt-6">Our Values</h3><ul class="list-disc pl-6 mb-4 space-y-2"><li><strong>Quality:</strong> All our products meet the strictest medical standards (CE, ISO 13485)</li><li><strong>Responsiveness:</strong> After-sales service available 24/7 with guaranteed intervention within 48h</li><li><strong>Expertise:</strong> A team of technicians and sales representatives in continuous training</li><li><strong>Proximity:</strong> Personalized support from A to Z</li><li><strong>Innovation:</strong> Always at the forefront of the latest medical technologies</li></ul><h3 class="text-xl font-bold mb-3 mt-6">Our History</h3><p class="mb-4">Since our creation, we have supported over 500 healthcare facilities in their equipment needs. Our growth is based on our clients'' trust and our ability to constantly innovate.</p>', 3, 'published', '2024-01-01 00:00:00.000'),
  ('mentions', 'ar', 'legal', 'simple', 'إشعارات قانونية', NULL, 'mentions', '<p class="mb-4"><strong>الاسم التجاري:</strong> شركة ساري سيستم ذات أسهم مبسطة (SAS)</p><p class="mb-4"><strong>رأس المال:</strong> 100,000 يورو</p><p class="mb-4"><strong>السجل التجاري (RCS):</strong> ليون 123 456 789</p><p class="mb-4"><strong>المقر الرئيسي:</strong> 123 شارع الصحة، 69000 ليون، فرنسا</p><p class="mb-4"><strong>الهاتف:</strong> 89 67 45 23 (0)1 33+</p><p class="mb-4"><strong>البريد الإلكتروني:</strong> contact@sarisysteme.com</p><p class="mb-4"><strong>مدير النشر:</strong> جان دوبون</p><p class="mb-4"><strong>المستضيف:</strong> OVH - 2 rue Kellermann, 59100 Roubaix, France</p><p class="mb-4"><strong>رقم ضريبة القيمة المضافة:</strong> FR12345678901</p>', 0, 'published', '2024-01-01 00:00:00.000'),
  ('privacy', 'ar', 'legal', 'simple', 'سياسة الخصوصية', NULL, 'privacy', '<p class="mb-4">تولي شركة ساري سيستم أهمية كبيرة لحماية بياناتك الشخصية. تشرح سياسة الخصوصية هذه كيف نجمع ونستخدم ونحمي معلوماتك.</p><h3 class="text-xl font-bold mb-3 mt-6">1. البيانات المجمعة</h3><p class="mb-4">نجمع المعلومات التي تقدمها لنا مباشرة (الاسم، البريد الإلكتروني، الهاتف، الشركة) عند طلب عروض الأسعار، أو التسجيل، أو الاتصال بنا.</p><h3 class="text-xl font-bold mb-3 mt-6">2. استخدام البيانات</h3><p class="mb-4">تُستخدم بياناتك من أجل:</p><ul class="list-disc pl-6 mb-4 space-y-2"><li>معالجة طلبات عروض الأسعار والطلبات الخاصة بك</li><li>إرسال أخبارنا إليك (بموافقتك)</li><li>تحسين خدماتنا</li><li>الامتثال لالتزاماتنا القانونية</li></ul><h3 class="text-xl font-bold mb-3 mt-6">3. حقوقك</h3><p class="mb-4">وفقًا للائحة العامة لحماية البيانات (GDPR)، يحق لك الوصول إلى بياناتك وتصحيحها وحذفها والاعتراض على معالجتها. لممارسة هذه الحقوق، اتصل بنا على: dpo@sarisysteme.com</p><h3 class="text-xl font-bold mb-3 mt-6">4. الأمان</h3><p class="mb-4">ننفذ تدابير أمنية تقنية وتنظيمية لحماية بياناتك من أي وصول غير مصرح به.</p><h3 class="text-xl font-bold mb-3 mt-6">5. ملفات تعريف الارتباط (Cookies)</h3><p class="mb-4">يستخدم موقعنا الإلكتروني ملفات تعريف الارتباط لتحسين تجربتك. يمكنك تكوين متصفحك لرفضها.</p>', 1, 'published', '2024-01-15 00:00:00.000'),
  ('conditions', 'ar', 'legal', 'simple', 'شروط وأحكام البيع', NULL, 'conditions', '<p class="mb-4">تنطبق شروط وأحكام البيع العامة هذه على جميع مبيعات المنتجات والخدمات التي تقوم بها شركة ساري سيستم.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 1: الأسعار</h3><p class="mb-4">تُذكر الأسعار باليورو غير شامل ضريبة القيمة المضافة (HT). تُضاف ضريبة القيمة المضافة بالسعر الساري إلى السعر غير شامل الضريبة. تحتفظ شركة ساري سيستم بالحق في تعديل أسعارها في أي وقت.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 2: الطلبات</h3><p class="mb-4">يجب تأكيد أي طلب كتابيًا (عبر البريد الإلكتروني أو أمر شراء موقع). تؤكد شركة ساري سيستم استلام الطلب في غضون 48 ساعة عمل.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 3: التسليم</h3><p class="mb-4">يتم تحديد مواعيد التسليم لكل منتج. في حالة التأخير، يجب على العميل إخطارنا في غضون 48 ساعة من التاريخ المقرر.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 4: الضمان</h3><p class="mb-4">تستفيد جميع منتجاتنا من ضمان المصنع (عادة من 12 إلى 36 شهرًا). لا يغطي الضمان الأضرار الناجمة عن سوء الاستخدام.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 5: الدفع</h3><p class="mb-4">الدفع خلال 30 يومًا من تاريخ الفاتورة للمحترفين. يُمنح خصم بنسبة 2% للدفع النقدي الفوري.</p><h3 class="text-xl font-bold mb-3 mt-6">المادة 6: الإرجاع</h3><p class="mb-4">يمكن إرجاع المنتجات غير المستخدمة في غضون 14 يومًا. تتحمل تكاليف الإرجاع من قبل العميل ما لم يكن المنتج معيبًا.</p>', 2, 'published', '2024-01-01 00:00:00.000'),
  ('about', 'ar', 'legal', 'simple', 'حول ساري سيستم', NULL, 'about', '<p class="mb-4">تأسست شركة ساري سيستم في عام 2003، وقد رسخت مكانتها على مدار 20 عامًا كفاعل رئيسي في توزيع المعدات والمستلزمات الطبية في فرنسا. تسمح لنا خبرتنا والتزامنا بمرافقة المهنيين الصحيين في ممارساتهم اليومية.</p><h3 class="text-xl font-bold mb-3 mt-6">مهمتنا</h3><p class="mb-4">تتمثل مهمتنا في مرافقة المهنيين الصحيين في سعيهم نحو التميز من خلال تزويدهم بحلول تكنولوجية مبتكرة وموثوقة ومصممة خصيصًا لتلبية احتياجاتهم المحددة. نحن نؤمن بأن كل مهني صحي يستحق أفضل الأدوات لتقديم رعاية عالية الجودة.</p><h3 class="text-xl font-bold mb-3 mt-6">قيمنا</h3><ul class="list-disc pl-6 mb-4 space-y-2"><li><strong>الجودة:</strong> جميع منتجاتنا تلبي أعلى المعايير الطبية صرامة (CE, ISO 13485)</li><li><strong>سرعة الاستجابة:</strong> خدمة ما بعد البيع متاحة على مدار الساعة طوال أيام الأسبوع مع ضمان التدخل في غضون 48 ساعة</li><li><strong>الخبرة:</strong> فريق من الفنيين وممثلي المبيعات يخضعون لتدريب مستمر</li><li><strong>القرب:</strong> دعم مخصص من الألف إلى الياء</li><li><strong>الابتكار:</strong> دائمًا في طليعة أحدث التقنيات الطبية</li></ul><h3 class="text-xl font-bold mb-3 mt-6">تاريخنا</h3><p class="mb-4">منذ إنشائنا، رافقنا أكثر من 500 مؤسسة صحية في تجهيزاتها. يعتمد نموّنا على ثقة عملائنا وقدرتنا على الابتكار باستمرار.</p>', 3, 'published', '2024-01-01 00:00:00.000')
ON DUPLICATE KEY UPDATE
  `kind` = 'legal',
  `subtype` = IF(COALESCE(`subtype`, '') = '', 'simple', `subtype`),
  `title` = IF(IFNULL(`title`, '') = '', VALUES(`title`), `title`),
  `content` = IF(IFNULL(`content`, '') = '', VALUES(`content`), `content`),
  `status` = IF(IFNULL(`status`, '') = '', 'published', `status`),
  `category` = VALUES(`category`),
  `sortOrder` = VALUES(`sortOrder`),
  `publishedAt` = COALESCE(`publishedAt`, VALUES(`publishedAt`)),
  `deletedAt` = NULL;

-- ---------------------------------------------------------------------------
-- 4. Contrôle : la même requête qu'après, et la liste lisible
--
-- Douze lignes, quatre par langue, toutes `published`. C'est exactement ce que
-- l'écran « Pages légales » doit afficher (filtre `kind = 'legal'`).
-- ---------------------------------------------------------------------------
SELECT `locale` AS langue, `slug`, `category` AS type, `status`,
       CHAR_LENGTH(`content`) AS longueur_texte, `title`
  FROM `pages`
 WHERE `kind` = 'legal' AND `deletedAt` IS NULL
 ORDER BY `locale`, `sortOrder`;

-- ---------------------------------------------------------------------------
-- 5. Et les liens du pied de page ?
--
-- Le site répond sur /{langue}/legal/{type}. Les liens courts que le pied de
-- page a gardés en base (/fr/privacy, /fr/terms, /fr/mentions…) n'étaient des
-- erreurs que tant que rien ne les reconnaissait : next.config.mjs les renvoie
-- maintenant sur le document correspondant. Rien n'est donc obligatoire en base ;
-- pour que l'adresse affichée soit celle du lien, on peut aligner les lignes de
-- la table des menus sur l'adresse canonique. La requête ci-dessous d'abord, la
-- correction ensuite — à décommenter, et à ajuster langue par langue.
--
-- SELECT locale, label, href FROM menus
--  WHERE LOWER(href) LIKE '%/privacy' OR LOWER(href) LIKE '%/terms'
--     OR LOWER(href) LIKE '%/mentions' OR LOWER(href) LIKE '%/legal'
--  ORDER BY locale, sortOrder
--
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/privacy')
--  WHERE LOWER(href) = CONCAT('/', locale, '/privacy')
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/conditions')
--  WHERE LOWER(href) IN (CONCAT('/', locale, '/terms'), CONCAT('/', locale, '/conditions'))
-- UPDATE menus SET href = CONCAT('/', locale, '/legal/mentions')
--  WHERE LOWER(href) IN (CONCAT('/', locale, '/mentions'), CONCAT('/', locale, '/legal-notice'))
-- ---------------------------------------------------------------------------
