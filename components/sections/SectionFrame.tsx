'use client';

/**
 * Enveloppe commune des blocs de la page d'accueil.
 *
 * Elle applique ce que l'administration règle pour tous les blocs de la même
 * façon : fond, hauteur, largeur de conteneur, alignement, grille, arrondi,
 * ombre, CSS libre — et rend le HTML produit par le constructeur de page quand
 * le bloc y est passé, à la place du rendu natif.
 *
 * Les valeurs dynamiques passent par des variables CSS (`--hs-cols`,
 * `--hs-gap`, `--hs-radius`) posées sur le `<section>` : les classes Tailwind
 * restent littérales (donc compilées) et seule la valeur change d'un bloc à
 * l'autre.
 */
import type { ReactNode } from 'react';
import {
  BACKGROUND_CLASS,
  CONTAINER_CLASS,
  TITLE_SIZE_CLASS,
  sanitizeBuilderHtml,
  scopeCss,
  styleVars,
  txt,
  type HomeSectionConfig,
} from '@/lib/home/config';

export const HS_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 md:[grid-template-columns:repeat(var(--hs-cols,3),minmax(0,1fr))] gap-[var(--hs-gap,24px)]';
export const HS_CARD_RADIUS = 'rounded-[var(--hs-radius,12px)]';
export const HS_SHADOW = 'shadow-[0_18px_50px_rgba(15,23,42,0.08)]';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Classes de grille pour `columns` colonnes.
 *
 * Les points de rupture sont écrits en toutes lettres, et non calculés :
 * Tailwind ne compile que les classes littérales, un `grid-cols-${n}` construit
 * à l'exécution n'existerait pas dans la feuille de style. Ils reprennent la
 * page d'avant — une colonne jusqu'à `md`, deux à `md`, `n` à `lg` — pour
 * qu'aucun bloc ne se retrouve plus à l'étroit qu'auparavant. Au-delà de six
 * colonnes, on retombe sur la grille pilotée par `--hs-cols`.
 */
export function gridClassFor(columns: number): string {
  if (columns <= 1) return 'grid grid-cols-1';
  if (columns === 2) return 'grid grid-cols-1 md:grid-cols-2';
  if (columns === 3) return 'grid grid-cols-1 md:grid-cols-3';
  if (columns === 4) return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  if (columns === 5) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
  if (columns === 6) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6';
  return `grid ${HS_GRID_CLASS}`;
}

export function sectionInlineStyle(config: HomeSectionConfig | undefined): React.CSSProperties {
  const style = config?.style || {};
  const vars = styleVars(config);
  const css: Record<string, string | number> = { ...vars };
  if (style.paddingY !== undefined) {
    css.paddingTop = `${style.paddingY}px`;
    css.paddingBottom = `${style.paddingY}px`;
  }
  if (style.background === 'custom' && style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.shadow) css.boxShadow = '0 24px 60px rgba(15,23,42,0.10)';
  return css as React.CSSProperties;
}

