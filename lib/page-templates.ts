export interface PageTemplate {
  slug: string;
  label: string;
  html: (lang: string) => string;
}

const CSS = `
:root { --sari:#199ACA; --lime:#C6DA34; --alert:#EBB518; --ink:#1d2a31; --mute:#66757e; }
* { box-sizing:border-box; }
body { margin:0; font-family: Inter, Cairo, sans-serif; color:var(--ink); background:#fff; }
.wrap { max-width:1120px; margin:0 auto; padding:0 24px; }
.nav { display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid #e3eef2; }
.brand { font-weight:800; color:var(--sari); letter-spacing:-.03em; font-size:20px; }
.nav a { margin:0 10px; color:var(--ink); text-decoration:none; font-size:14px; font-weight:600; }
.hero { background:linear-gradient(135deg,#199ACA 0%,#0d7a9e 55%,#12323c 100%); color:#fff; padding:72px 24px; }
.hero h1 { font-size:42px; margin:0 0 12px; letter-spacing:-.04em; }
.hero p { max-width:560px; opacity:.92; line-height:1.6; }
.btn { display:inline-block; background:var(--lime); color:#2a3308; padding:12px 18px; border-radius:10px; text-decoration:none; font-weight:700; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; padding:48px 0; }
.card { border:1px solid #e3eef2; border-radius:10px; padding:22px; box-shadow:0 10px 30px rgba(15,23,42,.06); }
.card h3 { margin:0 0 8px; }
.muted { color:var(--mute); font-size:14px; line-height:1.55; }
.footer { background:#12323c; color:#d7e8ee; padding:36px 24px; margin-top:24px; display:flex; justify-content:space-between; }
.badge { display:inline-block; background:rgba(198,218,52,.2); color:#2a3308; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
@media (max-width:800px){ .grid{grid-template-columns:1fr;} .hero h1{font-size:28px;} }
`;

