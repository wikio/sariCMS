/**
 * La bibliothèque de blocs du constructeur de page.
 *
 * Deux familles, dans le même tableau :
 * - les **composants existants de la vitrine**, repris tels quels (ils étaient
 *   là avant le constructeur et restent disponibles sous les mêmes identifiants) ;
 * - le **kit du constructeur** (`app/builder-kit.css`), qui porte les modules
 *   demandés pour construire une page : galerie avec visionneuse, carrousel,
 *   slider d'images, flyer, page d'atterrissage, bouton d'action configurable…
 *
 * Un bloc n'est que du HTML et des classes : c'est le contrat qui le rend
 * modifiable dans GrapesJS *et* rendu tel quel par la vitrine. Les classes de
 * réglage (`classes`) sont citées dans la fiche du bloc, parce que c'est par
 * elles que l'administrateur change une couleur, une taille ou le nombre de
 * colonnes — le panneau de style de GrapesJS les propose comme classes.
 *
 * Un bloc marqué `needs` est interactif à l'écran : `components/builder/
 * use-page-behaviors.ts` vient le câbler (diaporama, flèches, visionneuse). Sans
 * JavaScript, il reste lisible — les slides et les cartes s'affichent empilés, et
 * une image de galerie est un simple lien vers le fichier.
 */
export interface BuilderComponent {
  id: string;
  label: string;
  category: string;
  description: string;
  html: string;
  /** Classes de réglage à connaître pour modifier le bloc à la main. */
  classes?: string[];
  /** Comportements posés par le composant de rendu. */
  needs?: Array<'slides' | 'carousel' | 'lightbox'>;
}

/** Un point de départ de page : le contenu complet d'une page construite. */
export interface BuilderTemplate {
  id: string;
  label: string;
  description: string;
  html: (lang: string) => string;
}

