'use client';

/**
 * Les panneaux de droite de l'atelier.
 *
 * Un panneau ne parle jamais à Fabric : il parle à `Engine` (`lib/canvas/engine.ts`),
 * qui décide de ce qui doit être rejouable. Deux règles suivent de là et expliquent la
 * forme du code :
 *
 * - Un panneau ne garde pas d'état copié de la sélection. Il reçoit `props`, le lit,
 *   écrit dans le moteur, et le moteur redessine. Une copie locale serait une valeur
 *   fausse dès le premier glisser d'une poignée.
 * - Ce qui se glisse à la souris (opacité, rayon, filtre) appelle `onChange` sans
 *   history et `onCommit` à la fin du geste : l'historique doit compter un « annuler »
 *   par intention, pas soixante par glisser.
 */

import { useMemo, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Check,
  Circle,
  Crop,
  Eye,
  EyeOff,
  Italic,
  Layers,
  Lock,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Scissors,
  Shapes,
  Underline,
  Unlock,
  Wand2,
} from 'lucide-react';
import type { Engine } from '@/lib/canvas/engine';
import type { BackgroundSpec, ChartSpec, LayerInfo, ObjectProps } from '@/lib/canvas/types';
import { ARTBOARDS, alignLabel, parseChartData, sanitizeSide } from '@/lib/canvas/document';
import type { AlignMode } from '@/lib/canvas/document';
import { fontGroups } from '@/lib/canvas/fonts';
import { Card, ColorField, Field, GradientEditor, NumberField, Row, Segmented, SelectField, SliderField, TextField, Toggle } from './widgets';
import type { GradientSpec } from '@/lib/canvas/types';

/** Le bloc couleur/dégradé/rien, partagé par le fond, le remplissage et la bordure. */
function PaintField({
  label,
  value,
  onSolid,
  onGradient,
  onNone,
  allowNone = true,
}: {
  /** Le titre du carton ; le mot « couleur » que l'on lit dans les boutons vient de là. */
  label: string;
  value: { kind: 'solid'; color: string } | { kind: 'gradient'; gradient: GradientSpec } | { kind: 'none' };
  onSolid: (color: string, commit: boolean) => void;
  onGradient: (gradient: GradientSpec) => void;
  onNone?: () => void;
  allowNone?: boolean;
}) {
  const [mode, setMode] = useState<'uni' | 'degrade'>(value.kind === 'gradient' ? 'degrade' : 'uni');
  const gradient = value.kind === 'gradient' ? value.gradient : null;
  const color = value.kind === 'solid' ? value.color : '#0f172a';
  return (
    <Card title={label} icon={<Palette size={12} />}>
      <Segmented
        value={mode}
        onChange={(next) => {
          setMode(next);
          if (next === 'degrade' && !gradient) onGradient({ type: 'linear', angle: 90, stops: [{ offset: 0, color }, { offset: 100, color: '#ffffff' }] });
          if (next === 'uni' && gradient) onSolid(color, true);
        }}
        options={[
          { value: 'uni', label: 'Uni' },
          { value: 'degrade', label: 'Dégradé' },
        ]}
      />
      {mode === 'uni' ? <ColorField label="Couleur" value={color} onChange={(next) => onSolid(next, false)} onCommit={(next) => onSolid(next, true)} /> : null}
      {mode === 'degrade' && gradient ? <GradientEditor gradient={gradient} onChange={onGradient} label="Dégradé" /> : null}
      {allowNone && onNone ? (
        <button type="button" className="sc-btn" onClick={onNone}>
          Aucun {label.toLowerCase()}
        </button>
      ) : null}
    </Card>
  );
}

