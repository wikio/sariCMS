export interface BuilderComponent {
  id: string;
  label: string;
  category: string;
  description: string;
  html: string;
}

/**
 * Bibliothèque des composants existants de la vitrine (components/sections/*).
 * Chaque entrée fournit un extrait HTML éditable via GrapesJS (aperçu + modification).
 */
export const BUILDER_COMPONENTS: BuilderComponent[] = [
  {
    id: 'sari-hero-slider', label: 'Hero Slider', category: 'Hero',
    description: 'Bannière plein écran avec titre, sous-titre et CTA.',
    html: '<section class="hero"><div class="wrap"><span class="badge">Depuis 20 ans</span><h1>Titre du hero</h1><p>Texte d’accroche décrivant votre offre.</p><a class="btn" href="#">Découvrir</a></div></section>',
  },
  {
    id: 'sari-stats', label: 'Chiffres clés', category: 'Contenu',
    description: 'Bandeau de statistiques (clients, expérience, support).',
    html: '<section class="wrap grid" style="padding:48px 0"><article class="card"><h3>500+</h3><p class="muted">Clients accompagnés</p></article><article class="card"><h3>20 ans</h3><p class="muted">d’expérience</p></article><article class="card"><h3>24/7</h3><p class="muted">Support réactif</p></article></section>',
  },
  {
    id: 'sari-featured', label: 'Produits vedettes', category: 'E-shop',
    description: 'Grille de cartes produits (visuel, nom, prix).',
    html: '<section class="wrap" style="padding:48px 0"><h2>Produits vedettes</h2><div class="grid"><article class="card"><div style="height:120px;background:linear-gradient(135deg,#e8f6fb,#f7fde0);border-radius:8px;margin-bottom:12px"></div><h3>Produit A</h3><p class="muted">À partir de 4 500 DA</p></article><article class="card"><div style="height:120px;background:linear-gradient(135deg,#e8f6fb,#f7fde0);border-radius:8px;margin-bottom:12px"></div><h3>Produit B</h3><p class="muted">À partir de 8 500 DA</p></article><article class="card"><div style="height:120px;background:linear-gradient(135deg,#e8f6fb,#f7fde0);border-radius:8px;margin-bottom:12px"></div><h3>Produit C</h3><p class="muted">À partir de 3 200 DA</p></article></div></section>',
  },
  {
    id: 'sari-partners', label: 'Partenaires', category: 'Contenu',
    description: 'Bandeau de logos partenaires.',
    html: '<section class="wrap" style="padding:40px 0"><h2>Ils nous font confiance</h2><div class="grid"><article class="card" style="text-align:center"><h3>Partenaire A</h3></article><article class="card" style="text-align:center"><h3>Partenaire B</h3></article><article class="card" style="text-align:center"><h3>Partenaire C</h3></article></div></section>',
  },
  {
    id: 'sari-testimonials', label: 'Témoignages', category: 'Contenu',
    description: 'Slider / grille d’avis clients.',
    html: '<section class="wrap grid" style="padding:48px 0"><article class="card"><p class="muted">« Un accompagnement remarquable. »</p><h3>Dr. Laurent</h3></article><article class="card"><p class="muted">« Matériel fiable et SAV réactif. »</p><h3>Clinique El Afia</h3></article><article class="card"><p class="muted">« Livraison rapide et soignée. »</p><h3>CHU Mustapha</h3></article></section>',
  },
  {
    id: 'sari-cta', label: 'Appel à l’action', category: 'Contenu',
    description: 'Bloc CTA coloré avec bouton.',
    html: '<section style="padding:56px 24px;background:linear-gradient(135deg,#199ACA,#0d7a9e);color:#fff;text-align:center"><h2>Besoin d’un devis ?</h2><p style="opacity:.9">Contactez notre équipe commerciale.</p><a class="btn" href="#">Demander un devis</a></section>',
  },
  {
    id: 'sari-alternating', label: 'Sections alternées', category: 'Contenu',
    description: 'Texte / visuel en alternance.',
    html: '<section class="wrap grid" style="padding:48px 0"><article class="card"><div style="height:120px;background:linear-gradient(135deg,#e8f6fb,#f7fde0);border-radius:8px"></div></article><article class="card"><h3>Votre titre</h3><p class="muted">Description de la section avec texte éditable.</p></article></section>',
  },
  {
    id: 'sari-events', label: 'Événements', category: 'Contenu',
    description: 'Liste d’événements à venir.',
    html: '<section class="wrap" style="padding:40px 0"><h2>Événements</h2><div class="grid"><article class="card"><h3>Salon médical</h3><p class="muted">12–14 octobre 2026 · Alger</p></article><article class="card"><h3>Formation échographie</h3><p class="muted">Novembre 2026 · Oran</p></article></div></section>',
  },
  {
    id: 'sari-newsletter', label: 'Newsletter', category: 'Contenu',
    description: 'Formulaire d’inscription newsletter.',
    html: '<section class="card wrap" style="padding:40px 24px;margin:32px auto;max-width:640px;text-align:center"><h3>Restez informé</h3><p class="muted">Recevez nos actualités et offres.</p><div style="display:flex;gap:8px;justify-content:center"><input placeholder="E-mail" style="height:44px;padding:0 12px;border:1px solid #e3eef2;border-radius:8px;flex:1" /><a class="btn" href="#">S’inscrire</a></div></section>',
  },
  {
    id: 'sari-parallax', label: 'Bandeau parallaxe', category: 'Hero',
    description: 'Bandeau image plein largeur.',
    html: '<section style="min-height:280px;display:flex;align-items:center;justify-content:center;background:linear-gradient(120deg,#12323c,#199ACA);color:#fff;padding:48px 24px"><div style="text-align:center"><h2>Titre du bandeau</h2><p style="opacity:.9">Texte d’accompagnement.</p></div></section>',
  },
  {
    id: 'sari-grid', label: 'Grille 3 colonnes', category: 'Structure',
    description: 'Trois cartes alignées.',
    html: '<section class="wrap grid"><article class="card"><h3>A</h3><p class="muted">Texte</p></article><article class="card"><h3>B</h3><p class="muted">Texte</p></article><article class="card"><h3>C</h3><p class="muted">Texte</p></article></section>',
  },
  {
    id: 'sari-card', label: 'Carte simple', category: 'Structure',
    description: 'Carte avec titre et texte.',
    html: '<article class="card"><h3>Titre</h3><p class="muted">Texte</p></article>',
  },
];

export function builderComponentById(id: string): BuilderComponent | undefined {
  return BUILDER_COMPONENTS.find((c) => c.id === id);
}
