'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { X } from 'lucide-react';

export default function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const locale = useLocale();
  const rtl = locale === 'ar';
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const [w, setW] = useState(width);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
    } else if (shown) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setShown(false);
        setClosing(false);
      }, 260);
      return () => window.clearTimeout(t);
    }
  }, [open, shown]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const next = rtl ? window.innerWidth - ev.clientX : ev.clientX;
      setW(Math.min(Math.max(next, 320), Math.round(window.innerWidth * 0.92)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, onClose]);

  if (!shown) return null;

  return (
    <div className={`ad-drawer ${closing ? 'is-closing' : ''} ${rtl ? 'is-rtl' : ''}`} onClick={onClose}>
      <aside
        className="ad-drawer-panel"
        style={{ width: `min(${w}px, 100%)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ad-drawer-handle"
          onPointerDown={startDrag}
          onClick={onClose}
          title="Glisser pour redimensionner · cliquer pour fermer"
          aria-label="Glisser pour redimensionner ou fermer"
        />
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-black tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>{subtitle}</p>}
          </div>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onClose} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-auto ad-scroll space-y-3 pb-4">{children}</div>
        {footer && <footer className="ad-drawer-actions">{footer}</footer>}
      </aside>
    </div>
  );
}
