import type { ReactNode } from 'react';

import AdminLayout from '@/components/admin/AdminLayout';
import { AdminBrandProvider } from '@/components/admin/BrandContext';
import { BRAND_DEFAULTS, loadBrand } from '@/lib/brand';

/**
 * Métadonnées de l'administration.
 *
 * Avant ce fichier, le layout admin ne déclarait **aucune** métadonnée : les
 * écrans héritaient de celles de la vitrine, titre commercial compris. L'onglet
 * du navigateur d'un administrateur affichait donc « SARI Système - Équipements
 * Médicaux », jamais le nom du back-office.
 *
 * Le logo de la marque sert aussi de favicon : c'est l'image chargée dans
 * Réglages → Identité du back-office, donc l'onglet suit le logo sans qu'on ait
 * à retoucher `app/favicon.ico` (qui reste le repli, par convention Next, dès
 * que ce champ est vide).
 *
 * `robots: noindex` : l'administration n'a rien à faire dans un index public.
 * Sans cette ligne, l'`index, follow` du layout vitrine s'appliquait à /admin.
 */
export async function generateMetadata() {
  const brand = await loadBrand();
  return {
    title: {
      // `absolute`, et pas seulement `default` : le layout vitrine déclare un
      // modèle `%s | SARI Système`, et Next l'applique à tout titre d'un layout
      // enfant. Sans ce contournement, l'onglet de l'administration affichait
      // « SARI CMS | SARI Système » — le nom commercial de la boutique collé au
      // dos du back-office, ce que la centralisation venait précisément corriger.
      absolute: brand.title || BRAND_DEFAULTS.title,
      template: `%s · ${brand.title || BRAND_DEFAULTS.title}`,
    },
    robots: 'noindex, nofollow',
    openGraph: { title: brand.title },
    // Pas de `type:` déclaré : le logo peut être un PNG, un JPEG ou un SVG, et
    // une déclaration erronée vaut mieux que… rien du tout, mais un `type` faux
    // est une affirmation gratuite. Seul `url` est nécessaire ici.
    ...(brand.logo ? { icons: { icon: [{ url: brand.logo }], apple: [{ url: brand.logo }] } } : {}),
  };
}

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  // Une seule lecture pour les deux usages : ce que rend `generateMetadata` et ce
  // que voit l'arbre client. Le `loadBrand` est caché 30 s côté serveur, donc le
  // deuxième n'émet en pratique aucune requête.
  const brand = await loadBrand();
  return (
    <AdminBrandProvider initial={brand}>
      <AdminLayout>{children}</AdminLayout>
    </AdminBrandProvider>
  );
}
