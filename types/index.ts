// types/index.ts

export interface Config {
  meta: {
    companyName: string;
    tagline: string;
    description: string;
    logo: string;
    phone: string;
    email: string;
    address: string;
    social: {
      facebook: string;
      linkedin: string;
      twitter: string;
      youtube: string;
    };
  };
  stats: {
    clients: string;
    experience: string;
    support: string;
    satisfaction: string;
  };
}

export interface Menu {
  mainMenu: Array<{
    id: string;
    label: string;
    href: string;
    submenu?: Array<{
      label: string;
      href: string;
      desc?: string;
    }>;
  }>;
  footerMenu: {
    navigation: Array<{ label: string; href: string }>;
    legal: Array<{ label: string; href: string }>;
  };
  socialLinks: Record<string, string>;
}

export interface Product {
  id: number | string;
  slug?: string;
  /** Langue de la fiche (utile quand chaque langue a sa propre ligne en base). */
  locale?: string;
  /** Identifiant partagé par les versions FR/EN/AR d'un même produit. */
  legacyId?: string;
  name: string;
  category: string;
  price: string;
  shortDesc: string;
  fullDesc?: string;
  image: string;
  gallery?: string[];
  inStock: boolean;
  deliveryTime?: string;
  features?: string[];
  specs?: Record<string, string>;
  options?: Array<{
    name: string;
    choices: string[];
  }>;
  catalogPdf?: string;
}

export interface Event {
  id: number | string;
  locale?: string; // Langue du contenu (fr, en, ar)
  legacyId?: string; // ID unique pour toutes les versions linguistiques
  slug?: string;
  title: string;
  type: string;
  category?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  targetAudience?: string;
  location: string;
  shortDesc: string;
  fullContent?: string;
  image: string;
  agenda?: string[];
}

export interface Author {
  id: number | string;
  name: string;
  email?: string;
  bio?: string;
  photo?: string;
  role?: string;
  articlesCount?: number;
}

export interface News {
  id: number | string;
  locale?: string; // Langue du contenu (fr, en, ar)
  legacyId?: string; // ID unique pour toutes les versions linguistiques
  slug?: string;
  title: string;
  category: string;
  date: string;
  publicationDate?: string;
  /** Nom affiché de l'auteur (fiche liée, ou nom libre pour les articles repris). */
  author?: string;
  /** Fiche auteur liée : sert à afficher la qualification et la présentation. */
  authorId?: number | string;
  shortDesc: string;
  fullContent?: string;
  image: string;
  readTime?: string;
  tags?: string[];
  sujet?: string;
  classification?: string;
}

/**
 * Fiche auteur d'une actualité. `role` est la qualification affichée sous le
 * nom sur la page article, `bio` la présentation courte qui la suit.
 */
export interface Author {
  id: number | string;
  locale?: string;
  legacyId?: string;
  slug?: string;
  name: string;
  role?: string;
  bio?: string;
  photo?: string;
  email?: string;
  /** Auteur retenu lorsqu'un article n'en désigne aucun. */
  isFallback?: boolean;
  sortOrder?: number;
}

export interface Career {
  id: number | string;
  slug?: string;
  title: string;
  type: string;
  location: string;
  salary: string;
  shortDesc: string;
  fullDesc?: string;
  image?: string;
  typeTravail?: string;
  mission?: string;
  objectifs?: string[];
  prerequis?: string[];
  experience?: string;
  workflow?: string[];
  benefits?: string[];
  contact?: string;
  applyAuth?: 'required' | 'optional' | 'inherit';
}

export interface Service {
  id: number | string;
  /** Langue de la fiche (fr, en, ar) */
  locale?: string;
  /** Identifiant partagé par toutes les versions linguistiques d'un même service */
  legacyId?: string;
  slug?: string;
  title: string;
  icon: string;
  color?: string;
  image?: string;
  shortDesc: string;
  fullDesc?: string;
  features?: string[];
  faq?: Array<{ q: string; a: string }>;
}

export interface Testimonial {
  id: number | string;
  name: string;
  role: string;
  clinic: string;
  text: string;
  image: string;
  rating: number;
}

export interface Partner {
  id: number | string;
  name: string;
  logo: string;
  category?: string;
}

export interface LegalDoc {
  title: string;
  content: string;
  lastUpdate?: string;
}

export interface Legal {
  mentions: LegalDoc;
  privacy: LegalDoc;
  conditions: LegalDoc;
  about: LegalDoc;
  [key: string]: LegalDoc;
}

export interface GenericContent {
  id: number | string;
  title: string;
  subtitle?: string;
  category?: string;
  type?: 'full' | 'simple' | 'about' | 'gallery' | 'flyer' | 'slide' | 'scroll';
  content?: string;
  media?: string | string[];
  slides?: Array<{
    title: string;
    subtitle?: string;
    description?: string;
    media?: string;
    mediaType?: 'image' | 'video' | 'youtube';
    cta?: string;
    ctaLink?: string;
  }>;
  sections?: Array<{
    title: string;
    subtitle?: string;
    description?: string;
    media?: string;
    mediaType?: 'image' | 'video' | 'youtube';
    cta?: string;
    ctaLink?: string;
  }>;
}

export interface VerificationCode {
  code: string;
  key: string;
  type: string;
  status: 'valid' | 'invalid' | 'revoked' | 'expired';
  issuer?: string;
  invalidReason?: string;
  revocationReason?: string;
}

export interface HeroSlide {
  id: number | string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  cta: string;
  ctaLink: string;
}

export interface SolutionCategory {
  id: number | string;
  /** Langue de la fiche (fr, en, ar) */
  locale?: string;
  /** Identifiant partagé par toutes les versions linguistiques d'une même solution */
  legacyId?: string;
  slug?: string;
  title: string;
  shortDesc: string;
  fullDesc?: string;
  icon: string;
  image: string;
  color: string;
  productIds: Array<number | string>;
  features?: string[];
  faq?: Array<{ q: string; a: string }>;
  sortOrder?: number;
}

export interface Navigation {
  id: string;
  label: string;
  href: string;
  icon?: string;
}