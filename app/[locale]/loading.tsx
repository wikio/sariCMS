// app/[locale]/loading.tsx
/**
 * Le damier de pixels que voit le visiteur pendant que la page d'après se prépare.
 *
 * Next l'affiche dès qu'un composant serveur suspend le rendu — une page construite
 * dans l'éditeur, un appel au CMS, une liste qui trie en base. Sans lui, le clic ne
 * renvoie rien pendant quelques centaines de millisecondes et le visiteur reclique.
 * Le même motif sert au voile posé par `RoutePreloadGate` avant le premier octet :
 * une seule animation, un seul vocabulaire visuel, du clic à l'affichage.
 */
import { getTranslations } from 'next-intl/server';
import PixelGridLoader from '@/components/ui/PixelGridLoader';

export default async function LocaleLoading() {
  const t = await getTranslations('common.common');
  return (
    <div className="pixel-grid-veil">
      <PixelGridLoader label={t('loading')} />
    </div>
  );
}
