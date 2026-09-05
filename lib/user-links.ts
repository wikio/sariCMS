/**
 * Correspondance entre le type d'un compte et la vue métier associée.
 *
 * Il n'existe qu'une seule table `users` : un « client » et un « partenaire »
 * ne sont pas des enregistrements distincts, mais le même compte avec une
 * valeur de `type` différente. Les écrans Clients et Partenaires du back-office
 * interrogent d'ailleurs `/users` filtré par `type`.
 *
 * Ces liens permettent donc de passer de la fiche compte à la vue métier
 * correspondante, filtrée sur l'email — sans dupliquer la donnée.
 */

export type UserType = 'admin' | 'client' | 'partner' | 'candidate';

interface UserTypeLink {
  /** Segment de l'URL admin, après /{locale}/admin/. */
  path: string;
  /** Clé de traduction du libellé (admin.users.links.*). */
  labelKey: string;
}

const LINKS: Record<string, UserTypeLink> = {
  client: { path: 'clients', labelKey: 'client' },
  partner: { path: 'partners-accounts', labelKey: 'partner' },
  candidate: { path: 'applications', labelKey: 'candidate' },
  admin: { path: 'permissions', labelKey: 'admin' },
};

export function userTypeLink(type: unknown): UserTypeLink | null {
  return LINKS[String(type ?? '')] || null;
}

/**
 * URL de la fiche métier d'un compte. L'email sert de clé de recherche :
 * il est unique en base (`UNIQUE KEY users_email_key`) et c'est le champ que
 * les vues métier indexent.
 */
export function userRecordHref(locale: string, type: unknown, email?: unknown): string | null {
  const link = userTypeLink(type);
  if (!link) return null;
  const base = `/${locale}/admin/${link.path}`;
  const mail = String(email ?? '').trim();
  return mail ? `${base}?search=${encodeURIComponent(mail)}` : base;
}
