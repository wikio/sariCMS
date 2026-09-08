'use client';

/**
 * Les comportements des blocs construits : diaporama, carrousel, visionneuse.
 *
 * Le HTML sort du constructeur de l'administration et arrive ici tel quel — il ne
 * peut pas contenir de script (le champ `content` est passé dans un `dangerouslySet
 * InnerHTML` après assainissement, qui retire tout `on*` et tout `<script>`). Donc
 * la page construite ne promet que de la **structure** : `data-sari-slides`,
 * `data-sari-carousel`, `data-sari-lightbox`, et des classes de réglage. Ce composant
 * les reconnaît et les câble, après le rendu serveur, sur le même principe que le
 * reste du site : la page se lit sans JavaScript, et s'anime avec.
 *
 * Trois détails comptent :
 * - `is-ready` n'est posé qu'ici : avant, les slides et les cartes sont empilés,
 *   donc rien ne disparaît si le script ne s'exécute pas ;
 * - les préférences du visiteur (`prefers-reduced-motion`) coupent l'autoplay, pas
 *   la navigation manuelle ;
 * - la visionneuse est une boîte hors flux, renvoyée au `<body>` : posée dans le
 *   conteneur de la page, elle hériterait de ses `transform` et se retrouverait
 *   coincée sous le contenu.
 */
import { useEffect, type RefObject } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