export function ObjectPanel({ engine, props, canUngroup }: { engine: Engine; props: ObjectProps | null; canUngroup: boolean }) {
  if (!props) {
    return (
      <Card title="Sélection" icon={<Layers size={12} />}>
        <p style={{ color: '#93a1b8', margin: 0, lineHeight: 1.5 }}>
          Rien de sélectionné. Cliquez un objet, ou glissez-en plusieurs. <br />
          <kbd>Ctrl</kbd>+<kbd>A</kbd> tout sélectionner · <kbd>Suppr</kbd> effacer · <kbd>Ctrl</kbd>+<kbd>D</kbd> dupliquer.
        </p>
      </Card>
    );
  }
  const isText = props.text !== undefined;
  const isImage = props.src !== undefined;
  return (
    <>
      <Card
        title={props.id || 'Objet'}
        icon={<Shapes size={12} />}
        actions={
          <>
            <button type="button" className="sc-btn sc-btn--icon" title={props.visible ? 'Masquer' : 'Afficher'} onClick={() => engine.setVisible(!props.visible)}>
              {props.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button type="button" className="sc-btn sc-btn--icon" title={props.locked ? 'Déverrouiller' : 'Verrouiller'} onClick={() => engine.setLocked(!props.locked)}>
              {props.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
          </>
        }
      >
        <TextField label="Nom du calque" value={props.name} onChange={(name) => engine.rename(name, props.slotId, props.slotLabel)} />
        <Row>
          <NumberField label="X" value={props.left} onChange={(left) => engine.update({ left }, 'position')} />
          <NumberField label="Y" value={props.top} onChange={(top) => engine.update({ top }, 'position')} />
        </Row>
        <Row>
          <NumberField label="Largeur" value={props.width} min={1} onChange={(width) => engine.update({ scaleX: width / (props.width || 1) }, 'taille')} />
          <NumberField label="Hauteur" value={props.height} min={1} onChange={(height) => engine.update({ scaleY: height / (props.height || 1) }, 'taille')} />
        </Row>
        <Row>
          <NumberField label="Angle" value={props.angle} suffix="°" onChange={(angle) => engine.update({ angle }, 'rotation')} />
          <Segmented
            value=""
            title="Rotation"
            onChange={(next) => engine.rotateStep(next === 'l' ? -15 : 15)}
            options={[
              { value: 'l', label: '⟲' },
              { value: 'r', label: '⟳' },
            ]}
          />
          <Segmented
            value={props.flipX ? 'x' : props.flipY ? 'y' : ''}
            title="Miroir"
            onChange={(next) => engine.flip(next as 'x' | 'y')}
            options={[
              { value: 'x', label: '⇋' },
              { value: 'y', label: '⇵' },
            ]}
          />
        </Row>
        <SliderField label="Opacité" value={Math.round(props.opacity * 100)} min={0} max={100} onChange={(opacity) => engine.update({ opacity: opacity / 100 })} onCommit={(opacity) => engine.update({ opacity: opacity / 100 }, 'opacité')} unit="%" />
        {!isText && !isImage ? (
          <SliderField label="Arrondi" value={props.rx} min={0} max={Math.round(Math.min(props.width, props.height) / 2)} onChange={(rx) => engine.update({ rx })} onCommit={(rx) => engine.update({ rx }, 'arrondis')} unit="px" />
        ) : null}
        <Row>
          <Field label="Calque">
            <Segmented
              value=""
              onChange={(next) => engine.zOrder(next as 'haut' | 'bas' | 'avant' | 'après')}
              options={[
                { value: 'avant', icon: <ArrowUpToLine size={13} />, title: 'Avancer' },
                { value: 'haut', icon: <ArrowUpToLine size={13} style={{ transform: 'scaleY(-1)' }} />, title: 'Au premier plan' },
                { value: 'bas', icon: <ArrowDownToLine size={13} style={{ transform: 'scaleY(-1)' }} />, title: 'À l’arrière-plan' },
                { value: 'après', icon: <ArrowDownToLine size={13} />, title: 'Reculer' },
              ]}
            />
          </Field>
        </Row>
        {isImage ? (
          <Row>
            <button type="button" className="sc-btn" onClick={() => engine.duplicate()}>
              Dupliquer
            </button>
            <button type="button" className="sc-btn sc-btn--danger" onClick={() => engine.remove()}>
              Supprimer
            </button>
          </Row>
        ) : (
          <Row>
            <button type="button" className="sc-btn" onClick={() => engine.duplicate()}>
              Dupliquer
            </button>
            {canUngroup ? (
              <button type="button" className="sc-btn" onClick={() => engine.ungroup()}>
                Dégrouper
              </button>
            ) : null}
            <button type="button" className="sc-btn sc-btn--danger" onClick={() => engine.remove()}>
              Supprimer
            </button>
          </Row>
        )}
      </Card>

      <Card title="Alignement" icon={<AlignStartVertical size={12} />}>
        <div className="sc-row sc-row--wrap" style={{ gap: 4 }}>
          {(['gauche', 'centre-h', 'droite', 'haut', 'centre-v', 'bas', 'caler'] as AlignMode[]).map((mode) => (
            <button key={mode} type="button" className="sc-btn" style={{ padding: '4px 8px', fontSize: 11 }} title={alignLabel(mode)} onClick={() => engine.align(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <Row>
          <Field label="Répartir">
            <Segmented
              value=""
              onChange={(next) => engine.distribute(next as 'x' | 'y')}
              options={[
                { value: 'x', icon: <MoveHorizontal size={13} />, title: 'Horizontalement' },
                { value: 'y', icon: <MoveVertical size={13} />, title: 'Verticalement' },
              ]}
            />
          </Field>
        </Row>
      </Card>

      <PaintField
        label="Remplissage"
        value={props.fill}
        onSolid={(color, commit) => (commit ? engine.setPaint('fill', { kind: 'solid', color }) : engine.setPaint('fill', { kind: 'solid', color }))}
        onGradient={(gradient) => engine.setPaint('fill', { kind: 'gradient', gradient })}
        onNone={() => engine.setPaint('fill', { kind: 'none' })}
      />
      <Card title="Bordure" icon={<Circle size={12} />}>
        <PaintField
          label="Trait"
          value={props.stroke}
          onSolid={(color) => engine.setPaint('stroke', { kind: 'solid', color })}
          onGradient={(gradient) => engine.setPaint('stroke', { kind: 'gradient', gradient })}
          onNone={() => engine.setPaint('stroke', { kind: 'none' })}
        />
        <SliderField label="Épaisseur" value={props.strokeWidth} min={0} max={40} onChange={(strokeWidth) => engine.update({ strokeWidth })} onCommit={(strokeWidth) => engine.update({ strokeWidth }, 'bordure')} unit="px" />
        <TextField label="Pointillés" value={props.strokeDash || ''} placeholder="ex. 6 3, vide = trait plein" onChange={(value) => engine.update({ strokeDashArray: value ? value.split(/[\s,]+/).map(Number) : null }, 'bordure')} />
      </Card>
      <Card title="Ombre" icon={<Wand2 size={12} />}>
        <Toggle label="Ombre portée" checked={props.shadow.enabled} onChange={(enabled) => engine.update({ shadow: { ...props.shadow, enabled } }, 'ombre')} />
        {props.shadow.enabled ? (
          <>
            <ColorField label="Couleur" value={props.shadow.color} onChange={(color) => engine.update({ shadow: { ...props.shadow, color } })} onCommit={(color) => engine.update({ shadow: { ...props.shadow, color } }, 'ombre')} />
            <SliderField label="Flou" value={props.shadow.blur} min={0} max={80} onChange={(blur) => engine.update({ shadow: { ...props.shadow, blur } })} onCommit={(blur) => engine.update({ shadow: { ...props.shadow, blur } }, 'ombre')} />
            <Row>
              <NumberField label="Décalage X" value={props.shadow.offsetX} onChange={(offsetX) => engine.update({ shadow: { ...props.shadow, offsetX } }, 'ombre')} />
              <NumberField label="Décalage Y" value={props.shadow.offsetY} onChange={(offsetY) => engine.update({ shadow: { ...props.shadow, offsetY } }, 'ombre')} />
            </Row>
          </>
        ) : null}
      </Card>
    </>
  );
}

export function TextPanel({ engine, props }: { engine: Engine; props: ObjectProps }) {
  const groups = useMemo(() => fontGroups(), []);
  // Un `setText` écrit directement dans Fabric : le moteur coalesce les entrées
  // d'historique pendant la frappe, le panneau n'a donc pas de libellé à lui passer.
  const update = (patch: Record<string, unknown>) => engine.setText(patch);
  return (
    <>
      <Card title="Texte" icon={<Bold size={12} />}>
        <TextField multiline value={props.text || ''} placeholder="Saisir le texte" onChange={(text) => update({ text })} />
        <Row>
          <div style={{ flex: 1 }}>
            <SelectField
              value={props.fontFamily || ''}
              groups={groups.map((group) => ({ label: group.category, options: group.fonts.map((font) => ({ value: font.family, label: font.label })) }))}
              options={[]}
              onChange={(fontFamily) => update({ fontFamily })}
            />
          </div>
          <NumberField label="" value={props.fontSize || 24} min={4} max={600} onChange={(fontSize) => update({ fontSize })} />
        </Row>
        <Row wrap>
          <Segmented
            value={String(props.fontWeight) === '700' || Number(props.fontWeight) >= 600 ? 'bold' : 'normal'}
            onChange={(fontWeight) => update({ fontWeight: fontWeight === 'bold' ? 700 : 400 })}
            options={[
              { value: 'bold', icon: <Bold size={13} />, title: 'Gras' },
              { value: 'normal', label: 'normal' },
            ]}
          />
          <Segmented
            value={props.fontStyle === 'italic' ? 'italic' : 'normal'}
            onChange={(fontStyle) => update({ fontStyle: fontStyle === 'italic' ? 'italic' : 'normal' })}
            options={[
              { value: 'italic', icon: <Italic size={13} />, title: 'Italique' },
              { value: 'normal', label: 'normal' },
            ]}
          />
          <Segmented
            value={props.underline ? 'on' : 'off'}
            onChange={(underline) => update({ underline: underline === 'on' })}
            options={[
              { value: 'on', icon: <Underline size={13} />, title: 'Souligné' },
              { value: 'off', label: 'off' },
            ]}
          />
          <Segmented
            value={(props.align || 'left') as 'left' | 'center' | 'right' | 'justify'}
            onChange={(align) => update({ textAlign: align })}
            options={[
              { value: 'left', icon: <AlignStartHorizontal size={13} />, title: 'À gauche' },
              { value: 'center', icon: <AlignCenterHorizontal size={13} />, title: 'Centré' },
              { value: 'right', icon: <AlignEndHorizontal size={13} />, title: 'À droite' },
              { value: 'justify', icon: <AlignCenterVertical size={13} />, title: 'Justifié' },
            ]}
          />
        </Row>
        <Row>
          <button
            type="button"
            className="sc-btn"
            title="Passer en zone de texte (retour à la ligne auto)"
            onClick={() => {
              engine.update({ type: 'textbox' }, 'zone de texte');
              engine.commit('Zone de texte');
            }}
          >
            Zone
          </button>
          <button type="button" className="sc-btn" title="Texte libre (une ligne, largeur au contenu)" onClick={() => engine.setText({ type: 'text' })}>
            Libre
          </button>
        </Row>
      </Card>

      <Card title="Typographie fine" icon={<Check size={12} />}>
        <SliderField label="Interlettrage" value={Math.round((props.charSpacing || 0) / 10)} min={-5} max={60} onChange={(charSpacing) => update({ charSpacing: charSpacing * 10 })} onCommit={(charSpacing) => update({ charSpacing: charSpacing * 10 })} unit="px" />
        <SliderField label="Interligne" value={props.lineHeight || 1.16} min={0.6} max={3} step={0.02} onChange={(lineHeight) => update({ lineHeight })} onCommit={(lineHeight) => update({ lineHeight })} />
        {props.text !== undefined ? <SliderField label="Largeur de zone" value={props.width} min={40} max={4000} onChange={(width) => engine.update({ scaleX: width / (props.width || 1) })} onCommit={(width) => engine.update({ scaleX: width / (props.width || 1) }, 'largeur')} unit="px" /> : null}
      </Card>

      <Card title="Texte courbe" icon={<Shapes size={12} />}>
        <Toggle
          label="Incurver le texte"
          checked={!!props.curve?.enabled}
          onChange={(enabled) =>
            void engine.setCurve({
              enabled,
              radius: props.curve?.radius,
              offset: props.curve?.offset,
              side: props.curve?.side || 'left',
              align: props.curve?.align || 'center',
            })
          }
        />
        {props.curve?.enabled ? (
          <>
            <SliderField label="Rayon" value={props.curve.radius} min={40} max={1600} onChange={(radius) => void engine.setCurve({ enabled: true, radius, offset: props.curve?.offset, side: props.curve?.side, align: props.curve?.align })} onCommit={(radius) => void engine.setCurve({ enabled: true, radius, offset: props.curve?.offset, side: props.curve?.side, align: props.curve?.align })} unit="px" />
            <SliderField label="Position sur la courbe" value={props.curve.offset} min={-400} max={400} onChange={(offset) => void engine.setCurve({ enabled: true, offset, radius: props.curve?.radius, side: props.curve?.side, align: props.curve?.align })} onCommit={(offset) => void engine.setCurve({ enabled: true, offset, radius: props.curve?.radius, side: props.curve?.side, align: props.curve?.align })} unit="px" />
            <Row>
              <Field label="Côté">
                <Segmented
                  value={props.curve.side}
                  onChange={(side) => void engine.setCurve({ enabled: true, side, radius: props.curve?.radius, offset: props.curve?.offset, align: props.curve?.align })}
                  options={[
                    { value: 'left', label: 'dessus' },
                    { value: 'right', label: 'dessous' },
                  ]}
                />
              </Field>
              <Field label="Ancrage">
                <Segmented
                  value={props.curve.align}
                  onChange={(align) => void engine.setCurve({ enabled: true, align, radius: props.curve?.radius, offset: props.curve?.offset, side: props.curve?.side })}
                  options={[
                    { value: 'start', label: 'début' },
                    { value: 'center', label: 'milieu' },
                    { value: 'end', label: 'fin' },
                  ]}
                />
              </Field>
            </Row>
          </>
        ) : (
          <p style={{ color: '#64748b', margin: 0, fontSize: 11, lineHeight: 1.5 }}>
            {'L’arc est recalculé sur la longueur réelle du texte. L’export PNG reste fidèle ; l’export SVG signale ce texte comme non vectoriel, car Fabric n’écrit pas un « textPath » tout seul.'}
          </p>
        )}
      </Card>
    </>
  );
}

const MASKS: { value: 'none' | 'rect' | 'circle' | 'ellipse' | 'triangle' | 'hexagon' | 'star'; label: string }[] = [
  { value: 'none', label: 'aucune' },
  { value: 'rect', label: 'carré' },
  { value: 'circle', label: 'cercle' },
  { value: 'ellipse', label: 'ovale' },
  { value: 'triangle', label: 'triangle' },
  { value: 'hexagon', label: 'hexagone' },
  { value: 'star', label: 'étoile' },
];

export function ImagePanel({ engine, props, onPick }: { engine: Engine; props: ObjectProps; onPick: () => void }) {
  const [crop, setCrop] = useState({ width: 60, height: 60 });
  const [busy, setBusy] = useState(false);
  const filters = props.filters || {};
  const FILTERS: { name: string; label: string; min: number; max: number }[] = [
    { name: 'brightness', label: 'Luminosité', min: -100, max: 100 },
    { name: 'contrast', label: 'Contraste', min: -100, max: 100 },
    { name: 'saturation', label: 'Saturation', min: -100, max: 100 },
    { name: 'grayscale', label: 'Noir & blanc', min: 0, max: 100 },
    { name: 'blur', label: 'Flou', min: 0, max: 40 },
    { name: 'sepia', label: 'Sépia', min: 0, max: 100 },
    { name: 'invert', label: 'Inverser', min: 0, max: 100 },
    { name: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
    { name: 'pixelate', label: 'Pixelisation', min: 0, max: 40 },
    { name: 'noise', label: 'Grain', min: 0, max: 100 },
  ];

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="Source" icon={<Crop size={12} />}>
        <p style={{ margin: 0, color: '#93a1b8', wordBreak: 'break-all', fontSize: 11 }}>{props.src ? `${(props.src || '').slice(0, 84)}${(props.src || '').length > 84 ? '…' : ''}` : 'objet sans source'}</p>
        <Row>
          <button type="button" className="sc-btn" onClick={onPick} disabled={busy}>
            Remplacer par une image de la GED
          </button>
        </Row>
        <Row>
          <Field label="Zone visible">
            <div className="sc-row" style={{ gap: 4 }}>
              <NumberField label="" value={crop.width} min={4} max={400} onChange={(width) => setCrop((value) => ({ ...value, width }))} />
              <span style={{ color: '#64748b' }}>× </span>
              <NumberField label="" value={crop.height} min={4} max={400} onChange={(height) => setCrop((value) => ({ ...value, height }))} />
              <span style={{ color: '#64748b' }}>%</span>
            </div>
          </Field>
        </Row>
        <Row>
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            disabled={busy}
            title="Recadrer : le PNG écrit ne pèsera plus que la zone visible"
            onClick={() =>
              void run(async () => {
                const wide = Math.max(1, Math.round((props.width * crop.width) / 100));
                const high = Math.max(1, Math.round((props.height * crop.height) / 100));
                await engine.bakeCrop({
                  left: Math.round((props.width - wide) / 2),
                  top: Math.round((props.height - high) / 2),
                  width: wide,
                  height: high,
                });
              })
            }
          >
            <Scissors size={13} /> Recadrer le centre
          </button>
          <button type="button" className="sc-btn" disabled={busy} title="Rendre le fond blanc/translucide transparent" onClick={() => void run(() => engine.extractBackground(28))}>
            <Wand2 size={13} /> Détourer
          </button>
        </Row>
      </Card>

      <Card title="Masque de forme" icon={<Shapes size={12} />}>
        <select
          className="sc-select"
          value={props.clipShape && MASKS.some((mask) => mask.label === props.clipShape || mask.value === props.clipShape) ? props.clipShape : 'none'}
          onChange={(event) => engine.setMask(event.target.value as (typeof MASKS)[number]['value'])}
        >
          {MASKS.map((mask) => (
            <option key={mask.value} value={mask.value === 'none' ? 'none' : mask.label}>
              {mask.label}
            </option>
          ))}
        </select>
      </Card>

      <Card title="Retouche" icon={<Wand2 size={12} />}>
        {FILTERS.map((filter) => (
          <SliderField
            key={filter.name}
            label={filter.label}
            value={Math.round(filters[filter.name] || 0)}
            min={filter.min}
            max={filter.max}
            onChange={(value) => void engine.applyFilter(filter.name, value)}
            onCommit={(value) => void engine.applyFilter(filter.name, value)}
          />
        ))}
        <Row>
          <button type="button" className="sc-btn" onClick={() => engine.resetFilters()}>
            Réinitialiser les filtres
          </button>
        </Row>
      </Card>
    </>
  );
}

const CHART_TYPES: { value: ChartSpec['type']; label: string }[] = [
  { value: 'bar', label: 'Barres' },
  { value: 'line', label: 'Courbe' },
  { value: 'pie', label: 'Anneau' },
];

export function ChartPanel({ engine, props }: { engine: Engine; props: ObjectProps | null }) {
  const [spec, setSpec] = useState<ChartSpec>({ type: 'bar', series: [{ label: 'Janvier', value: 18 }, { label: 'Février', value: 27 }, { label: 'Mars', value: 41 }], title: 'Trafic', palette: 'lime', showGrid: true, strokeWidth: 3 });
  const [raw, setRaw] = useState('Janvier 18\nFévrier 27\nMars 41');
  const isChart = props ? /chart|graph/i.test(`${props.id} ${props.name}`) : false;

  const create = async (mode: 'objects' | 'image') => {
    const parsed = parseChartData(raw);
    const next: ChartSpec = { ...spec, series: parsed.length ? parsed : spec.series };
    if (isChart && props) {
      await engine.remove();
    }
    await engine.addChart(next, mode);
  };

  return (
    <Card title="Graphique" icon={<MoveHorizontal size={12} />}>
      <Segmented value={spec.type} onChange={(type) => setSpec((value) => ({ ...value, type }))} options={CHART_TYPES} />
      <Field label="Données — une ligne par valeur, « libellé 12 » ou « libellé, 12 »">
        <textarea className="sc-textarea" value={raw} onChange={(event) => setRaw(event.target.value)} spellCheck={false} />
      </Field>
      <Row>
        <TextField label="Titre" value={spec.title || ''} onChange={(title) => setSpec((value) => ({ ...value, title }))} />
      </Row>
      <Row>
        <Field label="Palette">
          <Segmented
            value={spec.palette || 'lime'}
            onChange={(palette) => setSpec((value) => ({ ...value, palette }))}
            options={[
              { value: 'lime', label: 'lime' },
              { value: 'ocean', label: 'ocean' },
              { value: 'sunset', label: 'sunset' },
              { value: 'ink', label: 'ink' },
            ]}
          />
        </Field>
      </Row>
      <Toggle label="Grille" checked={!!spec.showGrid} onChange={(showGrid) => setSpec((value) => ({ ...value, showGrid }))} />
      <Row>
        <button type="button" className="sc-btn sc-btn--primary" onClick={() => void create('objects')}>
          Insérer en objets éditables
        </button>
        <button type="button" className="sc-btn" title="Une seule image : plus léger, mais non vectoriel" onClick={() => void create('image')}>
          En image
        </button>
      </Row>
      <p style={{ color: '#64748b', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        {' '}
        Le graphique est construit en SVG puis transformé en objets Fabric : chaque barre, chaque segment et l’anneau restent sélectionnables,
        repolissables et alignables comme n’importe quel calque.
      </p>
    </Card>
  );
}

export function PathPanel({ engine, count }: { engine: Engine; count: number }) {
  return (
    <Card title="Points d’ancrage" icon={<Scissors size={12} />}>
      <p style={{ margin: 0, color: '#93a1b8', lineHeight: 1.5 }}>
        {count ? `${count} points. Glissez un point pour déformer la forme.` : 'Sélectionnez un tracé puis activez le mode points.'}
      </p>
      <Row wrap>
        <button type="button" className="sc-btn" onClick={() => engine.beginPathEdit()}>
          Modifier les points
        </button>
        <button type="button" className="sc-btn" disabled={!count} onClick={() => engine.endPathEdit()}>
          Terminer
        </button>
        <button type="button" className="sc-btn" disabled={!count} onClick={() => engine.insertAnchor(Math.max(0, count - 1))}>
          Ajouter un point
        </button>
        <button type="button" className="sc-btn sc-btn--danger" disabled={!count} onClick={() => engine.removeAnchor(count - 1)}>
          Retirer le dernier
        </button>
      </Row>
    </Card>
  );
}

export function LayerPanel({ engine, layers }: { engine: Engine; layers: LayerInfo[] }) {
  // La liste est VISUELLE (du haut vers le bas) ; `index` reste l'index du canvas.
  const ordered = useMemo(() => [...layers].reverse(), [layers]);
  const lockedCount = layers.filter((layer) => layer.locked).length;
  return (
    <Card
      title={`Calques (${layers.length})`}
      icon={<Layers size={12} />}
      // Un calque verrouillé ne se saisit plus du tout — et un gabarit en porte souvent
      // un (le fond, les cartouches). Sans issue visible, l'utilisateur conclut « rien
      // n'est déplaçable » ; ce bouton est le rattrapage, et il ne s'affiche que si utile.
      actions={
        lockedCount ? (
          <button type="button" className="sc-btn sc-btn--sm" title={`${lockedCount} calque(s) figé(s)`} onClick={() => engine.setLockedAll(false)}>
            Tout déverrouiller
          </button>
        ) : undefined
      }
    >
      <div className="sc-layers">
        {ordered.map((layer) => (
          <div key={`${layer.index}-${layer.id}`} className={`sc-layer${layer.selected ? ' sc-layer--on' : ''}`} role="button" tabIndex={0} aria-current={layer.selected} onClick={() => engine.selectIndex(layer.index)} onKeyDown={(event) => event.key === 'Enter' && engine.selectIndex(layer.index)}>
            <span className="sc-layer__kind">{layer.type.replace(/^sari-/, '')}</span>
            <span className="sc-layer__name">{layer.name}</span>
            <button
              type="button"
              title={layer.visible ? 'Masquer' : 'Afficher'}
              onClick={(event) => {
                event.stopPropagation();
                engine.selectIndex(layer.index);
                engine.setVisible(!layer.visible);
              }}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              title={layer.locked ? 'Déverrouiller' : 'Verrouiller'}
              onClick={(event) => {
                event.stopPropagation();
                engine.setLocked(!layer.locked);
              }}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        ))}
        {!layers.length ? <div className="sc-empty">Planche vide.</div> : null}
      </div>
    </Card>
  );
}

export function BackgroundPanel({ engine, background }: { engine: Engine; background: BackgroundSpec }) {
  const [mode, setMode] = useState(background.mode);
  const gradient = background.mode === 'gradient' ? background.gradient : { type: 'linear' as const, angle: 135, stops: [{ offset: 0, color: '#0f172a' }, { offset: 100, color: '#334155' }] };
  return (
    <>
      <Card title="Plan de travail" icon={<Palette size={12} />}>
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next);
            if (next === 'solid') void engine.setBackground({ mode: 'solid', color: background.mode === 'solid' ? background.color : '#ffffff' });
            if (next === 'gradient') void engine.setBackground({ mode: 'gradient', gradient });
            if (next === 'image' && background.mode === 'image') void engine.setBackground({ mode: 'image', src: background.src, fit: background.fit });
          }}
          options={[
            { value: 'solid', label: 'Uni' },
            { value: 'gradient', label: 'Dégradé' },
            { value: 'image', label: 'Image' },
          ]}
        />
        {mode === 'solid' && background.mode === 'solid' ? <ColorField label="Fond" value={background.color} onChange={(color) => void engine.setBackground({ mode: 'solid', color })} onCommit={(color) => void engine.setBackground({ mode: 'solid', color })} /> : null}
        {mode === 'gradient' ? <GradientEditor gradient={gradient} onChange={(next) => void engine.setBackground({ mode: 'gradient', gradient: next })} label="Fond dégradé" /> : null}
        {mode === 'image' ? (
          <>
            <Row>
              <SelectField
                value={background.mode === 'image' ? background.fit : 'cover'}
                options={[
                  { value: 'cover', label: 'Couvrir' },
                  { value: 'contain', label: 'Contenir' },
                  { value: 'stretch', label: 'Étirer' },
                ]}
                onChange={(fit) => void engine.setBackground({ ...(background.mode === 'image' ? background : { mode: 'solid', color: '#fff' }), mode: 'image', src: background.mode === 'image' ? background.src : '', fit: fit as 'cover' | 'contain' | 'stretch' } as BackgroundSpec)}
              />
            </Row>
            {background.mode !== 'image' || !background.src ? <p style={{ color: '#93a1b8', margin: 0 }}>Choisissez une image dans le panneau GED pour la poser en fond.</p> : null}
          </>
        ) : null}
      </Card>

      <Card title="Format" icon={<AlignEndVertical size={12} />}>
        <Row wrap>
          {ARTBOARDS.slice(0, 10).map((artboard) => (
            <button key={artboard.id} type="button" className="sc-btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => engine.setArtboard(artboard.width, artboard.height)} title={`${artboard.width}×${artboard.height}`}>
              {artboard.label}
            </button>
          ))}
        </Row>
        <Row>
          <Field label="Largeur">
            <NumberField
              label=""
              value={engine.getArtboard().width}
              min={64}
              max={6000}
              onChange={(width) => engine.setArtboard(sanitizeSide(width), engine.getArtboard().height)}
            />
          </Field>
          <Field label="Hauteur">
            <NumberField
              label=""
              value={engine.getArtboard().height}
              min={64}
              max={6000}
              onChange={(height) => engine.setArtboard(engine.getArtboard().width, sanitizeSide(height))}
            />
          </Field>
        </Row>
      </Card>
    </>
  );
}