export const BUILDER_COMPONENTS: BuilderComponent[] = [
  // ——— Les composants de la vitrine, conservés ———
  {
    id: 'sari-hero-slider', label: 'Hero Slider', category: 'Hero',
    description: 'Bannière plein écran avec titre, sous-titre et CTA.',
    html: '<section class="sari-hero"><figure class="sari-hero__bg"><img src="/media/marquee/atelier.svg" alt=""></figure><div class="sari-wrap"><span class="sari-eyebrow">Depuis 20 ans</span><h1>Titre du hero</h1><p class="sari-lead">Texte d’accroche décrivant votre offre.</p><div class="sari-actions"><a class="sari-btn sari-btn--arrow" href="#">Découvrir</a></div></div></section>',
  },
  {
    id: 'sari-stats', label: 'Chiffres clés', category: 'Contenu',
    description: 'Bandeau de statistiques (clients, expérience, support).',
    classes: ['.sari-grid--3', '.sari-grid--4'],
    html: '<section class="sari-band sari-band--lime"><div class="sari-wrap sari-grid"><div><div class="sari-num">500+</div><p>Clients accompagnés</p></div><div><div class="sari-num">20 ans</div><p>d’expérience</p></div><div><div class="sari-num">24/7</div><p>Support réactif</p></div></div></section>',
  },
  {
    id: 'sari-featured', label: 'Produits vedettes', category: 'E-shop',
    description: 'Grille de cartes produits (visuel, nom, prix).',
    classes: ['.sari-grid--3', '.sari-grid--4'],
    html: '<section class="sari-band"><div class="sari-wrap"><h2>Produits vedettes</h2><div class="sari-grid"><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/webinaire.svg" alt=""></div><h3>Produit A</h3><p class="sari-muted">À partir de 4 500 DA</p></article><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/atelier.svg" alt=""></div><h3>Produit B</h3><p class="sari-muted">À partir de 8 500 DA</p></article><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/recrute.svg" alt=""></div><h3>Produit C</h3><p class="sari-muted">À partir de 3 200 DA</p></article></div></div></section>',
  },
  {
    id: 'sari-partners', label: 'Partenaires', category: 'Contenu',
    description: 'Bandeau de logos partenaires.',
    html: '<section class="sari-band sari-band--gray sari-band--tight"><div class="sari-wrap sari-logos"><img src="/logo.png" alt="SARI"><img src="/media/marquee/prix-innovation.svg" alt="Partenaire A"><img src="/media/marquee/prix-innovation.svg" alt="Partenaire B"><img src="/media/marquee/prix-innovation.svg" alt="Partenaire C"></div></section>',
  },
  {
    id: 'sari-testimonials', label: 'Témoignages', category: 'Contenu',
    description: 'Slider / grille d’avis clients.',
    html: '<section class="sari-band"><div class="sari-wrap sari-grid"><article class="sari-card"><p class="sari-muted">« Un accompagnement remarquable. »</p><h3>Dr. Laurent</h3></article><article class="sari-card"><p class="sari-muted">« Matériel fiable et SAV réactif. »</p><h3>Clinique El Afia</h3></article><article class="sari-card"><p class="sari-muted">« Livraison rapide et soignée. »</p><h3>CHU Mustapha</h3></article></div></section>',
  },
  {
    id: 'sari-cta', label: 'Appel à l’action', category: 'Contenu',
    description: 'Bloc CTA coloré avec bouton.',
    html: '<section class="sari-band sari-band--blue"><div class="sari-wrap sari-cta-strip"><div><h2>Besoin d’un devis ?</h2><p class="sari-lead">Contactez notre équipe commerciale.</p></div><a class="sari-btn sari-btn--lime" href="#">Demander un devis</a></div></section>',
  },
  {
    id: 'sari-alternating', label: 'Sections alternées', category: 'Contenu',
    description: 'Texte / visuel en alternance.',
    classes: ['.sari-split--flip'],
    html: '<section class="sari-band"><div class="sari-wrap sari-split"><figure class="sari-figure"><img src="/media/marquee/webinaire.svg" alt=""></figure><div><h3>Votre titre</h3><p class="sari-lead">Description de la section avec texte éditable.</p></div></div></section>',
  },
  {
    id: 'sari-events', label: 'Événements', category: 'Contenu',
    description: 'Liste d’événements à venir.',
    html: '<section class="sari-band sari-band--gray"><div class="sari-wrap"><h2>Événements</h2><div class="sari-grid"><article class="sari-card"><span class="sari-eyebrow">12–14 octobre 2026</span><h3>Salon médical</h3><p class="sari-muted">Alger · stand A42</p></article><article class="sari-card"><span class="sari-eyebrow">Novembre 2026</span><h3>Formation échographie</h3><p class="sari-muted">Oran · sur inscription</p></article></div></div></section>',
  },
  {
    id: 'sari-newsletter', label: 'Newsletter', category: 'Contenu',
    description: 'Accroche d’inscription (le formulaire est posé par le site, pas par la page).',
    html: '<section class="sari-band"><div class="sari-wrap sari-wrap--narrow sari-center"><h3>Restez informé</h3><p class="sari-lead">Recevez nos actualités et offres.</p><a class="sari-btn" href="/fr/newsletter">S’inscrire à la lettre</a></div></section>',
  },
  {
    id: 'sari-parallax', label: 'Bandeau parallaxe', category: 'Hero',
    description: 'Bandeau image plein largeur.',
    html: '<section class="sari-hero"><figure class="sari-hero__bg"><img src="/media/marquee/recrute.svg" alt=""></figure><div class="sari-wrap sari-center"><h2>Titre du bandeau</h2><p class="sari-lead">Texte d’accompagnement.</p></div></section>',
  },
  {
    id: 'sari-grid', label: 'Grille 3 colonnes', category: 'Structure',
    description: 'Trois cartes alignées.',
    classes: ['.sari-grid--2', '.sari-grid--4'],
    html: '<section class="sari-band"><div class="sari-wrap sari-grid"><article class="sari-card"><h3>A</h3><p class="sari-muted">Texte</p></article><article class="sari-card"><h3>B</h3><p class="sari-muted">Texte</p></article><article class="sari-card"><h3>C</h3><p class="sari-muted">Texte</p></article></div></section>',
  },
  {
    id: 'sari-card', label: 'Carte simple', category: 'Structure',
    description: 'Carte avec titre et texte.',
    html: '<article class="sari-card"><h3>Titre</h3><p class="sari-muted">Texte</p></article>',
  },
  // ——— Le kit du constructeur ———
  {
    id: 'sari-landing', label: 'Page d\'atterrissage complète',
    category: 'Page d\'atterrissage',
    description: 'Bandeau titre, trois atouts, preuve chiffrée, appel à l\'action final.',
    classes: ['.sari-band--blue', '.sari-grid--3', '.sari-btn--lime'],
    html: '<section class="sari-hero"><figure class="sari-hero__bg"><img src="/media/marquee/webinaire.svg" alt=""></figure><div class="sari-wrap"><span class="sari-eyebrow">Offre 2026</span><h1>Présentez votre offre en une page</h1><p class="sari-lead">Un bandeau, trois arguments, une preuve et un bouton : ce qu\'il faut pour qu\'un visiteur appelle.</p><div class="sari-actions"><a class="sari-btn sari-btn--lime sari-btn--lg sari-btn--arrow" href="/contact">Demander un rappel</a><a class="sari-btn sari-btn--outline" href="/media/marquee/prix-innovation.svg" download>Télécharger le flyer</a></div></div></section><section class="sari-band sari-band--gray"><div class="sari-wrap"><h2>Ce que vous y gagnez</h2><div class="sari-grid sari-grid--3"><article class="sari-card"><h3>Installé en 48 h</h3><p>Une équipe sur site, le matériel réglé, la formation incluse.</p></article><article class="sari-card"><h3>Suivi sur mesure</h3><p>Contrat de maintenance adapté à votre activité et à vos volumes.</p></article><article class="sari-card"><h3>Pièces garanties</h3><p>Stock local et intervention garantie sous 24 h ouvrées.</p></article></div></div></section><section class="sari-band sari-band--blue sari-band--tight"><div class="sari-wrap"><div class="sari-grid sari-grid--3"><div class="sari-center"><div class="sari-num">20 ans</div><p class="sari-lead">au service des cliniques</p></div><div class="sari-center"><div class="sari-num">500+</div><p class="sari-lead">installations réalisées</p></div><div class="sari-center"><div class="sari-num">24 h</div><p class="sari-lead">de délai d\'intervention</p></div></div></div></section><section class="sari-band"><div class="sari-wrap sari-cta-strip"><div><h2>Parlons de votre projet</h2><p class="sari-muted">Un devis chiffré sous trois jours ouvrés.</p></div><a class="sari-btn" href="/contact">Nous contacter</a></div></section>',
  },
  {
    id: 'sari-hero-band', label: 'Bandeau titre pleine largeur',
    category: 'Page d\'atterrissage',
    description: 'Image de fond, sur-titre, titre, texte et boutons.',
    classes: ['.sari-hero', '.sari-hero--split'],
    html: '<section class="sari-hero"><figure class="sari-hero__bg"><img src="/media/marquee/atelier.svg" alt=""></figure><div class="sari-wrap"><span class="sari-eyebrow">Nouveau</span><h1>Titre de la page</h1><p class="sari-lead">Deux ou trois lignes d\'accroche, éditables en double-cliquant.</p><div class="sari-actions"><a class="sari-btn sari-btn--lime" href="/contact">Appel à l\'action</a><a class="sari-btn sari-btn--outline" href="/services">En savoir plus</a></div></div></section>',
  },
  {
    id: 'sari-hero-split', label: 'Bandeau en deux colonnes',
    category: 'Page d\'atterrissage',
    description: 'Texte à gauche, visuel à droite ; s\'empile sur mobile.',
    classes: ['.sari-split', '.sari-split--flip'],
    html: '<section class="sari-band"><div class="sari-wrap sari-split"><div><span class="sari-eyebrow">Section</span><h2>Un titre qui dit ce que fait la page</h2><p class="sari-lead">Le texte reste lisible : une colonne, puis une autre quand la largeur manque.</p><div class="sari-actions"><a class="sari-btn" href="/contact">Continuer</a></div></div><figure class="sari-figure"><img src="/media/marquee/recrute.svg" alt="Visuel de la section"><figcaption>Légende du visuel.</figcaption></figure></div></section>',
  },
  {
    id: 'sari-cta-button', label: 'Bouton d\'action configurable',
    category: 'Action',
    description: 'Un bouton : couleur, taille, flèche, pleine largeur — par classes.',
    classes: ['.sari-btn--lime', '.sari-btn--ink', '.sari-btn--outline', '.sari-btn--ghost', '.sari-btn--sm', '.sari-btn--lg', '.sari-btn--block', '.sari-btn--arrow'],
    html: '<div class="sari-actions"><a class="sari-btn sari-btn--arrow" href="/contact">Demander un devis</a><a class="sari-btn sari-btn--outline" href="/products">Voir le catalogue</a></div>',
  },
  {
    id: 'sari-cta-band', label: 'Bandeau d\'appel à l\'action',
    category: 'Action',
    description: 'Fond coloré, titre court, deux boutons.',
    classes: ['.sari-band--lime', '.sari-band--ink'],
    html: '<section class="sari-band sari-band--blue"><div class="sari-wrap sari-cta-strip"><div><h2>Besoin d\'un conseil technique ?</h2><p class="sari-lead">Nos ingénieurs biomédicaux répondent du lundi au vendredi.</p></div><div class="sari-actions"><a class="sari-btn sari-btn--lime" href="tel:+21300000000">Appeler</a><a class="sari-btn sari-btn--outline" href="/contact">Écrire</a></div></div></section>',
  },
  {
    id: 'sari-gallery', label: 'Galerie avec visionneuse',
    category: 'Médias',
    description: 'Mosaïque d\'images ; un clic agrandit, flèches et Échap pour naviguer.',
    needs: ['lightbox'],
    classes: ['.sari-gallery--2', '.sari-gallery--4', '.sari-gallery--tall', '.sari-gallery--wide'],
    html: '<section class="sari-band"><div class="sari-wrap"><h2>Notre parc matériel en images</h2><div class="sari-gallery" data-sari-lightbox><a class="sari-gallery__item" href="/media/marquee/atelier.svg"><img src="/media/marquee/atelier.svg" alt="Atelier de formation"><span class="sari-gallery__cap">Atelier de formation</span></a><a class="sari-gallery__item" href="/media/marquee/webinaire.svg"><img src="/media/marquee/webinaire.svg" alt="Webinaire"><span class="sari-gallery__cap">Webinaire produit</span></a><a class="sari-gallery__item" href="/media/marquee/recrute.svg"><img src="/media/marquee/recrute.svg" alt="Recrutement"><span class="sari-gallery__cap">Nous recrutons</span></a><a class="sari-gallery__item" href="/media/marquee/prix-innovation.svg"><img src="/media/marquee/prix-innovation.svg" alt="Prix de l\'innovation"><span class="sari-gallery__cap">Prix de l\'innovation</span></a></div></div></section>',
  },
  {
    id: 'sari-carousel-cards', label: 'Carrousel de cartes',
    category: 'Médias',
    description: 'Piste à défilement horizontal, flèches, autoplay en option.',
    needs: ['carousel'],
    classes: ['.sari-carousel--half', '.sari-carousel--third', '.sari-carousel--auto', '.sari-carousel--slow'],
    html: '<section class="sari-band sari-band--gray"><div class="sari-wrap"><div class="sari-carousel" data-sari-carousel><div class="sari-carousel__nav"><button type="button" class="sari-carousel__btn" data-carousel-prev aria-label="Éléments précédents">‹</button><button type="button" class="sari-carousel__btn" data-carousel-next aria-label="Éléments suivants">›</button></div><div class="sari-carousel__track"><article class="sari-carousel__item sari-card"><h3>Échographe portable</h3><p>Quatre sondes, autonomie 5 h.</p><a class="sari-btn sari-btn--sm" href="/products">Voir</a></article><article class="sari-carousel__item sari-card"><h3>Moniteur patient</h3><p>Écran 15 pouces, 12 paramètres.</p><a class="sari-btn sari-btn--sm" href="/products">Voir</a></article><article class="sari-carousel__item sari-card"><h3>Stérilisateur classe B</h3><p>Cycle vide fractionné, traçabilité.</p><a class="sari-btn sari-btn--sm" href="/products">Voir</a></article><article class="sari-carousel__item sari-card"><h3>Table radiologique</h3><p>Mur mobile, détection numérique.</p><a class="sari-btn sari-btn--sm" href="/products">Voir</a></article></div></div></div></section>',
  },
  {
    id: 'sari-slider-images', label: 'Slider d\'images',
    category: 'Médias',
    description: 'Diaporama avec légende, points de navigation et autoplay.',
    needs: ['slides'],
    classes: ['.sari-slides--plain', '.sari-slides--auto', '.sari-slides--slow'],
    html: '<section class="sari-band"><div class="sari-wrap"><div class="sari-slides" data-sari-slides data-interval="5000"><figure class="sari-slide is-active"><img src="/media/marquee/atelier.svg" alt="Atelier"><figcaption class="sari-slide__caption"><h3>Atelier de prise en main</h3><p>Deux heures sur votre site, par groupe de six.</p></figcaption></figure><figure class="sari-slide"><img src="/media/marquee/webinaire.svg" alt="Webinaire"><figcaption class="sari-slide__caption"><h3>Webinaire produit</h3><p>Une heure, en direct, avec questions.</p></figcaption></figure><figure class="sari-slide"><img src="/media/marquee/recrute.svg" alt="Recrutement"><figcaption class="sari-slide__caption"><h3>Nous recrutons</h3><p>Techniciens biomédicaux en CDI.</p></figcaption></figure></div></div></section>',
  },
  {
    id: 'sari-flyer-offer', label: 'Flyer d\'offre',
    category: 'Flyer',
    description: 'Carte en deux colonnes : arguments, prix, contact. Se imprime proprement.',
    classes: ['.sari-flyer__callout', '.sari-flyer__price'],
    html: '<section class="sari-band sari-band--gray"><div class="sari-wrap"><article class="sari-flyer"><header class="sari-flyer__head"><span class="sari-eyebrow">Offre de lancement</span><h2>Pack échographie de poche</h2><p class="sari-lead">Sonde sans fil, logiciel inclus, formation d\'une demi-journée.</p></header><div class="sari-flyer__body"><div><h3>Dans l\'offre</h3><ul class="sari-flyer__list"><li>Sonde multifréquences et valise de transport</li><li>Licence logicielle illimitée, mises à jour incluses</li><li>Garantie 3 ans, intervention sur site</li><li>Formation de 4 heures, jusqu\'à six personnes</li></ul><figure class="sari-flyer__media"><img src="/media/marquee/atelier.svg" alt="Le pack monté"></figure></div><aside class="sari-flyer__callout"><span class="sari-eyebrow">Jusqu\'au 31 décembre</span><div class="sari-flyer__price">à partir de 8 900 €</div><p class="sari-note">Location possible sur 24 ou 36 mois.</p><a class="sari-btn sari-btn--block" href="/contact">Réserver une démonstration</a></aside></div><footer class="sari-flyer__foot"><span>SARI Système · Alger · +213 (0)21 00 00 00</span><a class="sari-btn sari-btn--sm sari-btn--outline" href="/media/marquee/prix-innovation.svg" download>Telecharger le flyer (PDF)</a></footer></article></div></section>',
  },
  {
    id: 'sari-flyer-event', label: 'Flyer d\'événement',
    category: 'Flyer',
    description: 'Programme court, date en évidence, bouton d\'inscription.',
    classes: ['.sari-band--ink'],
    html: '<section class="sari-band sari-band--ink"><div class="sari-wrap"><article class="sari-flyer"><header class="sari-flyer__head"><span class="sari-eyebrow">14 octobre 2026 · Alger</span><h2>Journée de l\'imagerie portable</h2><p class="sari-lead">Démonstrations, tables rondes et essais sur site.</p></header><div class="sari-flyer__body"><div><h3>Programme</h3><ul class="sari-flyer__list"><li>09 h 00 — Accueil et café technique</li><li>10 h 30 — Démonstrations en salle de radiologie</li><li>14 h 00 — Retour d\'usage de trois cliniques</li><li>16 h 30 — Échanges et essais libres</li></ul></div><aside class="sari-flyer__callout"><span class="sari-eyebrow">Entrée libre</span><p>Inscription avant le 30 septembre, nombre de places limité.</p><a class="sari-btn sari-btn--block sari-btn--lime" href="/contact">Je m\'inscris</a></aside></div></article></div></section>',
  },
  {
    id: 'sari-cards-grid', label: 'Grille de cartes',
    category: 'Contenu',
    description: 'Autant de cartes que nécessaire, colonnes automatiques.',
    classes: ['.sari-grid--2', '.sari-grid--3', '.sari-grid--4'],
    html: '<section class="sari-band"><div class="sari-wrap"><h2>Nos univers</h2><div class="sari-grid"><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/webinaire.svg" alt=""></div><h3>Diagnostic</h3><p>Échographes, moniteurs, scopes.</p></article><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/atelier.svg" alt=""></div><h3>Imagerie</h3><p>Radiologie numérique et mur mobile.</p></article><article class="sari-card"><div class="sari-card__media"><img src="/media/marquee/recrute.svg" alt=""></div><h3>Services</h3><p>Maintenance, formation, conseil.</p></article></div></div></section>',
  },
  {
    id: 'sari-stats', label: 'Chiffres clés',
    category: 'Contenu',
    description: 'Bandeau de trois ou quatre chiffres, gros caractères.',
    classes: ['.sari-band--blue', '.sari-grid--4'],
    html: '<section class="sari-band sari-band--lime"><div class="sari-wrap sari-grid sari-grid--4"><div><div class="sari-num">20</div><p>années d\'activité</p></div><div><div class="sari-num">500+</div><p>installations</p></div><div><div class="sari-num">24 h</div><p>délai d\'intervention</p></div><div><div class="sari-num">98 %</div><p>de contrats honorés</p></div></div></section>',
  },
  {
    id: 'sari-logos', label: 'Mur de logos',
    category: 'Contenu',
    description: 'Alignement de marques, centré, qui passe sur plusieurs lignes.',
    classes: ['.sari-band--tight'],
    html: '<section class="sari-band sari-band--gray sari-band--tight"><div class="sari-wrap sari-logos"><img src="/logo.png" alt="SARI"><img src="/media/marquee/prix-innovation.svg" alt="Prix de l\'innovation"><img src="/media/marquee/prix-innovation.svg" alt="Partenaire"><img src="/media/marquee/prix-innovation.svg" alt="Partenaire"></div></section>',
  },
  {
    id: 'sari-quote', label: 'Témoignage',
    category: 'Contenu',
    description: 'Citation longue avec auteur.',
    classes: ['.sari-wrap--narrow'],
    html: '<section class="sari-band"><div class="sari-wrap sari-wrap--narrow"><blockquote class="sari-quote"><p>« Installation un vendredi, formation le lundi suivant. Nous n\'avons pas perdu une journée de consultation. »</p><footer>Dr. Amina Benali — Clinique El Afia</footer></blockquote></div></section>',
  },
  {
    id: 'sari-faq', label: 'Questions fréquentes',
    category: 'Contenu',
    description: 'Pliables sans JavaScript : le premier est ouvert, les autres se déplient au clic.',
    classes: ['.sari-faq'],
    html: '<section class="sari-band sari-band--gray"><div class="sari-wrap sari-wrap--narrow"><h2>Questions fréquentes</h2><div class="sari-faq"><details open><summary>Le matériel est-il garanti hors atelier ?</summary><p>Oui, trois ans pièces et main-d\'œuvre, intervention sur site sous 24 h ouvrées.</p></details><details><summary>Proposez-vous la location ?</summary><p>Sur 24 ou 36 mois, avec option d\'achat en fin de contrat.</p></details><details><summary>Formez-vous nos équipes ?</summary><p>La formation est incluse à la livraison, et une session de rappel est possible à six mois.</p></details></div></div></section>',
  },
  {
    id: 'sari-video', label: 'Vidéo ou visuel 16/9',
    category: 'Médias',
    description: 'Cadre au format 16/9 qui garde ses proportions.',
    classes: ['.sari-frame'],
    html: '<section class="sari-band"><div class="sari-wrap"><div class="sari-frame"><img src="/media/marquee/webinaire.svg" alt="Visuel de la présentation"></div><p class="sari-note">Remplacez l\'image par une vidéo dans le panneau de droite si besoin.</p></div></section>',
  },
  {
    id: 'sari-spacer', label: 'Espace vide',
    category: 'Structure',
    description: 'Respiration verticale entre deux bandeaux.',
    classes: ['.sari-spacer'],
    html: '<div class="sari-spacer" aria-hidden="true"></div>',
  },
  {
    id: 'sari-separator', label: 'Séparateur',
    category: 'Structure',
    description: 'Filet horizontal discret.',
    classes: ['.sari-sep'],
    html: '<div class="sari-wrap"><hr class="sari-sep"></div>',
  },
  {
    id: 'sari-page-head', label: 'En-tête de page (sans menu)',
    category: 'Structure',
    description: 'Fil d\'Ariane, titre et retour — pour une page autonome.',
    classes: ['.sari-band--tight'],
    html: '<section class="sari-band sari-band--tight sari-band--gray"><div class="sari-wrap sari-cta-strip"><p class="sari-note"><a href="/fr">Accueil</a> · <a href="/fr/content">Pages</a> · <span>Titre de la page</span></p><a class="sari-btn sari-btn--sm sari-btn--outline" href="/fr/contact">Nous écrire</a></div></section>',
  },
  // `builderComponentById` est l'accès utilisé par le panneau de composants.
];