export function usePageBehaviors(
  root: RefObject<HTMLElement | null>,
  options: { enabled?: boolean } = {},
): void {
  const enabled = options.enabled !== false;
  useEffect(() => {
    const host = root.current;
    if (!host || !enabled) return;
    const cleanups: Array<() => void> = [];
    const on = (
      element: Element | Document | Window,
      type: string,
      handler: EventListener,
      extra?: AddEventListenerOptions,
    ) => {
      element.addEventListener(type, handler, extra);
      return () => element.removeEventListener(type, handler, extra);
    };
    const all = <T extends HTMLElement>(selector: string) =>
      Array.from(host.querySelectorAll<T>(selector));

    // ——— Diaporama ———
    for (const box of all<HTMLDivElement>('[data-sari-slides]')) {
      const slides = Array.from(box.querySelectorAll<HTMLElement>('.sari-slide'));
      if (slides.length < 2) continue;
      box.classList.add('is-ready');
      const track = document.createElement('div');
      track.className = 'sari-slides__dots';
      track.setAttribute('role', 'tablist');
      const dots = slides.map((_, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'sari-slides__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', String(index + 1));
        track.appendChild(dot);
        return dot;
      });
      box.appendChild(track);
      for (const side of ['prev', 'next'] as const) {
        const arrow = document.createElement('button');
        arrow.type = 'button';
        arrow.className = `sari-slides__arrow sari-slides__arrow--${side}`;
        arrow.dataset.slideArrow = side;
        arrow.setAttribute('aria-label', side === 'prev' ? 'Visuel précédent' : 'Visuel suivant');
        arrow.textContent = side === 'prev' ? '‹' : '›';
        box.appendChild(arrow);
      }
      let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
      let timer: number | null = null;
      const show = (index: number) => {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle('is-active', i === current);
          slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
        });
        dots.forEach((dot, i) => {
          dot.classList.toggle('is-active', i === current);
          dot.setAttribute('aria-selected', i === current ? 'true' : 'false');
        });
      };
      show(current);
      cleanups.push(
        on(box, 'click', (event) => {
          const target = event.target as HTMLElement;
          const arrow = target.closest<HTMLElement>('[data-slide-arrow]');
          if (arrow) {
            event.preventDefault();
            show(current + (arrow.dataset.slideArrow === 'prev' ? -1 : 1));
            return;
          }
          const dot = target.closest<HTMLButtonElement>('.sari-slides__dot');
          if (dot) {
            event.preventDefault();
            show(dots.indexOf(dot));
          }
        }),
      );
      const reduced = window.matchMedia(REDUCED).matches;
      // Le rythme : un `data-interval` posé sur le bloc décide d'abord — c'est le
      // réglage fin, celui qui existe pour une raison précise. À défaut, la classe
      // de fiche `.sari-slides--slow` allonge à 9 s, comme pour le carrousel : sans
      // elle, la classe serait citée dans le panneau et ne ferait rien.
      const interval = Math.max(
        2000,
        Number(box.dataset.interval || 0) || (box.classList.contains('sari-slides--slow') ? 9000 : 6000),
      );
      const autoplay = !reduced && box.classList.contains('sari-slides--auto');
      if (autoplay) {
        const start = () => {
          if (timer === null) timer = window.setInterval(() => show(current + 1), interval);
        };
        const stop = () => {
          if (timer !== null) window.clearInterval(timer);
          timer = null;
        };
        start();
        cleanups.push(on(box, 'pointerenter', stop), on(box, 'focusin', stop), on(box, 'pointerleave', start), on(box, 'focusout', start));
        cleanups.push(() => stop());
      }
    }

    // ——— Carrousel ———
    for (const box of all<HTMLDivElement>('[data-sari-carousel]')) {
      const track = box.querySelector<HTMLElement>('.sari-carousel__track');
      if (!track) continue;
      const step = () => {
        const item = track.querySelector<HTMLElement>('.sari-carousel__item');
        const width = item ? item.getBoundingClientRect().width : track.clientWidth * 0.8;
        return Math.max(160, width + 16);
      };
      const reduced = window.matchMedia(REDUCED).matches;
      const sync = () => {
        const max = track.scrollWidth - track.clientWidth - 2;
        const prev = box.querySelector<HTMLButtonElement>('[data-carousel-prev]');
        const next = box.querySelector<HTMLButtonElement>('[data-carousel-next]');
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= max;
      };
      cleanups.push(
        on(box, 'click', (event) => {
          const button = (event.target as HTMLElement).closest<HTMLElement>('[data-carousel-prev],[data-carousel-next]');
          if (!button) return;
          event.preventDefault();
          const dir = button.hasAttribute('data-carousel-next') ? 1 : -1;
          // En écriture de droite à gauche, `scrollLeft` est négatif : la flèche
          // « suivant » doit pousser dans le sens que le lecteur attend.
          const rtl = getComputedStyle(track).direction === 'rtl';
          const amount = step() * dir * (rtl ? -1 : 1);
          track.scrollBy({ left: amount, behavior: reduced ? 'auto' : 'smooth' });
        }),
        on(track, 'scroll', sync, { passive: true }),
        on(window, 'resize', sync),
      );
      sync();
      if (!reduced && box.classList.contains('sari-carousel--auto')) {
        const period = box.classList.contains('sari-carousel--slow') ? 9000 : 5000;
        let paused = false;
        const id = window.setInterval(() => {
          if (paused) return;
          const max = track.scrollWidth - track.clientWidth - 2;
          const rtl = getComputedStyle(track).direction === 'rtl';
          const forward = rtl ? track.scrollLeft > -max + 2 : track.scrollLeft < max;
          track.scrollTo({ left: forward ? track.scrollLeft + step() * (rtl ? -1 : 1) : 0, behavior: 'smooth' });
        }, period);
        const pause = () => {
          paused = true;
        };
        const resume = () => {
          paused = false;
        };
        cleanups.push(on(box, 'pointerenter', pause), on(box, 'pointerleave', resume), () => window.clearInterval(id));
      }
    }

    // ——— Visionneuse ———
    for (const gallery of all<HTMLDivElement>('[data-sari-lightbox]')) {
      const items = Array.from(gallery.querySelectorAll<HTMLAnchorElement>('a[href]')).filter((link) =>
        /\.(svg|png|jpe?g|webp|avif|gif)$/i.test(link.getAttribute('href') || ''),
      );
      if (!items.length) continue;
      let overlay: HTMLDivElement | null = null;
      let index = 0;
      let lastFocus: HTMLElement | null = null;

      const close = () => {
        overlay?.remove();
        overlay = null;
        document.body.style.removeProperty('overflow');
        lastFocus?.focus?.();
      };
      const paint = () => {
        if (!overlay) return;
        const link = items[index];
        const img = overlay.querySelector('img');
        const caption = overlay.querySelector('figcaption');
        const count = overlay.querySelector('.sari-lightbox__count');
        if (img) {
          img.src = link.getAttribute('href') || '';
          img.alt = link.querySelector('img')?.getAttribute('alt') || '';
        }
        if (caption) {
          caption.textContent =
            link.querySelector('.sari-gallery__cap')?.textContent?.trim() ||
            link.querySelector('img')?.getAttribute('alt') ||
            '';
        }
        if (count) count.textContent = `${index + 1} / ${items.length}`;
      };
      const move = (delta: number) => {
        index = (index + delta + items.length) % items.length;
        paint();
      };
      cleanups.push(
        on(gallery, 'click', (event) => {
          const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
          const at = link ? items.indexOf(link) : -1;
          if (at < 0) return;
          // Sans JavaScript, le lien ouvre le fichier : on ne le coupe que si la
          // visionneuse s'est réellement montée.
          event.preventDefault();
          // Une visionneuse déjà ouverte est remplacée : cliquer une autre image
          // de la page pendant la navigation doit montrer cette image, pas empiler
          // une seconde boîte.
          close();
          index = at;
          lastFocus = link;
          overlay = document.createElement('div');
          overlay.className = 'sari-lightbox';
          overlay.setAttribute('role', 'dialog');
          overlay.setAttribute('aria-modal', 'true');
          overlay.setAttribute('aria-label', 'Image en grand');
          overlay.innerHTML =
            '<div class="sari-lightbox__bar"><span class="sari-lightbox__count"></span><span class="sari-lightbox__nav">' +
            (items.length > 1 ? '<button type="button" class="sari-lightbox__btn" data-lb="prev" aria-label="Image précédente">‹</button><button type="button" class="sari-lightbox__btn" data-lb="next" aria-label="Image suivante">›</button>' : '') +
            '<button type="button" class="sari-lightbox__btn" data-lb="close" aria-label="Fermer">×</button></span></div>' +
            '<figure><img alt=""><figcaption></figcaption></figure>';
          overlay.tabIndex = -1;
          document.body.appendChild(overlay);
          document.body.style.setProperty('overflow', 'hidden');
          paint();
          (overlay.querySelector<HTMLButtonElement>('[data-lb="close"]') || overlay).focus?.();
        }),
      );
      const onKey = (event: KeyboardEvent) => {
        if (!overlay) return;
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowRight') move(1);
        if (event.key === 'ArrowLeft') move(-1);
      };
      const onClick = (event: MouseEvent) => {
        if (!overlay) return;
        const target = event.target as HTMLElement;
        if (target === overlay || target.closest('[data-lb="close"]')) {
          close();
          return;
        }
        if (target.closest('[data-lb="prev"]')) move(-1);
        if (target.closest('[data-lb="next"]')) move(1);
      };
      cleanups.push(on(window, 'keydown', onKey as EventListener), on(document, 'click', onClick as EventListener));
    }

    return () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    };
  }, [root, enabled]);
}
