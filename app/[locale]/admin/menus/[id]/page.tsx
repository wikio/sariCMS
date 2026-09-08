'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { cmsAdminList } from '@/lib/cms-admin';

/* ============================================================
   Ancienne fiche générique d'un menu.

   Le formulaire générique ne sait éditer que des champs simples
   (nom, emplacement, langue, statut) : il n'affichait donc ni les
   liens du menu, ni leur URL, ce qui donnait un écran d'édition
   sans le contenu qu'on venait y modifier.

   L'arborescence des liens se gère dans MenuStudio (/admin/menus),
   destination du menu latéral. On y renvoie plutôt que de maintenir
   deux éditeurs divergents, en ouvrant l'onglet correspondant au
   menu demandé pour ne pas retomber sur « Menu principal ».
   ============================================================ */

export default function Page() {
  const params = useParams();
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const id = String(params.id);

    const go = (location?: string) => {
      if (cancelled) return;
      const suffix = location ? `?location=${encodeURIComponent(location)}` : '';
      router.replace(`/${locale}/admin/menus${suffix}`);
    };

    // L'emplacement détermine l'onglet à ouvrir. S'il est introuvable
    // (menu supprimé, session expirée), on ouvre l'éditeur par défaut.
    cmsAdminList<{ id?: string | number; location?: string }>('menus', {
      filter: JSON.stringify({ locale }),
    })
      .then((rows) => go(rows.find((m) => String(m.id) === id)?.location))
      .catch(() => go());

    return () => {
      cancelled = true;
    };
  }, [locale, router, params.id]);

  return (
    <div className="ad-card">
      <PixelGridLoader label="Éditeur de menus" />
    </div>
  );
}
