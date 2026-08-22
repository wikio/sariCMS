'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check, Crop, Eraser, FlipHorizontal, FlipVertical, ImagePlus, Loader,
  Maximize, Pencil, Redo2, RotateCcw, RotateCw, Save, SlidersHorizontal,
  Sparkles, Type, Undo2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

type Tool = 'draw' | 'erase' | 'text' | 'crop';

const PRESET_FILTERS: Array<{ key: string; label: string; filter: string }> = [
  { key: 'grayscale', label: 'N&B', filter: 'grayscale(1)' },
  { key: 'sepia', label: 'Sépia', filter: 'sepia(1)' },
  { key: 'invert', label: 'Inverser', filter: 'invert(1)' },
];

function loadImage(url: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image non chargeable'));
    img.src = url;
  });
}

export default function ImageEditor({
  src,
  onClose,
  onSaved,
}: {
  src: string;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [tainted, setTainted] = useState(false);
  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#e11d48');
  const [size, setSize] = useState(8);
  const [text, setText] = useState('');
  const [textPending, setTextPending] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ w: 800, h: 600 });
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [tolerance, setTolerance] = useState(40);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [busy, setBusy] = useState(false);

  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const cropStart = useRef<{ x: number; y: number } | null>(null);
  const cropSnapshot = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canvas = () => canvasRef.current as HTMLCanvasElement;
  const ctx = () => canvas().getContext('2d') as CanvasRenderingContext2D;

  const syncUndo = () => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  };

  /** Capture l'état courant dans l'historique. Retourne le dataURL capturé. */
  function snapshot(): string | null {
    try {
      const dataUrl = canvas().toDataURL();
      undoStack.current.push(dataUrl);
      if (undoStack.current.length > 30) undoStack.current.shift();
      redoStack.current = [];
      syncUndo();
      return dataUrl;
    } catch {
      return null;
    }
  }

  async function drawDataUrl(dataUrl: string) {
    const img = await loadImage(dataUrl, false);
    canvas().width = img.width;
    canvas().height = img.height;
    ctx().drawImage(img, 0, 0);
    setDims({ w: img.width, h: img.height });
  }

  function copyFrom(tmp: HTMLCanvasElement) {
    canvas().width = tmp.width;
    canvas().height = tmp.height;
    ctx().drawImage(tmp, 0, 0);
    setDims({ w: tmp.width, h: tmp.height });
  }

  function makeTemp(w: number, h: number) {
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    return { tmp, tctx: tmp.getContext('2d') as CanvasRenderingContext2D };
  }

  // -------------------------------------------------------------------------
  // Chargement initial
  // -------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const img = await loadImage(src);
        const W = Math.min(img.width || 1, 1600);
        const H = Math.max(1, Math.round((img.height || 1) * (W / (img.width || 1))));
        canvas().width = W;
        canvas().height = H;
        ctx().drawImage(img, 0, 0, W, H);
        setDims({ w: W, h: H });
        setFrame({ w: W, h: H });
        try {
          ctx().getImageData(0, 0, 1, 1);
        } catch {
          setTainted(true);
          showToast('Image distante protégée (CORS) : export désactivé', 'warning');
        }
        undoStack.current = [];
        redoStack.current = [];
        snapshot();
        setLoading(false);
      } catch {
        setLoading(false);
        showToast('Image non chargeable', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // -------------------------------------------------------------------------
  // Historique
  // -------------------------------------------------------------------------
  const undo = async () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    try {
      const current = canvas().toDataURL();
      redoStack.current.push(current);
    } catch {
      /* ignoré */
    }
    await drawDataUrl(prev);
    syncUndo();
  };

  const redo = async () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    try {
      undoStack.current.push(canvas().toDataURL());
    } catch {
      /* ignoré */
    }
    await drawDataUrl(next);
    syncUndo();
  };

  const reset = () => {
    const first = undoStack.current[0];
    if (!first) return;
    snapshot();
    drawDataUrl(first);
  };

  // -------------------------------------------------------------------------
  // Transformations
  // -------------------------------------------------------------------------
  const rotate = (dir: 1 | -1) => {
    snapshot();
    const c = canvas();
    const { tmp, tctx } = makeTemp(c.height, c.width);
    tctx.translate(tmp.width / 2, tmp.height / 2);
    tctx.rotate((dir * Math.PI) / 2);
    tctx.drawImage(c, -c.width / 2, -c.height / 2);
    copyFrom(tmp);
  };

  const flip = (axis: 'h' | 'v') => {
    snapshot();
    const c = canvas();
    const { tmp, tctx } = makeTemp(c.width, c.height);
    tctx.translate(axis === 'h' ? c.width : 0, axis === 'v' ? c.height : 0);
    tctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
    tctx.drawImage(c, 0, 0);
    copyFrom(tmp);
  };

  const applyFilter = (filter: string) => {
    snapshot();
    const c = canvas();
    const { tmp, tctx } = makeTemp(c.width, c.height);
    tctx.filter = filter;
    tctx.drawImage(c, 0, 0);
    copyFrom(tmp);
  };

  const applyFrame = () => {
    const W = Math.max(1, Math.round(frame.w) || 1);
    const H = Math.max(1, Math.round(frame.h) || 1);
    snapshot();
    const c = canvas();
    const { tmp, tctx } = makeTemp(W, H);
    const scale = fit === 'cover'
      ? Math.max(W / c.width, H / c.height)
      : Math.min(W / c.width, H / c.height);
    const dw = c.width * scale;
    const dh = c.height * scale;
    tctx.drawImage(c, (W - dw) / 2, (H - dh) / 2, dw, dh);
    copyFrom(tmp);
    showToast(`Cadre appliqué : ${W} × ${H}`, 'success');
  };

  const removeBackground = () => {
    snapshot();
    const c = canvas();
    const w = c.width;
    const h = c.height;
    const imageData = ctx().getImageData(0, 0, w, h);
    const d = imageData.data;
    const corners = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ].map(([x, y]) => {
      const i = (y * w + x) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    });
    const visited = new Uint8Array(w * h);
    const stack: number[] = [];
    const tol = tolerance * tolerance * 3;
    const match = (r: number, g: number, b: number) =>
      corners.some(([cr, cg, cb]) => {
        const dr = r - cr, dg = g - cg, db = b - cb;
        return dr * dr + dg * dg + db * db <= tol;
      });

    for (let y = 0; y < h; y++) {
      for (const x of [0, w - 1]) {
        const p = y * w + x;
        if (!visited[p] && match(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])) {
          visited[p] = 1;
          stack.push(p);
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (const y of [0, h - 1]) {
        const p = y * w + x;
        if (!visited[p] && match(d[p * 4], d[p * 4 + 1], d[p * 4 + 2])) {
          visited[p] = 1;
          stack.push(p);
        }
      }
    }

    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w;
      const y = Math.floor(p / w);
      d[p * 4 + 3] = 0;
      if (x > 0) {
        const n = p - 1;
        if (!visited[n] && match(d[n * 4], d[n * 4 + 1], d[n * 4 + 2])) { visited[n] = 1; stack.push(n); }
      }
      if (x < w - 1) {
        const n = p + 1;
        if (!visited[n] && match(d[n * 4], d[n * 4 + 1], d[n * 4 + 2])) { visited[n] = 1; stack.push(n); }
      }
      if (y > 0) {
        const n = p - w;
        if (!visited[n] && match(d[n * 4], d[n * 4 + 1], d[n * 4 + 2])) { visited[n] = 1; stack.push(n); }
      }
      if (y < h - 1) {
        const n = p + w;
        if (!visited[n] && match(d[n * 4], d[n * 4 + 1], d[n * 4 + 2])) { visited[n] = 1; stack.push(n); }
      }
    }
    ctx().putImageData(imageData, 0, 0);
  };

  const mergeImage = (file: File) => {
    const url = URL.createObjectURL(file);
    loadImage(url, false).then((img) => {
      snapshot();
      const c = canvas();
      const scale = Math.min(1, Math.min(c.width / img.width, c.height / img.height) * 0.8);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx().drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      URL.revokeObjectURL(url);
    });
  };

  // -------------------------------------------------------------------------
  // Pointeur (dessin / gomme / texte / crop)
  // -------------------------------------------------------------------------
  const toCanvas = (e: React.PointerEvent) => {
    const rect = canvas().getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas().width) / rect.width,
      y: ((e.clientY - rect.top) * canvas().height) / rect.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toCanvas(e);
    if (tool === 'text') {
      if (textPending && text.trim()) {
        snapshot();
        const g = ctx();
        g.save();
        g.fillStyle = color;
        g.font = `bold ${Math.max(18, size * 4)}px system-ui, sans-serif`;
        g.textBaseline = 'top';
        g.fillText(text, p.x, p.y);
        g.restore();
        setTextPending(false);
      }
      return;
    }
    if (tool === 'crop') {
      cropStart.current = p;
      cropSnapshot.current = snapshot();
      return;
    }
    drawing.current = true;
    snapshot();
    const g = ctx();
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = size;
    g.strokeStyle = tool === 'erase' ? 'rgba(0,0,0,1)' : color;
    g.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + 0.01, p.y + 0.01);
    g.stroke();
    g.restore();
    last.current = p;
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toCanvas(e);
    if (drawing.current && last.current) {
      const g = ctx();
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = size;
      g.strokeStyle = tool === 'erase' ? 'rgba(0,0,0,1)' : color;
      g.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
      g.beginPath();
      g.moveTo(last.current.x, last.current.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.restore();
      last.current = p;
      return;
    }
    if (cropStart.current && cropSnapshot.current) {
      drawDataUrl(cropSnapshot.current).then(() => {
        const s = cropStart.current as { x: number; y: number };
        const x = Math.min(s.x, p.x);
        const y = Math.min(s.y, p.y);
        const w = Math.abs(p.x - s.x);
        const h = Math.abs(p.y - s.y);
        const g = ctx();
        g.save();
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.setLineDash([6, 4]);
        g.strokeRect(x, y, w, h);
        g.restore();
      });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (drawing.current) {
      drawing.current = false;
      last.current = null;
      return;
    }
    if (cropStart.current && cropSnapshot.current) {
      const p = toCanvas(e);
      const s = cropStart.current;
      const x = Math.max(0, Math.min(s.x, p.x));
      const y = Math.max(0, Math.min(s.y, p.y));
      const w = Math.min(canvas().width - x, Math.abs(p.x - s.x));
      const h = Math.min(canvas().height - y, Math.abs(p.y - s.y));
      cropStart.current = null;
      if (w > 4 && h > 4) {
        loadImage(cropSnapshot.current, false).then((img) => {
          const { tmp, tctx } = makeTemp(Math.round(w), Math.round(h));
          tctx.drawImage(img, x, y, w, h, 0, 0, Math.round(w), Math.round(h));
          copyFrom(tmp);
        });
      }
    }
  };

  // -------------------------------------------------------------------------
  // Sauvegarde
  // -------------------------------------------------------------------------
  const save = async () => {
    setBusy(true);
    try {
      const dataUrl = canvas().toDataURL('image/png');
      const base = (src.split('/').pop() || 'image').replace(/\.[^.]+$/, '');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: `${base}-edite`, module: 'ged' }),
      });
      const json = await res.json();
      if (json.url) {
        showToast('Image enregistrée dans la GED', 'success');
        onSaved(json.url);
      } else {
        showToast(json.error || 'Sauvegarde impossible', 'error');
      }
    } catch {
      showToast('Sauvegarde impossible (image protégée ?)', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toolBtn = (t: Tool, Icon: typeof Pencil, label: string) => (
    <button
      type="button"
      title={label}
      onClick={() => setTool(t)}
      className={`ad-btn ad-btn-icon ${tool === t ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b0b0f] text-white">
      {/* Barre supérieure */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-wrap">
        <button type="button" className="ad-btn ad-btn-ghost !text-white" onClick={onClose}>
          <X className="w-4 h-4" /> Fermer
        </button>
        <div className="h-5 w-px bg-white/15" />
        <button type="button" className="ad-btn ad-btn-ghost !text-white" disabled={!canUndo} onClick={undo}>
          <Undo2 className="w-4 h-4" /> Annuler
        </button>
        <button type="button" className="ad-btn ad-btn-ghost !text-white" disabled={!canRedo} onClick={redo}>
          <Redo2 className="w-4 h-4" /> Rétablir
        </button>
        <button type="button" className="ad-btn ad-btn-ghost !text-white" onClick={reset}>
          <RotateCcw className="w-4 h-4" /> Réinitialiser
        </button>
        <div className="flex-1" />
        <span className="text-xs text-white/50 tabular-nums">{dims.w} × {dims.h} px</span>
        <button
          type="button"
          className="ad-btn ad-btn-primary"
          disabled={busy || tainted}
          onClick={save}
        >
          {busy ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Barre d'outils gauche */}
        <div className="w-14 border-r border-white/10 flex flex-col items-center gap-1 py-2 overflow-y-auto">
          {toolBtn('draw', Pencil, 'Dessiner')}
          {toolBtn('erase', Eraser, 'Gomme')}
          {toolBtn('text', Type, 'Texte')}
          {toolBtn('crop', Crop, 'Recadrer')}
          <div className="w-8 h-px bg-white/10 my-1" />
          <button type="button" title="Pivoter gauche" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => rotate(-1)}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" title="Pivoter droite" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => rotate(1)}>
            <RotateCw className="w-4 h-4" />
          </button>
          <button type="button" title="Retourner horizontalement" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => flip('h')}>
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button type="button" title="Retourner verticalement" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => flip('v')}>
            <FlipVertical className="w-4 h-4" />
          </button>
          <div className="w-8 h-px bg-white/10 my-1" />
          <button type="button" title="Importer une image (fusion)" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="w-4 h-4" />
          </button>
          <button type="button" title="Supprimer le fond" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={removeBackground}>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Zone canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-6" style={{ background: 'repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 0 0 / 24px 24px' }}>
          {loading ? (
            <Loader className="w-8 h-8 animate-spin text-white/40" />
          ) : (
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-sm touch-none"
              style={{ width: dims.w * zoom, height: dims.h * zoom, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            />
          )}
        </div>

        {/* Panneau réglages droit */}
        <div className="w-64 border-l border-white/10 p-3 space-y-3 overflow-y-auto text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Zoom affichage</div>
            <div className="flex items-center gap-1">
              <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}>
                <ZoomOut className="w-4 h-4" />
              </button>
              <button type="button" className="ad-btn ad-btn-ghost !text-white flex-1" onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>
                <ZoomIn className="w-4 h-4" />
              </button>
              <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost !text-white" onClick={() => setZoom(1)} title="Ajuster">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Outil actif</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <span className="w-16 text-white/60">Couleur</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-7 bg-transparent border border-white/20 rounded cursor-pointer" />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 text-white/60">Épaisseur</span>
                <input type="range" min={1} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} className="flex-1" />
                <span className="w-6 text-right tabular-nums">{size}</span>
              </label>
              {tool === 'text' && (
                <div className="space-y-2">
                  <input
                    className="ad-input !bg-white/5 !border-white/20 !text-white"
                    placeholder="Texte à insérer…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`ad-btn w-full ${textPending ? 'ad-btn-primary' : 'ad-btn-ghost !text-white'}`}
                    onClick={() => setTextPending((v) => !v)}
                  >
                    <Check className="w-4 h-4" /> {textPending ? 'Cliquez sur l’image pour placer' : 'Valider le texte'}
                  </button>
                </div>
              )}
              {tool === 'crop' && (
                <p className="text-[11px] text-white/50">Glissez sur l’image pour définir la zone à garder.</p>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Filtres
            </div>
            <div className="flex gap-1 flex-wrap">
              {PRESET_FILTERS.map((f) => (
                <button key={f.key} type="button" className="ad-btn ad-btn-ghost !text-white !px-2 !py-1 text-xs" onClick={() => applyFilter(f.filter)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="space-y-2 mt-2">
              {[
                { label: 'Luminosité', f: (v: number) => `brightness(${v}%)`, min: 20, max: 200, def: 100 },
                { label: 'Contraste', f: (v: number) => `contrast(${v}%)`, min: 20, max: 200, def: 100 },
                { label: 'Saturation', f: (v: number) => `saturate(${v}%)`, min: 0, max: 200, def: 100 },
                { label: 'Flou', f: (v: number) => `blur(${v}px)`, min: 0, max: 20, def: 0 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-20 text-white/60">{s.label}</span>
                  <input type="range" min={s.min} max={s.max} defaultValue={s.def} className="flex-1"
                    onPointerUp={(e) => applyFilter(s.f(Number((e.target as HTMLInputElement).value)))} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Fond transparent
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-16 text-white/60">Tolérance</span>
              <input type="range" min={1} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="flex-1" />
              <span className="w-6 text-right tabular-nums">{tolerance}</span>
            </div>
            <button type="button" className="ad-btn ad-btn-ghost !text-white w-full" onClick={removeBackground}>
              <Sparkles className="w-4 h-4" /> Supprimer le fond
            </button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Cadre / dimensions</div>
            <div className="flex items-center gap-2 mb-2">
              <input type="number" className="ad-input !bg-white/5 !border-white/20 !text-white" value={frame.w || ''} placeholder="Largeur" onChange={(e) => setFrame({ ...frame, w: Number(e.target.value) })} />
              <span className="text-white/40">×</span>
              <input type="number" className="ad-input !bg-white/5 !border-white/20 !text-white" value={frame.h || ''} placeholder="Hauteur" onChange={(e) => setFrame({ ...frame, h: Number(e.target.value) })} />
            </div>
            <div className="flex gap-1 mb-2">
              <button type="button" className={`ad-btn flex-1 text-xs ${fit === 'contain' ? 'ad-btn-primary' : 'ad-btn-ghost !text-white'}`} onClick={() => setFit('contain')}>
                Ajuster
              </button>
              <button type="button" className={`ad-btn flex-1 text-xs ${fit === 'cover' ? 'ad-btn-primary' : 'ad-btn-ghost !text-white'}`} onClick={() => setFit('cover')}>
                Remplir
              </button>
            </div>
            <button type="button" className="ad-btn ad-btn-ghost !text-white w-full" onClick={applyFrame}>
              Appliquer le cadre
            </button>
          </div>

          {tainted && (
            <p className="text-[11px] text-amber-400">Image distante sans autorisation CORS : les modifications ne peuvent pas être exportées.</p>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) mergeImage(f);
        e.target.value = '';
      }} />
    </div>
  );
}
