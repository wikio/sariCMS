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
  slug?: string;
  title: string;
  type: string;
  date: string;
  location: string;
  shortDesc: string;
  fullContent?: string;
  image: string;
  agenda?: string[];
}

export interface News {
  id: number | string;
  slug?: string;
  title: string;
  category: string;
  date: string;
  author?: string;
  shortDesc: string;
  fullContent?: string;
  image: string;
  readTime?: string;
  tags?: string[];
  sujet?: string;
  classification?: string;
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
  slug?: string;
  title: string;
  icon: string;
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
  id: number;
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
  id: string;
  title: string;
  shortDesc: string;
  fullDesc?: string;
  icon: string;
  image: string;
  color: string;
  productIds: Array<number | string>;
  features?: string[];
  faq?: Array<{ q: string; a: string }>;
}

export interface Navigation {
  id: string;
  label: string;
  href: string;
  icon?: string;
}