// components/ui/PixelGridLoader.tsx
/**
 * Le damier de la vitrine. `components/admin/PixelGridLoader` porte le même nom et un
 * usage voisin, mais se dessine avec `app/admin.css`, que la vitrine ne charge pas :
 * les deux vivent séparément, et se ressemblent volontairement.
 */
'use client';

/**
 * Le damier de pixels qui prévient « ça charge ».
 *
 * Une navigation sur la vitrine peut traîner — une page construite à la volée, un
 * appel CMS lent, une connexion de clinic mobile — et sans signe visible le visiteur
 * reclique, puis croit la page cassée. Ce composant n'est pas un spinner de plus :
 * il reprend le grain des visuels du site (des pixels, une grille) et il reste
 * discret — 15 cases, une impulsion en diagonale, rien qui clignote.
 *
 * Trois garde-fous valent le détour :
 *   - `role="status"` + un libellé (affiché sous la grille quand on en donne un, et
 *     toujours lu par les lecteurs d'écran) ;
 *   - `prefers-reduced-motion` : la grille s'allume une fois, immobile ;
 *   - le conteneur ne capte aucun clic (`pointer-events: none`) : quoi qu'il arrive,
 *     on peut continuer à cliquer pendant que l'animation tourne.
 */
const ROWS = 3;
const COLS = 5;

export default function PixelGridLoader({
  label,
  compact = false,
}: {
  /** Ce que lit un lecteur d'écran ; à l'affichage, rien. */
  label?: string;
  /** En ligne (dans un bouton, un bandeau) plutôt qu'en plein écran. */
  compact?: boolean;
}) {
  const cells = Array.from({ length: ROWS * COLS }, (_, i) => i);

  return (
    <div
      className="pixel-grid-wrap"
      data-compact={compact ? 'true' : undefined}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="pixel-grid" aria-hidden="true">
        {cells.map((i) => (
          <span
            key={i}
            className="pixel-grid__cell"
            style={{ ['--pixel-delay' as string]: `${((i % COLS) + Math.floor(i / COLS)) * 90}ms` }}
          />
        ))}
      </div>
      {label ? <span className="pixel-grid__label">{label}</span> : null}
    </div>
  );
}
