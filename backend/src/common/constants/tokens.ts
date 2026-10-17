export const REPOSITORY_FACTORY = Symbol('REPOSITORY_FACTORY');

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
export const PAGE_REPOSITORY = Symbol('PAGE_REPOSITORY');
export const FAQ_REPOSITORY = Symbol('FAQ_REPOSITORY');
export const TESTIMONIAL_REPOSITORY = Symbol('TESTIMONIAL_REPOSITORY');
export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');
export const CONTACT_INFO_REPOSITORY = Symbol('CONTACT_INFO_REPOSITORY');
export const CONTACT_MESSAGE_REPOSITORY = Symbol('CONTACT_MESSAGE_REPOSITORY');
export const TRANSLATION_REPOSITORY = Symbol('TRANSLATION_REPOSITORY');
export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
export const SETTING_REPOSITORY = Symbol('SETTING_REPOSITORY');
export const NEWS_REPOSITORY = Symbol('NEWS_REPOSITORY');
export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
export const SERVICE_REPOSITORY = Symbol('SERVICE_REPOSITORY');
export const PARTNER_REPOSITORY = Symbol('PARTNER_REPOSITORY');
export const CAREER_REPOSITORY = Symbol('CAREER_REPOSITORY');
export const SOLUTION_REPOSITORY = Symbol('SOLUTION_REPOSITORY');
export const HERO_REPOSITORY = Symbol('HERO_REPOSITORY');

export const COLLECTIONS = {
  users: 'users',
  roles: 'roles',
  permissions: 'permissions',
  refreshTokens: 'refresh_tokens',
  pages: 'pages',
  faqs: 'faqs',
  testimonials: 'testimonials',
  menus: 'menus',
  contactInfo: 'contact_info',
  contactMessages: 'contact_messages',
  translations: 'translations',
  auditLogs: 'audit_logs',
  settings: 'settings',
  news: 'news_articles',
  events: 'events',
  products: 'products',
  services: 'services',
  partners: 'partners',
  careers: 'careers',
  solutions: 'solutions',
  hero: 'hero_slides',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const PRISMA_MODEL_BY_COLLECTION: Record<string, string> = {
  users: 'user',
  roles: 'role',
  permissions: 'permission',
  refresh_tokens: 'refreshToken',
  pages: 'page',
  faqs: 'faq',
  testimonials: 'testimonial',
  menus: 'menu',
  contact_info: 'contactInfo',
  contact_messages: 'contactMessage',
  translations: 'translation',
  audit_logs: 'auditLog',
  settings: 'setting',
  news_articles: 'newsArticle',
  events: 'eventItem',
  products: 'product',
  services: 'serviceItem',
  partners: 'partner',
  careers: 'career',
  solutions: 'solutionCategory',
  hero_slides: 'heroSlide',
};
