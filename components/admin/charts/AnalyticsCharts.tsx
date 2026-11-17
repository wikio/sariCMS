'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow, BarChart2, BarChart3, Download, Image as ImageIcon,
  PieChart, Table as TableIcon, TrendingUp,
} from 'lucide-react';
import { exportChartDataCsv, exportSvgNodeAsPng } from '@/lib/analytics-export';

export type ChartVisualType = 'column' | 'bar' | 'area' | 'donut' | 'table';
export type ChartSortMode = 'default' | 'desc' | 'asc' | 'alpha';

export interface ChartDatum {
  key?: string;
  label: string;
  value: number;
  secondary?: number;
  secondaryLabel?: string;
  color?: string;
}

const DEFAULT_COLORS = [
  '#169EC9', '#0F9F6E', '#EAB616', '#8B5CF6', '#EC4899',
  '#F97316', '#06B6D4', '#C6DA34', '#EF4444', '#64748B',
];

/** Compteur animé progressif (respecte `enabled` et `prefers-reduced-motion`). */
export function AnimatedCounter({
  value,
  animated = true,
  suffix = '',
  decimals = 0,
}: {
  value: number | null | undefined;
  animated?: boolean;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState<number>(value ?? 0);
  const prevRef = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animated || reduced) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const start = prevRef.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.001) {
      setDisplay(value);
      return;
    }
    const duration = 520;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + diff * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDisplay(value);
        prevRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animated]);

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="tabular-nums">—</span>;
  }

  const formatted =
    decimals > 0
      ? display.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(display).toLocaleString('fr-FR');

  return (
    <span className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

/** Barre empilée animée multi-statuts avec survol interactif et légende. */
export function StackedProgressBar({
  segments,
  animated = true,
  height = 10,
  showLegend = true,
  emptyLabel = 'Aucune donnée',
}: {
  segments: Array<{ key?: string; label: string; value: number; color: string }>;
  animated?: boolean;
  height?: number;
  showLegend?: boolean;
  emptyLabel?: string;
}) {
  const [mounted, setMounted] = useState(!animated);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!animated) {
      setMounted(true);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animated]);

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

  return (
    <div className="space-y-2">
      <div
        className="w-full rounded-full overflow-hidden flex"
        style={{ height, background: 'var(--ad-surface-2)', border: '1px solid var(--ad-line)' }}
      >
        {total === 0 ? (
          <div className="w-full h-full opacity-40" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((seg) => {
              const id = seg.key || seg.label;
              const pct = (seg.value / total) * 100;
              const isDim = hovered !== null && hovered !== id;
              return (
                <div
                  key={id}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  title={`${seg.label} : ${seg.value} (${Math.round(pct)}%)`}
                  className={animated ? 'transition-all duration-700 ease-out h-full' : 'h-full'}
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    background: seg.color,
                    opacity: isDim ? 0.4 : 1,
                  }}
                />
              );
            })
        )}
      </div>

      {showLegend && (
        total === 0 ? (
          <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{emptyLabel}</div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {segments.map((seg) => {
              const id = seg.key || seg.label;
              const pct = total ? Math.round((seg.value / total) * 100) : 0;
              const active = hovered === id;
              return (
                <span
                  key={id}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  className={`inline-flex items-center gap-1.5 cursor-default transition-opacity ${
                    hovered && !active ? 'opacity-45' : 'opacity-100'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span style={{ color: 'var(--ad-muted)' }}>{seg.label}</span>
                  <strong className="tabular-nums">{seg.value}</strong>
                  {total > 0 && <span className="opacity-65 tabular-nums">({pct}%)</span>}
                </span>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/** Carte graphique configurable (type de graphique, tri, pourcentages, export CSV/PNG). */
export function ConfigurableChartCard({
  title,
  subtitle,
  icon,
  items,
  defaultType = 'column',
  animated = true,
  allowedTypes = ['column', 'bar', 'area', 'donut', 'table'],
  valueFormatter,
  emptyLabel = 'Aucune donnée pour ce filtre.',
  extraHeader,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: ChartDatum[];
  defaultType?: ChartVisualType;
  animated?: boolean;
  allowedTypes?: ChartVisualType[];
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
  extraHeader?: React.ReactNode;
}) {
  const [chartType, setChartType] = useState<ChartVisualType>(defaultType);
  const [sortMode, setSortMode] = useState<ChartSortMode>('default');
  const [hideZeros, setHideZeros] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(!animated);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setChartType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    if (!animated) {
      setMounted(true);
      return;
    }
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animated, chartType, items]);

  const prepared = useMemo(() => {
    let list = items.map((it, idx) => ({
      ...it,
      color: it.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    }));
    if (hideZeros) list = list.filter((it) => it.value > 0);
    if (sortMode === 'desc') list = [...list].sort((a, b) => b.value - a.value);
    else if (sortMode === 'asc') list = [...list].sort((a, b) => a.value - b.value);
    else if (sortMode === 'alpha') list = [...list].sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [items, hideZeros, sortMode]);

  const total = useMemo(() => prepared.reduce((s, i) => s + Math.max(0, i.value), 0), [prepared]);
  const maxVal = useMemo(() => Math.max(1, ...prepared.map((i) => i.value)), [prepared]);
  const fmt = (v: number) => (valueFormatter ? valueFormatter(v) : Number.isInteger(v) ? v.toLocaleString('fr-FR') : v.toFixed(1));

  const allTypeButtons: Array<{ id: ChartVisualType; icon: typeof BarChart3; label: string }> = [
    { id: 'column', icon: BarChart3, label: 'Colonnes' },
    { id: 'bar', icon: BarChart2, label: 'Barres' },
    { id: 'area', icon: TrendingUp, label: 'Courbe' },
    { id: 'donut', icon: PieChart, label: 'Anneau' },
    { id: 'table', icon: TableIcon, label: 'Tableau' },
  ];
  const typeButtons = allTypeButtons.filter((b) => allowedTypes.includes(b.id));

  const cycleSort = () => {
    const order: ChartSortMode[] = ['default', 'desc', 'asc', 'alpha'];
    setSortMode(order[(order.indexOf(sortMode) + 1) % order.length]);
  };

  return (
    <section className="ad-card p-5 space-y-4 flex flex-col">
      {/* En-tête + barre de configuration */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-black text-base flex items-center gap-2">
            {icon}
            <span className="truncate">{title}</span>
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {extraHeader}
          <div className="inline-flex rounded-lg p-0.5 border" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
            {typeButtons.map((b) => {
              const Icon = b.icon;
              const active = chartType === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  title={b.label}
                  onClick={() => setChartType(b.id)}
                  className={`p-1.5 rounded-md transition-all ${active ? 'ad-btn-primary' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={cycleSort}
            title={`Tri : ${sortMode}`}
            className={`ad-btn !p-1.5 text-xs ${sortMode !== 'default' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setHideZeros((v) => !v)}
            title="Masquer les valeurs nulles"
            className={`ad-btn !py-1 !px-2 text-[11px] ${hideZeros ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          >
            ≠0
          </button>

          <button
            type="button"
            title="Exporter CSV"
            onClick={() => exportChartDataCsv(title, prepared)}
            className="ad-btn ad-btn-ghost !p-1.5"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {chartType !== 'bar' && chartType !== 'table' && (
            <button
              type="button"
              title="Exporter PNG"
              onClick={() => exportSvgNodeAsPng(svgRef.current, title)}
              className="ad-btn ad-btn-ghost !p-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Corps du graphique */}
      {prepared.length === 0 || (total === 0 && chartType === 'donut') ? (
        <div className="py-10 text-center text-xs rounded-lg border border-dashed" style={{ borderColor: 'var(--ad-line)', color: 'var(--ad-muted)' }}>
          {emptyLabel}
        </div>
      ) : chartType === 'bar' ? (
        <div className="space-y-2.5">
          {prepared.map((item, idx) => {
            const pctVal = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const widthPct = (item.value / maxVal) * 100;
            const isHover = hoveredIdx === idx;
            return (
              <div
                key={item.key || item.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold truncate flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="tabular-nums font-bold shrink-0">
                    {fmt(item.value)}{' '}
                    <span className="font-normal opacity-65">({pctVal}%)</span>
                  </span>
                </div>
                <div
                  className="h-2.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--ad-surface-2)', border: '1px solid var(--ad-line)' }}
                >
                  <div
                    className={animated ? 'h-full rounded-full transition-all duration-700 ease-out' : 'h-full rounded-full'}
                    style={{
                      width: mounted ? `${widthPct}%` : '0%',
                      background: item.color,
                      filter: isHover ? 'brightness(1.12)' : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : chartType === 'column' ? (
        <div className="w-full overflow-x-auto">
          <svg ref={svgRef} viewBox="0 0 560 220" className="w-full h-56 select-none">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = 180 - step * 150;
              return (
                <g key={step}>
                  <line x1="36" y1={y} x2="546" y2={y} stroke="var(--ad-line)" strokeDasharray={step > 0 ? '3 3' : undefined} />
                  <text x="30" y={y + 4} textAnchor="end" fontSize="9" fill="var(--ad-muted)">
                    {Math.round(maxVal * step)}
                  </text>
                </g>
              );
            })}
            {prepared.map((item, idx) => {
              const slotW = 500 / Math.max(1, prepared.length);
              const barW = Math.min(44, Math.max(12, slotW * 0.62));
              const x = 42 + idx * slotW + (slotW - barW) / 2;
              const h = mounted ? (item.value / maxVal) * 150 : 0;
              const y = 180 - h;
              const isHover = hoveredIdx === idx;
              const shortLabel = item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label;
              return (
                <g
                  key={item.key || item.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(0, h)}
                    rx="5"
                    fill={item.color}
                    opacity={hoveredIdx !== null && !isHover ? 0.5 : 1}
                    style={{ transition: animated ? 'all 550ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined }}
                  />
                  <text
                    x={x + barW / 2}
                    y={Math.max(14, y - 6)}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--ad-ink)"
                  >
                    {fmt(item.value)}
                  </text>
                  <text x={x + barW / 2} y="198" textAnchor="middle" fontSize="9.5" fill="var(--ad-muted)">
                    {shortLabel}
                  </text>
                  <title>{`${item.label} : ${fmt(item.value)}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
      ) : chartType === 'area' ? (
        <div className="w-full overflow-x-auto">
          {(() => {
            const count = prepared.length;
            const pts = prepared.map((item, idx) => {
              const x = count === 1 ? 290 : 48 + (idx / (count - 1)) * 490;
              const y = 180 - (item.value / maxVal) * 146;
              return { x, y, item };
            });
            const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            const areaPath =
              pts.length > 0
                ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} 180 L ${pts[0].x.toFixed(1)} 180 Z`
                : '';
            const accent = prepared[0]?.color || '#169EC9';
            return (
              <svg ref={svgRef} viewBox="0 0 560 220" className="w-full h-56 select-none">
                <defs>
                  <linearGradient id={`areaGrad-${title.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.38" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                  const y = 180 - step * 146;
                  return (
                    <g key={step}>
                      <line x1="36" y1={y} x2="546" y2={y} stroke="var(--ad-line)" strokeDasharray="3 3" />
                      <text x="30" y={y + 4} textAnchor="end" fontSize="9" fill="var(--ad-muted)">
                        {Math.round(maxVal * step)}
                      </text>
                    </g>
                  );
                })}
                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#areaGrad-${title.replace(/[^a-z0-9]/gi, '')})`}
                    opacity={mounted ? 1 : 0}
                    style={{ transition: animated ? 'opacity 600ms ease' : undefined }}
                  />
                )}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke={accent}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {pts.map((p, idx) => {
                  const isHover = hoveredIdx === idx;
                  const shortLabel = p.item.label.length > 10 ? `${p.item.label.slice(0, 9)}…` : p.item.label;
                  return (
                    <g
                      key={p.item.key || p.item.label}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHover ? 6.5 : 4.2}
                        fill={p.item.color}
                        stroke="var(--ad-surface)"
                        strokeWidth="2"
                        style={{ transition: 'r 180ms ease' }}
                      />
                      <text x={p.x} y={Math.max(14, p.y - 10)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--ad-ink)">
                        {fmt(p.item.value)}
                      </text>
                      <text x={p.x} y="198" textAnchor="middle" fontSize="9" fill="var(--ad-muted)">
                        {shortLabel}
                      </text>
                      <title>{`${p.item.label} : ${fmt(p.item.value)}`}</title>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>
      ) : chartType === 'donut' ? (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {(() => {
            const r = 62;
            const c = 2 * Math.PI * r;
            let offset = 0;
            const activeItem = hoveredIdx !== null ? prepared[hoveredIdx] : null;
            return (
              <>
                <svg ref={svgRef} viewBox="0 0 180 180" className="w-44 h-44 shrink-0 select-none">
                  <circle cx="90" cy="90" r={r} fill="none" stroke="var(--ad-line)" strokeWidth="20" />
                  {prepared.map((item, idx) => {
                    const frac = total > 0 ? item.value / total : 0;
                    const len = mounted ? frac * c : 0;
                    const isHover = hoveredIdx === idx;
                    const el = (
                      <circle
                        key={item.key || item.label}
                        cx="90"
                        cy="90"
                        r={r}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={isHover ? 24 : 20}
                        strokeDasharray={`${len} ${Math.max(0, c - len)}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 90 90)"
                        className="cursor-pointer"
                        opacity={hoveredIdx !== null && !isHover ? 0.45 : 1}
                        style={{ transition: animated ? 'all 550ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        <title>{`${item.label} : ${fmt(item.value)} (${Math.round(frac * 100)}%)`}</title>
                      </circle>
                    );
                    offset += frac * c;
                    return el;
                  })}
                  <text x="90" y="86" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--ad-ink)">
                    {activeItem ? fmt(activeItem.value) : fmt(total)}
                  </text>
                  <text x="90" y="104" textAnchor="middle" fontSize="10" fill="var(--ad-muted)">
                    {activeItem
                      ? `${Math.round((activeItem.value / Math.max(1, total)) * 100)}%`
                      : 'TOTAL'}
                  </text>
                </svg>

                <ul className="space-y-1.5 text-xs flex-1 w-full">
                  {prepared.map((item, idx) => {
                    const frac = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    const isHover = hoveredIdx === idx;
                    return (
                      <li
                        key={item.key || item.label}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-default transition-colors ${
                          isHover ? 'bg-[var(--ad-surface-2)]' : ''
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto font-bold tabular-nums">{fmt(item.value)}</span>
                        <span className="w-9 text-right tabular-nums opacity-65">{frac}%</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-[var(--ad-line)]" style={{ color: 'var(--ad-muted)' }}>
                <th className="py-1.5">Élément</th>
                <th className="py-1.5 text-right">Valeur</th>
                <th className="py-1.5 text-right">Part</th>
              </tr>
            </thead>
            <tbody>
              {prepared.map((item) => {
                const frac = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={item.key || item.label} className="border-b border-[var(--ad-line)]/50">
                    <td className="py-1.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span>{item.label}</span>
                    </td>
                    <td className="py-1.5 text-right font-bold tabular-nums">{fmt(item.value)}</td>
                    <td className="py-1.5 text-right tabular-nums opacity-75">{frac}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Graphique chronologique multi-séries configurable avec activation de séries et export PNG/CSV. */
export function MultiSeriesTimelineChart({
  title,
  subtitle,
  data,
  series,
  animated = true,
  emptyLabel = 'Aucune activité chronologique sur la période sélectionnée.',
}: {
  title: string;
  subtitle?: string;
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string; color: string }>;
  animated?: boolean;
  emptyLabel?: string;
}) {
  const [enabledKeys, setEnabledKeys] = useState<string[]>(() => series.map((s) => s.key));
  const [mode, setMode] = useState<'area' | 'stacked'>('area');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeSeries = series.filter((s) => enabledKeys.includes(s.key));

  const toggleSeries = (key: string) => {
    setEnabledKeys((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  const maxY = useMemo(() => {
    if (!data.length || !activeSeries.length) return 1;
    let m = 1;
    for (const row of data) {
      if (mode === 'stacked') {
        const sum = activeSeries.reduce((s, sr) => s + Number(row[sr.key] || 0), 0);
        if (sum > m) m = sum;
      } else {
        for (const sr of activeSeries) {
          const v = Number(row[sr.key] || 0);
          if (v > m) m = v;
        }
      }
    }
    return m;
  }, [data, activeSeries, mode]);

  const exportCsv = () => {
    const items = data.map((row) => ({
      label: String(row.label || row.bucket || ''),
      value: activeSeries.reduce((s, sr) => s + Number(row[sr.key] || 0), 0),
    }));
    exportChartDataCsv(title, items);
  };

  return (
    <section className="ad-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--ad-accent)' }} />
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--ad-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg p-0.5 border" style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}>
            <button
              type="button"
              onClick={() => setMode('area')}
              className={`px-2 py-1 rounded text-xs font-bold ${mode === 'area' ? 'ad-btn-primary' : 'opacity-70'}`}
            >
              Courbes
            </button>
            <button
              type="button"
              onClick={() => setMode('stacked')}
              className={`px-2 py-1 rounded text-xs font-bold ${mode === 'stacked' ? 'ad-btn-primary' : 'opacity-70'}`}
            >
              Colonnes empilées
            </button>
          </div>
          <button type="button" onClick={exportCsv} className="ad-btn ad-btn-ghost !p-1.5" title="Exporter CSV">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exportSvgNodeAsPng(svgRef.current, title)}
            className="ad-btn ad-btn-ghost !p-1.5"
            title="Exporter PNG"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sélecteur interactif de séries */}
      <div className="flex flex-wrap gap-1.5">
        {series.map((s) => {
          const on = enabledKeys.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border transition-all ${
                on ? 'opacity-100' : 'opacity-40'
              }`}
              style={{
                borderColor: on ? s.color : 'var(--ad-line)',
                background: on ? `color-mix(in srgb, ${s.color} 14%, transparent)` : 'transparent',
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>

      {data.length === 0 ? (
        <div className="py-10 text-center text-xs rounded-lg border border-dashed" style={{ borderColor: 'var(--ad-line)', color: 'var(--ad-muted)' }}>
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="w-full overflow-x-auto">
            <svg ref={svgRef} viewBox="0 0 820 250" className="w-full h-60 select-none">
              {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = 205 - step * 175;
                return (
                  <g key={step}>
                    <line x1="42" y1={y} x2="804" y2={y} stroke="var(--ad-line)" strokeDasharray={step > 0 ? '3 3' : undefined} />
                    <text x="36" y={y + 4} textAnchor="end" fontSize="9.5" fill="var(--ad-muted)">
                      {Math.round(maxY * step)}
                    </text>
                  </g>
                );
              })}

              {mode === 'stacked'
                ? data.map((row, idx) => {
                    const slot = 750 / Math.max(1, data.length);
                    const barW = Math.min(34, Math.max(8, slot * 0.62));
                    const x = 48 + idx * slot + (slot - barW) / 2;
                    let yCursor = 205;
                    return (
                      <g
                        key={String(row.bucket || idx)}
                        onMouseEnter={() => setHoverIndex(idx)}
                        onMouseLeave={() => setHoverIndex(null)}
                        className="cursor-pointer"
                      >
                        {activeSeries.map((sr) => {
                          const v = Number(row[sr.key] || 0);
                          const h = (v / maxY) * 175;
                          yCursor -= h;
                          return (
                            <rect
                              key={sr.key}
                              x={x}
                              y={yCursor}
                              width={barW}
                              height={Math.max(0, h)}
                              rx="2"
                              fill={sr.color}
                              opacity={hoverIndex !== null && hoverIndex !== idx ? 0.5 : 0.92}
                              style={{ transition: animated ? 'all 450ms ease' : undefined }}
                            />
                          );
                        })}
                        {(data.length <= 14 || idx % Math.ceil(data.length / 12) === 0) && (
                          <text x={x + barW / 2} y="226" textAnchor="middle" fontSize="9.5" fill="var(--ad-muted)">
                            {String(row.label || '')}
                          </text>
                        )}
                      </g>
                    );
                  })
                : activeSeries.map((sr) => {
                    const pts = data.map((row, idx) => {
                      const x = data.length === 1 ? 420 : 52 + (idx / (data.length - 1)) * 744;
                      const y = 205 - (Number(row[sr.key] || 0) / maxY) * 175;
                      return { x, y, v: Number(row[sr.key] || 0), label: String(row.label || '') };
                    });
                    const dLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const dArea = `${dLine} L ${pts[pts.length - 1].x.toFixed(1)} 205 L ${pts[0].x.toFixed(1)} 205 Z`;
                    return (
                      <g key={sr.key}>
                        <path d={dArea} fill={sr.color} opacity="0.08" />
                        <path d={dLine} fill="none" stroke={sr.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r={hoverIndex === idx ? 5.5 : 3.2}
                            fill={sr.color}
                            stroke="var(--ad-surface)"
                            strokeWidth="1.5"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoverIndex(idx)}
                            onMouseLeave={() => setHoverIndex(null)}
                          />
                        ))}
                      </g>
                    );
                  })}

              {mode === 'area' &&
                data.map((row, idx) => {
                  if (data.length > 14 && idx % Math.ceil(data.length / 12) !== 0) return null;
                  const x = data.length === 1 ? 420 : 52 + (idx / (data.length - 1)) * 744;
                  return (
                    <text key={idx} x={x} y="226" textAnchor="middle" fontSize="9.5" fill="var(--ad-muted)">
                      {String(row.label || '')}
                    </text>
                  );
                })}
            </svg>
          </div>

          {hoverIndex !== null && data[hoverIndex] && (
            <div
              className="p-2.5 rounded-lg border text-xs flex flex-wrap items-center gap-x-4 gap-y-1"
              style={{ borderColor: 'var(--ad-line)', background: 'var(--ad-surface-2)' }}
            >
              <strong className="uppercase tracking-wider">{String(data[hoverIndex].label || data[hoverIndex].bucket)}</strong>
              {activeSeries.map((sr) => (
                <span key={sr.key} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: sr.color }} />
                  <span style={{ color: 'var(--ad-muted)' }}>{sr.label} :</span>
                  <strong className="tabular-nums">{Number(data[hoverIndex][sr.key] || 0)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
