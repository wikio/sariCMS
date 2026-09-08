// app/[locale]/admin/home/page.tsx
'use client';

import HomeStudio from '@/components/admin/home/HomeStudio';

/**
 * Studio de la page d'accueil : chaque bloc affiché par `app/[locale]/page.tsx`
 * se règle ici — textes par langue, fiches sélectionnées, comportement,
 * apparence, ordre d'affichage et, pour les blocs qui s'y prêtent, rendu produit
 * par le constructeur de page.
 */
export default function AdminHomePage() {
  return <HomeStudio />;
}
