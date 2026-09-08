// components/layout/RoutePreloadGate.tsx
'use client';

/**
 * Le préchargement à la souris, et le damier qui prévient pendant que la page arrive.
 *
 * Sur la vitrine, un clic peut précéder de plusieurs centaines de millisecondes le
 * premier octet de la page suivante : une page construite dans l'éditeur, une vue qui
 * attend le CMS, une connexion de cabinet mobile. Sans signe, le visiteur reclique —
 * et retombe souvent sur la même page, une fois de plus. Ce composant fait deux
 * choses, dans cet ordre :
 *
 *   1. au survol (et au focus clavier) d'un lien interne, il demande le préchargement
 *      — Next ne s'occupe que de ce qui est dans le champ de vision, et le menu mobile
 *      se déroule après le chargement, donc hors champ ;
 *   2. au clic sur un lien dont la cible n'est pas encore tiède, il affiche le damier
 *      de pixels avant même que la navigation ne commence, et le range dès que la
 *      nouvelle page s'affiche.
 *
 * Un lien déjà tiède ne déclenche pas de voile : la navigation sera instantanée, et
 * une animation qui clignote une frame sur deux est pire que pas d'animation. Enfin,
 * l'arrière-plan ne capte aucun clic et se range de lui-même au bout de dix secondes :
 * un lien qui ne mène nulle part ne doit pas laisser l'écran sous cloche.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PixelGridLoader from '@/components/ui/PixelGridLoader';
import { anchorFrom, isInternalHref, isSamePage, isWarm, markWarm } from '@/lib/route-preload';

/** Au-delà, on range le voile : un lien qui ne navigue pas ne doit pas cloîtrer la page. */
const PATIENCE_MS = 10_000;

/** L'administration a déjà ses propres indicateurs ; le voile double y fait tressauter les tableaux. */
const EXCLUDED_PREFIXES = ['/admin', '/builder', '/connexion', '/inscription'];

export default function RoutePreloadGate() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common.common');
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setPending(null);
  }, []);

  useEffect(() => {
    // La page où l'on est est, par définition, chargée ; et une navigation qui
    // échoue ou revient en arrière ne doit pas laisser le voile accroché.
    markWarm(pathname);
    hide();
  }, [pathname, hide]);

  useEffect(() => {
    const excluded = () => {
      const path = window.location.pathname;
      const localeless = /^\/(fr|en|ar)(\/|$)/.test(path) ? path.slice(3) || '/' : path;
      return EXCLUDED_PREFIXES.some((prefix) => localeless.startsWith(prefix));
    };

    // Une seule et même fonction pour `pointerover` et `focusin` : survoler et
    // atteindre au clavier doivent tiédir la même cible.
    const warm = (event: Event) => {
      if (excluded()) return;
      const href = isInternalHref(anchorFrom(event.target), window.location.origin);
      if (!href || isWarm(href)) return;
      try {
        router.prefetch(href);
      } catch {
        // Un préchargement refusé n'est pas grave ; le clic, lui, marchera.
      }
      markWarm(href);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (excluded()) return;
      const href = isInternalHref(anchorFrom(event.target), window.location.origin);
      if (!href || isWarm(href) || isSamePage(href)) return;
      setPending(href);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, PATIENCE_MS);
    };

    document.addEventListener('pointerover', warm, true);
    document.addEventListener('focusin', warm, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('popstate', hide);
    window.addEventListener('pagehide', hide);

    return () => {
      document.removeEventListener('pointerover', warm, true);
      document.removeEventListener('focusin', warm, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('popstate', hide);
      window.removeEventListener('pagehide', hide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hide, router]);

  if (!pending) return null;

  return (
    <div className="pixel-grid-veil" data-route={pending}>
      <PixelGridLoader label={t('loading')} />
    </div>
  );
}
