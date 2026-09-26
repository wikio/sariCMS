'use client';

/**
 * components/admin/BrandContext.tsx — diffuse la marque dans l'administration.
 *
 * Le layout serveur la lit une fois et la passe ici. Un contexte plutôt qu'un
 * `fetch` par composant : la barre latérale, l'en-tête du tableau de bord, la
 * page de connexion et le titre de l'onglet veulent la même valeur, à la même
 * seconde, et un renommage doit les toucher ensemble — c'est tout l'objet de la
 * centralisation.
 *
 * Le hook fonctionne aussi hors fournisseur (valeur par défaut) : les écrans
 * rendus en dehors du layout admin, ou un composant réutilisé ailleurs,
 * s'affichent avec la marque du dépôt au lieu de lever « hors d'un fournisseur ».
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { BRAND_DEFAULTS, fetchBrand, normalizeBrand, type AdminBrand } from '@/lib/brand';

interface BrandContextValue {
  brand: AdminBrand;
  /** Vrai tant que le serveur n'a pas répondu — évite un titre fantôme. */
  pending: boolean;
  /** Relit la marque : appelée après un enregistrement dans les réglages. */
  refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue>({
  brand: BRAND_DEFAULTS,
  pending: false,
  refresh: async () => {},
});

export function AdminBrandProvider({ initial, children }: { initial?: AdminBrand; children: ReactNode }) {
  const [brand, setBrand] = useState<AdminBrand>(() => (initial ? normalizeBrand(initial) : BRAND_DEFAULTS));
  const [pending, setPending] = useState(!initial);

  // Le layout fournit déjà la valeur : on ne la relit pas, sauf quand il n'a pas
  // pu joindre le backend et a posé les défauts.
  const refresh = useCallback(async () => {
    try {
      setBrand(await fetchBrand());
    } catch {
      /* la valeur en place reste affichée ; un échec de relecture n'est pas une raison de tout effacer */
    } finally {
      setPending(false);
    }
  }, []);

  const value = useMemo(() => ({ brand, pending, refresh }), [brand, pending, refresh]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useAdminBrand(): BrandContextValue {
  return useContext(BrandContext);
}