function shell(lang: string, body: string) {
  const rtl = lang === 'ar';
  return `<div dir="${rtl ? 'rtl' : 'ltr'}" style="font-family:${rtl ? 'Cairo, Inter, sans-serif' : 'Inter, Cairo, sans-serif'}">
  <header class="nav">
    <div class="brand">SARI Système</div>
    <nav>
      <a href="/${lang}">${rtl ? 'الرئيسية' : lang === 'en' ? 'Home' : 'Accueil'}</a>
      <a href="/${lang}/products">${rtl ? 'المنتجات' : lang === 'en' ? 'Products' : 'Produits'}</a>
      <a href="/${lang}/services">${rtl ? 'الخدمات' : lang === 'en' ? 'Services' : 'Services'}</a>
      <a href="/${lang}/contact">${rtl ? 'اتصل' : lang === 'en' ? 'Contact' : 'Contact'}</a>
    </nav>
  </header>
  ${body}
  <footer class="footer">
    <div>© ${new Date().getFullYear()} SARI Système</div>
    <div>${rtl ? 'توزيع المعدات الطبية' : lang === 'en' ? 'Medical equipment distribution' : 'Distribution d’équipements médicaux'}</div>
  </footer>
</div>`;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    slug: 'home',
    label: 'Accueil',
    html: (lang) => shell(lang, `
      <section class="hero">
        <div class="wrap">
          <span class="badge">${lang === 'ar' ? 'منذ أكثر من 20 سنة' : lang === 'en' ? '20+ years' : 'Plus de 20 ans'}</span>
          <h1>${lang === 'ar' ? 'معدات طبية موثوقة للمهنيين' : lang === 'en' ? 'Reliable medical equipment for professionals' : 'Équipements médicaux de confiance pour les professionnels'}</h1>
          <p>${lang === 'ar' ? 'تشخيص، تصوير، جراحة وحلول متكاملة للعيادات والمستشفيات.' : lang === 'en' ? 'Diagnostics, imaging, surgery and turnkey solutions for clinics and hospitals.' : 'Diagnostic, imagerie, chirurgie et solutions clés en main pour cliniques et hôpitaux.'}</p>
          <p><a class="btn" href="/${lang}/products">${lang === 'ar' ? 'اكتشف الكتالوج' : lang === 'en' ? 'Browse catalogue' : 'Voir le catalogue'}</a></p>
        </div>
      </section>
      <section class="wrap grid">
        <article class="card"><h3>${lang === 'ar' ? 'منتجات' : lang === 'en' ? 'Products' : 'Produits'}</h3><p class="muted">${lang === 'ar' ? 'أجهزة معتمدة وقطع غيار أصلية.' : 'Échographes, moniteurs, autoclaves et consommables certifiés.'}</p></article>
        <article class="card"><h3>${lang === 'ar' ? 'خدمات' : lang === 'en' ? 'Services' : 'Services'}</h3><p class="muted">${lang === 'ar' ? 'تركيب، تكوين وصيانة.' : 'Installation, formation et maintenance sur site.'}</p></article>
        <article class="card"><h3>${lang === 'ar' ? 'دعم' : lang === 'en' ? 'Support' : 'Accompagnement'}</h3><p class="muted">${lang === 'ar' ? 'فريق محلي جاهز للتدخل.' : 'Équipe locale, SAV réactif, pièces d’origine.'}</p></article>
      </section>`),
  },
  {
    slug: 'products',
    label: 'Catalogue produits',
    html: (lang) => shell(lang, `
      <section class="wrap" style="padding:48px 24px">
        <h1>${lang === 'ar' ? 'الكتالوج' : lang === 'en' ? 'Catalogue' : 'Catalogue produits'}</h1>
        <p class="muted">${lang === 'ar' ? 'تصفية حسب الفئة والمخزون.' : 'Filtrez par catégorie, disponibilité et budget.'}</p>
        <div class="grid">
          ${['Échographe Portable Pro', 'Défibrillateur DSA Premium', 'Autoclave Classe B 23L', 'Moniteur Multiparamètres', 'Couveuse Néonatale', 'Lampe Scialytique LED'].map((n) => `
            <article class="card">
              <div style="height:120px;background:linear-gradient(135deg,#e8f6fb,#f7fde0);border-radius:8px;margin-bottom:12px"></div>
              <h3>${n}</h3>
              <p class="muted">À partir de 4 500 DA</p>
              <a class="btn" href="/${lang}/products">${lang === 'en' ? 'Details' : 'Détail'}</a>
            </article>`).join('')}
        </div>
      </section>`),
  },
  {
    slug: 'about',
    label: 'À propos',
    html: (lang) => shell(lang, `
      <section class="wrap" style="padding:56px 24px;max-width:760px">
        <h1>${lang === 'ar' ? 'من نحن' : lang === 'en' ? 'About SARI' : 'À propos de SARI'}</h1>
        <p class="muted">${lang === 'ar' ? 'شركة جزائرية متخصصة في توزيع المعدات الطبية منذ أكثر من عشرين عاماً.' : lang === 'en' ? 'An Algerian company specialised in medical equipment distribution for more than twenty years.' : 'Société algérienne spécialisée dans la distribution d’équipements médicaux depuis plus de vingt ans.'}</p>
        <p>${lang === 'fr' ? 'Nous accompagnons hôpitaux, cliniques et cabinets sur tout le territoire, de l’étude du besoin jusqu’à la maintenance.' : 'We support hospitals, clinics and practices nationwide — from needs assessment to maintenance.'}</p>
      </section>`),
  },
  {
    slug: 'services',
    label: 'Services',
    html: (lang) => shell(lang, `
      <section class="wrap" style="padding:48px 24px">
        <h1>Services</h1>
        <div class="grid">
          <article class="card"><h3>${lang === 'ar' ? 'تركيب' : 'Installation'}</h3><p class="muted">Mise en service et recette sur site.</p></article>
          <article class="card"><h3>${lang === 'ar' ? 'تكوين' : 'Formation'}</h3><p class="muted">Prise en main des équipements par vos équipes.</p></article>
          <article class="card"><h3>${lang === 'ar' ? 'صيانة' : 'Maintenance'}</h3><p class="muted">Contrats préventifs et interventions correctives.</p></article>
        </div>
      </section>`),
  },
  {
    slug: 'contact',
    label: 'Contact',
    html: (lang) => shell(lang, `
      <section class="wrap" style="padding:56px 24px;max-width:640px">
        <h1>Contact</h1>
        <p class="muted">Alger · +213 (0)21 00 00 00 · contact@sarisysteme.com</p>
        <form class="card" style="display:grid;gap:10px">
          <input placeholder="${lang === 'ar' ? 'الاسم' : 'Nom'}" style="height:44px;padding:0 12px;border:1px solid #e3eef2;border-radius:8px" />
          <input placeholder="E-mail" style="height:44px;padding:0 12px;border:1px solid #e3eef2;border-radius:8px" />
          <textarea placeholder="${lang === 'ar' ? 'رسالتكم' : 'Message'}" style="min-height:120px;padding:12px;border:1px solid #e3eef2;border-radius:8px"></textarea>
          <button class="btn" type="button">${lang === 'ar' ? 'إرسال' : lang === 'en' ? 'Send' : 'Envoyer'}</button>
        </form>
      </section>`),
  },
  {
    slug: 'legal',
    label: 'Mentions légales',
    html: (lang) => shell(lang, `
      <section class="wrap" style="padding:56px 24px;max-width:760px">
        <h1>${lang === 'ar' ? 'الإشعارات القانونية' : lang === 'en' ? 'Legal notice' : 'Mentions légales'}</h1>
        <p class="muted">SARI Système — distribution d’équipements médicaux. Siège social Alger. RC, NIF et conditions générales sont éditables ici.</p>
      </section>`),
  },
];

export const PAGE_BUILDER_CSS = CSS;

export function builderKey(slug: string, lang: string) {
  return `sari_page_builder_${slug}_${lang}`;
}