export function sectionBgStyle(config: HomeSectionConfig | undefined): React.CSSProperties {
  const style = config?.style || {};
  if (!style.backgroundImage) return {};
  return {
    backgroundImage: `url("${style.backgroundImage}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: config?.settings?.parallax === false ? 'scroll' : 'fixed',
  };
}

interface HeaderProps {
  config?: HomeSectionConfig;
  /** Traductions du site, utilisées quand le champ n'est pas saisi dans le studio. */
  fallbacks?: { subtitle?: string; title?: string; description?: string };
  action?: ReactNode;
  align?: 'start' | 'center' | 'end';
  as?: 'div';
}

/** Titre de section (surtitre / titre / description) + bouton à droite. */
export function SectionHeader({ config, fallbacks = {}, action, align }: HeaderProps) {
  const style = config?.style || {};
  if (style.showHeader === false) return null;
  const subtitle = txt(config, 'subtitle', fallbacks.subtitle || '');
  const title = txt(config, 'title', fallbacks.title || '');
  const description = txt(config, 'description', fallbacks.description || '');
  const hasContent = Boolean(subtitle || title || description || action);
  if (!hasContent) return null;

  const alignment = align || style.align || 'start';
  const centered = alignment === 'center';

  return (
    <div
      className={cx(
        'gap-4 flex flex-col mb-12',
        centered ? 'items-center text-center md:mb-16' : 'md:flex-row md:items-end md:justify-between',
      )}
    >
      <div className={cx('space-y-1', centered && 'mx-auto max-w-3xl')}>
        {subtitle ? (
          <span className={cx('font-bold uppercase tracking-wider text-sm', style.invert ? 'text-sari-lime' : 'text-sari-lime')}>
            {subtitle}
          </span>
        ) : null}
        {title ? (
          <h2 className={cx('font-bold mt-4 mb-4', TITLE_SIZE_CLASS[style.titleSize || 'lg'], style.invert ? 'text-white' : 'text-sari-dark dark:text-white')}>
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className={cx('text-xl max-w-2xl', style.invert ? 'text-blue-50' : 'text-gray-600 dark:text-gray-400')}>{description}</p>
        ) : null}
      </div>
      {action ? <div className={cx(centered && 'mt-4')}>{action}</div> : null}
    </div>
  );
}

interface FrameProps {
  /** Clé du bloc : sert d'`id` (lien direct, ancrage) et de portée du CSS libre. */
  sectionKey: string;
  config?: HomeSectionConfig;
  children?: ReactNode;
  className?: string;
  /** En-tête à l'intérieur du conteneur (défaut) ou pleine largeur. */
  header?: HeaderProps;
  /** Masque tout le bloc (désactivé dans le studio) — rendu `null`. */
  respectDisabled?: boolean;
}

export function isSectionVisible(config: HomeSectionConfig | undefined): boolean {
  if (!config) return true;
  if (config.enabled === false) return false;
  return config.status !== 'draft';
}

/**
 * CSS libre + CSS du constructeur, limités au bloc. Les bandeaux qui dessinent
 * leur propre structure (mission, CTA, newsletter, slider) l'utilisent pour que
 * le champ « CSS libre » fonctionne partout de la même façon.
 */
export function ScopedStyle({ sectionKey, config }: { sectionKey: string; config?: HomeSectionConfig }) {
  const custom = config?.style?.customCss?.trim() || '';
  const builder = config?.builder?.css?.trim() || '';
  if (!custom && !builder) return null;
  const scope = `.hs-${sectionKey.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <style
      dangerouslySetInnerHTML={{ __html: [scopeCss(custom, scope), scopeCss(builder, scope)].join('\n') }}
    />
  );
}

/** Le bloc a-t-il été repris par le constructeur de page ? */
export function isBuilderHtml(config: HomeSectionConfig | undefined): boolean {
  return config?.builder?.mode === 'html' && Boolean(config?.builder?.html?.trim());
}

export default function SectionFrame({
  sectionKey,
  config,
  children,
  className,
  header,
  respectDisabled = true,
}: FrameProps) {
  if (respectDisabled && !isSectionVisible(config)) return null;

  const style = config?.style || {};
  const background = style.background || 'inherit';
  const bgClass = BACKGROUND_CLASS[background] || '';
  const containerClass = CONTAINER_CLASS[style.container || 'normal'] || CONTAINER_CLASS.normal;
  const scoped = `hs-${sectionKey.replace(/[^a-z0-9]/gi, '-')}`;
  const customCss = style.customCss?.trim();
  const builderCss = config?.builder?.css?.trim();
  const builderHtml = isBuilderHtml(config) ? sanitizeBuilderHtml(String(config?.builder?.html)) : '';

  return (
    <section
      id={`home-${sectionKey}`}
      className={cx(scoped, 'relative overflow-hidden', bgClass, className)}
      style={{ ...sectionInlineStyle(config), ...sectionBgStyle(config) }}
    >
      {customCss || builderCss ? (
        <style
          // Le style vient de l'administration (constructeur de page ou CSS
          // libre) : il est délibérément limité à la portée du bloc.
          dangerouslySetInnerHTML={{ __html: [scopeCss(customCss || '', `.${scoped}`), scopeCss(builderCss || '', `.${scoped}`)].join('\n') }}
        />
      ) : null}
      {style.pattern ? <div className="absolute inset-0 grid-pattern-bg opacity-10" aria-hidden /> : null}
      {style.overlay && style.backgroundImage ? (
        <div className="absolute inset-0 bg-sari-dark" style={{ opacity: Number(style.overlay) / 100 }} aria-hidden />
      ) : null}
      <div className={cx(containerClass, 'relative z-10')}>
        {header ? <SectionHeader {...header} config={config} /> : null}
        {builderHtml ? (
          <div dangerouslySetInnerHTML={{ __html: builderHtml }} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Rendu « constructeur de page » pour les blocs qui n'ont pas la structure
 * d'une section standard (le slider plein écran, par exemple) : si le bloc a
 * été repris par GrapesJS, on montre son HTML, sinon le rendu natif.
 */
export function BuilderBlock({
  config,
  sectionKey,
  children,
}: {
  config?: HomeSectionConfig;
  sectionKey: string;
  children: ReactNode;
}) {
  const scoped = `hs-${sectionKey.replace(/[^a-z0-9]/gi, '-')}`;
  if (!isBuilderHtml(config)) return <>{children}</>;
  const css = config?.builder?.css?.trim();
  return (
    <div className={scoped}>
      {css ? <style dangerouslySetInnerHTML={{ __html: scopeCss(css, `.${scoped}`) }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: sanitizeBuilderHtml(String(config?.builder?.html)) }} />
    </div>
  );
}

/** Grille alignée sur le nombre de colonnes réglé dans le studio. */
export function gridProps(config: HomeSectionConfig | undefined, fallbackColumns = 3, fallbackGap = 24) {
  const style = config?.style || {};
  const columns = style.columns || fallbackColumns;
  return {
    className: gridClassFor(columns),
    style: {
      '--hs-cols': String(style.columns || fallbackColumns),
      '--hs-gap': `${style.gap ?? fallbackGap}px`,
      '--hs-radius': `${style.radius ?? 12}px`,
    } as React.CSSProperties,
  };
}
