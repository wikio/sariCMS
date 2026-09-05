export const ACTIONS = ['create', 'read', 'update', 'delete', 'admin'] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  'users',
  'roles',
  'permissions',
  'pages',
  'faqs',
  'testimonials',
  'menus',
  'contact',
  'translations',
  'audit',
  'settings',
  'news',
  'authors',
  'events',
  'products',
  'services',
  'partners',
  'careers',
  'solutions',
  'hero',
  'dashboard',
  'orders',
  'quotes',
  'applications',
] as const;
export type Resource = (typeof RESOURCES)[number];

export function perm(resource: Resource | string, action: Action | string): string {
  return `${resource}:${action}`;
}

export const ALL_PERMISSIONS: string[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => perm(resource, action)),
);

export const SUPER_ADMIN_SLUG = 'super-admin';
export const EDITOR_SLUG = 'editor';
export const VIEWER_SLUG = 'viewer';
