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
  'home',
  'newsletter',
  'payments',
  'coupons',
  'taxes',
] as const;
// ^ `payments` porte le relevé des encaissements. `coupons` et `taxes` étaient
// pilotés par un `@CrudResource` sans être déclarés ici : la permission
// correspondante n'existant dans aucune table, un rôle autre que super-admin ne
// pouvait pas être autorisé à les ouvrir. Constaté en branchant ce module,
// réparé avec. Commentaire placé APRÈS le tableau et non dedans :
// `sql/permissions-catalog.mjs` extrait les ressources de ce littéral ligne à
// ligne, et un commentaire qui y traîne est pris pour un nom de ressource — le
// seed refusait alors de partir (« Catalogue désaligné »), ce qui vaut mieux
// qu'un fichier de permissions écrit à l'envers.
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