export function builderComponentById(id: string): BuilderComponent | undefined {
  return BUILDER_COMPONENTS.find((c) => c.id === id);
}

/**
 * Points de départ d'une page construite.
 *
 * Aucune de ces pages ne porte de bandeau de navigation ni de pied de page : une
 * page construite est autonome (c'est le sens de son type), elle se relie depuis
 * une campagne, un e-mail ou un QR code. Les liens internes y sont écrits avec
 * leur préfixe de langue, que le constructeur ne peut pas deviner.
 */
export const STARTER_TEMPLATES: BuilderTemplate[] = [
  {
    id: 'blank',
    label: 'Page vide',
    description: 'Une page sans contenu, pour partir de zéro.',
    html: (lang) => `<main class="sari-shell"><section class="sari-band"><div class="sari-wrap"><h1>${
      { fr: 'Titre de la page', en: 'Page title', ar: 'عنوان الصفحة' }[lang] || 'Titre de la page'
    }</h1><p class="sari-lead">${
      { fr: 'Double-cliquez pour écrire ici, ou glissez un bloc depuis la gauche.', en: 'Double-click to write here, or drag a block from the left.', ar: 'انقر مرتين للكتابة هنا، أو اسحب لبنة من اليسار.' }[lang] || 'Double-cliquez pour écrire ici.'
    }</p></div></section></main>`,
  },
  {
    id: 'landing',
    label: 'Page d’atterrissage',
    description: 'Bandeau titre, atouts, preuve chiffrée, appel à l’action.',
    html: () => builderComponentById('sari-landing')?.html || '',
  },
  {
    id: 'flyer',
    label: 'Flyer d’offre',
    description: 'Une carte à lire d’un bout à l’autre, printable.',
    html: () => builderComponentById('sari-flyer-offer')?.html || '',
  },
  {
    id: 'gallery',
    label: 'Galerie',
    description: 'En-tête court et mosaïque de photos.',
    html: () =>
      `<main class="sari-shell">${builderComponentById('sari-page-head')?.html || ''}${builderComponentById('sari-gallery')?.html || ''}</main>`,
  },
  {
    id: 'campaign',
    label: 'Campagne (slider + CTA)',
    description: 'Un diaporama suivi d’un bandeau d’action.',
    html: () =>
      `<main class="sari-shell">${builderComponentById('sari-slider-images')?.html || ''}${builderComponentById('sari-cta-band')?.html || ''}</main>`,
  },
];

/** Le CSS que le constructeur pose dans la page quand elle n'a pas encore de style. */
export const STARTER_CSS = `/* Le kit du constructeur (boutons, galeries, carrousels,
   flyers, bandeaux) est déjà servi par le site : cette feuille n'est là que pour
   ce que la page a de particulier — une couleur, un espacement, une police. */
`;

export function starterTemplate(id: string): BuilderTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}
